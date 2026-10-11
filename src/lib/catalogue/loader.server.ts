import 'server-only'

import { Pool } from 'pg'

import type { Facetable } from '@/lib/catalogue/facets'
import { getPool as sharedPool } from '@/lib/db/pool'
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
async function getPool(): Promise<Pool> {
  return sharedPool()
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
  /** One line, the benefit, in our voice. On the card under the botanical name. */
  summary: string | null
  /** What actually arrives in the parcel, measured at the bench. */
  benchNote: string | null
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
  /**
   * Units on the bench right now.
   *
   * Present because `sku_stock` was enforced at checkout and shown NOWHERE on
   * the storefront — so a customer could add a sold-out plant to a cart, pay for
   * it, and only discover it at packing. That is the "sold out on an in-stock
   * SKU" failure the audit found at Upvan, and it is the kind of thing that
   * costs a one-star review and a support ticket.
   */
  stock: number
  /** Aggregate rating. 0 with `ratingCount === 0` means "no reviews yet". */
  rating: { average: number; count: number }
  care: {
    light: string
    waterIntervalDays: number
    soilMoistureTargetPct: number
    difficulty: string
    toxicity: string
    /** The seven-field long-form guide. Drives `/care/[slug]`. */
    guide: {
      light: string | null
      water: string | null
      humidity: string | null
      temperature: string | null
      feeding: string | null
      additional: string | null
    }
  }
  /** The three flags the collection pages derive their URLs from. */
  traits: { edible: boolean; airPurifying: boolean; vastuFriendly: boolean }
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
  species_slug: string | null
  common_name: string
  botanical_name: string | null
  description: string | null
  summary: string | null
  bench_note: string | null
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
  stock_on_hand: number
  rating_average: string | null
  rating_count: string | null
  care_light: string | null
  care_water_interval_days: number | null
  care_soil_moisture_target_pct: number | null
  care_difficulty: string | null
  care_toxicity: string | null
  guide_light: string | null
  guide_water: string | null
  guide_humidity: string | null
  guide_temperature: string | null
  guide_feeding: string | null
  guide_additional: string | null
  is_edible: boolean
  is_air_purifying: boolean
  is_vastu_friendly: boolean
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
       /*
        * A CONSUMABLE HAS NO SPECIES ROW, so sp.common_name is NULL for it --
        * and the LEFT JOIN that made consumables reachable at all is what put
        * it there. Before this COALESCE, sorting the catalogue crashed with
        * "Cannot read properties of null (reading 'localeCompare')" on the
        * homepage, which is how the whole soil-and-feed rail took the page
        * down with it.
        *
        * The declared common name is the right fallback, not a workaround:
        * skus.legal_metrology_common_name_declared is a Legal Metrology r.6(10)
        * field that every SKU must carry anyway, so it is the one name we can
        * guarantee exists for a non-plant. A DB CHECK
        * (skus_declarations_non_blank) refuses a blank one.
        */
       COALESCE(sp."common_name", s."legal_metrology_common_name_declared") AS common_name,
       sp."botanical_name",
       COALESCE(sp."description", s."description") AS description,
       sp."summary",
       sp."bench_note",
       s."size_tier",
       s."item_class",
       s."base_price_paise",
       COALESCE(st."stock_on_hand", 0) AS stock_on_hand,
       rv."average"              AS rating_average,
       rv."count"                AS rating_count,
       sp."care_light",
       sp."care_water_interval_days",
       sp."care_soil_moisture_target_pct",
       sp."care_difficulty",
       sp."care_toxicity",
       sp."care_guide_light"     AS guide_light,
       sp."care_guide_water"     AS guide_water,
       sp."care_guide_humidity"  AS guide_humidity,
       sp."care_guide_temperature"  AS guide_temperature,
       sp."care_guide_feeding"   AS guide_feeding,
       sp."care_guide_additional" AS guide_additional,
       COALESCE(sp."edible", false)      AS is_edible,
       COALESCE(sp."air_purifying", false) AS is_air_purifying,
       COALESCE(sp."vastu_friendly", false) AS is_vastu_friendly,
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
      LEFT JOIN "species" sp ON sp."id" = s."species_id"
      LEFT JOIN "sku_stock" st ON st."sku_id" = s."id"
      LEFT JOIN (
        SELECT "sku_id",
               round(avg("rating"), 1) AS average,
               count(*)::int          AS count
          FROM "reviews"
         WHERE "is_published" = true
         GROUP BY "sku_id"
      ) rv ON rv."sku_id" = s."id"
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
    /*
     * Seasonal gate.
     *
     * `seasons` is NULL for a consumable because it has no species row, and a
     * NULL is NOT an empty array. The original code was:
     *
     *   const available = row.seasons ?? []
     *   if (!available.some((s) => seasons.includes(s))) continue
     *
     * which is correct for a plant and silently DELETES every non-plant from
     * the catalogue. Combined with the INNER JOIN above it, that made the
     * homepage's entire "Soil, feed & tools" rail unreachable — dead code
     * rendering a promise the database could not keep, and three seeded SKUs
     * with no page at all.
     *
     * A consumable is not seasonal. Soil does not die in April. So the gate
     * applies to plants only, and the rule is written so that a plant with an
     * empty `seasons` array is still excluded (a species nobody has declared
     * availability for is not sellable) while a consumable sails through.
     */
    const available = row.seasons ?? []
    const isPlant = row.item_class === 'plant'
    if (isPlant && !available.some((s) => seasons.includes(s as never))) continue

    const basePricePaise = toPaise(row.base_price_paise, `${row.sku_code} base price`)

    const plant: PlantSpec = {
      speciesId: row.species_slug ?? row.sku_code,
      commonName: row.common_name,
      basePricePaise,
      sizeTier: row.size_tier,
      itemClass: row.item_class,
    }

    // The ladder is DERIVED here, never stored. One rule, applied per render —
    // which is why 24 variants need no 24 price rows to maintain.
    //
    // A consumable gets a ONE-row ladder. A bag of cocopeat has no planter
    // option, and `priceLadder` would otherwise cheerfully offer it a
    // "handmade stoneware, sage glaze" for ₹185 more — which is both nonsense
    // and, on the PDP, an upsell for something that cannot be potted.
    const ladder = isPlant ? priceLadder(plant, planterSpecs) : priceLadder(plant, [])

    items.push({
      skuId: String(row.sku_id),
      skuCode: row.sku_code,
      /*
       * A consumable has no species, so it has no slug. It gets its SKU code,
       * which is unique and stable. The alternative — leaving it null — makes
       * every `/plant/[slug]` link undefined and 500s on a missing param.
       */
      slug: row.species_slug ?? row.sku_code,
      commonName: row.common_name,
      botanicalName: row.botanical_name,
      description: row.description,
      summary: row.summary,
      benchNote: row.bench_note,
      sizeTier: row.size_tier,
      itemClass: row.item_class,
      basePricePaise,
      ladder,
      planters: row.item_class === 'plant' ? planterRows.map((p) => byId.get(String(p.id))!) : [],
      stock: row.stock_on_hand,
      rating: {
        average: row.rating_average == null ? 0 : Number(row.rating_average),
        count: row.rating_count == null ? 0 : Number(row.rating_count),
      },
      care: {
        // A consumable has no care profile, and pretending otherwise would put
        // "water every 7 days" under a bag of cocopeat. Nulls are honest.
        light: row.care_light ?? '',
        waterIntervalDays: row.care_water_interval_days ?? 0,
        soilMoistureTargetPct: row.care_soil_moisture_target_pct ?? 0,
        difficulty: row.care_difficulty ?? '',
        toxicity: row.care_toxicity ?? '',
        guide: {
          light: row.guide_light,
          water: row.guide_water,
          humidity: row.guide_humidity,
          temperature: row.guide_temperature,
          feeding: row.guide_feeding,
          additional: row.guide_additional,
        },
      },
      traits: {
        edible: row.is_edible,
        airPurifying: row.is_air_purifying,
        vastuFriendly: row.is_vastu_friendly,
      },
      seasonal: isPlant ? { seasons: available, hardy: row.hardy ?? false } : null,
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

/**
 * Adapt a loader item to the facet shape.
 *
 * A separate function rather than having `CatalogueItem` implement `Facetable`:
 * `CatalogueItem.entryPaise` would have to be a stored field, and then two
 * sources of truth for the same number — one derived from the ladder, one
 * copied. The conversion is the only place the two vocabularies meet, so it is
 * the only place a mismatch can be caught.
 */
export function toFacetable(item: CatalogueItem): Facetable {
  return {
    id: item.skuId,
    commonName: item.commonName,
    botanicalName: item.botanicalName,
    description: item.description,
    slug: item.slug,
    itemClass: item.itemClass,
    sizeTier: item.sizeTier,
    entryPaise: item.ladder[0]!.totalPaise,
    stock: item.stock,
    light: (item.care.light || 'bright_indirect') as Facetable['light'],
    difficulty: (item.care.difficulty || 'moderate') as Facetable['difficulty'],
    toxicity: (item.care.toxicity || 'pets') as Facetable['toxicity'],
    waterIntervalDays: item.care.waterIntervalDays,
    seasons: (item.seasonal?.seasons ?? []) as Facetable['seasons'],
    edible: item.traits.edible,
    airPurifying: item.traits.airPurifying,
    vastuFriendly: item.traits.vastuFriendly,
  }
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
