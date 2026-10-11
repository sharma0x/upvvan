import type { PoolClient } from 'pg'

import {
  ORDER_STATUSES,
  assertTransition,
  canonicalStatus,
  nextStatuses,
  STATUS_COPY,
  type OrderStatus,
} from '@/lib/orders/status'
import type { DispatchStatus } from '@/lib/dispatch/assign'

/**
 * Keeping `orders.status` and the customer-facing timeline in step with dispatch.
 *
 * ── THE BUG, MEASURED IN THIS DATABASE ──────────────────────────────────────
 *
 * `verifyDeliveryOtp` closed a delivery by writing the order status with raw SQL:
 *
 *     UPDATE "orders" SET "status" = 'DELIVERED', "updated_at" = now()
 *       WHERE "id" = (SELECT "order_id" FROM "dispatches" WHERE "id" = $1)
 *
 * Two things were wrong with that, and only the first was visible.
 *
 * 1. NO `order_events` ROW. The customer timeline at `/order/<code>` is built
 *    ENTIRELY from `order_events` (see `orders/db.ts:hydrate`). Nothing on the
 *    dispatch path wrote one. So a delivered order rendered a header saying
 *    "Delivered" above a timeline whose last entry was "Payment received", hours
 *    earlier. Verified on order UPV-4GG-GOOM:
 *
 *        orders.status  = DELIVERED
 *        dispatches.status = DELIVERED
 *        order_events   = PAYMENT_PENDING, PAID          ← nothing about the journey
 *
 *    A page that says one thing in the heading and another in the body is worse
 *    than one that says nothing, because a customer who notices will not believe
 *    the next thing it tells them either.
 *
 * 2. IT BYPASSED THE STATE MACHINE. `assertTransition` is the project's single
 *    enforcement point for lifecycle transitions, and this write skipped it.
 *    `PAID → DELIVERED` is not in the table at all, so the raw SQL succeeded only
 *    because no trigger enforces the table. A business rule that one statement can
 *    route around is a comment.
 *
 * ── WHY NOTHING WROTE THE MIDDLE OF THE CHAIN EITHER ────────────────────────
 *
 * `orders.status` had exactly three writers: creation (`PAYMENT_PENDING`),
 * capture (`PAID`) and the raw delivery write above. `PACKING`, `PACKED` and
 * `OUT_FOR_DELIVERY` were unreachable — three states in the enum, in the domain
 * model, in `STATUS_COPY` and in the customer's own words, with no code path that
 * could ever produce them.
 *
 * ── THE MAPPING, AND WHY IT IS NOT A SIMPLE LOOKUP ──────────────────────────
 *
 * A dispatch has six states; an order has nine, and they are not the same
 * vocabulary. Two dispatch states deliberately do NOT move the order:
 *
 *   · `ASSIGNED` — a rider has been given the job. The plant has not moved and
 *     the customer has not been told anything new about their parcel. Advancing
 *     the order here would tell a customer their plant is packed the moment a
 *     dispatcher clicked a button. Instead this writes an event at the CURRENT
 *     status, which is exactly what an append-only log is for: a fact that
 *     happened, with no state change implied.
 *   · `FAILED` / `CANCELLED` — the dispatch failed. That is a rider's problem to
 *     report and a dispatcher's to re-run; the ORDER is still paid and still ours
 *     to deliver, and moving it to `CANCELLED` would tell a paying customer their
 *     order was cancelled by a rider who could not find the gate.
 *
 * Everything else walks `nextStatuses` to reach the target, one legal hop at a
 * time. That matters: `PAID → OUT_FOR_DELIVERY` is not a legal transition, so a
 * direct write would be a second rule violation wearing a different hat. The walk
 * means the timeline records the order it actually happened in — packed, then on
 * the road — which is also what the customer was told would happen.
 */

/** Dispatch state → the order state it means. `null` = no order state change. */
const ORDER_STATUS_FOR_DISPATCH: Record<DispatchStatus, OrderStatus | null> = {
  ASSIGNED: null,
  PICKED_UP: 'PACKED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  // See the header: a failed drop is a dispatch fact, not an order cancellation.
  FAILED: null,
  CANCELLED: null,
}

/**
 * What the customer is told at each hop.
 *
 * `STATUS_COPY` holds the label AND the detail; the detail is written for the
 * order page header, where there is no rider and no band. Here we want the
 * sentence that belongs beside a timestamp on a timeline.
 */
const EVENT_NOTES: Record<OrderStatus, string> = {
  PAYMENT_PENDING: 'Order received. Waiting for payment.',
  PAID: 'Payment received in full. Your plant is reserved.',
  PACKING: 'At the packing bench — soil, pot and plant going together.',
  PACKED: 'Packed, and with your rider.',
  OUT_FOR_DELIVERY: 'On the road to you.',
  DELIVERED: 'Delivered. Report damage within the guarantee window and we replace it.',
  CANCELLED: 'This order was cancelled. Anything charged is settled back to you.',
  CLAIM_OPEN: 'We have your claim and are looking at what arrived.',
  REPLACEMENT_QUEUED: 'A replacement plant is on its way. No action needed from you.',
}

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

/**
 * Append one timeline entry.
 *
 * Deliberately inline rather than importing `appendEvent` from `orders/db.ts`:
 * that module imports the payments gateway for `newOrderCode`, and pulling a
 * payment dependency into the dispatch write path to save three lines of SQL
 * couples a rider's status change to a module that also generates money codes.
 * The statement is identical; the reason it is repeated is the coupling.
 */
async function appendOrderEvent(
  client: PoolClient,
  args: { orderId: number; status: string; note: string; actor: string },
): Promise<void> {
  await client.query(
    `INSERT INTO "order_events" ("order_id", "status", "note", "actor", "created_at")
     VALUES ($1, $2, $3, $4, now())`,
    [args.orderId, args.status, args.note, args.actor],
  )
}

/**
 * Advance the order (and its timeline) to match a dispatch state.
 *
 * Called from inside the dispatch transaction, so the ledger, the order status and
 * the customer-visible timeline commit together or not at all. A dispatch that
 * exists with no timeline entry is a plant on a bike with no record of who was
 * told to take it — the same argument the append-only ledger exists to make.
 *
 * `actor` is free text on purpose: `orders.customer` / `rider:Asha` /
 * `staff:ops@upvvan.test`. It is read by support, not by machines, and a machine
 * would only constrain the values a human needs to write.
 */
export async function syncOrderToDispatch(
  client: PoolClient,
  args: { dispatchId: number; orderId: number; dispatchStatus: DispatchStatus; actor: string },
): Promise<void> {
  const { rows } = await client.query<{ status: string }>(
    `SELECT "status"::text AS "status" FROM "orders" WHERE "id" = $1 FOR UPDATE`,
    [args.orderId],
  )
  const stored = rows[0]?.status
  if (!stored) return

  /*
   * `canonicalStatus` throws on a status we cannot explain to a customer, which
   * is the right behaviour — but it must not throw INSIDE a dispatch transaction,
   * or one unmappable legacy row would roll back a rider's status change and
   * leave them unable to finish a run. So it is caught, logged, and the order is
   * left alone: a wrong timeline is a support problem, an undeliverable parcel is
   * a much worse one.
   */
  let current: OrderStatus
  try {
    current = canonicalStatus(stored)
  } catch (error) {
    console.error(
      `[dispatch] order ${args.orderId} has status "${stored}" with no canonical equivalent; ` +
        `leaving it alone rather than rolling back a rider's delivery.`,
      error,
    )
    return
  }

  const target = ORDER_STATUS_FOR_DISPATCH[args.dispatchStatus] ?? null

  if (target === null) {
    // No state change — but still a fact worth recording.
    await appendOrderEvent(client, {
      orderId: args.orderId,
      status: current,
      note: dispatchNote(args.dispatchStatus, current),
      actor: args.actor,
    })
    return
  }

  if (target === current) {
    // Already there (a re-sent webhook, a retried call). Nothing to claim.
    return
  }

  /*
   * Walk one legal hop at a time.
   *
   * `assertTransition` is the project's single enforcement point, so this code
   * cannot invent a transition the table forbids. If a target is genuinely
   * unreachable the walk throws — inside the dispatch transaction, which is the
   * correct blast radius: the delivery is refused rather than recorded as
   * something it was not.
   */
  let cursor = current
  let hops = 0
  while (cursor !== target) {
    const legal = nextStatuses(cursor)
    if (legal.length === 0) {
      throw new Error(
        `Order ${args.orderId} is ${cursor}, which has no onward states, and dispatch ` +
          `${args.dispatchId} reported ${target}. Refusing to invent a transition.`,
      )
    }
    // Pick the hop that gets us closest without overshooting.
    const step = chooseHop(legal, target)
    if (!step) {
      throw new Error(
        `Order ${args.orderId} cannot reach ${target} from ${cursor}. Legal next states: ${legal.join(', ')}.`,
      )
    }

    assertTransition(cursor, step)
    await client.query(`UPDATE "orders" SET "status" = $1, "updated_at" = now() WHERE "id" = $2`, [
      step,
      args.orderId,
    ])
    await appendOrderEvent(client, {
      orderId: args.orderId,
      status: step,
      note: EVENT_NOTES[step],
      actor: args.actor,
    })

    cursor = step
    hops += 1
    if (hops > ORDER_STATUSES.length) {
      // Unreachable: the table is finite and acyclic. Cheap insurance against an
      // infinite loop in a rider's transaction.
      throw new Error(
        `Refusing to walk order ${args.orderId} more than ${ORDER_STATUSES.length} hops.`,
      )
    }
  }

  void STATUS_COPY
}

/**
 * Which legal successor moves us towards `target`?
 *
 * Depth-first over the transition table rather than "the first one that is not the
 * current status", because the first legal successor is frequently a dead end
 * (`PAID → CANCELLED` has no onward states at all, and a walk that took it would
 * strand the order forever). The table is five rows deep in practice, so the
 * search is trivial and being exhaustive is worth more than being clever.
 */
function chooseHop(from: readonly OrderStatus[], target: OrderStatus): OrderStatus | null {
  for (const candidate of from) {
    if (candidate === target) return candidate
    if (reaches(candidate, target)) return candidate
  }
  return null
}

function reaches(from: OrderStatus, target: OrderStatus, depth = 0): boolean {
  if (from === target) return true
  if (depth > ORDER_STATUSES.length) return false
  const onward: readonly OrderStatus[] = nextStatuses(from)
  return onward.some((next) => reaches(next, target, depth + 1))
}

/**
 * The note for a dispatch state that does not change the order.
 *
 * `DELIVERED` never reaches here (it is a real target) but the default is a
 * plain factual sentence rather than a status constant, because this string is
 * rendered verbatim to a customer.
 */
function dispatchNote(dispatchStatus: DispatchStatus, current: OrderStatus): string {
  switch (dispatchStatus) {
    case 'ASSIGNED':
      return 'A rider has been assigned to your drop. Your plant is still at the nursery.'
    case 'FAILED':
      return 'Your rider could not complete this drop. We are re-arranging it — nothing is needed from you.'
    case 'CANCELLED':
      return 'This drop was cancelled before it left the nursery. You will hear from us about the order.'
    default:
      return STATUS_COPY[current].detail
  }
}

export { isOrderStatus }
