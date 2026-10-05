/**
 * Order status — THE state machine, in one place.
 *
 * ── WHY A SEPARATE MODULE AND NOT A `switch` IN A ROUTE ─────────────────────
 *
 * Three different writers move an order forward: the payment webhook, the
 * fulfilment console, and the customer raising a claim. Each of them needs to
 * know what may follow what. Before this module existed the answer was "whatever
 * the caller decided", which is how an order ends up DELIVERED -> PLACED and the
 * guarantee clock silently restarts.
 *
 * So the rule is stated ONCE, here, in a form that has no I/O and no database
 * access — which means it can be unit-tested directly and cannot be bypassed by
 * a route handler that forgot to check. Every writer calls
 * `assertTransition()`; nothing else is allowed to invent a transition.
 *
 * ── WHY PAYMENT IS PART OF THE ORDER LIFECYCLE ───────────────────────────────
 *
 * The tempting design is to keep payment state in a side table and leave
 * `orders.status` purely about logistics. We do not, because the customer's
 * question is never "was the payment captured?" in the abstract — it is "has my
 * money left my account and is my plant coming?". One lifecycle, answered in one
 * place, is the honest shape. The payment *record* (intent id, gateway
 * reference, failure reason) is still separate — that is an audit trail, not a
 * state — but the STATE is on the order.
 *
 * ── WHY THERE IS NO REFUNDED ────────────────────────────────────────────────
 *
 * Plants are replaced, never refunded; pots, soil and feed are settled in money
 * and that settlement is a payment event, not a lifecycle terminal. So the
 * machine has no REFUNDED node and cannot grow one by accident: a transition to
 * an unknown status is a thrown error, not a permissive default.
 */


/**
 * The error every rule violation in the order domain raises.
 *
 * Deliberately NOT `PricingError`. That error means "this number is not whole
 * paise", and borrowing it here would make a stack trace lie about the kind of
 * failure — a status-machine bug read as a rounding bug. The name and the
 * customer-facing-wording contract are what the routes key off, so it is stated
 * once here rather than re-derived per route.
 */
export class OrderRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderRuleError'
  }
}

/**
 * The canonical vocabulary.
 *
 * These names are the DOMAIN language. They deliberately do not all exist as
 * values in the `enum_orders_status` Postgres enum yet — `supportsDatabaseStatus`
 * exists to detect that at runtime and refuse loudly instead of writing a
 * status the schema cannot hold. The migration that adds the four missing enum
 * values is reported in the checkout-loop hand-off; until it lands, an order
 * cannot leave PAYMENT_PENDING and the failure message says exactly why.
 */
export const ORDER_STATUSES = [
  'PAYMENT_PENDING',
  'PAID',
  'PACKING',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'CLAIM_OPEN',
  'REPLACEMENT_QUEUED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Legal successors, keyed by status.
 *
 * Read this table as the whole business rule. There is no wildcard, no "any
 * status may be set by staff", and no admin escape hatch — an operator who
 * needs an illegal transition is telling us the table is wrong, and the answer
 * to that is to change the table deliberately, not to add a bypass.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  // Not paid yet. The ONLY exits are capture or cancellation — an unpaid order
  // must never reach the packing bench, which is the whole point of prepaid.
  PAYMENT_PENDING: ['PAID', 'CANCELLED'],

  // Paid. From here the order belongs to fulfilment, and cancellation becomes a
  // refund decision (which is a payment event) rather than a free abort.
  PAID: ['PACKING', 'CANCELLED'],
  PACKING: ['PACKED', 'CANCELLED'],

  // Packed and awaiting a rider. Still cancellable because a plant that has not
  // left the nursery is inventory we can re-sell; once it is out for delivery it
  // is not.
  PACKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],

  // Terminal, except for the guarantee window. DELIVERED -> CLAIM_OPEN is the
  // whole reason the guarantee exists, and it is the ONLY way out of DELIVERED.
  DELIVERED: ['CLAIM_OPEN'],

  // A claim is either queued for replacement or rejected; either way the order
  // ends at DELIVERED again, because there is no other terminal for a plant.
  CLAIM_OPEN: ['REPLACEMENT_QUEUED', 'DELIVERED'],
  REPLACEMENT_QUEUED: ['DELIVERED'],

  // Terminal. Stock is returned and the customer is told; nothing follows.
  CANCELLED: [],
}

/**
 * Statuses with no way out. `CANCELLED` is here because an unpaid order that is
 * cancelled is genuinely finished. `DELIVERED` is NOT, because the guarantee
 * window is a legal obligation, not a state — the claim branch is what follows.
 */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/** What may legally follow `from`. Empty for a terminal status. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from]
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/**
 * ── PRE-PAID STAGES ARE NOT CUSTOMER-REACHABLE ON THEIR OWN ─────────────────
 *
 * `PACKING` is an internal bench state. Exposing it would tell a customer their
 * plant is being watered by someone they have not met. It still has to be in the
 * machine (ops moves through it), so it is filtered at the PRESENTATION edge —
 * `visibleTimeline()` — rather than deleted from the model.
 */
const CUSTOMER_VISIBLE: readonly OrderStatus[] = [
  'PAYMENT_PENDING',
  'PAID',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CLAIM_OPEN',
  'REPLACEMENT_QUEUED',
  'CANCELLED',
]

export function isCustomerVisible(status: OrderStatus): boolean {
  return CUSTOMER_VISIBLE.includes(status)
}

/**
 * Copy for the tracking timeline. Written for a customer on a phone, in the
 * language the rest of the storefront uses — no internal state names, no jargon,
 * and no promise we have not already made in the cart.
 */
export const STATUS_COPY: Record<OrderStatus, { label: string; detail: string }> = {
  PAYMENT_PENDING: {
    label: 'Payment pending',
    detail: 'We have your order. It joins the packing bench the moment payment clears.',
  },
  PAID: {
    label: 'Payment received',
    detail: 'Paid in full. Your plant is reserved and goes to the bench next.',
  },
  PACKING: {
    label: 'Being packed',
    detail: 'Soil, pot and plant are packed together for the road.',
  },
  PACKED: {
    label: 'Packed',
    detail: 'Packed and waiting for a rider to be assigned.',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for delivery',
    detail: 'On the road to you.',
  },
  DELIVERED: {
    label: 'Delivered',
    detail: 'Delivered. Report damage within the guarantee window and we replace it.',
  },
  CANCELLED: {
    label: 'Cancelled',
    detail: 'This order was cancelled. Anything charged is settled back to you.',
  },
  CLAIM_OPEN: {
    label: 'Claim open',
    detail: 'We have your claim and are looking at what arrived.',
  },
  REPLACEMENT_QUEUED: {
    label: 'Replacement queued',
    detail: 'A replacement plant is on its way. No action needed from you.',
  },
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(
      `An order cannot move from ${from} to ${to}. Legal next states: ${
        nextStatuses(from as OrderStatus).join(', ') || 'none — this state is final'
      }.`,
    )
    this.name = 'IllegalTransitionError'
  }
}

/**
 * The single enforcement point.
 *
 * Both callers are deliberate: the type system refuses a status we have no copy
 * for, and the table refuses one we would not allow. Throwing rather than
 * returning a boolean means a caller cannot forget to check the result — the
 * mistake this function exists to prevent is a route that logs a warning and
 * carries on.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_STATUSES.includes(to)) {
    throw new OrderRuleError(
      `${to} is not an order status. The lifecycle is fixed; a status cannot be invented at a call site.`,
    )
  }
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to)
  }
}

/**
 * ── THE LEGACY ALIASES ──────────────────────────────────────────────────────
 *
 * The `orders.status` enum predates this module and carries logistics-only
 * names. Rows written before the payment lifecycle landed must still render a
 * truthful timeline, so each old value maps to the canonical state that means
 * the same thing. The mapping is total and explicit: an unmapped legacy value is
 * an error, not a silent pass-through, because a status we cannot explain to a
 * customer is a status we should not be holding.
 */
const LEGACY_ALIASES: Record<string, OrderStatus> = {
  PLACED: 'PAYMENT_PENDING',
  ROUTED: 'PACKING',
  PACKING: 'PACKING',
  PACKED: 'PACKED',
  DISPATCHED: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  RESOLVED: 'DELIVERED',
  CLAIM_OPEN: 'CLAIM_OPEN',
  CLAIM_REJECTED: 'CLAIM_OPEN',
  REPLACEMENT_QUEUED: 'REPLACEMENT_QUEUED',
}

/** Normalise a stored status — canonical or legacy — to the canonical name. */
export function canonicalStatus(stored: string): OrderStatus {
  const upper = stored.toUpperCase()
  if ((ORDER_STATUSES as readonly string[]).includes(upper)) return upper as OrderStatus
  const aliased = LEGACY_ALIASES[upper]
  if (aliased) return aliased
  throw new OrderRuleError(
    `Stored order status "${stored}" has no canonical equivalent. A status we cannot explain to a customer is a status we should not be holding.`,
  )
}

/**
 * ── THE SCHEMA CANNOT YET HOLD EVERY STATE ──────────────────────────────────
 *
 * `PAYMENT_PENDING`, `PAID`, `OUT_FOR_DELIVERY` and `CANCELLED` are not values in
 * `enum_orders_status` until the companion migration adds them. Rather than
 * silently writing a logistics status for a payment event — which would put a
 * cancelled order in the same column state as a delivered one — the writer
 * checks the enum it is about to write against and refuses, with a message that
 * names the migration.
 *
 * This is the honest shape for a schema constraint that lives one migration
 * behind the code: visible, specific, and impossible to mistake for a bug in the
 * payment path.
 */
export function supportsDatabaseStatus(enumLabels: readonly string[], status: OrderStatus): boolean {
  return enumLabels.includes(status)
}

export function missingEnumValueError(status: OrderStatus): Error {
  return new Error(
    `Cannot write order status ${status}: the "enum_orders_status" Postgres enum does not contain that value yet. ` +
      `Add it with ALTER TYPE "enum_orders_status" ADD VALUE '${status}' — see the checkout-loop migration ` +
      `(orders_payments_stock). Note that ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so it ` +
      `must be applied outside the Payload migration runner.`,
  )
}