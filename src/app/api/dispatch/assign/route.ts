import { NextResponse } from 'next/server'

import { AssignmentError } from '@/lib/dispatch/assign'
import { createDispatch } from '@/lib/dispatch/store.server'
import { currentStaff } from '@/lib/dispatch/session.server'
import { db, normaliseCode } from '@/lib/orders/db'
import { config } from '@/lib/config'
import { sendEmail } from '@/lib/email/send'
import { customerMailbox } from '@/lib/email/address'
import { deliveryCode, riderDispatch } from '@/lib/email/templates'
import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * POST /api/dispatch/assign — hand an order to a rider.
 *
 * ── WHY THIS IS STAFF-ONLY AND UNCONDITIONALLY ─────────────────────────────
 * Every mutation here writes to `dispatch_events`, which is append-only. That
 * makes the ledger's integrity a function of who is allowed to write to it: one
 * unauthenticated path that can move a drop from ASSIGNED to anything is enough
 * for the whole audit trail to be worthless, because a trail that can be written
 * by anyone records nothing. So the identity check is a gate, not a nicety.
 *
 * ── ERRORS NEVER REACH THE OPERATOR VERBATIM ───────────────────────────────
 * `AssignmentError` messages ARE the operator-facing copy — they name the zone,
 * the band and what to do next, and they are written for a dispatcher standing
 * at a screen at 6pm. Everything else is logged and replaced with a generic
 * 500, for the reason AGENTS.md records: an `err.message` leak once reached a
 * customer as `relation "order_items" does not exist`.
 */

interface AssignBody {
  /**
   * The order's numeric id. Still supported, but `orderCode` is what callers
   * should send — see the note in the handler.
   */
  orderId?: string | number
  /**
   * `UPV-XXXXXXXX`. The PREFERRED identifier, because every human-facing surface
   * a dispatcher works from shows the code: the packing slip, the customer's
   * confirmation e-mail, the phone call they take about a late parcel. Asking for
   * a database id instead means the dispatcher reads a code off the slip and then
   * has to go and look up an id somewhere else — the kind of small friction that
   * turns into somebody assigning the wrong order.
   */
  orderCode?: string
  /** The routing engine's measured distance. See assign.ts on why this is required. */
  distanceKm?: number
  riderId?: string | number
}

/**
 * Read the body as JSON or as a form post.
 *
 * ── WHY, GIVEN THE CONSOLE SENDS JSON ────────────────────────────────────────
 *
 * Because `<form action="/api/dispatch/assign" method="post">` in `AssignButton`
 * posts `application/x-www-form-urlencoded` when JavaScript is unavailable, and
 * the no-JS path is the one nobody exercises until the day a phone on the packing
 * bench fails to hydrate.
 *
 * The rider sign-in form already needed this — its `End shift` control is a real
 * form post — and getting it wrong there meant a rider who signed out with JS
 * broken stayed signed in. Same class of failure, so same shape of fix.
 *
 * JSON first: `request.json()` on a urlencoded body throws predictably, and
 * swallowing that into `{}` is what makes the failure invisible. Both shapes are
 * genuinely tried before giving up.
 */
async function readBody(request: Request): Promise<AssignBody> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text())
    const km = form.get('distanceKm')
    const rider = form.get('riderId')
    return {
      orderCode: form.get('orderCode') ?? undefined,
      // A form always sends a string. `Number('')` is 0, which is a legitimate
      // distance and would silently assign a band-A drop to a blank field, so an
      // empty value is passed through as `undefined` and refused by the guard
      // below rather than becoming zero.
      distanceKm: km === null || km === '' ? undefined : Number(km),
      riderId: rider === null || rider === '' ? undefined : rider,
    }
  }

  return (await request.json().catch(() => ({}))) as AssignBody
}

export async function POST(request: Request): Promise<NextResponse> {
  const staff = await currentStaff()
  if (!staff) {
    return NextResponse.json(
      { message: 'Sign in to the ops console to assign a rider.' },
      { status: 401 },
    )
  }

  const body = await readBody(request)

  /*
   * Resolve the order from EITHER an id or a code.
   *
   * The id is still accepted so nothing that already sends one breaks, but the
   * code is the path a human takes, and the two are reconciled to a single
   * validated integer before anything else happens.
   *
   * Both forms are validated HERE rather than passed to Postgres. A bound
   * parameter stops injection but NOT a type error, and `WHERE id = 'abc'` raises
   * 22P02 from the driver — which surfaces as a 500 on a mistyped id.
   */
  let orderId: string
  const rawCode = String(body.orderCode ?? '')
    .trim()
    .toUpperCase()

  if (rawCode !== '') {
    // `normaliseCode` is the single definition of what an order code looks like
    // (it also strips the dashes a person might type from a packing slip), so the
    // route and the lookup page cannot disagree about which codes are real.
    const normalised = normaliseCode(rawCode)
    if (!normalised) {
      return NextResponse.json(
        { message: 'That does not look like an order code. It is on the confirmation message.' },
        { status: 400 },
      )
    }
    const found = await db().query<{ id: number }>(
      `SELECT "id" FROM "orders" WHERE "order_code" = $1`,
      [normalised],
    )
    const row = found.rows[0]
    if (!row) {
      return NextResponse.json(
        { message: `No order with the code ${normalised}.` },
        { status: 404 },
      )
    }
    orderId = String(row.id)
  } else {
    const candidate = String(body.orderId ?? '').trim()
    if (!/^\d+$/.test(candidate)) {
      return NextResponse.json({ message: 'Which order?' }, { status: 400 })
    }
    orderId = candidate
  }

  const distanceKm = Number(body.distanceKm)
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return NextResponse.json(
      {
        message:
          'Enter the drop distance in kilometres — the band and the rider pay both come from it.',
      },
      { status: 400 },
    )
  }

  const riderId = body.riderId != null ? String(body.riderId).trim() : undefined
  if (riderId != null && !/^\d+$/.test(riderId)) {
    return NextResponse.json({ message: 'That rider is not valid.' }, { status: 400 })
  }

  try {
    const assignment = await createDispatch({
      orderId: Number(orderId),
      distanceKm,
      forcedRiderId: riderId != null ? Number(riderId) : undefined,
      actorLabel: staff.email ?? `staff#${staff.id}`,
    })

    /*
     * ── TELL THE RIDER ──────────────────────────────────────────────────────
     *
     * An assignment a rider does not know about is an assignment that does not
     * happen. There is no push notification on a phone in a van, so this message
     * IS the notification: it has the address, the customer's number to call on
     * arrival, and the pay for the drop.
     *
     * The pay is in the body deliberately. `dispatches.payout_paise` is a
     * SNAPSHOT taken at assignment, and telling the rider what it is turns that
     * snapshot from an accounting record into something a person can check —
     * which is the cheapest possible way to find out whether the band table is
     * wrong before a rider has to complain.
     *
     * After the transaction, not awaited, never throwing. A dispatcher pressing
     * Assign should not wait on SMTP, and a mail outage must not turn a
     * successful assignment into an error the operator has to retry — which
     * would create a SECOND dispatch, or a support ticket about one that exists.
     */
    void notifyRider(assignment, Number(orderId)).catch((err: unknown) => {
      console.error('[dispatch/assign] rider notification failed:', err)
    })

    /*
     * ── THE PROOF-OF-DELIVERY CODE, TO THE CUSTOMER ──────────────────────────
     *
     * A delivery can only be closed on a code the CUSTOMER reads out. If that code
     * never reaches them, the drop cannot be closed, and the rider's choice is
     * between leaving the plant and pressing a button that the database refuses —
     * which is precisely the situation the control was designed to prevent, and
     * precisely the "marked delivered but not received" complaint that dominates
     * every competitor's reviews.
     *
     * It used to be queued into the `outbox` table and go nowhere, which in
     * production meant no delivery could ever be completed. The hashed column
     * stays the only durable copy; this sends the plaintext that was generated in
     * the transaction.
     *
     * Sent up front, when the rider is still at the depot, rather than at the
     * door — `createDispatch` says why: a customer holding the code while they
     * work through an area will actually read it out.
     */
    void notifyDeliveryCode(assignment, Number(orderId)).catch((err: unknown) => {
      console.error('[dispatch/assign] delivery-code notification failed:', err)
    })

    return NextResponse.json({
      ok: true,
      dispatchId: assignment.dispatchId,
      riderId: assignment.riderId,
      riderName: assignment.riderName,
      bandCode: assignment.bandCode,
      payoutPaise: assignment.payoutPaise,
      message: `${assignment.riderName} has it. Band ${assignment.bandCode}.`,
    })
  } catch (err) {
    // Business rules carry their own wording, and that wording is the copy the
    // operator should read.
    if (err instanceof AssignmentError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: 422 })
    }

    const raw = (err as { message?: string }).message ?? ''
    const isBusinessRule =
      raw.includes('already has a dispatch') ||
      raw.includes('does not exist') ||
      raw.includes('not active') ||
      raw.includes('does not deliver in this order') ||
      raw.includes('already holds') ||
      raw.includes('no longer configured')

    if (isBusinessRule) {
      return NextResponse.json({ message: raw }, { status: 422 })
    }

    console.error('[dispatch/assign] failed:', raw)
    return NextResponse.json(
      { message: 'Could not assign that drop. Nothing has changed — try again.' },
      { status: 500 },
    )
  }
}

/**
 * The dispatch message to a rider.
 *
 * Re-reads the order and the rider rather than threading them through
 * `createDispatch`'s return value: the assignment result carries ids and money,
 * not an address or a phone number, and a dispatcher notification that says
 * "go to the customer" is useless.
 */
async function notifyRider(
  assignment: {
    riderId: string | number
    riderName: string
    bandCode: string
    payoutPaise: number
  },
  orderId: number,
): Promise<void> {
  const { rows } = await db().query<{
    order_code: string
    customer_name: string
    customer_phone: string
    address_line1: string
    address_line2: string | null
    address_landmark: string | null
    address_city: string | null
    pincode: string
    rider_phone: string
  }>(
    `SELECT o."order_code", o."customer_name", o."customer_phone",
            o."address_line1", o."address_line2", o."address_landmark",
            o."address_city", o."pincode", r."phone" AS rider_phone
       FROM "orders" o
       JOIN "riders" r ON r."id" = $2
      WHERE o."id" = $1`,
    [orderId, Number(assignment.riderId)],
  )
  const row = rows[0]
  if (!row) return

  const base = config.server.url.replace(/\/$/, '')
  const template = riderDispatch({
    riderName: assignment.riderName,
    orderCode: row.order_code,
    customerName: row.customer_name,
    addressLines: [
      row.address_line1,
      row.address_line2,
      row.address_landmark,
      [row.address_city, row.pincode].filter(Boolean).join(' '),
    ].filter((l): l is string => Boolean(l && l.trim() !== '')),
    phone: row.customer_phone,
    payoutPaise: assignment.payoutPaise,
    bandLabel: assignment.bandCode,
    stopUrl: `${base}/rider`,
  })

  await sendEmail({
    kind: 'dispatch_rider',
    // Riders authenticate by phone too — there is no e-mail column on `riders`
    // and adding one that nobody fills in would be worse than not having it. So
    // the mailbox is the phone, which is also the channel their OTP arrives on.
    to: customerMailbox(assignment.riderName, row.rider_phone),
    toName: assignment.riderName,
    subject: template.subject,
    text: template.text,
    html: template.html,
    internal: true,
  })
}

/**
 * Send the customer the code that closes their delivery.
 *
 * Sent from the SAME message as the rider's dispatch notification conceptually,
 * but to the other party: the rider is told where to go, the customer is told
 * what to expect and what to say when it arrives.
 */
async function notifyDeliveryCode(
  assignment: {
    riderId: string | number
    riderName: string
    dispatchId: number
    deliveryOtp: string | null
  },
  orderId: number,
): Promise<void> {
  // No code means no customer phone on the order, which the capture path's CHECK
  // normally prevents. Nothing to send, and nothing to warn about.
  if (!assignment.deliveryOtp) return

  const settings = await loadBusinessSettings()
  const { rows } = await db().query<{
    order_code: string
    customer_name: string
    customer_phone: string
    address_line1: string
    address_city: string | null
    pincode: string
  }>(
    `SELECT "order_code", "customer_name", "customer_phone",
            "address_line1", "address_city", "pincode"
       FROM "orders" WHERE "id" = $1`,
    [orderId],
  )
  const row = rows[0]
  if (!row) return

  const template = deliveryCode({
    orderCode: row.order_code,
    customerName: row.customer_name,
    code: assignment.deliveryOtp,
    riderName: assignment.riderName,
    address: [row.address_line1, row.address_city, row.pincode].filter(Boolean).join(', '),
    supportPhone: settings.customerCarePhone || 'our published number',
  })

  await sendEmail({
    // NOT `dispatch_rider`. See the EmailKind note in `lib/email/send.ts`: this is
    // the customer's credential, not an internal brief, and logging it under the
    // same kind made the two indistinguishable on the one screen an owner uses to
    // answer "did they get it?".
    kind: 'delivery_code_reissue',
    to: customerMailbox(row.customer_name, row.customer_phone),
    toName: row.customer_name,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}
