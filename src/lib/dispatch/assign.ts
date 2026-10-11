/**
 * Distance-band allocation.
 *
 * ── WHY THIS MODULE IS WHERE THE INCENTIVE ACTUALLY LIVES ───────────────────
 *
 * research/concept.md §8 names "our own service fails the way Urvann's did" as
 * the single most likely failure mode for this business. Urvann's publicly-filed
 * 3PL agreement pays riders ₹65 per order REGARDLESS OF DISTANCE and carries a
 * ₹100 penalty for marking an order delivered without delivering it. They still
 * carry 2.1/5 on Trustpilot and 1.4/5 across 78 PissedConsumer reviews.
 *
 * The penalty is the tell. A penalty clause is written by an operator who has
 * discovered that lying is cheaper than delivering. It is a SYMPTOM of a broken
 * pay structure, not a repair for one — you cannot fine your way out of paying
 * someone the same for a 1km drop and a 12km drop.
 *
 * So the shape here is the inverse, and the inversion has to hold at the moment
 * of ASSIGNMENT, not in a policy document:
 *
 *   1. A dispatch's payout is SNAPSHOT from the city band table at assignment.
 *      Ops editing delivery_bands an hour later must not silently rewrite what
 *      riders already earned. Enforced by a trigger, not by convention.
 *
 *   2. Allocation is by ZONE, then by LOAD. Not by who is closest, not by who is
 *      cheapest, and never by a flat fee. A rider who has already taken three
 *      far drops is not the right person for a fourth, because the marginal
 *      cost of that trip is the highest it will be all day — and if we let load
 *      pile up on whoever is available, the far drops end up on whoever did not
 *      speak up, which is exactly how the incentive inverts in practice.
 *
 *   3. There is NO PENALTY REGIME anywhere in this file or in the schema. Not a
 *      small one, not a token one. The honest action has to BE the cheap action,
 *      and the way to achieve that is to make the dishonest one require the
 *      customer's OTP rather than to threaten the rider afterwards.
 *
 * ── WHY BAND IS A REQUIRED INPUT AND NOT COMPUTED HERE ──────────────────────
 *
 * src/lib/geo/serviceability.ts already records why: band selection needs a
 * DISTANCE, and only the routing engine knows the distance from the drop address
 * to the nursery. A pincode's band is not knowable from the pincode alone. So
 * `assignDispatch` demands the band as an argument and refuses to guess one.
 *
 * Guessing would be the worst outcome available. A wrong guess means a rider is
 * under-paid for a 12km drop, notices, and stops taking long drops — which is
 * Urvann's failure mode arriving through a different door.
 *
 * ── MONEY ───────────────────────────────────────────────────────────────────
 * Integer paise end to end. No floats, no rupees. `ceil` on the payout, so
 * rounding never costs a rider a paise, and because ceil is monotonic it also
 * preserves band ordering after the per-rider multiplier is applied.
 */

import {
  type DistanceBand,
  type Paise,
  assertBandsAreMonotonic,
  bandForDistance,
} from '@/lib/geo/bands'

/** Basis points. 10000 = 1.0×. Integer — a float here is a rounding bug. */
export type BasisPoints = number

/** Mirrors the `dispatches_status_is_known` CHECK in schema.sql. */
export const DISPATCH_STATUSES = [
  'ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const

export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

/** Terminal states — no transition leaves these. Mirrors the transition trigger. */
export const TERMINAL_STATUSES: readonly DispatchStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED']

/**
 * Legal transitions.
 *
 * Lives here, beside the status vocabulary, rather than in the server store — it
 * is pure logic and belongs with the rest of the pure logic. Mirrors
 * `upvvan_dispatch_transition_is_legal` in schema.sql, which refuses the same
 * edges at the database level for every writer.
 *
 * DELIVERED/FAILED/CANCELLED have no outgoing edges. There is no path backwards
 * from a delivered drop, because un-delivering is precisely what a mutable status
 * column exists to allow.
 */
const LEGAL_NEXT: Record<DispatchStatus, readonly DispatchStatus[]> = {
  ASSIGNED: ['PICKED_UP', 'FAILED', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
}

export function isLegalTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return LEGAL_NEXT[from]?.includes(to) ?? false
}

/** `OUT_FOR_DELIVERY` → `out for delivery`. */
export function humanStatus(status: DispatchStatus): string {
  return status.replace(/_/g, ' ').toLowerCase()
}

export type AssignmentErrorCode =
  | 'NO_ACTIVE_RIDER'
  | 'ALL_RIDERS_AT_CAPACITY'
  | 'BAND_NOT_CONFIGURED'
  | 'NON_MONOTONIC_BANDS'
  | 'BAD_MULTIPLIER'
  | 'NON_INTEGER_PAY'

export class AssignmentError extends Error {
  constructor(
    message: string,
    readonly code: AssignmentErrorCode,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AssignmentError'
  }
}

export interface CandidateRider {
  id: string | number
  name: string
  cityId: string | number
  zoneId: string | number | null
  active: boolean
  /** Per-rider override. Null = use the zone's capacity. */
  maxDropsPerDay: number | null
  payMultiplierBp: BasisPoints
}

export interface DispatchLoad {
  riderId: string | number
  /** Any non-terminal status counts against a rider's daily capacity. */
  status: DispatchStatus
  assignedAt: Date | string
}

export interface ZoneCapacity {
  zoneId: string | number
  maxDailyDrops: number | null
}

export interface AssignInput {
  orderId: string | number
  cityId: string | number
  /** The order's zone. Allocation is zone-first; see the header. */
  zoneId: string | number | null
  /** The band's distance. See "WHY BAND IS A REQUIRED INPUT" above. */
  distanceKm: number
  /** The city's band rows, loaded from `delivery_bands`. */
  bands: readonly DistanceBand[]
  riders: readonly CandidateRider[]
  /** Today's dispatches, for the load calculation. */
  loads: readonly DispatchLoad[]
  zones: readonly ZoneCapacity[]
}

export interface PaySnapshot {
  bandCode: string
  bandPayPaise: Paise
  payMultiplierBp: BasisPoints
  payoutPaise: Paise
}

export interface Assignment extends PaySnapshot {
  riderId: string | number
  riderName: string
  zoneId: string | number | null
  /** Drops this rider already holds today, before this one. */
  loadBefore: number
  capacity: number | null
}

/**
 * `id` arrives from route params and JSON bodies; `json_agg` returns numbers.
 * Comparing with `===` silently reports a mismatch — and for a rider lookup
 * that means "no such rider" on a row that plainly exists. Same trap
 * `sameId()` in serviceability.ts exists to close.
 */
function sameId(a: string | number | null, b: string | number | null): boolean {
  if (a == null || b == null) return a === b
  return String(a) === String(b)
}

function assertIntegerPaise(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new AssignmentError(
      `${label} must be an integer number of paise, received ${value}. No floats, no rupees.`,
      'NON_INTEGER_PAY',
      { value },
    )
  }
}

/**
 * Payout for a band at a per-rider multiplier.
 *
 * ceil, not round. Two reasons, and the second is the one that matters:
 *
 *   · A rider is never paid less than the band rate because of our rounding.
 *   · ceil is MONOTONIC. Multiplying bands by a multiplier and rounding keeps
 *     them strictly ordered, so the "longer route pays strictly more" invariant
 *     survives the per-rider adjustment. A `round()` can collapse two adjacent
 *     bands onto the same paise — 4500p at 1.0001x and 4501p at 1.0001x both
 *     land on 4501 — and that silently reinstates the flat-pay structure this
 *     whole business model exists to avoid.
 *
 * The multiplier is validated > 0 rather than >= 10000: a per-rider DISCOUNT is
 * a legitimate operational tool (a new rider on a probationary rate), and it
 * cannot break band ordering either, because scaling by any positive scalar
 * preserves strict order.
 */
export function payoutForBand(bandPayPaise: Paise, multiplierBp: BasisPoints): Paise {
  assertIntegerPaise(bandPayPaise, 'Band pay')
  if (!Number.isInteger(multiplierBp) || multiplierBp <= 0) {
    throw new AssignmentError(
      `Pay multiplier must be a positive whole number of basis points, received ${multiplierBp}.`,
      'BAD_MULTIPLIER',
      { multiplierBp },
    )
  }
  return Math.ceil((bandPayPaise * multiplierBp) / 10_000)
}

/**
 * The snapshot written onto every dispatch at assignment.
 *
 * Taken ONCE, here, and made immutable by trigger immediately after. This is
 * the entire reason a later edit to `delivery_bands` cannot rewrite history: the
 * dispatch row carries its own copy of the commercial terms that applied when
 * the drop was handed over.
 */
export function snapshotPay(band: DistanceBand, multiplierBp: BasisPoints): PaySnapshot {
  assertIntegerPaise(band.payPaise, `Band ${band.code} pay`)
  const payoutPaise = payoutForBand(band.payPaise, multiplierBp)
  return {
    bandCode: band.code,
    bandPayPaise: band.payPaise,
    payMultiplierBp: multiplierBp,
    payoutPaise,
  }
}

/**
 * Riders eligible for a drop, most loaded LAST.
 *
 * Zone-first, and a rider with no zone is NOT a wildcard. An unzoned rider is a
 * rider ops has not yet placed, and treating "no zone" as "can do anything" means
 * an unassigned rider silently absorbs drops from across the city. Excluded.
 */
function eligibleRiders(input: AssignInput): CandidateRider[] {
  return input.riders.filter(
    (r) =>
      r.active &&
      sameId(r.cityId, input.cityId) &&
      r.zoneId != null &&
      sameId(r.zoneId, input.zoneId),
  )
}

/** Open (non-terminal) dispatches per rider, for `date_trunc('day', assigned_at)`. */
function loadByRider(input: AssignInput): Map<string, number> {
  const loads = new Map<string, number>()
  for (const load of input.loads) {
    if (TERMINAL_STATUSES.includes(load.status)) continue
    const key = String(load.riderId)
    loads.set(key, (loads.get(key) ?? 0) + 1)
  }
  return loads
}

/**
 * Pick a rider and snapshot the pay. The single allocation entry point.
 *
 * Throws rather than returning null on failure. An ops console that renders "no
 * rider available" and one that renders an unassigned drop because a query
 * returned nothing look identical on a dispatch board, and the second is how a
 * plant goes out of a door unaccounted for.
 */
export function assignDispatch(input: AssignInput): Assignment {
  // A bad band set would quietly pay everyone wrongly. `assertBandsAreMonotonic`
  // is the same guard the `delivery-bands` collection runs on save — re-run it
  // here because a direct SQL write can bypass that hook, and this is the code
  // that would cash out the damage.
  try {
    assertBandsAreMonotonic(input.bands)
  } catch (err) {
    throw new AssignmentError(
      `City ${input.cityId} has an unusable band configuration: ${(err as Error).message}`,
      'NON_MONOTONIC_BANDS',
      { cause: err },
    )
  }

  let band: DistanceBand
  try {
    band = bandForDistance(input.bands, input.distanceKm)
  } catch (err) {
    throw new AssignmentError(
      `No delivery band covers a drop at ${input.distanceKm}km in city ${input.cityId}. ` +
        'A dispatch cannot be assigned without a band, because the band IS the rider pay — ' +
        'an unbanded drop would be paid at zero and would be dropped by the rider.',
      'BAND_NOT_CONFIGURED',
      { distanceKm: input.distanceKm, cityId: input.cityId, cause: err },
    )
  }

  const eligible = eligibleRiders(input)
  if (eligible.length === 0) {
    throw new AssignmentError(
      `No active rider covers zone ${input.zoneId} in city ${input.cityId}. ` +
        'Assign a rider to this zone before assigning drops to it.',
      'NO_ACTIVE_RIDER',
      { zoneId: input.zoneId, cityId: input.cityId },
    )
  }

  const loads = loadByRider(input)

  const scored = eligible
    .map((rider) => {
      const key = String(rider.id)
      const loadBefore = loads.get(key) ?? 0

      // Per-rider override wins; the zone capacity is the default. A rider on a
      // two-wheeler carrying a 40kg planter set genuinely cannot do eight drops.
      const zoneCap = input.zones.find((z) => sameId(z.zoneId, input.zoneId))?.maxDailyDrops ?? null
      const capacity = rider.maxDropsPerDay ?? zoneCap

      return { rider, loadBefore, capacity }
    })
    .filter((c) => c.capacity == null || c.loadBefore < c.capacity)

  if (scored.length === 0) {
    const attempted = eligible.map((r) => {
      const held = loads.get(String(r.id)) ?? 0
      const zoneCap = input.zones.find((z) => sameId(z.zoneId, r.zoneId))?.maxDailyDrops ?? null
      const cap = r.maxDropsPerDay ?? zoneCap
      return `${r.name} (${held}/${cap ?? 'no cap'})`
    })
    throw new AssignmentError(
      `Every rider in zone ${input.zoneId} is at capacity today (${attempted.join(', ')}). ` +
        'Raise a rider max_drops_per_day, add a rider to the zone, or move the drop to a later run.',
      'ALL_RIDERS_AT_CAPACITY',
      { zoneId: input.zoneId, attempted },
    )
  }

  /*
   * LEAST LOADED FIRST.
   *
   * This is the load-balancing decision, and it is deliberately NOT weighted by
   * pay or distance. Sorting by "who has earned the least today" would put every
   * far, well-paid drop onto whoever has been unlucky so far — which converts a
   * fairness rule into a penalty for being given good work, and riders notice
   * within a week.
   *
   * Count is also the honest unit. Band pay is a proxy for effort, not a measure
   * of it; sorting on the proxy starts rewarding the manipulation of the proxy.
   *
   * Ties break on rider id so the same input always yields the same assignment.
   * A board where the same order assigns differently on each click makes the
   * dispatch log unreadable as an audit trail.
   */
  scored.sort((a, b) => {
    if (a.loadBefore !== b.loadBefore) return a.loadBefore - b.loadBefore
    return Number(a.rider.id) - Number(b.rider.id)
  })

  const winner = scored[0]!
  const pay = snapshotPay(band, winner.rider.payMultiplierBp)

  return {
    riderId: winner.rider.id,
    riderName: winner.rider.name,
    zoneId: input.zoneId,
    loadBefore: winner.loadBefore,
    capacity: winner.capacity,
    ...pay,
  }
}
