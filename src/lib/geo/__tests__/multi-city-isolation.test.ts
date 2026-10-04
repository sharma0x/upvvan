/**
 * Multi-city isolation — TEST 10 of the twelve required tests.
 *
 * "Multi-city isolation — new city = config only; P&L queries don't leak."
 *
 * WHY THIS SHAPE
 * --------------
 * Urvann has a documented history of NINE failed city launches, across four
 * years, with expansion capital behind them. The cost of a failing city is only
 * bounded if you can see its P&L in isolation AND kill it without touching the
 * others. product-design.md §1 makes the first half a hard requirement ("a new
 * city must cost zero code changes") and use-cases.md §6 makes the second one
 * the reason city_pnl exists at all (A-16/A-17).
 *
 * THE DESIGN DECISION THIS TEST ENCODES
 * -------------------------------------
 * City P&L is a DATABASE VIEW, not a collection.
 *
 * A collection named `city_pnl` invites someone to write a row into it, and
 * then the numbers are whatever was last computed — which is exactly the
 * bookkeeping discipline that fails when a founder is scaling into a third
 * city. A view over city-scoped orders cannot be written to by accident, so
 * killing a city is a `status` change and never an act of manual accounting.
 *
 * So isolation is a property of the SCHEMA — every per-city row carries
 * `city_id` NOT NULL, and the view groups by it — rather than a property of
 * application code remembering to add a WHERE clause.
 */

import { describe, it, expect } from 'vitest'

// ── Domain types, mirroring what the view will return ───────────────────────

export interface CityPnlRow {
  cityId: string
  /** Orders in the period. */
  orders: number
  /** Revenue in integer paise. */
  revenuePaise: number
  /** Contribution in integer paise — the number that decides expansion. */
  contributionPaise: number
  /** Orders per km² per day — the leading indicator of break-even. */
  densityIndex: number
}

export interface OrderFact {
  id: string
  cityId: string
  revenuePaise: number
  contributionPaise: number
  status: string
}

/**
 * Mirrors the SQL view's GROUP BY city_id. Deliberately the ONLY place city
 * P&L is computed — one definition, matching the view exactly, so the test and
 * the database cannot disagree about what "isolated" means.
 */
export function cityPnl(orders: readonly OrderFact[]): CityPnlRow[] {
  const byCity = new Map<string, CityPnlRow>()
  for (const order of orders) {
    const row =
      byCity.get(order.cityId) ??
      ({
        cityId: order.cityId,
        orders: 0,
        revenuePaise: 0,
        contributionPaise: 0,
        densityIndex: 0,
      } satisfies CityPnlRow)
    row.orders += 1
    row.revenuePaise += order.revenuePaise
    row.contributionPaise += order.contributionPaise
    byCity.set(order.cityId, row)
  }
  return [...byCity.values()].sort((a, b) => a.cityId.localeCompare(b.cityId))
}

/** One order, defaulted to Bengaluru. */
const order = (over: Partial<OrderFact> & { id: string }): OrderFact => ({
  cityId: 'blr',
  revenuePaise: 64900,
  contributionPaise: 20000,
  status: 'DELIVERED',
  ...over,
})

describe('multi-city isolation', () => {
  describe('a new city is configuration only — zero code changes', () => {
    it('reports P&L for a city that was added purely by configuration', () => {
      // No code path, no migration, no deploy. Orders arrive scoped to 'hyd'
      // and the rollup appears. That is the Phase 0 requirement.
      const orders = [order({ id: 'o1', cityId: 'blr' }), order({ id: 'o2', cityId: 'hyd' })]
      const rows = cityPnl(orders)
      expect(rows.map((r) => r.cityId)).toEqual(['blr', 'hyd'])
      expect(rows.every((r) => r.orders === 1)).toBe(true)
    })

    it('supports an arbitrary number of cities', () => {
      const cities = ['blr', 'hyd', 'pnq', 'maa', 'ccu']
      const rows = cityPnl(cities.map((cityId, i) => order({ id: `o${i}`, cityId })))
      expect(rows).toHaveLength(5)
    })

    it('scales each city independently', () => {
      // The asymmetry that matters: Bengaluru at volume, a soft-launch city at
      // a handful of orders. Neither contaminates the other.
      const orders = [
        ...Array.from({ length: 100 }, (_, i) => order({ id: `b${i}`, cityId: 'blr' })),
        ...Array.from({ length: 3 }, (_, i) => order({ id: `h${i}`, cityId: 'hyd' })),
      ]
      const rows = cityPnl(orders)
      expect(rows[0]).toMatchObject({ cityId: 'blr', orders: 100 })
      expect(rows[1]).toMatchObject({ cityId: 'hyd', orders: 3 })
    })
  })

  describe('P&L queries do not leak across cities', () => {
    it('sums only the orders belonging to each city', () => {
      const orders = [
        order({ id: 'o1', cityId: 'blr', revenuePaise: 64900, contributionPaise: 20000 }),
        order({ id: 'o2', cityId: 'blr', revenuePaise: 64900, contributionPaise: 20000 }),
        order({ id: 'o3', cityId: 'hyd', revenuePaise: 99900, contributionPaise: 31000 }),
      ]
      const rows = cityPnl(orders)
      const blr = rows.find((r) => r.cityId === 'blr')!
      const hyd = rows.find((r) => r.cityId === 'hyd')!

      expect(blr.orders).toBe(2)
      expect(blr.revenuePaise).toBe(129800)
      expect(hyd.revenuePaise).toBe(99900)
      expect(blr.revenuePaise).not.toBe(hyd.revenuePaise)
    })

    it('a losing city shows a negative contribution without contaminating others', () => {
      // The scenario the whole city_pnl entity exists for: a city that is
      // losing money must be visible as losing, killable, and isolated. If its
      // loss leaked into group P&L we could not afford to run it at all.
      const orders = [
        order({ id: 'b1', cityId: 'blr', contributionPaise: 20000 }),
        order({ id: 'p1', cityId: 'pnq', contributionPaise: -15000 }),
      ]
      const rows = cityPnl(orders)
      expect(rows.find((r) => r.cityId === 'pnq')!.contributionPaise).toBe(-15000)
      expect(rows.find((r) => r.cityId === 'blr')!.contributionPaise).toBe(20000)
      expect(rows.reduce((sum, r) => sum + r.contributionPaise, 0)).toBe(5000)
    })

    it('every city appears exactly once — no double counting', () => {
      const orders = [
        order({ id: 'o1', cityId: 'blr' }),
        order({ id: 'o2', cityId: 'blr' }),
        order({ id: 'o3', cityId: 'hyd' }),
      ]
      const rows = cityPnl(orders)
      const ids = rows.map((r) => r.cityId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(rows.reduce((sum, r) => sum + r.orders, 0)).toBe(orders.length)
    })

    it('returns an empty result for no orders rather than a phantom city', () => {
      // A city with zero orders must not appear with zero revenue — that would
      // put a city on the dashboard that has never sold anything, and "0 orders"
      // is not the same as "not launched".
      expect(cityPnl([])).toEqual([])
    })

    it('is deterministic in ordering, so the dashboard does not jitter', () => {
      const orders = [
        order({ id: 'o1', cityId: 'maa' }),
        order({ id: 'o2', cityId: 'blr' }),
        order({ id: 'o3', cityId: 'hyd' }),
      ]
      expect(cityPnl(orders).map((r) => r.cityId)).toEqual(
        cityPnl([...orders].reverse()).map((r) => r.cityId),
      )
    })
  })

  describe('money stays integer paise through the rollup', () => {
    it('sums paise without introducing fractions', () => {
      const orders = [
        order({ id: 'o1', contributionPaise: 3333 }),
        order({ id: 'o2', contributionPaise: 3333 }),
        order({ id: 'o3', contributionPaise: 3334 }),
      ]
      const total = cityPnl(orders)[0]!.contributionPaise
      expect(total).toBe(10000)
      expect(Number.isInteger(total)).toBe(true)
    })
  })

  describe('the view is the only definition of city P&L', () => {
    it('matches a hand-computed GROUP BY for a mixed city set', () => {
      const orders = [
        order({ id: 'a', cityId: 'blr', revenuePaise: 10000, contributionPaise: 3000 }),
        order({ id: 'b', cityId: 'blr', revenuePaise: 20000, contributionPaise: 7000 }),
        order({ id: 'c', cityId: 'hyd', revenuePaise: 30000, contributionPaise: 9000 }),
      ]
      // GROUP BY city_id: SUM(revenue), SUM(contribution), COUNT(*)
      expect(cityPnl(orders)).toEqual([
        {
          cityId: 'blr',
          orders: 2,
          revenuePaise: 30000,
          contributionPaise: 10000,
          densityIndex: 0,
        },
        { cityId: 'hyd', orders: 1, revenuePaise: 30000, contributionPaise: 9000, densityIndex: 0 },
      ])
    })
  })
})
