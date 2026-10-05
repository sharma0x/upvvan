/**
 * Plant pricing — the planter ladder, which is our primary AOV lever.
 *
 * WHY A LADDER AND NOT A PRICE LIST
 * ---------------------------------
 * Measured across the category: the same plant at two variants moves +29% to
 * +121%, and the uplift is LARGEST AT THE SMALL END (The Sill Money Tree
 * $39→$79, +103%; Ugaoo runs one Money Plant from ₹199 to ₹1,099 across 2 sizes
 * × 14 pot styles × 17 colours — 5.5× on an identical plant).
 *
 * The mechanism works because the pot has near-zero mortality: it never eats
 * return cost the way a plant does, and it barely moves freight. A ₹249 plant
 * becomes a ₹699 order with zero extra growing.
 *
 * It is the one lever that beats every alternative in the unit-economics model
 * (AOV +₹100 = +₹45 contribution, against freight rightsizing at +₹24).
 *
 * ── THE THREE RULES THIS MODULE ENFORCES ───────────────────────────────────
 *
 * 1. THE HONEST ENTRY OPTION IS ALWAYS PRESENT.
 *    Ugaoo sells the identical plant at ₹199 in a plain grow pot, and that is
 *    why their ₹1,099 version reads as a choice rather than a bait-and-switch.
 *    Remove the entry option and the premium becomes a suspicion. So the ladder
 *    ALWAYS yields a bare-plant price, and that price is reachable.
 *
 * 2. NO DISCOUNT FRAMING. NO STRUCK-THROUGH PRICE.
 *    Every Indian site shows a struck-through MRP. We don't: an MRP is a
 *    merchandising fiction. The uplift is shown as a VALUE ("the ceramic pot is
 *    worth ₹450 more"), never as a saving. So this module has no concept of a
 *    compare-at price — the absence is deliberate and is asserted by the tests.
 *
 * 3. INTEGER PAISE. ALWAYS.
 *    A 5.5× ladder on a ₹199 base must land on whole paise. Floats would
 *    accumulate error exactly where the money is most visible.
 */

/** Integer paise. Never a float, never rupees. */
export type Paise = number

/** Basis points: 2900 = 29%. Integers, to keep the ladder exact. */
export type BasisPoints = number

export type SizeTier = 'XS' | 'MD' | 'LG' | 'XL'

/**
 * Size tiers carry their own multiplier, and they are NOT cosmetic.
 *
 * ── A CORRECTION WORTH RECORDING ──────────────────────────────────────────
 * The research gives two different numbers, and conflating them is a modelling
 * error that would have shipped:
 *
 *   · "planter uplift +29% to +121%" — what a single POT adds to a given plant.
 *   · "Ugaoo: ₹199 → ₹1,099 on an IDENTICAL plant, 5.5×" — the whole price
 *     range, which spans 2 SIZE TIERS × 14 pot styles × 17 colours.
 *
 * So 5.5× is NOT achievable by a planter alone. A planter alone maxes out at
 * +121% (2.21×). Reaching 5.5× requires the size tier to carry a multiplier too,
 * which is exactly why Ugaoo lists the same species at two sizes.
 *
 * The first implementation put the whole burden on the planter and asserted
 * 5.5× from it; the test caught that 2.21× ≠ 5.5×. The band cap is correct, and
 * the size multiplier is what closes the gap.
 */
export const SIZE_TIER_MULTIPLIER: Record<SizeTier, BasisPoints> = {
  XS: 0,
  MD: 45_000, // +450% — a mature plant costs real growing time, which is the point
  LG: 120_000,
  XL: 260_000,
}

/** What the item actually is. Plants and consumables have different rules. */
export type ItemClass = 'plant' | 'planter' | 'consumable'

export interface PlantSpec {
  speciesId: string
  commonName: string
  basePricePaise: Paise
  sizeTier: SizeTier
  itemClass: ItemClass
}

export interface PlanterSpec {
  planterId: string
  name: string
  /**
   * Uplift over the bare plant, in basis points. 0 = the honest entry option
   * (grow pot). Range in the research: 2900–12100.
   */
  upliftBp: BasisPoints
  /** Pots are cheap and light; they barely move the freight line. */
  costPaise: Paise
}

export interface PriceBreakdown {
  /** The bare plant, no planter. Always reachable — see rule 1. */
  entryPaise: Paise
  /** Bare plant + this planter. */
  totalPaise: Paise
  /** What the planter adds, as a positive value. Never rendered as a discount. */
  planterValuePaise: Paise
  planterUpliftBp: BasisPoints
  /**
   * True when this is the bare-plant price. The UI must not render a strikethrough
   * for this; it is an option, not an original price.
   */
  isEntryOption: boolean
}

export class PricingError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NEGATIVE_PRICE'
      | 'FRACTIONAL_PAISE'
      | 'UPLIFT_OUT_OF_RANGE'
      | 'NEGATIVE_UPLIFT'
      | 'NO_ENTRY_OPTION',
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PricingError'
  }
}

/**
 * Proven uplift band, from the research. A planter costing more than +121% or
 * saving money is a data error, not a pricing strategy.
 */
export const MIN_UPLIFT_BP = 2900
export const MAX_UPLIFT_BP = 12100

export function applyPlanter(plant: PlantSpec, planter: PlanterSpec): PriceBreakdown {
  assertMoney(plant.basePricePaise, 'base price')
  assertMoney(planter.costPaise, 'planter cost')

  // Size first: the tier sets the plant's price, then the pot adds to THAT.
  // Ordering matters — a +121% pot on an XS plant is a different number than on
  // an XL, and the ladder a customer sees is built from this.
  const sizeMultiplierBp = SIZE_TIER_MULTIPLIER[plant.sizeTier]
  const plantPriceAtTier = Math.ceil(
    (plant.basePricePaise * (10_000 + sizeMultiplierBp)) / 10_000,
  )

  if (planter.upliftBp < 0) {
    throw new PricingError(
      `Planter ${planter.planterId} has a NEGATIVE uplift (${planter.upliftBp}bp). A planter cannot reduce the price of a plant — that is a discount, and we do not do discounts.`,
      'NEGATIVE_UPLIFT',
      { planter: planter.planterId, upliftBp: planter.upliftBp },
    )
  }

  if (planter.upliftBp > MAX_UPLIFT_BP) {
    throw new PricingError(
      `Planter ${planter.planterId} uplifts by ${planter.upliftBp}bp, above the proven maximum of ${MAX_UPLIFT_BP}bp (121%). Above that we are inventing a number no competitor has demonstrated.`,
      'UPLIFT_OUT_OF_RANGE',
      { planter: planter.planterId, upliftBp: planter.upliftBp, max: MAX_UPLIFT_BP },
    )
  }

  // Integer arithmetic throughout: round UP so we never sell below cost on a
  // ladder the customer can see.
  const planterValuePaise = Math.ceil((plantPriceAtTier * planter.upliftBp) / 10_000)

  return {
    entryPaise: plantPriceAtTier,
    totalPaise: plantPriceAtTier + planterValuePaise,
    planterValuePaise,
    planterUpliftBp: planter.upliftBp,
    isEntryOption: planter.upliftBp === 0,
  }
}

/**
 * The full ladder for one plant: every planter option, cheapest first.
 *
 * The FIRST entry is always the bare plant. That ordering is the mechanism behind
 * rule 1 — the honest option is not buried at the bottom of a list, it is where
 * the customer's eye lands first.
 */
export function priceLadder(
  plant: PlantSpec,
  planters: readonly PlanterSpec[],
): PriceBreakdown[] {
  const entry: PlanterSpec = {
    planterId: 'grow-pot',
    name: 'Grow pot (decorate on arrival)',
    upliftBp: 0,
    costPaise: 0,
  }

  const all = [entry, ...planters]
  const seen = new Set<string>()

  const ladder = all.map((planter) => {
    if (seen.has(planter.planterId)) {
      throw new PricingError(
        `Duplicate planter ${planter.planterId} in the ladder for ${plant.speciesId}.`,
        'NEGATIVE_UPLIFT',
        { planter: planter.planterId },
      )
    }
    seen.add(planter.planterId)
    return applyPlanter(plant, planter)
  })

  ladder.sort((a, b) => a.totalPaise - b.totalPaise)

  // Must compare against the SAME tier price the ladder opens at. Comparing to
  // the raw base is wrong for every tier except XS — the first version did that
  // and rejected a perfectly valid MD ladder as having "no entry option".
  if (ladder[0]!.totalPaise !== plantPriceForTier(plant)) {
    throw new PricingError(
      `The ladder for ${plant.speciesId} (${plant.sizeTier}) does not open at the bare-plant price (${plantPriceForTier(plant)}p). Without an honest entry option the premium reads as a bait-and-switch.`,
      'NO_ENTRY_OPTION',
      { species: plant.speciesId, sizeTier: plant.sizeTier, lowest: ladder[0]!.totalPaise },
    )
  }

  return ladder
}

/** The bare-plant price at a given size tier, in integer paise. */
export function plantPriceForTier(plant: PlantSpec): Paise {
  assertMoney(plant.basePricePaise, 'base price')
  return Math.ceil(
    (plant.basePricePaise * (10_000 + SIZE_TIER_MULTIPLIER[plant.sizeTier])) / 10_000,
  )
}

/**
 * Format integer paise as a rupee string, with Indian digit grouping
 * (1,75,120 not 175,120 — lakh, not thousand).
 *
 * Pure integer arithmetic. `toLocaleString` would be simpler but is
 * locale-dependent and can emit non-ASCII digits, which is exactly the kind of
 * thing that renders fine on a developer's machine and wrong on a customer's.
 */
export function formatPaise(paise: Paise): string {
  if (!Number.isInteger(paise)) {
    throw new PricingError(`Cannot format non-integer paise: ${paise}`, 'FRACTIONAL_PAISE')
  }

  const rupees = Math.floor(paise / 100)
  const remainder = paise % 100

  // Indian grouping: last 3 digits, then pairs.
  const s = String(rupees)
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3

  return remainder === 0 ? `₹${grouped}` : `₹${grouped}.${String(remainder).padStart(2, '0')}`
}

function assertMoney(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new PricingError(
      `${label} must be an integer number of paise, received ${value}. No floats, no rupees.`,
      'FRACTIONAL_PAISE',
      { value },
    )
  }
  if (value < 0) {
    throw new PricingError(`${label} cannot be negative (${value}p).`, 'NEGATIVE_PRICE', { value })
  }
}