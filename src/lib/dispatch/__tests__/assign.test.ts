/**
 * Allocation and payout — pure unit tests, no database.
 *
 * These encode the incentive fix. research/concept.md §8 names "our own service
 * fails the way Urvann's did" as the most likely failure mode, and Urvann's
 * public contract pays ₹65 per order regardless of distance and penalises fake
 * delivery marking at ₹100. A flat per-order payout plus a fine is a structure in
 * which lying is the cheapest available action — and it produced a 2.1/5 rating.
 *
 * Every assertion below is about keeping the honest action the cheap one:
 *   · longer route ⇒ strictly more pay
 *   · that ordering survives a per-rider multiplier
 *   · allocation spreads load rather than concentrating it
 *   · an unbanded drop is REFUSED rather than paid at zero
 */

import { describe, it, expect } from 'vitest'

import {
  AssignmentError,
  assignDispatch,
  payoutForBand,
  snapshotPay,
  isLegalTransition,
  TERMINAL_STATUSES,
} from '../assign'
import { defaultLaunchBands, type DistanceBand } from '@/lib/geo/bands'
import { minMultiplierBpFor, multiplierPreservesBandOrdering } from '../pay'

/** The smallest multiplier that keeps this city's bands strictly ordered. */
const safeFloorFor = (bands: Parameters<typeof minMultiplierBpFor>[0]) =>
  minMultiplierBpFor(bands)

const BANDS = defaultLaunchBands()

const band = (code: string, minKm: number, maxKm: number, payPaise: number): DistanceBand => ({
  code,
  minKm,
  maxKm,
  payPaise,
  label: `${code} ${minKm}-${maxKm}km`,
})

const rider = (over: Partial<Parameters<typeof assignDispatch>[0]['riders'][number]> = {}) => ({
  id: 1,
  name: 'Rider',
  cityId: 1,
  zoneId: 10,
  active: true,
  maxDropsPerDay: null,
  payMultiplierBp: 10_000,
  ...over,
})

const base = (over: Partial<Parameters<typeof assignDispatch>[0]> = {}) => ({
  orderId: 100,
  cityId: 1,
  zoneId: 10,
  distanceKm: 2,
  bands: BANDS,
  riders: [rider()],
  loads: [],
  zones: [],
  ...over,
})

describe('payout arithmetic', () => {
  it('is the band rate at a 1.0x multiplier', () => {
    expect(payoutForBand(4500, 10_000)).toBe(4500)
  })

  it('applies a per-rider uplift', () => {
    expect(payoutForBand(7500, 11_500)).toBe(8625)
  })

  it('rounds UP, so our rounding never costs a rider a paise', () => {
    // 4500 * 1.0001 = 4500.45 → 4501, never 4500.
    expect(payoutForBand(4500, 10_001)).toBe(4501)
    expect(payoutForBand(4501, 10_001)).toBe(4502)
  })

  it('refuses a non-integer band pay — money is integer paise', () => {
    expect(() => payoutForBand(4500.5, 10_000)).toThrow(/integer number of paise/)
  })

  it('refuses a zero or negative multiplier', () => {
    // A zero multiplier would make every band pay zero, which is Urvann's
    // problem in a different costume: the rider is paid the same for everything,
    // including nothing.
    expect(() => payoutForBand(4500, 0)).toThrow(AssignmentError)
    expect(() => payoutForBand(4500, -1)).toThrow(AssignmentError)
  })
})

describe('THE INCENTIVE INVARIANT: longer route pays strictly more', () => {
  it('holds for the launch bands', () => {
    const payouts = BANDS.map((b) => payoutForBand(b.payPaise, 10_000))
    for (let i = 1; i < payouts.length; i++) {
      expect(payouts[i]!).toBeGreaterThan(payouts[i - 1]!)
    }
  })

  it('SURVIVES a per-rider multiplier — this is why pay is a multiplier, not an amount', () => {
    // The whole reason `pay_multiplier_bp` exists rather than a rupee figure.
    // An absolute per-rider amount could make a 12km drop pay less than a 3km
    // one; scaling every band by one positive number cannot.
    //
    // The range starts at the SAFE floor for these bands, not at 1. See the
    // `collapses adjacent bands` test below for what happens below it — this
    // property is NOT unconditional, and the floor is what makes it true.
    for (const bp of [safeFloorFor(BANDS), 5000, 10_000, 11_500, 99_999]) {
      const payouts = BANDS.map((b) => payoutForBand(b.payPaise, bp))
      for (let i = 1; i < payouts.length; i++) {
        expect(payouts[i]!).toBeGreaterThan(payouts[i - 1]!)
      }
    }
  })

  it('COLLAPSES adjacent bands below the safe floor — the bug this floor exists for', () => {
    // `ceil` is monotonic but NOT strictly increasing. At 1bp the launch bands
    // all round to 1 paise, which is flat per-order pay arriving through the
    // multiplier field. This test documents the hazard so the floor cannot be
    // quietly removed.
    const payouts = BANDS.map((b) => payoutForBand(b.payPaise, 1))
    expect(new Set(payouts).size).toBeLessThan(BANDS.length)
    expect(multiplierPreservesBandOrdering(1, BANDS)).toBe(false)
  })

  it('the floor is a GUARANTEED bound — below it, ordering is merely not guaranteed', () => {
    // `floor = ceil(10000 / smallestGap)` guarantees the exact (pre-rounding)
    // gap between adjacent payouts is at least 1 paise, which implies their
    // ceils differ. So the floor is always SAFE.
    //
    // It is not the exact minimum: some band sets happen to stay ordered a basis
    // point lower, because ceil can still separate values whose exact gap is
    // under 1. Asserting "floor - 1 always breaks" would be wrong, and asserting
    // "floor - 1 always works" would be wrong too. What is true — and what the
    // floor is FOR — is that at or above it the invariant holds for any band set,
    // and below it there exists a band set that breaks it (see the 1bp case).
    const floor = safeFloorFor(BANDS)
    for (let bp = floor; bp <= 40_000; bp += 137) {
      expect(multiplierPreservesBandOrdering(bp, BANDS)).toBe(true)
    }
    expect(multiplierPreservesBandOrdering(1, BANDS)).toBe(false)
  })

  it('computes the floor from the city OWN bands, not a constant', () => {
    // Wider band gaps tolerate a smaller multiplier. A hardcoded floor would
    // either over-restrict a city with wide bands or under-protect one with narrow
    // ones — and would break "adding a city costs zero code changes".
    const narrow = [band('A', 0, 3, 1000), band('B', 3, 7, 1001)]
    const wide = [band('A', 0, 3, 1000), band('B', 3, 7, 9000)]
    expect(minMultiplierBpFor(narrow)).toBe(10_000)
    expect(minMultiplierBpFor(wide)).toBe(2)
  })

  it('survives rounding up, which is monotonic', () => {
    // A `round()` could collapse two adjacent bands onto the same paise and
    // silently reinstate flat pay. `ceil` cannot.
    const payouts = BANDS.map((b) => payoutForBand(b.payPaise, 10_001))
    expect(new Set(payouts).size).toBe(payouts.length)
  })

  it('refuses a band set that pays the same for a short and a long drop', () => {
    // The exact structure that produced Urvann's 1.4/5.
    const flat = [band('A', 0, 3, 6500), band('B', 3, 7, 6500), band('C', 7, 12, 6500)]
    expect(() => assignDispatch(base({ bands: flat }))).toThrow(/must be strictly more|unusable/i)
  })

  it('refuses a band set with a gap, so a real distance can never be unbanded', () => {
    const gapped = [band('A', 0, 3, 4500), band('C', 7, 12, 7500)]
    expect(() => assignDispatch(base({ bands: gapped }))).toThrow(/unusable/i)
  })
})

describe('an unbanded drop is REFUSED, never paid at zero', () => {
  it('rejects a distance past the top band', () => {
    // 40km with a 12km ceiling. Silently paying the top band would hide the
    // configuration error; silently paying zero would make the rider drop it.
    expect(() => assignDispatch(base({ distanceKm: 40 }))).toThrow(AssignmentError)
    try {
      assignDispatch(base({ distanceKm: 40 }))
    } catch (err) {
      expect((err as AssignmentError).code).toBe('BAND_NOT_CONFIGURED')
      expect((err as Error).message).toMatch(/paid at zero/)
    }
  })

  it('accepts the half-open boundary: exactly 3km is band B', () => {
    expect(snapshotPay(BANDS[1]!, 10_000).bandCode).toBe('B')
    expect(assignDispatch(base({ distanceKm: 3 })).bandCode).toBe('B')
  })
})

describe('the snapshot is what the band said AT THAT MOMENT', () => {
  it('carries the band, its rate, the multiplier and the payout', () => {
    const snap = snapshotPay(BANDS[2]!, 11_500)
    expect(snap).toEqual({
      bandCode: 'C',
      bandPayPaise: 7500,
      payMultiplierBp: 11_500,
      payoutPaise: 8625,
    })
  })

  it('does not change when the band table is later edited', () => {
    // The immutability of this object is enforced by a trigger, but the value
    // must be self-contained first: a snapshot that re-read the band would be
    // rewritten by ops editing delivery_bands an hour later.
    const snap = snapshotPay(BANDS[2]!, 10_000)
    const edited = [{ ...BANDS[2]!, payPaise: 99_900 }, ...BANDS.slice(0, 2)]
    expect(snap.payoutPaise).toBe(7500)
    expect(snapshotPay(edited[0]!, 10_000).payoutPaise).toBe(99_900)
    expect(snap.payoutPaise).not.toBe(snapshotPay(edited[0]!, 10_000).payoutPaise)
  })
})

describe('allocation: zone first, then least loaded', () => {
  it('refuses a rider who is in a DIFFERENT zone, rather than using them', () => {
    // The failure this prevents: an unzoned or wrongly-zoned rider silently
    // absorbing drops from across the city.
    try {
      assignDispatch(base({ riders: [rider({ id: 1, name: 'WrongZone', zoneId: 99 })] }))
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as AssignmentError).code).toBe('NO_ACTIVE_RIDER')
    }
  })

  it('throws when no active rider covers the zone', () => {
    try {
      assignDispatch(base({ riders: [rider({ id: 1, active: false })] }))
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as AssignmentError).code).toBe('NO_ACTIVE_RIDER')
    }
  })

  it('treats an UNZONED rider as ineligible, not as covering everywhere', () => {
    try {
      assignDispatch(base({ riders: [rider({ id: 1, zoneId: null })] }))
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as AssignmentError).code).toBe('NO_ACTIVE_RIDER')
    }
  })

  it('excludes a rider from another city', () => {
    try {
      assignDispatch(base({ riders: [rider({ id: 1, cityId: 2 })] }))
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as AssignmentError).code).toBe('NO_ACTIVE_RIDER')
    }
  })

  it('picks the LEAST LOADED rider', () => {
    const a = assignDispatch(
      base({
        riders: [
          rider({ id: 1, name: 'Busy' }),
          rider({ id: 2, name: 'Free' }),
          rider({ id: 3, name: 'Busier' }),
        ],
        loads: [
          { riderId: 1, status: 'ASSIGNED', assignedAt: new Date() },
          { riderId: 1, status: 'PICKED_UP', assignedAt: new Date() },
          { riderId: 3, status: 'OUT_FOR_DELIVERY', assignedAt: new Date() },
        ],
      }),
    )
    expect(a.riderName).toBe('Free')
  })

  it('does NOT sort by earnings — that would punish a rider for good work', () => {
    // If allocation preferred whoever has earned least today, every well-paid
    // far drop would land on whoever has been unlucky. Load count is the honest
    // unit: band pay is a proxy for effort, not a measure of it.
    const a = assignDispatch(
      base({
        riders: [rider({ id: 1, name: 'Earned' }), rider({ id: 2, name: 'Fresh' })],
        loads: [{ riderId: 1, status: 'ASSIGNED', assignedAt: new Date() }],
      }),
    )
    expect(a.riderName).toBe('Fresh')
  })

  it('is deterministic — the same input always assigns the same rider', () => {
    const input = base({
      riders: [rider({ id: 7, name: 'Seven' }), rider({ id: 3, name: 'Three' })],
    })
    expect(assignDispatch(input).riderName).toBe(assignDispatch(input).riderName)
  })

  it('ignores terminal loads when counting capacity', () => {
    // A delivered drop must not count against today's capacity, or a rider who
    // finished early is penalised for being efficient.
    const a = assignDispatch(
      base({
        riders: [rider({ id: 1, name: 'Done' }), rider({ id: 2, name: 'Working' })],
        loads: [{ riderId: 1, status: 'DELIVERED', assignedAt: new Date() }],
      }),
    )
    expect(a.riderName).toBe('Done')
  })
})

describe('capacity is a real limit, and the error names who is full', () => {
  it('excludes a rider at capacity', () => {
    const a = assignDispatch(
      base({
        riders: [rider({ id: 1, name: 'Full', maxDropsPerDay: 2 }), rider({ id: 2, name: 'Room' })],
        loads: [
          { riderId: 1, status: 'ASSIGNED', assignedAt: new Date() },
          { riderId: 1, status: 'ASSIGNED', assignedAt: new Date() },
        ],
      }),
    )
    expect(a.riderName).toBe('Room')
  })

  it('falls back to the zone capacity when the rider has no override', () => {
    const a = assignDispatch(
      base({
        riders: [rider({ id: 1, name: 'ZoneFull', maxDropsPerDay: null }), rider({ id: 2, name: 'ZoneRoom' })],
        loads: [{ riderId: 1, status: 'ASSIGNED', assignedAt: new Date() }],
        zones: [{ zoneId: 10, maxDailyDrops: 1 }],
      }),
    )
    expect(a.riderName).toBe('ZoneRoom')
  })

  it('throws when EVERYONE is full, naming the counts', () => {
    try {
      assignDispatch(
        base({
          riders: [rider({ id: 1, name: 'Asha', maxDropsPerDay: 1 })],
          loads: [{ riderId: 1, status: 'ASSIGNED', assignedAt: new Date() }],
        }),
      )
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as AssignmentError).code).toBe('ALL_RIDERS_AT_CAPACITY')
      // The operator needs to know WHERE to act.
      expect((err as Error).message).toMatch(/Asha/)
      expect((err as Error).message).toMatch(/max_drops_per_day/)
    }
  })
})

describe('id types: route params are strings, json_agg returns numbers', () => {
  it('matches a rider whose id arrives as a string', () => {
    const a = assignDispatch(base({ riders: [rider({ id: '42', name: 'Stringly' })] }))
    expect(a.riderName).toBe('Stringly')
  })

  it('treats a null zone on the order as "no zone", not as matching every zone', () => {
    try {
      assignDispatch(base({ zoneId: null }))
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as AssignmentError).code).toBe('NO_ACTIVE_RIDER')
    }
  })
})

describe('the state machine a rider cannot walk backwards through', () => {
  it('allows the forward path', () => {
    expect(isLegalTransition('ASSIGNED', 'PICKED_UP')).toBe(true)
    expect(isLegalTransition('PICKED_UP', 'OUT_FOR_DELIVERY')).toBe(true)
    expect(isLegalTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true)
  })

  it('refuses to skip the pickup', () => {
    expect(isLegalTransition('ASSIGNED', 'OUT_FOR_DELIVERY')).toBe(false)
    expect(isLegalTransition('ASSIGNED', 'DELIVERED')).toBe(false)
  })

  it('refuses to un-deliver, un-fail or un-cancel', () => {
    // "Un-delivering is what a mutable status column is FOR" — a complaint
    // dispute handled by flipping a boolean back is not an audit trail.
    for (const terminal of TERMINAL_STATUSES) {
      expect(isLegalTransition(terminal, 'ASSIGNED')).toBe(false)
      expect(isLegalTransition(terminal, 'OUT_FOR_DELIVERY')).toBe(false)
    }
  })
})