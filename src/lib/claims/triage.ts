import 'server-only'

import { PoolClient } from 'pg'

import { getPool } from '@/lib/db/pool'
import {
  ORDER_STATUSES,
  assertTransition,
  canonicalStatus,
  nextStatuses,
  type OrderStatus,
} from '@/lib/orders/status'
import { config } from '@/lib/config'
import { loadBusinessSettings } from '@/lib/settings/server'
import { sendEmail } from '@/lib/email/send'
import { customerMailbox } from '@/lib/email/address'
import { decisionNotice } from '@/lib/email/templates'
import { guaranteeTerms } from '@/lib/commerce/guarantee'

/**
 * Claim triage — the half of the claim flow that did not exist.
 *
 * ── THE BUG, IN ONE SENTENCE ────────────────────────────────────────────────
 *
 * A customer could open a claim and nothing could ever close it.
 *
 * `POST /api/claims` inserted `order_claims` with `status = 'OPEN'` and set
 * `orders.status = 'CLAIM_OPEN'`. No file in the repository ever wrote
 * `order_claims.status` again. The CHECK allows four values
 * (`OPEN | ACCEPTED | REPLACEMENT_QUEUED | REJECTED`); only the first was
 * reachable, and `order_claims` is a raw table with no Payload collection and no
 * admin screen, so there was nowhere to reach it from.
 *
 * The knock-on effect is worse than a stuck record. `assertTransition` allows
 * `CLAIM_OPEN → REPLACEMENT_QUEUED | DELIVERED` and nothing else, so:
 *
 *   · the order was pinned at `CLAIM_OPEN` FOREVER,
 *   · a second claim returned 409 — "we already have a claim open and it is
 *     being handled" — for a claim that was not being handled by anyone,
 *   · the replacement work order could not be raised through the system, because
 *     the system has no way to raise one.
 *
 * A customer whose plant genuinely died could not get a replacement, and the way
 * this is usually discovered is by the guarantee expiring.
 *
 * ── WHY TRIAGE IS A DECISION AND NOT A BUTTON ────────────────────────────────
 *
 * Because "accept", "reject" and "queue a replacement" are different commercial
 * answers with different consequences, and each one changes what the customer is
 * told:
 *
 *   ACCEPTED             — we agree. A replacement is owed.
 *   REPLACEMENT_QUEUED   — the replacement is actually going out, and the order
 *                          returns to `DELIVERED` afterwards so the second
 *                          replacement (if the first also fails) is claimable.
 *   REJECTED             — we do not agree, and the customer is told why, in
 *                          writing, with the reason stored.
 *
 * `REJECTED` is deliberately NOT wired to a bare "reject" link. It is the one
 * outcome where this business could do real damage to its own reputation, so it
 * requires a reason and it sends the reason to the customer.
 */
export type ClaimOutcome = 'accepted' | 'replacement_queued' | 'rejected'

const OUTCOMES: readonly ClaimOutcome[] = ['accepted', 'replacement_queued', 'rejected']

/** `order_claims.status` per outcome. */
const CLAIM_STATUS: Record<ClaimOutcome, string> = {
  accepted: 'ACCEPTED',
  replacement_queued: 'REPLACEMENT_QUEUED',
  rejected: 'REJECTED',
}

/** Where the ORDER ends up per outcome, walked through the state machine. */
const ORDER_TARGET: Record<ClaimOutcome, OrderStatus> = {
  accepted: 'REPLACEMENT_QUEUED',
  replacement_queued: 'REPLACEMENT_QUEUED',
  // A rejected claim puts the order BACK to delivered. `CLAIM_OPEN`'s only exits
  // are REPLACEMENT_QUEUED and DELIVERED, and there is no "CLAIM_CLOSED" state —
  // so DELIVERED is where a rejected claim has to land, and it re-opens the
  // guarantee window on the ORIGINAL delivery, which is correct: the plant is
  // still the customer's and still covered.
  rejected: 'DELIVERED',
}

const OUTCOME_COPY: Record<ClaimOutcome, { subject: string; body: string[] }> = {
  accepted: {
    subject: 'We have accepted your claim',
    body: [
      'We have looked at what you sent and we agree. A replacement plant is being prepared for you.',
      'You do not need to send the original back — a plant that has travelled is a dead plant, and asking you to post it would cost you a courier fee to save us something we could never sell.',
    ],
  },
  replacement_queued: {
    subject: 'Your replacement is on its way',
    body: [
      'Your replacement has left the nursery and is with a rider.',
      'It is a prepaid delivery like any other: you will get a message when the rider sets off, and a code to read out when they arrive.',
    ],
  },
  rejected: {
    subject: 'About your claim',
    body: [
      'We have not been able to agree this one, and we would rather tell you why than leave you waiting.',
      'If you think we have this wrong, reply to this message or WhatsApp us with a photo and a grower will look again. A human reads every claim, and this one is not closed to you.',
    ],
  },
}

export interface ClaimRow {
  id: number
  claimCode: string
  orderCode: string
  orderId: number
  status: string
  kind: string
  description: string
  evidenceUrl: string | null
  createdAt: Date
  customerName: string | null
  customerPhone: string | null
  orderItemLabel: string | null
  orderStatus: string
  resolvedAt: Date | null
  resolutionNote: string | null
  /** The tier this order was SOLD at, which is what the promise is written from. */
  guaranteeTier: string
}

/** Claims, newest first, optionally only the open ones. */
export async function listClaims(onlyOpen = false): Promise<ClaimRow[]> {
  const db = await getPool()
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT c."id",
            c."order_code"                                  AS "orderCode",
            c."order_id"                                    AS "orderId",
            c."status",
            c."kind",
            c."description",
            c."evidence_url"                                AS "evidenceUrl",
            c."created_at"                                  AS "createdAt",
            o."customer_name"                               AS "customerName",
            o."customer_phone"                              AS "customerPhone",
            o."status"::text                                AS "orderStatus",
            i.id IS NOT NULL                                AS "hasItem",
            /*
             * size_tier is CAST TO TEXT before the CASE, and that is the fix.
             *
             * size_tier is an ENUM. Asking Postgres to resolve the empty string
             * against enum_skus_size_tier is something it cannot do, so the whole
             * claims console 500d the moment a claim had no matching order line:
             *
             *     invalid input value for enum enum_skus_size_tier: ""
             *
             * The cast is what makes the empty fallback legal. It is the same
             * family of mistake the numeric-arrives-as-a-string notes in AGENTS.md
             * describe: a column TYPE is part of its contract, and a value chosen
             * to fill a gap can be legal in the column and illegal in the
             * expression built over it.
             *
             * (No backticks in this comment: it lives inside a JS template
             * literal, where one silently ends the string. That is the exact hazard
             * scripts/check-silent-failures.mjs exists to catch.)
             */
            COALESCE(sp."common_name", 'Plant') || CASE WHEN s."size_tier"::text IS NOT NULL
              THEN ' · ' || s."size_tier"::text ELSE '' END AS "itemLabel",
            c."resolved_at"                                 AS "resolvedAt",
            c."resolution_note"                             AS "resolutionNote",
            o."guarantee_tier"::text                        AS "guaranteeTier"
       FROM "order_claims" c
       JOIN "orders" o ON o."id" = c."order_id"
       LEFT JOIN "orders_items" i ON i."id" = c."order_item_id"
       LEFT JOIN "skus" s         ON s."id" = i."sku_id"
       LEFT JOIN "species" sp     ON sp."id" = s."species_id"
      ${onlyOpen ? `WHERE c."status" = 'OPEN'` : ''}
      ORDER BY c."created_at" DESC
      LIMIT 200`,
  )

  return rows.map((row) => ({
    id: Number(row.id),
    claimCode: `CLM-${String(row.id).padStart(6, '0')}`,
    orderCode: String(row.orderCode),
    orderId: Number(row.orderId),
    status: String(row.status),
    kind: String(row.kind),
    description: String(row.description),
    evidenceUrl: row.evidenceUrl == null ? null : String(row.evidenceUrl),
    createdAt: row.createdAt as Date,
    customerName: row.customerName == null ? null : String(row.customerName),
    customerPhone: row.customerPhone == null ? null : String(row.customerPhone),
    orderItemLabel: row.hasItem ? String(row.itemLabel) : null,
    orderStatus: String(row.orderStatus),
    resolvedAt: (row.resolvedAt as Date) ?? null,
    resolutionNote: row.resolutionNote == null ? null : String(row.resolutionNote),
    guaranteeTier: String(row.guaranteeTier ?? 'T0'),
  }))
}

export class ClaimTriageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ClaimTriageError'
  }
}

/**
 * Resolve a claim.
 *
 * One transaction for the claim row, the order status and the timeline entry.
 * Three separate writes would let a crash leave a claim marked `REJECTED` on an
 * order still sitting at `CLAIM_OPEN` — which is exactly the state that made
 * second claims impossible, reached a second way.
 */
export async function resolveClaim(args: {
  claimId: number
  outcome: ClaimOutcome
  note: string | null
  actor: string
}): Promise<{ claimCode: string; orderStatus: string }> {
  const db = await getPool()
  const client: PoolClient = await db.connect()

  let committed: ClaimRow | null = null
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT c."id", c."order_code" AS "orderCode", c."order_id" AS "orderId",
              c."status",
              o."status"::text AS "orderStatus",
              o."customer_name" AS "customerName",
              o."customer_phone" AS "customerPhone",
              o."guarantee_tier"::text AS "guaranteeTier"
         FROM "order_claims" c
         JOIN "orders" o ON o."id" = c."order_id"
        WHERE c."id" = $1
        FOR UPDATE OF c, o`,
      [args.claimId],
    )
    const row = rows[0]
    if (!row) throw new ClaimTriageError('That claim does not exist.', 404)

    if (String(row.status) !== 'OPEN') {
      throw new ClaimTriageError(
        `That claim was already resolved as ${String(row.status).toLowerCase()}. Nothing has changed.`,
        409,
      )
    }

    const current = canonicalStatus(String(row.orderStatus))
    const target = ORDER_TARGET[args.outcome]

    /*
     * A claim filed against an order that is NOT in `CLAIM_OPEN` is a data fault,
     * not a business outcome, and it must not be papered over by writing an
     * illegal transition. Refusing leaves the claim OPEN and visible, which is the
     * honest state.
     */
    if (current !== 'CLAIM_OPEN' && current !== 'REPLACEMENT_QUEUED') {
      throw new ClaimTriageError(
        `Order ${String(row.orderCode)} is ${current}, so this claim cannot be resolved from here. ` +
          'Check the order timeline before closing the claim.',
        409,
      )
    }

    await client.query(
      `UPDATE "order_claims"
          SET "status" = $1, "resolved_at" = now(), "resolved_by" = $2,
              "resolution_note" = $3
        WHERE "id" = $4`,
      [CLAIM_STATUS[args.outcome], args.actor, args.note, args.claimId],
    )

    /*
     * Walked through the same table every other writer uses.
     *
     * `REPLACEMENT_QUEUED → DELIVERED` is legal, and `CLAIM_OPEN → DELIVERED` is
     * legal, so both rejected and replacement-queued land somewhere reachable.
     * A direct `UPDATE orders SET status = …` here would be the third bypass of
     * `assertTransition` in this codebase, and the first two are the reason the
     * customer timeline used to disagree with the order heading.
     */
    const timeline: Array<{ status: OrderStatus; note: string }> = []
    walkOrderTo(cursorFrom(current), target, (_from, step) => {
      timeline.push({ status: step, note: outcomeNote(args.outcome, step) })
    })

    await client.query(`UPDATE "orders" SET "status" = $1, "updated_at" = now() WHERE "id" = $2`, [
      target,
      Number(row.orderId),
    ])

    for (const entry of timeline) {
      await client.query(
        `INSERT INTO "order_events" ("order_id", "status", "note", "actor", "created_at")
         VALUES ($1, $2, $3, $4, now())`,
        [Number(row.orderId), entry.status, entry.note, `support:${args.actor}`],
      )
    }

    await client.query('COMMIT')

    committed = {
      id: Number(row.id),
      claimCode: `CLM-${String(row.id).padStart(6, '0')}`,
      orderCode: String(row.orderCode),
      orderId: Number(row.orderId),
      status: CLAIM_STATUS[args.outcome],
      kind: '',
      description: '',
      evidenceUrl: null,
      createdAt: new Date(),
      customerName: row.customerName == null ? null : String(row.customerName),
      customerPhone: row.customerPhone == null ? null : String(row.customerPhone),
      orderItemLabel: null,
      orderStatus: target,
      resolvedAt: new Date(),
      resolutionNote: args.note,
      guaranteeTier: String(row.guaranteeTier ?? 'T0'),
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  // After the commit, never inside it. A mail outage must not undo a decision a
  // human already made.
  void notifyClaimResolved(committed, args.outcome).catch((error: unknown) => {
    console.error('[claims] resolution notification failed:', error)
  })

  return { claimCode: committed!.claimCode, orderStatus: committed!.orderStatus }
}

function outcomeNote(outcome: ClaimOutcome, target: string): string {
  if (target === 'REPLACEMENT_QUEUED') {
    return outcome === 'replacement_queued'
      ? 'Your replacement is with a rider now.'
      : 'We have accepted your claim. A replacement plant is being prepared.'
  }
  return 'We have closed your claim. The guarantee on this delivery is still open.'
}

/**
 * Tell the customer what we decided.
 *
 * ── WHY THIS TEMPLATE ALREADY EXISTED ───────────────────────────────────────
 *
 * It did not. `acknowledgement` was written for "we have received your claim" and
 * this is a different message with different consequences, so it gets its own
 * body rather than a reused one with a changed verb.
 *
 * The rejection path is the important one: it states the reason, offers a human
 * review, and does NOT close the conversation. A claim this business cannot agree
 * is exactly the one where a template that says "we have declined your claim" and
 * stops is how a 1-star review is written.
 */
async function notifyClaimResolved(claim: ClaimRow | null, outcome: ClaimOutcome): Promise<void> {
  if (!claim?.customerPhone) return

  const settings = await loadBusinessSettings()
  const terms = guaranteeTerms(claim.guaranteeTier)
  const copy = OUTCOME_COPY[outcome]
  const base = config.server.url.replace(/\/$/, '')

  const template = decisionNotice({
    reference: claim.claimCode,
    outcome: copy.subject,
    firstName: (claim.customerName ?? '').split(/\s+/)[0] ?? '',
    paragraphs: [
      `Order ${claim.orderCode}.`,
      ...copy.body,
      ...(outcome === 'rejected'
        ? []
        : [`Our ${terms.label.toLowerCase()} covers you for ${terms.days} days from delivery.`]),
    ],
    whatNext:
      outcome === 'rejected'
        ? [
            'Reply to this message with another photo if you have one.',
            `Or WhatsApp ${settings.customerCarePhone} and ask for a grower, quoting ${claim.claimCode}.`,
            'A human reads every claim. This one is not closed to you.',
          ]
        : [`Nothing is needed from you. Quote ${claim.claimCode} if you contact us.`],
    supportPhone: settings.customerCarePhone || 'our published number',
    contactUrl: `${base}/order/${claim.orderCode}`,
  })

  await sendEmail({
    kind: 'claim_resolution',
    to: customerMailbox(claim.customerName ?? '', claim.customerPhone),
    toName: claim.customerName ?? undefined,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}

export function isClaimOutcome(value: unknown): value is ClaimOutcome {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value)
}

/**
 * Explicitly widened back to `OrderStatus`.
 *
 * `current` is narrowed to the two claim states by the guard above it, and that
 * narrowing leaks into the loop below where it makes `cursor = target` a type
 * error — because the compiler can prove the loop only ever assigns `target`, and
 * `target` is not one of the two. It is correct: the loop DOES always assign
 * `target`. Widening at the boundary states the intent once instead of teaching
 * the loop to lie.
 */
function cursorFrom(status: OrderStatus): OrderStatus {
  return status
}

/**
 * Walk the legal transitions from `from` to `target`, calling `visit` for each hop.
 *
 * Exists so both this module and `order-sync.ts` reach the target the same way:
 * one hop at a time, every hop through `assertTransition`, and a refusal rather
 * than an invented transition when the target is unreachable.
 *
 * Returns the final state so a caller can thread a cursor, though at the moment
 * both callers want the log of hops rather than the destination.
 */
function walkOrderTo(
  from: OrderStatus,
  target: OrderStatus,
  visit: (from: OrderStatus, step: OrderStatus) => void,
): void {
  /*
   * The cursor moves HERE, not in the visitor.
   *
   * It used to be `cursor = visit(cursor, target)` with the visitor returning the
   * next cursor — and the caller returned `from` unchanged, because the caller did
   * not care about the cursor. So the cursor never moved, the loop never
   * terminated on its own condition, and every claim resolution ended with:
   *
   *     Refusing to walk more hops than there are order states.
   *
   * The hop limit is the only reason that surfaced as a clean 409 rather than a
   * hung request, and it exists purely as insurance against a loop. Making the
   * caller unable to break the loop — by not returning the cursor — is the
   * structural fix; the limit stays as the backstop.
   */
  let cursor = from
  let hops = 0
  while (cursor !== target) {
    const legal: readonly OrderStatus[] = nextStatuses(cursor)
    if (!legal.includes(target)) {
      throw new ClaimTriageError(
        `An order at ${cursor} cannot reach ${target}. Legal next states: ${legal.join(', ')}. ` +
          `Refusing to invent a transition.`,
        409,
      )
    }
    assertTransition(cursor, target)
    visit(cursor, target)
    cursor = target
    hops += 1
    if (hops > ORDER_STATUSES.length) {
      throw new ClaimTriageError(
        'Refusing to walk more hops than there are order states. This is a bug, not a business rule.',
        409,
      )
    }
  }
}
