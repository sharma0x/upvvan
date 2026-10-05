import 'server-only'

import { Pool } from 'pg'

import { config } from '@/lib/config'
import {
  applyPlanter,
  priceLadder,
  PricingError,
  type PlanterSpec,
  type PlantSpec,
  type SizeTier,
} from '@/lib/catalogue/pricing'

/**
 * Catalogue loader — the server-side projection the storefront renders.
 *
 * Reads through raw SQL rather than Payload's Local API. That is deliberate: this
 * is a read-only storefront projection, and going through Payload would pull the
 * whole config and access-control layer into a page render for no benefit.
 * Writes still go through Payload — this file writes nothing.
 */

let pool: Pool | null = null

async function getPool(): Promise<Pool> {
  if (!pool) {
    /*
     * A SECOND pool, separate from `src/lib/geo/loader.server.ts`.
     *
     * Worth knowing because it was the last cause of intermittent PDP 404s. With
     * `max` unset, `pg` defaults to 10 connections. Under a request burst plus
     * concurrent database work, requests queue; if the queue outlives the caller's
     * timeout the query throws, and the PDP — which had no try/catch — rendered
     * `notFound()`. A customer saw "this plant does not exist" when the truth was
     * "the database was briefly busy".
     *
     * Measured: 6 of 27 requests 404'd while a database-backed suite ran. Raising
     * `max`, bounding the wait, and logging idle-client errors fixed most of it;
     * the rest is handled where the truth matters, in the PDP, by not converting a
     * query failure into a factual claim about the catalogue.
     *
     * Two pools for one database is itself the underlying smell — the same
     * connection budget is spent twice and neither pool knows about the other.
     * Consolidating them is the correct fix and is recorded as a follow-up rather
     * than done here, because `geo` and `catalogue` are loaded from different
     * server contexts and sharing a module-level pool across them is a larger
     * change than this fix warrants.
     */
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    })
    // Without this listener `pg` emits an unhandled 'error' on an idle client and
    // Node exits — one dropped socket becomes a total outage.
    pool.on('error', (err) => {
      console.error('[catalogue] idle postgres client errored:', err.message)
    })
  }
  return pool
}

/** Indian season for a city. March–June is the lethal window. */
export function currentSeasons(now = new Date()): Array<'summer' | 'monsoon' | 'perennial'> {
  const month = now.getMonth() + 1 // 1-12
  if (month >= 3 && month <= 6) return ['summer']
  if (month >= 7 && month <= 9) return ['monsoon']
  return ['perennial']
}

export interface CatalogueItem {
  skuId: string
  skuCode: string
  slug: string
  commonName: string
  botanicalName: string | null
  description: string | null
  sizeTier: SizeTier
  itemClass: 'plant' | 'planter' | 'consumable'
  basePricePaise: number
  ladder: ReturnType<typeof priceLadder>
  planters: Array<{
    planterId: string
    name: string
    material: string | null
    colour: string | null
    upliftBp: number
  }>
  care: {
    light: string
    waterIntervalDays: number
    soilMoistureTargetPct: number
    difficulty: string
    toxicity: string
  }
  seasonal: { seasons: string[]; hardy: boolean } | null
  legal: {
    manufacturerName: string
    manufacturerAddress: string
    countryOfOrigin: string
    commonNameDeclared: string
    netQuantity: string
    mrpPaise: number
    bestBefore: string | null
    dimensions: { heightCm: number; potDiameterCm: number; spreadCm: number } | null
  }
}

interface Row {
  sku_id: number
  sku_code: string
  species_slug: string
  common_name: string
  botanical_name: string | null
  description: string | null
  size_tier: SizeTier
  item_class: 'plant' | 'planter' | 'consumable'
  /**
   * `numeric` columns come back from `pg` as STRINGS, not numbers. That is the
   * driver being faithful to Postgres, and it matters here: paise must be
   * integers everywhere, and a string that later gets coerced is how a float
   * reaches the database. Coerced explicitly, at the boundary, with the
   * assertion that proves it.
   */
  base_price_paise: string
  care_light: string
  care_water_interval_days: number
  care_soil_moisture_target_pct: number
  care_difficulty: string
  care_toxicity: string
  seasons: string[] | null
  hardy: boolean | null
  lm_manufacturer_name: string
  lm_manufacturer_address: string
  lm_country_of_origin: string
  lm_common_name: string
  lm_net_quantity: string
  lm_mrp_paise: string
  lm_best_before: string | null
  lm_height: number | null
  lm_pot_dia: number | null
  lm_spread: number | null
}

/** Postgres `numeric` → integer paise, refusing anything non-integral. */
function toPaise(value: string | number | null, label: string): number {
  const n = typeof value === 'string' ? Number(value) : value
  if (n == null || !Number.isFinite(n)) {
    throw new PricingError(`${label} is not a number: ${value}`, 'FRACTIONAL_PAISE')
  }
  if (!Number.isInteger(n)) {
    throw new PricingError(
      `${label} is ${n}, which is not whole paise. Money is integer paise everywhere.`,
      'FRACTIONAL_PAISE',
      { value: n },
    )
  }
  return n
}

/**
 * Live catalogue for a city.
 *
 * Seasonally filtered: a species not available in the current window is NOT
 * listed. That is how "substitute hardy SKUs, never pause" is implemented — the
 * catalogue itself changes rather than the site going dark.
 */
export async function loadCatalogue(cityId: number): Promise<CatalogueItem[]> {
  const db = await getPool()
  const seasons = currentSeasons()

  const { rows } = await db.query<Row>(
    `SELECT
       s."id"                    AS sku_id,
       s."sku_code",
       sp."slug"                 AS species_slug,
       sp."common_name",
       sp."botanical_name",
       sp."description",
       s."size_tier",
       s."item_class",
       s."base_price_paise",
       sp."care_light",
       sp."care_water_interval_days",
       sp."care_soil_moisture_target_pct",
       sp."care_difficulty",
       sp."care_toxicity",
       (SELECT json_agg(ss."value" ORDER BY ss."value")
          FROM species_seasonal_availability av
          JOIN species_seasonal_availability_seasons ss ON ss.parent_id = av.id
         WHERE av._parent_id = sp."id" AND av."city_id" = $1) AS seasons,
       (SELECT av.hardy FROM species_seasonal_availability av
         WHERE av._parent_id = sp."id" AND av."city_id" = $1 LIMIT 1) AS hardy,
       s."legal_metrology_manufacturer_name"  AS lm_manufacturer_name,
       s."legal_metrology_manufacturer_address" AS lm_manufacturer_address,
       s."legal_metrology_country_of_origin"  AS lm_country_of_origin,
       s."legal_metrology_common_name_declared" AS lm_common_name,
       s."legal_metrology_net_quantity"        AS lm_net_quantity,
       s."legal_metrology_mrp_paise"           AS lm_mrp_paise,
       s."legal_metrology_best_before"         AS lm_best_before,
       s."legal_metrology_dimensions_height_cm"        AS lm_height,
       s."legal_metrology_dimensions_pot_diameter_cm" AS lm_pot_dia,
       s."legal_metrology_dimensions_spread_cm"       AS lm_spread
     FROM "skus" s
     JOIN "species" sp ON sp."id" = s."species_id"
    WHERE s."is_published" = true
      AND s."city_id" = $1
    ORDER BY sp."common_name", s."size_tier"`,
    [cityId],
  )

  const { rows: planterRows } = await db.query<{
    id: number
    name: string
    uplift_bp: string
    cost_paise: string
    material: string | null
    colour: string | null
  }>(
    `SELECT "id", "name", "uplift_bp", "cost_paise", "material", "colour"
       FROM "planters" WHERE "is_active" = true
      ORDER BY "uplift_bp" ASC`,
  )

  const planterSpecs: PlanterSpec[] = planterRows.map((p) => ({
    planterId: String(p.id),
    name: p.name,
    upliftBp: toPaise(p.uplift_bp, `${p.name} uplift`),
    costPaise: toPaise(p.cost_paise, `${p.name} cost`),
  }))

  const byId = new Map(
    planterRows.map((p) => [
      String(p.id),
      {
        planterId: String(p.id),
        name: p.name,
        material: p.material,
        colour: p.colour,
        upliftBp: toPaise(p.uplift_bp, `${p.name} uplift`),
      },
    ]),
  )

  const items: CatalogueItem[] = []

  for (const row of rows) {
    // Seasonal gate. No availability row means the species is not sold in this
    // city at all — which is different from "out of season", and both mean the
    // customer must not see it.
    const available = row.seasons ?? []
    if (!available.some((s) => seasons.includes(s as never))) continue

    const plant: PlantSpec = {
      speciesId: row.species_slug,
      commonName: row.common_name,
      basePricePaise: toPaise(row.base_price_paise, `${row.sku_code} base price`),
      sizeTier: row.size_tier,
      itemClass: row.item_class,
    }

    // The ladder is DERIVED here, never stored. One rule, applied per render —
    // which is why 24 variants need no 24 price rows to maintain.
    const ladder = priceLadder(plant, planterSpecs)

    items.push({
      skuId: String(row.sku_id),
      skuCode: row.sku_code,
      slug: row.species_slug,
      commonName: row.common_name,
      botanicalName: row.botanical_name,
      description: row.description,
      sizeTier: row.size_tier,
      itemClass: row.item_class,
      basePricePaise: toPaise(row.base_price_paise, `${row.sku_code} base price`),
      ladder,
      planters: planterRows.map((p) => byId.get(String(p.id))!),
      care: {
        light: row.care_light,
        waterIntervalDays: row.care_water_interval_days,
        soilMoistureTargetPct: row.care_soil_moisture_target_pct,
        difficulty: row.care_difficulty,
        toxicity: row.care_toxicity,
      },
      seasonal: { seasons: available, hardy: row.hardy ?? false },
      legal: {
        manufacturerName: row.lm_manufacturer_name,
        manufacturerAddress: row.lm_manufacturer_address,
        countryOfOrigin: row.lm_country_of_origin,
        commonNameDeclared: row.lm_common_name,
        netQuantity: row.lm_net_quantity,
        mrpPaise: toPaise(row.lm_mrp_paise, `${row.sku_code} declared MRP`),
        bestBefore: row.lm_best_before,
        dimensions:
          row.lm_height != null && row.lm_pot_dia != null && row.lm_spread != null
            ? {
                heightCm: row.lm_height,
                potDiameterCm: row.lm_pot_dia,
                spreadCm: row.lm_spread,
              }
            : null,
      },
    })
  }

  return items
}

/** Price for one specific planter choice, used by the cart. */
export function priceForChoice(item: CatalogueItem, planterId: string): number {
  const match = item.planters.find((p) => p.planterId === planterId)
  // Grow pot / no planter = the entry option, which is always reachable.
  if (!match) return item.ladder[0]!.totalPaise
  return applyPlanter(
    {
      speciesId: item.slug,
      commonName: item.commonName,
      basePricePaise: item.basePricePaise,
      sizeTier: item.sizeTier,
      itemClass: item.itemClass,
    },
    {
      planterId: match.planterId,
      name: match.name,
      upliftBp: match.upliftBp,
      costPaise: 0,
    },
  ).totalPaise
}