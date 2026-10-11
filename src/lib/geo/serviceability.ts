import { config } from '@/lib/config'

/**
 * Serviceability: can we actually deliver to this pincode?
 *
 * THE RULE (product-design.md §7, Part 3 rule 12)
 * ------------------------------------------------
 * An order cannot exist for a pincode outside the serviceable set — and a
 * serviceable pincode in a DIFFERENT city must also be rejected.
 *
 * The loudest, most-documented failure across every competitor we researched is
 * promising geography we cannot serve. Over-promising is failure mode #1 in the
 * cross-surface journey diagram, and it is the one that costs a second order:
 * the customer who was told "not in your city yet" does not try again, and the
 * one who was told yes and then had no rider is worse.
 *
 * TWO SEPARATE FAILURES, DELIBERATELY DISTINGUISHED
 * -------------------------------------------------
 * A pincode that belongs to another city we also serve is NOT the same failure as
 * a pincode we have never heard of, and the distinction is worth keeping:
 *
 *   - UNKNOWN        — we have no row. Coverage gap; a city-expansion signal.
 *   - NOT_SERVICEABLE — we have the row and it is switched off. A deliberate
 *                      capacity or seasonal decision (A-07 "bulk enable/disable
 *                      ahead of season or capacity crunch").
 *   - CITY_MISMATCH  — the row is live and serviceable, but in a different city.
 *                      This is the subtle one. It is the case where a naive
 *                      "is this pincode in our list?" check would PASS and then
 *                      route a Bengaluru order to a Hyderabad nursery, because
 *                      both cities share a live pincode row and the lookup did
 *                      not scope by city. Hence a distinct code and a distinct
 *                      message, so the bug is visible in logs rather than showing
 *                      up as a mysterious failed delivery.
 *
 * Resolution is deliberately a PURE FUNCTION over injected records. It is the
 * hot path (every cart render, every checkout), it must be trivially testable
 * without a database, and the same function runs server-side at order placement
 * where the caller is trusted and untrusted alike.
 */

/** A city, as far as serviceability cares. */
export interface CityRef {
  /** Postgres integer PK (number) or a Payload relationship value (string). */
  id: string | number
  /** Lowercase slug — the stable key used in URLs and config. */
  slug: string
  name: string
  /** Is this city accepting orders right now? HQ's on/off switch. */
  isActive: boolean
  /** State code, for operator-facing error messages ("not in Telangana yet"). */
  stateCode?: string | null
  /**
   * State NAME, e.g. "Karnataka".
   *
   * Separate from `stateCode` because a delivery address needs "Karnataka" and a
   * code of "KA" is not a thing you print on a label. The checkout address form
   * used to hardcode "Karnataka" with no input, so a customer anywhere else in
   * the country got an order written with our state on it.
   */
  stateName?: string | null
  /**
   * GST rate in basis points for THIS city, or null to use the global default.
   *
   * Per city because it is a tax rate and tax rates are not global. A single
   * env var silently over-charges or under-charges any city that differs, and
   * the difference shows up on a tax invoice rather than in a log.
   */
  taxRateBp?: number | null
  /**
   * GSTIN, e.g. `29ABCDE1234F1Z5`.
   *
   * Optional because `CityRef` is also constructed in TESTS and from fixtures
   * where a GSTIN is irrelevant — but it is REQUIRED on an invoice and every
   * marketplace, courier and gateway gates on it, so anything rendering an
   * invoice or a compliance footer must read it from here rather than from a
   * global env var: GSTIN is PER CITY, and a second city has a second one.
   */
  gstin?: string | null
}

/** A zone — a delivery geography inside one city. */
export interface ZoneRef {
  id: string | number
  cityId: string | number
  name: string
  isActive: boolean
}

/** A pincode row: the unit of serviceability. */
export interface PincodeRef {
  id: string | number
  /** Indian pincode — 6 digits, stored as text so leading zeros survive. */
  pincode: string
  cityId: string | number
  zoneId: string | number | null
  /**
   * The HQ switch. Distinct from `city.isActive`: a city can be live while
   * individual pincodes are bulk-disabled ahead of a capacity crunch or the
   * March-June heat window.
   */
  isServiceable: boolean
}

export type ServiceabilityRejectionCode =
  | 'INVALID_PINCODE'
  | 'UNKNOWN_PINCODE'
  | 'NOT_SERVICEABLE'
  | 'CITY_MISMATCH'
  | 'CITY_INACTIVE'
  | 'ZONE_MISSING'
  | 'ZONE_INACTIVE'

export interface ServiceableResult {
  serviceable: true
  pincode: PincodeRef
  city: CityRef
  zone: ZoneRef
}

export interface UnserviceableResult {
  serviceable: false
  code: ServiceabilityRejectionCode
  /** Operator- and customer-safe message. Never leaks another city's data. */
  message: string
}

export type ServiceabilityResult = ServiceableResult | UnserviceableResult

/**
 * Indian pincodes are exactly 6 digits. Leading zeros are legal (e.g. 560001).
 */
const PINCODE_PATTERN = new RegExp(config.business.pincodePattern)

/**
 * Normalise an id for comparison.
 *
 * IDs cross a type boundary in this system: Postgres `integer` primary keys come
 * back from `json_agg` as NUMBERS, while Payload relationship values and route
 * params are STRINGS. Comparing them with `===` silently reports a mismatch —
 * and for the city gate that means a live, serviceable pincode is rejected as
 * CITY_MISMATCH.
 *
 * That bug is invisible to unit tests whose fixtures happen to use consistent
 * types, and invisible until a customer is told we do not deliver to their own
 * city. So the comparison normalises instead of trusting the caller.
 */
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

/**
 * Normalise a pincode for lookup. Strips whitespace and separators a customer
 * might paste ("560 001", "560-001"). Deliberately does NOT strip a leading
 * zero or coerce to a number — "012345" is a valid pincode and number coercion
 * would silently drop the zero and return the wrong district.
 */
export function normalisePincode(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/[\s-]/g, '')
}

export interface ResolveOptions {
  /** The city the caller is shopping in. Orders are placed city-scoped. */
  cityId: string | number
  pincodes: readonly PincodeRef[]
  cities: readonly CityRef[]
  zones: readonly ZoneRef[]
}

/**
 * Can we deliver to `pincodeInput` for a customer shopping in `cityId`?
 *
 * Order of checks matters and is deliberate: cheapest and most specific first,
 * so the returned code is the *actual* reason rather than a downstream symptom.
 * An inactive city is reported as CITY_INACTIVE rather than as every pincode
 * being unserviceable, because "we're not open in your city yet" is a
 * different message from "we don't deliver to that pincode" and the founder
 * needs to see them separately in the logs.
 */
export function resolveServiceability(
  pincodeInput: string,
  { cityId, pincodes, cities, zones }: ResolveOptions,
): ServiceabilityResult {
  const pincode = normalisePincode(pincodeInput)

  if (!PINCODE_PATTERN.test(pincode)) {
    return {
      serviceable: false,
      code: 'INVALID_PINCODE',
      message: 'Enter a valid 6-digit pincode.',
    }
  }

  const row = pincodes.find((p) => p.pincode === pincode)

  if (!row) {
    return {
      serviceable: false,
      code: 'UNKNOWN_PINCODE',
      message: 'We do not deliver to this pincode yet.',
    }
  }

  // The subtle one. Checked BEFORE the serviceable flag so a live pincode in
  // another city can never be quietly accepted — see the module header.
  if (!sameId(row.cityId, cityId)) {
    return {
      serviceable: false,
      code: 'CITY_MISMATCH',
      message: 'This pincode is not in our delivery city yet.',
    }
  }

  if (!row.isServiceable) {
    return {
      serviceable: false,
      code: 'NOT_SERVICEABLE',
      message: 'We do not deliver to this pincode yet.',
    }
  }

  const city = cities.find((c) => sameId(c.id, cityId))
  if (!city) {
    return {
      serviceable: false,
      code: 'CITY_INACTIVE',
      message: 'This city is not open for orders yet.',
    }
  }

  if (!city.isActive) {
    return {
      serviceable: false,
      code: 'CITY_INACTIVE',
      message: `We have not opened delivery in ${city.name} yet.`,
    }
  }

  if (!row.zoneId) {
    return {
      serviceable: false,
      code: 'ZONE_MISSING',
      message: 'We do not deliver to this pincode yet.',
    }
  }

  const zone = zones.find((z) => sameId(z.id, row.zoneId as string))
  if (!zone || !sameId(zone.cityId, cityId)) {
    return {
      serviceable: false,
      code: 'ZONE_MISSING',
      message: 'We do not deliver to this pincode yet.',
    }
  }

  if (!zone.isActive) {
    return {
      serviceable: false,
      code: 'ZONE_INACTIVE',
      message: 'We do not deliver to this pincode yet.',
    }
  }

  return { serviceable: true, pincode: row, city, zone }
}

// NOTE: there is deliberately no `resolveServiceabilityWithBand` here.
//
// An earlier draft had one, which took the bands array and returned a band.
// It always returned `band: undefined`, because band selection needs a
// DISTANCE — and only the routing engine knows the distance from the drop
// address to the nursery. A pincode's band is not knowable from the pincode
// alone.
//
// So the chain is: pincode -> zone (serviceability, decidable now) -> distance
// (needs geocoding) -> band (decidable then). Band lookup lives in bands.ts and
// is called by the run-assignment code in Phase 3, not by checkout.
