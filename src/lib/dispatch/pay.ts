/**
 * The pay MULTIPLIER below which this city's bands stop being distinguishable.
 *
 * ── WHY THIS FUNCTION EXISTS, AND WHY A TEST FOUND IT ──────────────────────
 *
 * `payoutForBand` uses `ceil`, and `ceil` is monotonic — but "monotonic" is not
 * "strictly increasing" once the multiplier is small enough that adjacent bands
 * round onto the same paise.
 *
 * With the launch bands, at 1 basis point (0.0001×):
 *
 *     4500p × 1bp → ceil(0.45) = 1p
 *     6000p × 1bp → ceil(0.60) = 1p
 *     7500p × 1bp → ceil(0.75) = 1p
 *
 * All three bands pay 1 paise. That is flat-per-order pay — the exact structure
 * that produced Urvann's 1.4/5 — arriving through the multiplier field instead
 * of the band table. And it is invisible: the row looks configured, the payout
 * is an integer, nothing throws.
 *
 * It was found by a property test asserting the ordering invariant across a
 * range of multipliers, not by reading the code. Worth recording, because the
 * obvious "ceil is monotonic, we're fine" reasoning is exactly what missed it.
 *
 * ── THE FLOOR ──────────────────────────────────────────────────────────────
 *
 * For adjacent bands to stay distinct under ceil, the gap between their base
 * pays must span at least one whole basis-point-scaled unit:
 *
 *     gap × multiplierBp / 10000  ≥  1    ⟹    multiplierBp ≥ 10000 / gap
 *
 * So the floor is `ceil(10000 / smallestGap)`, where the smallest gap is over the
 * city's OWN bands — not a constant, because a city with wider bands tolerates a
 * smaller multiplier. Computing it per city is what keeps "adding a city costs
 * zero code changes" true.
 *
 * This is a GUARANTEED bound, not the exact minimum. At or above it the ordering
 * holds for ANY band set, because the pre-rounding gap is provably at least one
 * whole paise. Below it some particular band sets still happen to stay ordered —
 * ceil can separate values whose exact gap is under 1 — so the bound errs toward
 * refusing a legal value rather than toward accepting an illegal one. That is the
 * right direction for a money invariant: a probationary rate set one basis point
 * too low is a five-minute fix, and a flat-per-order payout nobody noticed is not.
 *
 * A per-rider DISCOUNT below 10000bp stays legal as long as it stays above this
 * floor: paying a probationary rider less is fine, paying a far drop the same as
 * a near one is not.
 */
export function minMultiplierBpFor(bands: ReadonlyArray<{ payPaise: number }>): number {
  const pays = [...bands].map((b) => b.payPaise).sort((a, b) => a - b)
  if (pays.length < 2) return 1

  let smallestGap = Number.POSITIVE_INFINITY
  for (let i = 1; i < pays.length; i++) {
    smallestGap = Math.min(smallestGap, pays[i]! - pays[i - 1]!)
  }
  if (smallestGap <= 0) return Number.POSITIVE_INFINITY
  return Math.ceil(10_000 / smallestGap)
}

/**
 * Does this multiplier keep every band in this city strictly ordered after
 * rounding? The check the Riders collection and the DB trigger both use.
 */
export function multiplierPreservesBandOrdering(
  multiplierBp: number,
  bands: ReadonlyArray<{ payPaise: number }>,
): boolean {
  if (!Number.isInteger(multiplierBp) || multiplierBp <= 0) return false
  let previous = -1
  for (const band of [...bands].sort((a, b) => a.payPaise - b.payPaise)) {
    const payout = Math.ceil((band.payPaise * multiplierBp) / 10_000)
    if (payout <= previous) return false
    previous = payout
  }
  return true
}

/** Copy for the admin panel when a multiplier is rejected. */
export function explainMultiplierFloor(
  multiplierBp: number,
  bands: ReadonlyArray<{ payPaise: number }>,
): string {
  const floor = minMultiplierBpFor(bands)
  return (
    `At ${multiplierBp}bp the rounded payouts of two bands would come out equal, so a longer ` +
    `route would pay the same as a shorter one — the flat per-order payment that produced a ` +
    `competitor's 1.4/5 rating. Use at least ${floor}bp for this city's bands.`
  )
}

/**
 * Shared money validation and the copy that explains it.
 *
 * WHY A SEPARATE MODULE FOR TWO FUNCTIONS
 * ---------------------------------------
 * Because `DeliveryBands.payPaise` and `Riders.payMultiplierBp` are BOTH money
 * expressed in integer units, they need the same refusal: a float, a negative,
 * or a nonsense value must be rejected at the boundary with the same wording.
 *
 * Duplicating the check in each collection means the two can drift — and the
 * failure is silent. A band that accepted 4500.5 while a rider multiplier
 * rejected the same shape would produce a payout the schema's CHECK
 * (`dispatches_payout_matches_snapshot`) then refuses to store, so the
 * dispatch fails at 6pm with a constraint violation instead of at save time with
 * a sentence explaining what was wrong.
 *
 * So: one validator, used by both, and the WHY lives with it.
 */

/**
 * Integer-unit validation.
 *
 * `isMultiplier` switches the wording and the upper bound. A pay multiplier is
 * not money — it is a scale factor — so capping it at 100000bp (10×) is
 * sensible: past that, somebody has typed a number that means nothing, and a
 * 1000× rider payout would pass every integer check this codebase has.
 */
export function isValidPayPaise(
  value: number | null | undefined,
  label: string,
  isMultiplier = false,
): true | string {
  if (value == null) return `${label} is required.`
  if (!Number.isFinite(value)) return `${label} must be a number.`
  if (!Number.isInteger(value)) {
    return isMultiplier
      ? 'Use whole basis points — 11500 means 15% above the band rate, not 1.15.'
      : 'Money is integer paise. 4500 means ₹45; decimals and rupee amounts are refused.'
  }
  if (value <= 0) {
    return isMultiplier
      ? 'The multiplier must be above zero. Zero or negative would make longer routes pay less, which is the exact failure we are avoiding.'
      : 'Pay cannot be negative.'
  }
  if (isMultiplier && value > 100_000) {
    return 'A multiplier above 10× the band rate is a typo, not a pay policy.'
  }
  return true
}

/**
 * The `payMultiplierBp` field description.
 *
 * Exported as a function so the reasoning travels WITH the field rather than
 * living in a comment that a future edit to the field will not read. The admin
 * panel description is the only place an operator sees why this is a multiplier,
 * and an operator who sets 4500 here instead of 10000 would otherwise be
 * quietly reinstating the flat per-order payment.
 */
export function payMultiplierHelp(): string {
  return [
    'Basis points against the city distance band, NOT a rupee amount.',
    '10000 = exactly the band rate (the usual case). 11500 = 15% above it.',
    'Why a multiplier: multiplying every band by one positive number keeps them in order, so a per-rider uplift can never make a 12km drop pay less than a 3km one.',
    "A flat rupee amount here would reinstate exactly the pay structure that produced a competitor's 1.4/5 rating.",
    "Each drop's payout is snapshotted when it is assigned, so changing this later does not change what riders have already earned.",
  ].join(' ')
}
