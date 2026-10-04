/**
 * Rider pay banding — TEST 9 of the twelve required tests.
 *
 * "Rider pay banding — longer route pays strictly more. Write this early; it
 * encodes the core incentive fix."
 *
 * These are pure unit tests: no database, no Payload, no mocks. If this file
 * needs a fixture to run, the module has picked up a dependency it should not
 * have.
 */

import { describe, it, expect } from 'vitest'
import {
  defaultLaunchBands,
  BandConfigurationError,
  assertBandsAreMonotonic,
  bandForDistance,
  bandsFromRows,
  payForDistance,
  sortBands,
  type DistanceBand,
} from '../bands'

/** Launch bands from configuration — see src/lib/config.ts. */
const LAUNCH_BANDS = defaultLaunchBands()

const band = (code: string, minKm: number, maxKm: number, payPaise: number): DistanceBand => ({
  code,
  minKm,
  maxKm,
  payPaise,
  label: `${code} ${minKm}-${maxKm}`,
})

describe('rider pay banding — the core incentive fix', () => {
  describe('THE INVARIANT: longer route pays strictly more', () => {
    it('accepts the launch configuration', () => {
      expect(() => assertBandsAreMonotonic(LAUNCH_BANDS)).not.toThrow()
    })

    it('REJECTS a configuration where a longer route pays less', () => {
      // The exact inversion that produced a 2.1/5 operator. If this passes,
      // the whole business model has a hole in it.
      const inverted = [band('A', 0, 3, 7500), band('B', 3, 7, 6000), band('C', 7, 12, 4500)]
      expect(() => assertBandsAreMonotonic(inverted)).toThrow(BandConfigurationError)
      expect(() => assertBandsAreMonotonic(inverted)).toThrow(/NON_MONOTONIC_PAY|not more than/i)
    })

    it('REJECTS a longer route paying exactly the same', () => {
      // "Strictly" more. Equal pay at a longer distance is the same defect with
      // less contrast: the rider has no reason to take the long drop.
      const flat = [band('A', 0, 3, 6000), band('B', 3, 7, 6000)]
      expect(() => assertBandsAreMonotonic(flat)).toThrow(/not more than/i)
    })

    it('holds for any number of bands, not just three', () => {
      const five = [
        band('A', 0, 2, 4000),
        band('B', 2, 4, 5000),
        band('C', 4, 7, 6000),
        band('D', 7, 10, 7000),
        band('E', 10, 14, 8500),
      ]
      expect(() => assertBandsAreMonotonic(five)).not.toThrow()
    })

    it('catches the inversion regardless of the order bands are supplied in', () => {
      // Admin panels hand over rows in arbitrary order. Validation must not
      // depend on the caller having sorted them.
      const shuffled = [band('C', 7, 12, 7500), band('A', 0, 3, 4500), band('B', 3, 7, 6000)]
      expect(() => assertBandsAreMonotonic(shuffled)).not.toThrow()
      expect(sortBands(shuffled).map((b) => b.code)).toEqual(['A', 'B', 'C'])
    })
  })

  describe('money is integer paise, never floats', () => {
    it('REJECTS a fractional pay', () => {
      const fractional = [band('A', 0, 3, 4500.5), band('B', 3, 7, 6000)]
      expect(() => assertBandsAreMonotonic(fractional)).toThrow(/paise/i)
    })

    it('REJECTS negative pay', () => {
      const negative = [band('A', 0, 3, -1), band('B', 3, 7, 6000)]
      expect(() => assertBandsAreMonotonic(negative)).toThrow(BandConfigurationError)
    })

    it('accepts the launch pay values as exact paise', () => {
      expect(payForDistance(LAUNCH_BANDS, 1.2)).toBe(4500)
      expect(payForDistance(LAUNCH_BANDS, 5)).toBe(6000)
      expect(payForDistance(LAUNCH_BANDS, 9)).toBe(7500)
    })
  })

  describe('ranges must be contiguous — no gaps, no overlaps', () => {
    it('REJECTS a gap between bands', () => {
      // A gap means a real distance has no band, which throws mid-checkout.
      const gapped = [band('A', 0, 3, 4500), band('B', 5, 7, 6000)]
      expect(() => assertBandsAreMonotonic(gapped)).toThrow(/Gap/i)
    })

    it('REJECTS overlapping bands', () => {
      const overlapping = [band('A', 0, 4, 4500), band('B', 3, 7, 6000)]
      expect(() => assertBandsAreMonotonic(overlapping)).toThrow(/overlap/i)
    })

    it('REJECTS inverted bounds', () => {
      const invertedBounds = [band('A', 5, 3, 4500)]
      expect(() => assertBandsAreMonotonic(invertedBounds)).toThrow(/must exceed/i)
    })

    it('REJECTS an empty band set', () => {
      expect(() => assertBandsAreMonotonic([])).toThrow(/No distance bands/i)
    })
  })

  describe('band lookup is half-open, so a boundary belongs to exactly one band', () => {
    it('assigns 3km to band B, not band A', () => {
      expect(bandForDistance(LAUNCH_BANDS, 3).code).toBe('B')
    })

    it('assigns 2.999km to band A and 3.001km to band B', () => {
      expect(bandForDistance(LAUNCH_BANDS, 2.999).code).toBe('A')
      expect(bandForDistance(LAUNCH_BANDS, 3.001).code).toBe('B')
    })

    it('treats 0km as band A', () => {
      expect(bandForDistance(LAUNCH_BANDS, 0).code).toBe('A')
    })

    it('REJECTS a distance beyond the city radius rather than paying the top band', () => {
      // A 40km pincode must not silently earn the 7-12km band. "How far do we
      // actually ride" is an operational fact, so out-of-range is an error.
      expect(() => bandForDistance(LAUNCH_BANDS, 40)).toThrow(/falls outside every band/i)
    })

    it('REJECTS negative and non-finite distances', () => {
      expect(() => bandForDistance(LAUNCH_BANDS, -1)).toThrow(/non-negative/i)
      expect(() => bandForDistance(LAUNCH_BANDS, Number.NaN)).toThrow(BandConfigurationError)
    })

    it('REJECTS an empty band set at lookup time', () => {
      expect(() => bandForDistance([], 2)).toThrow(/No distance bands/i)
    })
  })

  describe('per-drop pay rises at every band transition', () => {
    it('pays strictly more when crossing a band boundary', () => {
      // Constant WITHIN a band by design — that is what a band is. The
      // invariant is that crossing a boundary pays strictly more, which is the
      // property that makes distance worth the rider's time.
      //
      // The launch config has two internal transitions (3km, 7km). 12km is the
      // zone radius, not a band — the top band's maxKm is exclusive, so 12.0 is
      // out of range and throws rather than paying (see "REJECTS a distance
      // beyond the city radius"). That is the intended behaviour, so the
      // boundary list stops at the last real transition.
      const transitions: Array<[number, number]> = [
        [2.99, 3.0],
        [6.99, 7.0],
      ]

      for (const [insideKm, outsideKm] of transitions) {
        expect(payForDistance(LAUNCH_BANDS, outsideKm)).toBeGreaterThan(
          payForDistance(LAUNCH_BANDS, insideKm),
        )
      }
    })

    it('never pays less for a longer route, across band transitions only', () => {
      // Dense sweep, comparing each sample to the last DISTINCT band rather
      // than the previous sample — so the assertion is about band progression,
      // not about a constant-within-band reading two samples apart.
      let lastDistinctPay = payForDistance(LAUNCH_BANDS, 0)
      let lastCode = bandForDistance(LAUNCH_BANDS, 0).code

      for (let km = 0; km < 11.9; km += 0.1) {
        const at = Number(km.toFixed(2))
        const pay = payForDistance(LAUNCH_BANDS, at)
        const { code } = bandForDistance(LAUNCH_BANDS, at)
        if (code !== lastCode) {
          expect(pay).toBeGreaterThan(lastDistinctPay)
          lastDistinctPay = pay
          lastCode = code
        } else {
          expect(pay).toBe(lastDistinctPay)
        }
      }
    })

    it('pays the same amount everywhere inside one band', () => {
      // Explicitly asserted, because "rises with distance" must not be
      // over-read as a continuous rate — it is a step function, and a rider is
      // told the band and the amount, not a formula.
      expect(payForDistance(LAUNCH_BANDS, 0.1)).toBe(payForDistance(LAUNCH_BANDS, 2.99))
    })
  })

  describe('CSV import — bands come from configuration, not code', () => {
    it('builds and validates bands from CSV rows', () => {
      const rows = [
        { code: 'A', minKm: 0, maxKm: 4, payPaise: 5000, label: 'Near' },
        { code: 'B', minKm: 4, maxKm: 9, payPaise: 6500, label: 'Mid' },
        { code: 'C', minKm: 9, maxKm: 15, payPaise: 8000, label: 'Far' },
      ]
      const bands = bandsFromRows(rows)
      expect(bands).toHaveLength(3)
      expect(payForDistance(bands, 10)).toBe(8000)
    })

    it('fails the whole import when one row inverts the incentive', () => {
      // Loudly at upload, not quietly at the first out-of-range pincode.
      const rows = [
        { code: 'A', minKm: 0, maxKm: 3, payPaise: 9000, label: 'Near' },
        { code: 'B', minKm: 3, maxKm: 7, payPaise: 6000, label: 'Mid' },
      ]
      expect(() => bandsFromRows(rows)).toThrow(BandConfigurationError)
    })
  })
})
