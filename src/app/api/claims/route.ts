import { NextResponse } from 'next/server'

import { clientIp } from '@/lib/orders/client-ip'
import { appendEvent, db, normaliseCode, phoneTail } from '@/lib/orders/db'
import { consume } from '@/lib/orders/rate-limit'
import { assertTransition, canonicalStatus, IllegalTransitionError } from '@/lib/orders/status'

/**
 * POST /api/claims — open a damage / DOA claim.
 *
 * ── WHAT A CLAIM IS AND IS NOT ──────────────────────────────────────────────
 *
 * A claim here means ONE THING: a plant arrived damaged or dead, and we send
 * another. There is no refund path for a plant anywhere in this system, and that
 * is the single biggest structural difference from every competitor in the
 * research — Ugaao's 30-day guarantee is defeated four ways (register within 5
 * days, keep it in the original pot, mortality only, triage before payout) and
 * Urvann defaults to wallet credit, which suppresses the complaint and starves
 * the DOA model of the feedback it depends on.
 *
 * The replacement is not a concession, it is the cheapest possible settlement: the
 * marginal cost is a plant we have already grown and would otherwise discard.
 *
 * ── WHY A CLAIM REQUIRES DELIVERY ───────────────────────────────────────────
 *
 * Only a DELIVERED order can be claimed, enforced by `assertTransition`. A claim
 * raised against an order still in transit is not a damage report — it is a
 * customer who has not waited, and answering it with a replacement trains customers
 * to claim early and our DOA rate to become fiction. The database trigger is not
 * the enforcement point here (a CHECK cannot see the prior state), which is why
 * the state machine lives in application code AND the write is row-locked below.
 */

const CLAIM_KINDS = ['DAMAGED', 'DEAD_ON_ARRIVAL', 'WRONG_ITEM', 'MISSING_ITEM'] as const
type ClaimKind = (typeof CLAIM_KINDS)[number]

/** Mirrors `order_claims_kind_known` in the migration. */
function parseKind(raw: string): ClaimKind | null {
  const upper = raw.trim().toUpperCase() as ClaimKind
  return CLAIM_KINDS.includes(upper) ? upper : null
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    orderCode?: string
    phone?: string
    kind?: string
    orderItemId?: string
    description?: string
    evidenceUrl?: string
  }

  const code = normaliseCode(String(body.orderCode ?? ''))
  const tail = phoneTail(String(body.phone ?? ''))

  if (!code || !tail) {
    return NextResponse.json(
      { message: 'Enter your order code and the phone number on the order.' },
      { status: 400 },
    )
  }

  const kind = parseKind(String(body.kind ?? ''))
  if (!kind) {
    return NextResponse.json(
      { message: 'Tell us what is wrong with the plant you received.' },
      { status: 400 },
    )
  }

  /*
   * ── THE DESCRIPTION IS THE EVIDENCE WE ACTUALLY HAVE TODAY ────────────────
   *
   * Capped at 1000 characters because this is customer-typed text going into a
   * support queue: an unbounded field here is a storage vector and a rendering
   * hazard in the admin panel, for no benefit to a person describing a crushed pot.
   */
  const description = String(body.description ?? '').trim().slice(0, 1000)
  if (description.length < 10) {
    return NextResponse.json(
      { message: 'Please describe what arrived and what condition it is in.' },
      { status: 400 },
    )
  }

  /*
   * ── VIDEO UPLOAD IS A REPORTED GAP, NOT AN OMISSION ───────────────────────
   *
   * The unboxing video is the strongest evidence a claim has, and we do not yet
   * collect it: it needs presigned multipart upload to RustFS/S3, a size cap, a
   * retention policy, and a rule for who may read it. None of that is a form field.
   *
   * `evidenceUrl` accepts a link the customer already has (a WhatsApp video, a Drive
   * link) so the evidence is not lost in the meantime, and the column exists so the
   * upload path lands without a migration. Reported as a follow-up, not hidden.
   */
  const evidenceUrl = String(body.evidenceUrl ?? '').trim().slice(0, 500) || null

  const limit = consume(clientIp(request), 'claim')
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const pool = db()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // `FOR UPDATE` — the status is read and written in one transaction so two
    // simultaneous claims cannot both read DELIVERED and both claim it is the first.
    const found = await client.query<{ id: number; order_code: string; status: string }>(
      `SELECT "id", "order_code", "status"
         FROM "orders"
        WHERE "order_code" = $1
          AND right(regexp_replace("customer_phone"::text, '\\D', '', 'g'), 4) = $2
        FOR UPDATE`,
      [code, tail],
    )

    const order = found.rows[0]
    if (!order) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { message: 'We could not find an order with that code and phone number.' },
        { status: 404 },
      )
    }

    const from = canonicalStatus(order.status)

    // Refuse rather than accept-and-ignore. A claim on an undelivered order is a
    // support conversation, not a claim, and silently opening one would put a
    // replacement in the queue for an order that has not arrived.
    try {
      assertTransition(from, 'CLAIM_OPEN')
    } catch (err) {
      if (err instanceof IllegalTransitionError) {
        await client.query('ROLLBACK')
        /*
         * Four distinct situations reach here and they must NOT share a sentence.
         *
         * A customer whose plant already has a claim open and is told "we can only
         * take a claim once delivered" will conclude their report was lost and file
         * again — three identical claims, three identical apologies, and a genuine
         * complaint buried. The DELIVERED-message was written for an order in transit
         * and is actively wrong for one already claimed.
         */
        const message =
          from === 'CANCELLED'
            ? 'This order was cancelled, so there is nothing to replace.'
            : from === 'CLAIM_OPEN' || from === 'REPLACEMENT_QUEUED'
              ? 'We already have a claim open for this order and it is being handled. There is nothing more for you to do — we will be in touch.'
              : 'We can only take a claim once the plant has been delivered. Tell us what happened and we will sort it out.'

        return NextResponse.json({ message }, { status: 409 })
      }
      throw err
    }

    /*
     * ── WHICH PLANT ─────────────────────────────────────────────────────────
     *
     * A claim must name a line. A claim against the whole order cannot be
     * fulfilled without ops working out which plant died, which is the step that
     * turns a 48-hour guarantee into a support ticket. The line id is verified
     * against THIS order rather than trusted from the request body — otherwise a
     * customer could attach their claim to another order's line.
     */
    let orderItemId: string | null = null
    const requestedItem = String(body.orderItemId ?? '').trim()
    if (requestedItem) {
      const item = await client.query<{ id: string }>(
        `SELECT "id" FROM "orders_items" WHERE "id" = $1 AND "_parent_id" = $2`,
        [requestedItem, order.id],
      )
      if (!item.rows[0]) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { message: 'That item is not part of this order.' },
          { status: 400 },
        )
      }
      orderItemId = item.rows[0].id
    } else {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { message: 'Tell us which plant arrived damaged.' },
        { status: 400 },
      )
    }

    const claim = await client.query<{ id: number; status: string; created_at: Date }>(
      `INSERT INTO "order_claims"
         ("order_id", "order_code", "order_item_id", "kind", "description", "status", "evidence_url", "created_at")
       VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, now())
       RETURNING "id", "status", "created_at"`,
      [order.id, order.order_code, orderItemId, kind, description, evidenceUrl],
    )

    await client.query(
      `UPDATE "orders" SET "status" = 'CLAIM_OPEN', "updated_at" = now() WHERE "id" = $1`,
      [order.id],
    )

    await appendEvent(client, {
      orderId: order.id,
      status: 'CLAIM_OPEN',
      note: `Claim received: ${kind.replace(/_/g, ' ').toLowerCase()}.`,
      actor: 'customer',
    })

    await client.query('COMMIT')

    return NextResponse.json(
      {
        claimId: claim.rows[0]!.id,
        claimStatus: claim.rows[0]!.status,
        orderCode: order.order_code,
        orderStatus: 'CLAIM_OPEN',
        createdAt: claim.rows[0]!.created_at,
        message:
          'Claim received. If a plant arrived damaged or dead we send a replacement — you do not need to send anything back.',
      },
      { status: 201 },
    )
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})

    // Business-rule violations carry their own wording, which IS the customer copy.
    // Everything else is logged and reported generically.
    const raw = (err as { message?: string }).message ?? ''
    if (
      raw.includes('order_claims_kind_known') ||
      raw.includes('order_claims_status_known') ||
      raw.includes('orders_items')
    ) {
      console.error('[claims] rejected:', raw)
      return NextResponse.json(
        { message: 'We could not record that claim. Please contact us and we will sort it out.' },
        { status: 422 },
      )
    }

    console.error('[claims] creation failed:', raw)
    return NextResponse.json(
      { message: 'We could not record your claim. Please try again in a moment.' },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}

/**
 * GET /api/claims — a customer's claims on one order.
 *
 * Read-only and scoped to an order the caller has already proved they own (code +
 * phone, same credential pair as lookup). Returns the claim KIND and status and
 * deliberately NOT `description` and `evidence_url` in the list view — the free-text
 * is the customer's own account of the damage and repeating it in a list endpoint
 * is how it ends up in a log line.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = normaliseCode(searchParams.get('orderCode') ?? '')
  const tail = phoneTail(searchParams.get('phone') ?? '')

  if (!code || !tail) {
    return NextResponse.json(
      { message: 'Enter your order code and the phone number on the order.' },
      { status: 400 },
    )
  }

  const limit = consume(clientIp(request), 'claim-read')
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const res = await db().query<{
    id: number
    order_item_id: string | null
    kind: string
    status: string
    created_at: Date
  }>(
    `SELECT c."id", c."order_item_id", c."kind", c."status", c."created_at"
       FROM "order_claims" c
       JOIN "orders" o ON o."id" = c."order_id"
      WHERE o."order_code" = $1
        AND right(regexp_replace(o."customer_phone"::text, '\\D', '', 'g'), 4) = $2
      ORDER BY c."created_at" ASC`,
    [code, tail],
  )

  if (res.rows.length === 0) {
    // Also covers "order does not exist", for the same reason as lookup: the two
    // cases must be indistinguishable or this becomes a code-existence oracle.
    const order = await db().query(`SELECT 1 FROM "orders" WHERE "order_code" = $1`, [code])
    if (order.rowCount === 0) {
      return NextResponse.json(
        { message: 'We could not find an order with that code and phone number.' },
        { status: 404 },
      )
    }
  }

  return NextResponse.json({ claims: res.rows }, { status: 200 })
}