/**
 * Distance bands and rider pay — the core incentive fix.
 *
 * WHY THIS IS THE MOST IMPORTANT MODULE IN THE OPERATION
 * ------------------------------------------------------
 * Urvann's publicly-filed 3PL agreement pays riders ₹65 per order REGARDLESS OF
 * DISTANCE, and penalises staff ₹100 for marking an order delivered without
 * delivering it. Under that structure, lying is the cheapest action available —
 * which is why they carry 2.1/5 on Trustpilot and 1.4/5 on PissedConsumer while
 * growing revenue 54% YoY.
 *
 * The penalty clause is a SYMPTOM of a broken pay structure, not a fix. You
 * cannot fine your way out of paying someone the same for a 1km drop and a 12km
 * drop.
 *
 * We invert it: pay rises with distance, so a longer route pays strictly more,
 * and there is no penalty regime at all — the honest action is the cheap action.
 * We keep the four-field delivery proof as an audit trail we would want anyway,
 * not as a deterrent.
 *
 * DERIVED INDEPENDENTLY — THREE DECISIONS THAT THE USUAL SHAPE GETS WRONG
 * ------------------------------------------------------------------------
 *
 * 1. BANDS ARE THE PRIMITIVE. ZONES ARE A LABEL.
 *    The intuitive model is pincode → zone → band, with the band looked up from
 *    the zone. That is backwards, and backwards in a way that produces a real
 *    bug: it makes band assignment a matter of *picking a zone name*, so an
 *    operator who creates "Zone 4" and forgets to attach bands has silently
 *    unbanded pincodes. Here, a distance *determines* a band, and a zone is
 *    derived from a band. Nothing can be unbanded; the worst case is a pincode
 *    with no computed band, which is loudly wrong rather than quietly wrong.
 *
 * 2. MONEY IS INTEGER PAISE. EVERYWHERE. NO FLOATS.
 *    Not rupees-as-decimal, not floats, not "number" in the DB. Paise are the
 *    only representation that makes 5.5× planter ladders and ₹45/₹60/₹75 bands
 *    exact. A float rupee is a rounding bug waiting for a large enough number.
 *
 * 3. MONOTONICITY IS AN INVARIANT, NOT A CONVENTION.
 *    A config where Band C (7-12km) pays less than Band A (0-3km) silently
 *    reinstates Urvann's structure: riders take short routes and dump the rest.
 *    That failure is invisible in the admin panel and visible only in rider
 *    behaviour months later. So the whole set is validated together, not
 *    per-call — see `assertBandsAreMonotonic`.
 *
 * Bands are CONFIGURATION per city. A new city must cost zero code changes
 * (product-design.md §1). Nothing here hardcodes ₹45/₹60/₹75 — those are seed
 * data, not constants.
 */

import { config } from '@/lib/config'

/** Indian Rupees. Integer paise only — see decision 2 above. */
export type Paise = number

export interface DistanceBand {
  /** Stable identifier within a city. Launch default: 'A' | 'B' | 'C'. */
  code: string
  /** Inclusive lower bound, km. */
  minKm: number
  /**
   * Exclusive upper bound, km. Half-open [minKm, maxKm) so adjacent bands can
   * share a boundary without ambiguity.
   *
   * NOT Infinity, and not null. "How far do we actually ride" is an operational
   * fact about a city's radius, and it must be declared so that a 40km pincode
   * is rejected as out-of-range rather than silently paid the top band.
   */
  maxKm: number
  /** Per-drop pay. Integer paise. */
  payPaise: Paise
  /**
   * Human label for the rider surface. Shown to the rider verbatim —
   * product-design.md §4.1 requires per-drop pay to be visible upfront, and
   * §4.4 forbids hiding banding behind an internal formula.
   */
  label: string
}

export type BandErrorCode =
  | 'NON_MONOTONIC_PAY'
  | 'OVERLAPPING_RANGES'
  | 'GAP_IN_RANGES'
  | 'NEGATIVE_PAY'
  | 'NON_INTEGER_PAY'
  | 'BAD_BOUNDS'
  | 'NO_BANDS'
  | 'NO_MATCHING_BAND'

/**
 * A band-configuration failure. Typed with a code so callers can react
 * differently: a NO_MATCHING_BAND at checkout is a customer-facing message,
 * the same code at config-save time is an operator error.
 */
export class BandConfigurationError extends Error {
  constructor(
    message: string,
    readonly code: BandErrorCode,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'BandConfigurationError'
  }
}

/** Ascending by distance. Does not mutate the input. */
export function sortBands(bands: readonly DistanceBand[]): DistanceBand[] {
  return [...bands].sort((a, b) => a.minKm - b.minKm)
}

function isValidPaise(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/**
 * The band containing `km`. Half-open ranges, so 3km is in B, not in both A
 * and B.
 */
export function bandForDistance(bands: readonly DistanceBand[], km: number): DistanceBand {
  if (!Number.isFinite(km) || km < 0) {
    throw new BandConfigurationError(
      `Distance must be a non-negative finite number of km, received ${km}`,
      'BAD_BOUNDS',
      { km },
    )
  }
  if (bands.length === 0) {
    throw new BandConfigurationError('No distance bands configured for this city', 'NO_BANDS', {
      km,
    })
  }

  const matches = sortBands(bands).filter((b) => km >= b.minKm && km < b.maxKm)

  if (matches.length > 1) {
    throw new BandConfigurationError(
      `${km}km matches ${matches.length} bands (${matches
        .map((b) => b.code)
        .join(', ')}). Bands must not overlap — a pincode would have two answers.`,
      'OVERLAPPING_RANGES',
      { km, matched: matches.map((b) => b.code) },
    )
  }

  const match = matches[0]
  if (!match) {
    const ordered = sortBands(bands)
    throw new BandConfigurationError(
      `${km}km falls outside every band (${ordered
        .map((b) => `${b.code}=${b.minKm}-${b.maxKm}`)
        .join(', ')}km). Either the distance is wrong or this city needs a wider band.`,
      'NO_MATCHING_BAND',
      { km, ranges: ordered.map((b) => ({ code: b.code, minKm: b.minKm, maxKm: b.maxKm })) },
    )
  }
  return match
}

/** Per-drop pay in paise for a drop at `km`. */
export function payForDistance(bands: readonly DistanceBand[], km: number): Paise {
  return bandForDistance(bands, km).payPaise
}

/**
 * THE INVARIANT. Longer route ⇒ strictly more pay, with no gaps and no
 * overlaps.
 *
 * Validated as a whole SET rather than per-lookup, because the failure mode is
 * a configuration error that sits dormant in the admin panel until a rider
 * notices and starts routing around it. Validating on save is the only moment
 * anyone is looking.
 */
export function assertBandsAreMonotonic(bands: readonly DistanceBand[]): void {
  if (bands.length === 0) {
    throw new BandConfigurationError('No distance bands configured', 'NO_BANDS')
  }

  for (const band of bands) {
    if (!isValidPaise(band.payPaise)) {
      throw new BandConfigurationError(
        `Band ${band.code} has pay ${band.payPaise}. Pay must be a non-negative integer number of paise — no floats, no rupees.`,
        Number.isInteger(band.payPaise) ? 'NEGATIVE_PAY' : 'NON_INTEGER_PAY',
        { band: band.code, payPaise: band.payPaise },
      )
    }
    if (band.maxKm <= band.minKm) {
      throw new BandConfigurationError(
        `Band ${band.code}: maxKm (${band.maxKm}) must exceed minKm (${band.minKm}).`,
        'BAD_BOUNDS',
        { band: band.code, minKm: band.minKm, maxKm: band.maxKm },
      )
    }
  }

  const ordered = sortBands(bands)

  // Contiguity first. A gap means a real distance has no band, which would
  // throw at the worst possible moment — mid-checkout, mid-run.
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!
    const curr = ordered[i]!
    if (curr.minKm < prev.maxKm) {
      throw new BandConfigurationError(
        `Bands ${prev.code} (${prev.minKm}-${prev.maxKm}km) and ${curr.code} (${curr.minKm}-${curr.maxKm}km) overlap.`,
        'OVERLAPPING_RANGES',
        { previous: prev.code, current: curr.code },
      )
    }
    if (curr.minKm > prev.maxKm) {
      throw new BandConfigurationError(
        `Gap between ${prev.code} (ends ${prev.maxKm}km) and ${curr.code} (starts ${curr.minKm}km) — a drop at ${(
          (prev.maxKm + curr.minKm) /
          2
        ).toFixed(2)}km would have no band.`,
        'GAP_IN_RANGES',
        { previous: prev.code, current: curr.code, gapKm: curr.minKm - prev.maxKm },
      )
    }
  }

  // And now the invariant the whole business model rests on.
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!
    const curr = ordered[i]!
    if (curr.payPaise <= prev.payPaise) {
      throw new BandConfigurationError(
        `Band ${curr.code} (${curr.minKm}-${curr.maxKm}km) pays ${curr.payPaise}p, which is NOT more than ${prev.code} (${prev.minKm}-${prev.maxKm}km) at ${prev.payPaise}p. Longer routes must pay strictly more — otherwise the incentive inverts and riders will route around long drops.`,
        'NON_MONOTONIC_PAY',
        {
          previous: { code: prev.code, payPaise: prev.payPaise, maxKm: prev.maxKm },
          current: { code: curr.code, payPaise: curr.payPaise, minKm: curr.minKm },
        },
      )
    }
  }
}

/**
 * Bands from CSV rows — the HQ admin importer's entry point (A-07).
 *
 * Validates the whole set on import so a bad file fails loudly at upload rather
 * than silently at the first out-of-range pincode.
 */
export function bandsFromRows(
  rows: ReadonlyArray<Record<string, string | number>>,
): DistanceBand[] {
  const bands = rows.map((row) => ({
    code: String(row.code).trim(),
    minKm: Number(row.minKm),
    maxKm: Number(row.maxKm),
    payPaise: Number(row.payPaise),
    label: String(row.label ?? row.code).trim(),
  }))
  assertBandsAreMonotonic(bands)
  return bands
}

/**
 * Launch bands, derived from configuration.
 *
 * These are SEED values for a new city's band table, not a constant the
 * application reads at runtime. Once seeded, the `delivery_bands` collection is
 * the source of truth, so a city with different bands works with no code change
 * and no deploy — which is the Phase 0 requirement this module exists to satisfy.
 *
 * The values (₹45 / ₹60 / ₹75 over a 12km zone) come from
 * product-design.md §4.1 and live in `config.business.seedBands` so the founder
 * can change them in the environment rather than by editing a module.
 *
 * Kept here as a convenience for tests and the seeding script, which need a
 * valid band set without a database.
 */
export function defaultLaunchBands(): readonly DistanceBand[] {
  return Object.freeze(
    config.business.seedBands.map((band) => ({
      code: band.code,
      minKm: band.minKm,
      maxKm: band.maxKm,
      payPaise: band.payPaise,
      label: `Band ${band.code} · ${band.minKm}–${band.maxKm} km · ₹${band.payPaise / 100}`,
    })),
  )
}
