/**
 * Plant pricing — the planter ladder AOV mechanic.
 *
 * Slice B of the architecture spike: "one species, 2 size tiers, 4 planters, 3
 * colours; price derived from a ladder rule, not per-variant manual entry;
 * assert identical plant ₹199 and ₹1,099 equivalent achievable (Ugaoo's 5.5×)".
 *
 * Pure functions, no database. If this file needed a fixture to run, it has
 * picked up a dependency it should not have.
 *
 * ── A CORRECTION THIS FILE FORCED ─────────────────────────────────────────
 * The first version asserted that a single planter reaches Ugaoo's 5.5× and it
 * did not: the proven +121% pot ceiling only reaches 2.21×. The 5.5× figure is
 * the range across 2 SIZE TIERS × 14 pots × 17 colours.
 *
 * So the MODEL was wrong, not the test. Size tiers now carry a multiplier, and
 * both halves are asserted separately — including that a planter ALONE still
 * caps at 2.21×, so nobody later removes the cap instead of fixing the model.
 */

import { describe, it, expect } from 'vitest'

import {
  MAX_UPLIFT_BP,
  MIN_UPLIFT_BP,
  SIZE_TIER_MULTIPLIER,
  PricingError,
  applyPlanter,
  formatPaise,
  priceLadder,
  type PlanterSpec,
  type PlantSpec,
} from '../pricing'

/** Ugaoo's Money Plant: ₹199 base. MD carries a +450% size multiplier. */
const MONEY_PLANT: PlantSpec = {
  speciesId: 'money-plant',
  commonName: 'Money Plant',
  basePricePaise: 19900,
  sizeTier: 'MD',
  itemClass: 'plant',
}

/** XS carries no size multiplier, so its entry price is the raw base. */
const MONEY_PLANT_XS: PlantSpec = { ...MONEY_PLANT, sizeTier: 'XS' }

const planter = (planterId: string, upliftBp: number, costPaise = 5000): PlanterSpec => ({
  planterId,
  name: planterId,
  upliftBp,
  costPaise,
})

describe('planter ladder pricing', () => {
  describe('THE LADDER — price is derived, never entered per variant', () => {
    it('XS opens at exactly the base price', () => {
      const bare = applyPlanter(MONEY_PLANT_XS, planter('grow-pot', 0, 0))
      expect(bare.totalPaise).toBe(19900)
      expect(bare.isEntryOption).toBe(true)
    })

    it('MD multiplies the base by its size tier', () => {
      // ₹199 × (1 + 4.50) = ₹1,094.50
      const bare = applyPlanter(MONEY_PLANT, planter('grow-pot', 0, 0))
      expect(bare.totalPaise).toBe(109450)
    })

    it('adds the planter value on top of the SIZE-TIER price, not the base', () => {
      // +60% on ₹1,094.50 → ₹656.70 pot → ₹1,751.20 total
      const priced = applyPlanter(MONEY_PLANT, planter('ceramic-white', 6000))
      expect(priced.entryPaise).toBe(109450)
      expect(priced.planterValuePaise).toBe(65670)
      expect(priced.totalPaise).toBe(175120)
    })

    it('produces a 24-variant ladder from 1 species × 2 tiers × 4 pots × 3 colours', () => {
      const tiers = ['XS', 'MD'] as const
      const pots = [
        planter('grow-pot', 0, 0),
        planter('ceramic', 6000),
        planter('terracotta', 8500),
        planter('cachepot', MAX_UPLIFT_BP),
      ]
      const colours = ['white', 'terracotta', 'sage'] as const

      let variants = 0
      for (const tier of tiers) {
        for (const pot of pots) {
          for (const _colour of colours) {
            const priced = applyPlanter({ ...MONEY_PLANT, sizeTier: tier }, pot)
            expect(Number.isInteger(priced.totalPaise)).toBe(true)
            variants++
          }
        }
      }
      expect(variants).toBe(24)
    })

    it('reaches Ugaoo 5.5× across size tiers × planters', () => {
      const bottom = applyPlanter(MONEY_PLANT_XS, planter('grow-pot', 0, 0))
      const top = applyPlanter(MONEY_PLANT, planter('handmade-terra', MAX_UPLIFT_BP))
      expect(bottom.totalPaise).toBe(19900)
      expect(top.totalPaise / bottom.totalPaise).toBeGreaterThanOrEqual(5.5)
    })

    it('a planter ALONE caps at 2.21× of its tier price', () => {
      // Asserted explicitly so nobody "fixes" the tier model by deleting the cap.
      const ratio =
        applyPlanter(MONEY_PLANT_XS, planter('handmade-terra', MAX_UPLIFT_BP)).totalPaise /
        MONEY_PLANT_XS.basePricePaise
      expect(ratio).toBeCloseTo(2.21, 2)
      expect(ratio).toBeLessThan(5.5)
    })

    it('orders tiers cheapest to most expensive', () => {
      const prices = (['XS', 'MD', 'LG', 'XL'] as const).map(
        (tier) =>
          applyPlanter({ ...MONEY_PLANT, sizeTier: tier }, planter('grow-pot', 0, 0))
            .totalPaise,
      )
      expect(prices).toEqual([...prices].sort((a, b) => a - b))
    })

    it('declares a multiplier for every size tier', () => {
      for (const tier of ['XS', 'MD', 'LG', 'XL'] as const) {
        expect(SIZE_TIER_MULTIPLIER[tier]).toBeTypeOf('number')
      }
    })
  })

  describe('RULE 1 — the honest entry option is always present and comes first', () => {
    it('opens the ladder at the bare-plant price for that tier', () => {
      const ladder = priceLadder(MONEY_PLANT, [
        planter('ceramic', 6000),
        planter('terracotta', 8500),
      ])
      expect(ladder[0]!.totalPaise).toBe(109450)
      expect(ladder[0]!.isEntryOption).toBe(true)
    })

    it('orders the ladder cheapest first', () => {
      const ladder = priceLadder(MONEY_PLANT, [
        planter('cachepot', MAX_UPLIFT_BP),
        planter('ceramic', 6000),
      ])
      const totals = ladder.map((l) => l.totalPaise)
      expect(totals).toEqual([...totals].sort((a, b) => a - b))
    })

    it('works with NO planters configured', () => {
      // A city with only grow pots must still be able to sell.
      const ladder = priceLadder(MONEY_PLANT, [])
      expect(ladder).toHaveLength(1)
      expect(ladder[0]!.totalPaise).toBe(109450)
    })

    it('marks exactly one option as the entry option', () => {
      const ladder = priceLadder(MONEY_PLANT, [
        planter('ceramic', 6000),
        planter('terracotta', 8500),
      ])
      expect(ladder.filter((l) => l.isEntryOption)).toHaveLength(1)
      expect(ladder[0]!.isEntryOption).toBe(true)
    })
  })

  describe('RULE 2 — no discount framing anywhere', () => {
    it('exposes no compare-at or original price field', () => {
      const priced = applyPlanter(MONEY_PLANT, planter('ceramic', 6000))
      // The planter contribution is a POSITIVE VALUE. There is deliberately no
      // `wasPrice`, `compareAt`, `discountPaise` or `savingsPaise` — an MRP is a
      // merchandising fiction and every Indian site shows a struck-through one.
      expect(Object.keys(priced).sort()).toEqual([
        'entryPaise',
        'isEntryOption',
        'planterUpliftBp',
        'planterValuePaise',
        'totalPaise',
      ])
    })

    it('REJECTS a negative uplift — a planter cannot discount a plant', () => {
      expect(() => applyPlanter(MONEY_PLANT, planter('clearance', -2000))).toThrow(
        /cannot reduce the price/i,
      )
    })

    it('REJECTS an uplift above the proven maximum', () => {
      expect(() => applyPlanter(MONEY_PLANT, planter('absurd', MAX_UPLIFT_BP + 1))).toThrow(
        /above the proven maximum/i,
      )
    })

    it('accepts both ends of the proven band', () => {
      expect(() => applyPlanter(MONEY_PLANT, planter('min', MIN_UPLIFT_BP))).not.toThrow()
      expect(() => applyPlanter(MONEY_PLANT, planter('max', MAX_UPLIFT_BP))).not.toThrow()
    })
  })

  describe('RULE 3 — money is integer paise', () => {
    it('REJECTS a fractional base price', () => {
      expect(() =>
        applyPlanter({ ...MONEY_PLANT, basePricePaise: 199.5 }, planter('grow-pot', 0, 0)),
      ).toThrow(/integer number of paise/i)
    })

    it('REJECTS a fractional planter cost', () => {
      expect(() => applyPlanter(MONEY_PLANT, planter('ceramic', 6000, 50.5))).toThrow(
        /integer number of paise/i,
      )
    })

    it('REJECTS a negative price', () => {
      expect(() =>
        applyPlanter({ ...MONEY_PLANT, basePricePaise: -100 }, planter('grow-pot', 0, 0)),
      ).toThrow(/cannot be negative/i)
    })

    it('rounds UP so the ladder never sells below the derived value', () => {
      // XS 999p × 29% = 289.71p → 290p. Rounding down would shave a paisa the
      // customer can see on a ladder.
      const cheap: PlantSpec = { ...MONEY_PLANT_XS, basePricePaise: 999 }
      expect(applyPlanter(cheap, planter('small', MIN_UPLIFT_BP)).planterValuePaise).toBe(290)
    })

    it('keeps every total an exact integer across a dense sweep', () => {
      for (let base = 9900; base <= 99900; base += 137) {
        for (let bp = MIN_UPLIFT_BP; bp <= MAX_UPLIFT_BP; bp += 311) {
          for (const tier of ['XS', 'MD', 'LG'] as const) {
            const priced = applyPlanter(
              { ...MONEY_PLANT, basePricePaise: base, sizeTier: tier },
              planter('p', bp),
            )
            expect(Number.isInteger(priced.totalPaise)).toBe(true)
            expect(Number.isInteger(priced.entryPaise)).toBe(true)
          }
        }
      }
    })

    it('formats paise without float division', () => {
      expect(formatPaise(19900)).toBe('₹199')
      expect(formatPaise(175120)).toBe('₹1,751.20')
      expect(formatPaise(4500)).toBe('₹45')
    })

    it('REFUSES to format a fractional value', () => {
      expect(() => formatPaise(199.5)).toThrow(PricingError)
    })
  })

  describe('consumables are not plants', () => {
    it('prices a soil bag with no planter and no size multiplier', () => {
      const soil: PlantSpec = {
        speciesId: 'cocopeat',
        commonName: 'Cocopeat 5kg',
        basePricePaise: 32900,
        sizeTier: 'XS',
        itemClass: 'consumable',
      }
      const priced = applyPlanter(soil, planter('grow-pot', 0, 0))
      expect(priced.totalPaise).toBe(32900)
      expect(priced.planterValuePaise).toBe(0)
    })
  })
})