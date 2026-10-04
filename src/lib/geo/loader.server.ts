import { config as appConfig } from '@/lib/config'
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

let pool: import('pg').Pool | null = null

async function getPool(): Promise<import('pg').Pool> {
  if (!pool) {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: appConfig.database.url })
  }
  return pool
}

export async function loadGeo(): Promise<LoadedGeo> {
  const db = await getPool()

  const { rows } = await db.query<GeoRow>(`
    SELECT
      (SELECT json_agg(json_build_object(
                'id', id, 'slug', slug, 'name', name,
                'stateCode', state, 'isActive', COALESCE(is_active, false)
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
