/**
 * Pincode + city gate — TEST 4 of the twelve required tests.
 *
 * "Pincode + city gate — unserviceable pincode rejected; serviceable pincode in
 * another city rejected."
 *
 * This is the loudest, most-documented failure across every competitor we
 * researched: promising geography we cannot serve. Over-promising is failure
 * mode #1 in the cross-surface journey diagram.
 *
 * The subtle case is the second one. A pincode that is serviceable — but in a
 * DIFFERENT city we also serve — must be rejected. A naive "is this pincode in
 * our list?" check passes it, and the order then routes to the wrong nursery.
 * That is why CITY_MISMATCH is a distinct code with a distinct message rather
 * than being folded into "not serviceable": it needs to be visible in logs as a
 * different bug from a coverage gap.
 */

import { describe, it, expect } from 'vitest'
import {
  normalisePincode,
  resolveServiceability,
  type CityRef,
  type PincodeRef,
  type ZoneRef,
} from '../serviceability'

const city = (over: Partial<CityRef> & { id: string }): CityRef => ({
  slug: over.id,
  name: `City ${over.id}`,
  isActive: true,
  stateCode: 'KA',
  ...over,
})

const zone = (over: Partial<ZoneRef> & { id: string; cityId: string }): ZoneRef => ({
  name: `Zone ${over.id}`,
  isActive: true,
  ...over,
})

const pin = (over: Partial<PincodeRef> & { pincode: string; cityId: string }): PincodeRef => ({
  id: `pin-${over.pincode}`,
  zoneId: `zone-${over.cityId}-a`,
  isServiceable: true,
  ...over,
})

// Two cities, both live, both with live pincode rows. This is the fixture that
// makes CITY_MISMATCH reachable — and reachable by mistake.
const CITIES: CityRef[] = [
  city({ id: 'blr', slug: 'bengaluru', name: 'Bengaluru', stateCode: 'KA' }),
  city({ id: 'hyd', slug: 'hyderabad', name: 'Hyderabad', stateCode: 'TG' }),
]

const ZONES: ZoneRef[] = [
  zone({ id: 'zone-blr-a', cityId: 'blr' }),
  zone({ id: 'zone-hyd-a', cityId: 'hyd' }),
]

const PINCODES: PincodeRef[] = [
  pin({ pincode: '560001', cityId: 'blr' }),
  pin({ pincode: '560002', cityId: 'blr', isServiceable: false }),
  pin({ pincode: '500001', cityId: 'hyd' }),
]

const resolve = (p: string, cityId = 'blr') =>
  resolveServiceability(p, { cityId, pincodes: PINCODES, cities: CITIES, zones: ZONES })

describe('pincode + city gate', () => {
  describe('id types crossing the Postgres/Payload boundary', () => {
    // REGRESSION TEST for a real production bug.
    //
    // Postgres integer primary keys come back from `json_agg` as NUMBERS;
    // Payload relationship values and route params are STRINGS. With `===`
    // comparison, a serviceable pincode in Bengaluru was rejected as
    // CITY_MISMATCH — `127 !== "127"` — so the API told a customer in our own
    // city that we do not deliver to them.
    //
    // The original fixtures all used consistent string ids, which is exactly why
    // 21 unit tests passed while the live endpoint was broken. These fixtures
    // deliberately MIX types, the way production does.
    it('accepts a pincode when ids are numbers on one side and strings on the other', () => {
      const numericCities: CityRef[] = [
        { id: 127, slug: 'bengaluru', name: 'Bengaluru', isActive: true },
      ]
      const numericPincodes: PincodeRef[] = [
        { id: 1, pincode: '560001', cityId: 127, zoneId: 9, isServiceable: true },
      ]
      const numericZones: ZoneRef[] = [{ id: 9, cityId: 127, name: 'Central', isActive: true }]

      const result = resolveServiceability('560001', {
        cityId: '127', // string, as a route param arrives
        pincodes: numericPincodes,
        cities: numericCities,
        zones: numericZones,
      })
      expect(result.serviceable).toBe(true)
    })

    it('accepts a pincode when ids are strings on both sides', () => {
      const result = resolveServiceability('560001', {
        cityId: '127',
        pincodes: [{ id: '1', pincode: '560001', cityId: '127', zoneId: '9', isServiceable: true }],
        cities: [{ id: '127', slug: 'bengaluru', name: 'Bengaluru', isActive: true }],
        zones: [{ id: '9', cityId: '127', name: 'Central', isActive: true }],
      })
      expect(result.serviceable).toBe(true)
    })

    it('STILL rejects a genuine mismatch when ids are mixed types', () => {
      // The fix must not blunt the check it was meant to preserve: city 128 is
      // Hyderabad, and a Bengaluru shopper must still be refused.
      const result = resolveServiceability('560001', {
        cityId: '127',
        pincodes: [{ id: 1, pincode: '560001', cityId: 128, zoneId: 9, isServiceable: true }],
        cities: [
          { id: 127, slug: 'bengaluru', name: 'Bengaluru', isActive: true },
          { id: 128, slug: 'hyderabad', name: 'Hyderabad', isActive: true },
        ],
        zones: [{ id: 9, cityId: 128, name: 'H Central', isActive: true }],
      })
      expect(result.serviceable).toBe(false)
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('CITY_MISMATCH')
    })

    it('matches a zone whose id type differs from its city id type', () => {
      const result = resolveServiceability('560001', {
        cityId: 127,
        pincodes: [{ id: '1', pincode: '560001', cityId: 127, zoneId: '9', isServiceable: true }],
        cities: [{ id: 127, slug: 'bengaluru', name: 'Bengaluru', isActive: true }],
        zones: [{ id: 9, cityId: 127, name: 'Central', isActive: true }],
      })
      expect(result.serviceable).toBe(true)
    })
  })

  describe('serviceable pincodes in our own city are accepted', () => {
    it('accepts a live pincode in the shopping city', () => {
      const result = resolve('560001')
      expect(result.serviceable).toBe(true)
    })

    it('returns the pincode, city and zone on success', () => {
      const result = resolve('560001')
      if (!result.serviceable) throw new Error('expected serviceable')
      expect(result.pincode.pincode).toBe('560001')
      expect(result.city.slug).toBe('bengaluru')
      expect(result.zone.id).toBe('zone-blr-a')
    })

    it('accepts the same pincode when shopping in ITS OWN city', () => {
      // Symmetry check: 500001 must work for Hyderabad, or the gate is
      // rejecting everything and the bug looks like a coverage problem.
      expect(resolve('500001', 'hyd').serviceable).toBe(true)
    })
  })

  describe('unserviceable pincodes are rejected', () => {
    it('REJECTS a pincode we have never heard of', () => {
      const result = resolve('999999')
      expect(result.serviceable).toBe(false)
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('UNKNOWN_PINCODE')
    })

    it('REJECTS a pincode that exists but is switched off', () => {
      // Distinct from unknown: a deliberate capacity or seasonal decision
      // (A-07 bulk enable/disable), not a coverage gap.
      const result = resolve('560002')
      expect(result.serviceable).toBe(false)
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('NOT_SERVICEABLE')
    })

    it('REJECTS a malformed pincode', () => {
      for (const bad of ['', '12345', '1234567', 'abcdef', '56 001 89x']) {
        const result = resolve(bad)
        expect(result.serviceable).toBe(false)
        if (result.serviceable) throw new Error('expected rejection')
        expect(result.code).toBe('INVALID_PINCODE')
      }
    })
  })

  describe('THE SUBTLE CASE: serviceable pincode in another city is rejected', () => {
    it('REJECTS Hyderabad pincode 500001 while shopping in Bengaluru', () => {
      const result = resolve('500001', 'blr')
      expect(result.serviceable).toBe(false)
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('CITY_MISMATCH')
    })

    it('reports CITY_MISMATCH distinctly from NOT_SERVICEABLE', () => {
      // Two different bugs and two different operator responses: a mismatch is
      // a routing defect, an unserviceable pincode is a config decision.
      const mismatch = resolve('500001', 'blr')
      const unserviceable = resolve('560002', 'blr')
      if (mismatch.serviceable || unserviceable.serviceable) {
        throw new Error('expected both rejected')
      }
      expect(mismatch.code).not.toBe(unserviceable.code)
    })

    it('never leaks the other city name in the customer-facing message', () => {
      const result = resolve('500001', 'blr')
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.message).not.toMatch(/hyderabad/i)
      expect(result.message).not.toMatch(/500001/)
    })

    it('checks city mismatch BEFORE the serviceable flag', () => {
      // A disabled pincode in another city must still report CITY_MISMATCH,
      // because "wrong city" is the more actionable diagnosis.
      const pincodes = [pin({ pincode: '500002', cityId: 'hyd', isServiceable: false })]
      const result = resolveServiceability('500002', {
        cityId: 'blr',
        pincodes,
        cities: CITIES,
        zones: ZONES,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('CITY_MISMATCH')
    })
  })

  describe('city on/off switch gates everything', () => {
    it('REJECTS every pincode when the city is not open', () => {
      const closed = [city({ id: 'blr', slug: 'bengaluru', name: 'Bengaluru', isActive: false })]
      const result = resolveServiceability('560001', {
        cityId: 'blr',
        pincodes: PINCODES,
        cities: closed,
        zones: ZONES,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('CITY_INACTIVE')
    })

    it('names the city in the message when it is simply not open yet', () => {
      const closed = [city({ id: 'blr', slug: 'bengaluru', name: 'Bengaluru', isActive: false })]
      const result = resolveServiceability('560001', {
        cityId: 'blr',
        pincodes: PINCODES,
        cities: closed,
        zones: ZONES,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.message).toMatch(/Bengaluru/)
    })
  })

  describe('incomplete configuration fails closed, never open', () => {
    it('REJECTS a pincode with no zone assigned', () => {
      // The whole point of bands-as-primitive: an unbanded pincode must be
      // loudly wrong, not quietly served at the wrong pay.
      const pincodes = [pin({ pincode: '560003', cityId: 'blr', zoneId: null })]
      const result = resolveServiceability('560003', {
        cityId: 'blr',
        pincodes,
        cities: CITIES,
        zones: ZONES,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('ZONE_MISSING')
    })

    it('REJECTS a pincode whose zone belongs to a different city', () => {
      const pincodes = [pin({ pincode: '560004', cityId: 'blr', zoneId: 'zone-hyd-a' })]
      const result = resolveServiceability('560004', {
        cityId: 'blr',
        pincodes,
        cities: CITIES,
        zones: ZONES,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('ZONE_MISSING')
    })

    it('REJECTS a pincode in a deactivated zone', () => {
      const pincodes = [pin({ pincode: '560005', cityId: 'blr' })]
      const zones = [zone({ id: 'zone-blr-a', cityId: 'blr', isActive: false })]
      const result = resolveServiceability('560005', {
        cityId: 'blr',
        pincodes,
        cities: CITIES,
        zones,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('ZONE_INACTIVE')
    })

    it('REJECTS when the city row is missing entirely', () => {
      const result = resolveServiceability('560001', {
        cityId: 'blr',
        pincodes: PINCODES,
        cities: [],
        zones: ZONES,
      })
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('CITY_INACTIVE')
    })
  })

  describe('pincode normalisation — leading zeros must survive', () => {
    it('strips spaces and dashes a customer pasted', () => {
      expect(normalisePincode(' 560 001 ')).toBe('560001')
      expect(normalisePincode('560-001')).toBe('560001')
    })

    it('preserves a leading zero rather than coercing to a number', () => {
      // "012345" is a valid pincode. Number coercion would silently drop the
      // zero and return the wrong district.
      const pincodes = [pin({ pincode: '012345', cityId: 'blr' })]
      const result = resolveServiceability('012345', {
        cityId: 'blr',
        pincodes,
        cities: CITIES,
        zones: ZONES,
      })
      expect(result.serviceable).toBe(true)
    })

    it('accepts a padded zero pincode that is NOT in the serviceable set', () => {
      const result = resolve('012345')
      if (result.serviceable) throw new Error('expected rejection')
      expect(result.code).toBe('UNKNOWN_PINCODE')
    })
  })

  describe('the gate is total — every pincode has exactly one verdict', () => {
    it('classifies every fixture pincode without throwing', () => {
      const probes = ['560001', '560002', '500001', '500002', '999999', 'bad', '']
      for (const probe of probes) {
        expect(() => resolve(probe)).not.toThrow()
        expect(typeof resolve(probe).serviceable).toBe('boolean')
      }
    })

    it('never returns serviceable without a complete chain', () => {
      // Property: serviceable=true implies pincode + city + zone all resolved.
      for (const probe of ['560001', '500001']) {
        for (const targetCity of ['blr', 'hyd']) {
          const r = resolve(probe, targetCity)
          if (r.serviceable) {
            expect(r.pincode.cityId).toBe(targetCity)
            expect(r.zone.cityId).toBe(targetCity)
          }
        }
      }
    })
  })
})
