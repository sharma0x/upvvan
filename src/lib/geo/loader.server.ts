import { getPool as sharedPool } from '@/lib/db/pool'
import {
  resolveServiceability,
  type CityRef,
  type PincodeRef,
  type ZoneRef,
} from '@/lib/geo/serviceability'

/**
 * Server-side geo loader.
 *
 * Loads the minimal geo projection the serviceability gate needs. Deliberately
 * NOT cached in a separate service (C-5): Phase 0 has no measured load, and the
 * data is a few hundred rows per city. If a load test ever justifies a cache,
 * that is an in-process bounded LRU, not a new service — see DECISIONS.md.
 *
 * Every query is city-scoped where it can be. That is belt-and-braces: the real
 * isolation guarantee is `city_id NOT NULL` in the schema, not this filter.
 *
 * No soft-delete filter: these collections declare no `deletedAt` field, so
 * Payload creates no deleted_at column. A city is retired with status='killed',
 * which is a lifecycle transition rather than a deletion — and an audit trail of
 * city lifecycles is worth more than a hard delete.
 */

interface GeoRow {
  cities: {
    id: number
    slug: string
    name: string
    stateCode: string | null
    isActive: boolean
  }[]
  zones: { id: number; cityId: number; name: string; isActive: boolean }[]
  delivery_bands: {
    id: number
    cityId: number
    code: string
    minKm: number
    maxKm: number
    payPaise: number
  }[]
  pincodes: {
    id: number
    pincode: string
    cityId: number
    zoneId: number | null
    isServiceable: boolean
  }[]
}

export interface LoadedGeo {
  cities: CityRef[]
  zones: ZoneRef[]
  pincodes: PincodeRef[]
  cityIdBySlug: Map<string, number>
}

/*
 * Delegates to the ONE process-wide pool.
 *
 * There were nine module-level pools in this codebase — this one was `max: 20`,
 * and `catalogue/loader.server.ts` was another `max: 20`, which is 40 connections
 * from two modules before anything else loads. `next build` prerenders dozens of
 * routes in parallel and died with
 *
 *     error: sorry, too many clients already
 *     Error occurred prerendering page "/collections/plants-for-a-bright-room"
 *
 * A pool exists to REUSE connections. Nine pools reusing the same handful is not
 * reuse; it is nine warm-up costs and nine places for a leak to hide. See
 * `src/lib/db/pool.ts`.
 *
 * Kept as a thin wrapper rather than replaced at every call site: the callers are
 * correct, and rewriting working call sites during an incident is how an incident
 * becomes an outage.
 */
async function getPool(): Promise<import('pg').Pool> {
  return sharedPool()
}

export async function loadGeo(): Promise<LoadedGeo> {
  const db = await getPool()

  const { rows } = await db.query<GeoRow>(`
    SELECT
      /*
       * The "state" column holds the state's NAME ("Karnataka") — cities has no
       * separate code column, so stateCode and stateName are both that value.
       * That is not a duplicated field, it is one column under two names for two
       * consumers: a delivery label needs the printable name, and the operator
       * error messages want it too.
       *
       * taxRateBp is per city because GST on a nursery plant is not the same
       * everywhere, and a global default silently over-charges or under-charges
       * a city that differs. NULL means "use the global default".
       */
      (SELECT json_agg(json_build_object(
                'id', id, 'slug', slug, 'name', name,
                'stateCode', state, 'stateName', state,
                'taxRateBp', tax_rate_bp,
                'gstin', gstin, 'isActive', COALESCE(is_active, false)
              ))
         FROM cities)                                                    AS cities,
      (SELECT COALESCE(json_agg(json_build_object(
                'id', id, 'cityId', city_id, 'name', name,
                'isActive', COALESCE(is_active, true)
              )), '[]'::json)
         FROM zones)                                                     AS zones,
      (SELECT COALESCE(json_agg(json_build_object(
                'id', id, 'pincode', pincode, 'cityId', city_id,
                'zoneId', zone_id, 'isServiceable', COALESCE(is_serviceable, false)
              )), '[]'::json)
         FROM pincodes)                                                  AS pincodes,
      (SELECT COALESCE(json_agg(json_build_object(
                'id', id, 'code', code, 'minKm', min_km,
                'maxKm', max_km, 'payPaise', pay_paise
              )), '[]'::json)
         FROM delivery_bands)                                            AS delivery_bands
  `)

  const row = rows[0]!
  const cityIdBySlug = new Map<string, number>((row.cities ?? []).map((c) => [c.slug, c.id]))

  // The SQL builds camelCase JSON keys to match the domain types directly, so
  // no field mapping is needed here. The `unknown` hop is required because
  // TypeScript cannot see that the json_agg keys match the interfaces.
  return {
    cities: (row.cities ?? []) as unknown as CityRef[],
    zones: (row.zones ?? []) as unknown as ZoneRef[],
    pincodes: (row.pincodes ?? []) as unknown as PincodeRef[],
    cityIdBySlug,
  }
}

export { resolveServiceability }
