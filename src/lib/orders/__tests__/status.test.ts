/**
 * The order state machine.
 *
 * ── WHY A UNIT TEST AND NOT ONLY THE e2e SCRIPT ──────────────────────────────
 *
 * Because `assertTransition` is a pure function with no I/O, which means it can be
 * checked in milliseconds against the FULL transition table — every status, every
 * legal successor, and every illegal pair. The e2e script proves the loop works for
 * the two or three states a customer actually walks through; this proves nothing
 * else can be reached, including the states nobody thinks to test.
 *
 * ── WHY THE ILLEGAL TRANSITIONS MATTER MORE THAN THE LEGAL ONES ──────────────
 *
 * Every legal transition is exercised by real orders, so a bug in one is caught the
 * first time a customer hits it. An ILLEGAL transition being permitted is a silent
 * corruption: an order that goes DELIVERED → PAYMENT_PENDING restarts the guarantee
 * clock without anyone noticing, and one that goes PAYMENT_PENDING → DELIVERED is a
 * plant dispatched to a customer who never paid. Neither raises an error at the
 * moment it happens. So the illegal pairs are enumerated exhaustively here rather
 * than sampled.
 */
import { describe, it, expect } from 'vitest'

import {
  ORDER_STATUSES,
  STATUS_COPY,
  assertTransition,
  canTransition,
  canonicalStatus,
  IllegalTransitionError,
  isCustomerVisible,
  isTerminal,
  missingEnumValueError,
  nextStatuses,
  supportsDatabaseStatus,
  OrderRuleError,
  type OrderStatus,
} from '@/lib/orders/status'

/** Every (from, to) pair, generated rather than hand-listed so a new status is covered. */
function everyPair(): Array<[OrderStatus, OrderStatus]> {
  const out: Array<[OrderStatus, OrderStatus]> = []
  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      out.push([from, to])
    }
  }
  return out
}

describe('order status state machine', () => {
  it('covers every status in the enum-free canonical vocabulary', () => {
    expect(ORDER_STATUSES).toEqual([
      'PAYMENT_PENDING',
      'PAID',
      'PACKING',
      'PACKED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'CLAIM_OPEN',
      'REPLACEMENT_QUEUED',
    ])
  })

  describe('the happy path', () => {
    it('runs PAYMENT_PENDING → PAID → PACKING → PACKED → OUT_FOR_DELIVERY → DELIVERED', () => {
      const path: OrderStatus[] = [
        'PAYMENT_PENDING',
        'PAID',
        'PACKING',
        'PACKED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
      ]
      for (let i = 0; i < path.length - 1; i++) {
        expect(canTransition(path[i]!, path[i + 1]!)).toBe(true)
      }
    })

    it('lets a delivered order be claimed, and only then', () => {
      expect(canTransition('DELIVERED', 'CLAIM_OPEN')).toBe(true)
      expect(canTransition('CLAIM_OPEN', 'REPLACEMENT_QUEUED')).toBe(true)
      expect(canTransition('REPLACEMENT_QUEUED', 'DELIVERED')).toBe(true)
    })
  })

  describe('an unpaid order can never reach dispatch', () => {
    /*
     * This is the single most important assertion in the file. The original bug was
     * a UI that said "Order placed" with no money moved; the structural version of
     * that bug is a state machine that lets an unpaid order walk to DELIVERED. If
     * this test ever fails, the prepaid-only model has a hole in it.
     */
    const fulfilment: OrderStatus[] = ['PACKING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED']

    it.each(fulfilment)('refuses PAYMENT_PENDING → %s', (target) => {
      expect(canTransition('PAYMENT_PENDING', target)).toBe(false)
      expect(() => assertTransition('PAYMENT_PENDING', target)).toThrow(IllegalTransitionError)
    })

    it('refuses to deliver a PAID order that was never packed', () => {
      expect(canTransition('PAID', 'DELIVERED')).toBe(false)
    })
  })

  describe('terminal states', () => {
    it('CANCELLED is final', () => {
      expect(isTerminal('CANCELLED')).toBe(true)
      expect(nextStatuses('CANCELLED')).toEqual([])
    })

    /*
     * DELIVERED is NOT terminal, and that is a business requirement rather than an
     * oversight: the guarantee window is a legal obligation, so the claim branch has
     * to remain reachable from DELIVERED for as long as we sell that promise.
     */
    it('DELIVERED is NOT terminal — the guarantee branch must stay reachable', () => {
      expect(isTerminal('DELIVERED')).toBe(false)
      expect(nextStatuses('DELIVERED')).toEqual(['CLAIM_OPEN'])
    })
  })

  describe('exhaustive refusal of illegal transitions', () => {
    /*
     * Generated over the full cross-product, so adding a status to the vocabulary
     * without deciding its successors FAILS this test rather than silently widening
     * the machine.
     */
    const legal: Array<[OrderStatus, OrderStatus]> = everyPair().filter(([from, to]) =>
      canTransition(from, to),
    )

    const illegal = everyPair().filter(([from, to]) => !canTransition(from, to))

    it('found a non-trivial set of illegal pairs to check', () => {
      expect(illegal.length).toBeGreaterThan(60)
      expect(legal.length).toBeGreaterThan(5)
    })

    it.each(illegal)('refuses %s → %s', (from, to) => {
      expect(() => assertTransition(from, to)).toThrow(IllegalTransitionError)
    })
  })

  describe('error messages are diagnosable from a log line alone', () => {
    it('names both statuses and the legal successors', () => {
      let message = ''
      try {
        assertTransition('PAYMENT_PENDING', 'DELIVERED')
      } catch (err) {
        message = (err as Error).message
      }
      expect(message).toContain('PAYMENT_PENDING')
      expect(message).toContain('DELIVERED')
      // The legal options are the thing a support engineer needs at 2am.
      expect(message).toContain('PAID')
    })

    it('says "none — this state is final" for a terminal status', () => {
      expect(() => assertTransition('CANCELLED', 'PAID')).toThrow(/none — this state is final/)
    })

    it('refuses a status that is not in the vocabulary at all', () => {
      // @ts-expect-error deliberately passing a value the type forbids
      expect(() => assertTransition('PAID', 'SHIPPED_BY_STAFF')).toThrow(OrderRuleError)
    })
  })

  describe('legacy aliases', () => {
    /*
     * 44 orders predate the payment lifecycle and carry logistics-only statuses.
     * They must still render a truthful timeline, and an unmapped legacy value must
     * be an error rather than a silent pass-through — a status we cannot explain to
     * a customer is a status we should not be holding.
     */
    it.each([
      ['PLACED', 'PAYMENT_PENDING'],
      ['ROUTED', 'PACKING'],
      ['DISPATCHED', 'OUT_FOR_DELIVERY'],
      ['RESOLVED', 'DELIVERED'],
      ['CLAIM_REJECTED', 'CLAIM_OPEN'],
    ])('maps the legacy value %s to %s', (legacy, canonical) => {
      expect(canonicalStatus(legacy)).toBe(canonical)
    })

    it('passes canonical values through unchanged', () => {
      expect(canonicalStatus('PAID')).toBe('PAID')
      expect(canonicalStatus('paid')).toBe('PAID')
    })

    it('THROWS on an unknown stored status rather than guessing', () => {
      expect(() => canonicalStatus('WINGED_IT')).toThrow(OrderRuleError)
    })
  })

  describe('customer-visible copy', () => {
    it('has copy for every status, so no page can render an empty label', () => {
      for (const status of ORDER_STATUSES) {
        expect(STATUS_COPY[status].label.length).toBeGreaterThan(0)
        expect(STATUS_COPY[status].detail.length).toBeGreaterThan(0)
      }
    })

    /*
     * PACKING is an internal bench state. Exposing it would tell a customer their
     * plant is being watered by someone they have not met — so it exists in the
     * machine (ops moves through it) and is filtered at the presentation edge.
     */
    it('hides the internal bench state from customers', () => {
      expect(isCustomerVisible('PACKING')).toBe(false)
      for (const status of ORDER_STATUSES.filter((s) => s !== 'PACKING')) {
        expect(isCustomerVisible(status)).toBe(true)
      }
    })

    it('says nothing was charged nowhere in the paid-path copy', () => {
      // A PAID status must not also claim the customer still owes money.
      expect(STATUS_COPY.PAID.label.toLowerCase()).toContain('payment received')
    })
  })

  describe('the schema-gap check', () => {
    /*
     * The four lifecycle statuses do not exist in `enum_orders_status` until the
     * companion migration is applied. Rather than silently writing a logistics status
     * for a payment event, the writer asks first — and the refusal names the
     * migration.
     */
    /*
     * The enum as it exists BEFORE the checkout-loop migration — the full pre-existing
     * list, not an abbreviated one. An earlier version of this fixture listed only six
     * values and the test correctly failed, because it implied the claim branch was
     * also missing from the database. It is not: CLAIM_OPEN, CLAIM_REJECTED,
     * REPLACEMENT_QUEUED and RESOLVED have been there since Phase 1. The gap is
     * exactly the four payment-lifecycle values.
     */
    const BEFORE_MIGRATION = [
      'PLACED',
      'ROUTED',
      'PACKING',
      'PACKED',
      'DISPATCHED',
      'DELIVERED',
      'RESOLVED',
      'CLAIM_OPEN',
      'CLAIM_REJECTED',
      'REPLACEMENT_QUEUED',
    ]

    it('detects a missing enum value', () => {
      expect(supportsDatabaseStatus(BEFORE_MIGRATION, 'PAID')).toBe(false)
      expect(supportsDatabaseStatus(BEFORE_MIGRATION, 'DELIVERED')).toBe(true)
    })

    it('names the ALTER TYPE statement in the error', () => {
      const message = missingEnumValueError('CANCELLED').message
      expect(message).toContain('CANCELLED')
      expect(message).toContain("ALTER TYPE")
      expect(message).toContain('enum_orders_status')
    })

    it('passes once the four values exist', () => {
      const AFTER = [...BEFORE_MIGRATION, 'PAYMENT_PENDING', 'PAID', 'OUT_FOR_DELIVERY', 'CANCELLED']
      for (const status of ORDER_STATUSES) {
        expect(supportsDatabaseStatus(AFTER, status)).toBe(true)
      }
    })
  })
})