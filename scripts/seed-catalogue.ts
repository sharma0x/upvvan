/**
 * Phase 1 catalogue seed — real species, planters, batches and SKUs.
 *
 * Idempotent: every row is upserted by a natural key, so running this twice
 * changes nothing. Seeding is a development convenience and must never
 * accumulate duplicates.
 *
 * ── WHY THESE SPECIES ──────────────────────────────────────────────────────
 * Chosen for Indian homes specifically, not for a generic plant list:
 *
 *  · Most urban Indian buyers have zero natural light (rented flat, north-facing
 *    window, AC running). So every species here is `bright_indirect` or `low`,
 *    and the quiz explicitly does NOT ask "how bright is your window?".
 *  · March–June at 40–46°C is lethal. Each species carries its seasonal
 *    availability per city; the hardy flag is what survives the window.
 *  · Toxicity is recorded because it is a SAFETY field, and it drives the
 *    pet-safe filter. Two of these are toxic to pets and say so.
 *
 * Prices come from the research: a 4-inch pot at ₹249 is the documented entry
 * point, and the planter ladder takes the same plant to ₹1,099 (Ugaoo's 5.5×).
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

interface SpeciesSeed {
  slug: string
  commonName: string
  botanicalName: string
  description: string
  light: 'low' | 'bright_indirect' | 'direct'
  waterIntervalDays: number
  soilMoistureTargetPct: number
  difficulty: 'easy' | 'moderate' | 'fussy'
  toxicity: 'pets' | 'children' | 'safe'
  /** Hardiness in the Mar–June window. Only hardy species are listed in summer. */
  hardy: boolean
  /** Seasons available in Bengaluru. */
  seasons: Array<'summer' | 'monsoon' | 'perennial'>
  /** XS-tier base price, paise. The planter ladder is derived from this. */
  basePricePaise: number
  /** Declared dimensions at XS (cm). Measured at the bench with a ruler. */
  heightCm: number
  potDiameterCm: number
  spreadCm: number
}

const SPECIES: SpeciesSeed[] = [
  {
    slug: 'money-plant',
    commonName: 'Money Plant',
    botanicalName: 'Epipremnum aureum',
    description:
      'A trailing vine that grows fast in almost any light and forgives a missed watering. The safest first plant there is.',
    light: 'low',
    waterIntervalDays: 7,
    soilMoistureTargetPct: 40,
    difficulty: 'easy',
    toxicity: 'children',
    hardy: true,
    seasons: ['summer', 'monsoon', 'perennial'],
    basePricePaise: 19900,
    heightCm: 20,
    potDiameterCm: 10,
    spreadCm: 25,
  },
  {
    slug: 'snake-plant',
    commonName: 'Snake Plant',
    botanicalName: 'Dracaena trifasciata',
    description:
      'Survives neglect, low light and dry air. Water it once a month and it will still be alive — the right plant for a forgetful owner.',
    light: 'low',
    waterIntervalDays: 21,
    soilMoistureTargetPct: 25,
    difficulty: 'easy',
    toxicity: 'pets',
    hardy: true,
    seasons: ['summer', 'monsoon', 'perennial'],
    basePricePaise: 24900,
    heightCm: 35,
    potDiameterCm: 12,
    spreadCm: 18,
  },
  {
    slug: 'zz-plant',
    commonName: 'ZZ Plant',
    botanicalName: 'Zamioculcas zamiifolia',
    description:
      'Stores water in its rhizomes, so it wilts later than anything else we sell. Genuinely happy in a dim corridor.',
    light: 'low',
    waterIntervalDays: 18,
    soilMoistureTargetPct: 30,
    difficulty: 'easy',
    toxicity: 'pets',
    hardy: true,
    seasons: ['summer', 'monsoon', 'perennial'],
    basePricePaise: 32900,
    heightCm: 40,
    potDiameterCm: 14,
    spreadCm: 25,
  },
  {
    slug: 'jade-plant',
    commonName: 'Jade Plant',
    botanicalName: 'Crassula ovata',
    description:
      'A small tree that outlives its owner. Give it sun and let the soil dry fully between waterings.',
    light: 'bright_indirect',
    waterIntervalDays: 14,
    soilMoistureTargetPct: 30,
    difficulty: 'easy',
    toxicity: 'children',
    hardy: true,
    seasons: ['summer', 'monsoon', 'perennial'],
    basePricePaise: 29900,
    heightCm: 25,
    potDiameterCm: 12,
    spreadCm: 20,
  },
  {
    slug: 'peace-lily',
    commonName: 'Peace Lily',
    botanicalName: 'Spathiphyllum wallisii',
    description:
      'Tells you exactly when it is thirsty by drooping, and recovers within hours. The most communicative plant we sell.',
    light: 'low',
    waterIntervalDays: 5,
    soilMoistureTargetPct: 50,
    difficulty: 'moderate',
    toxicity: 'pets',
    hardy: false,
    // NOT hardy — it sulks above 38°C, so it is out of the summer catalogue.
    seasons: ['monsoon', 'perennial'],
    basePricePaise: 44900,
    heightCm: 45,
    potDiameterCm: 15,
    spreadCm: 30,
  },
  {
    slug: 'tulsi',
    commonName: 'Tulsi',
    botanicalName: 'Ocimum sanctum',
    description:
      'The one plant every Indian kitchen already has a place for. Hardy, fast, and it grows back from nothing.',
    light: 'direct',
    waterIntervalDays: 2,
    soilMoistureTargetPct: 55,
    difficulty: 'easy',
    toxicity: 'safe',
    hardy: true,
    seasons: ['summer', 'monsoon', 'perennial'],
    basePricePaise: 14900,
    heightCm: 30,
    potDiameterCm: 10,
    spreadCm: 18,
  },
]

/** Planters. Uplift is bounded to the proven band (29%–121%) and validated in SQL. */
const PLANTERS = [
  { name: 'Grow pot — decorate on arrival', upliftBp: 0, costPaise: 2000, material: 'plastic', colour: 'black' },
  { name: 'Coir-wrapped terracotta', upliftBp: 4500, costPaise: 8500, material: 'terracotta', colour: 'terracotta' },
  { name: 'Unglazed ceramic, matte white', upliftBp: 6000, costPaise: 12000, material: 'ceramic', colour: 'white' },
  { name: 'Handmade stoneware, sage glaze', upliftBp: 8500, costPaise: 18500, material: 'stoneware', colour: 'sage' },
  { name: 'Studio planter, high-gloss charcoal', upliftBp: 12100, costPaise: 28000, material: 'stoneware', colour: 'charcoal' },
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const city = await client.query<{ id: number }>(
      `SELECT id FROM cities WHERE slug = 'bengaluru'`,
    )
    const cityId = city.rows[0]?.id
    if (!cityId) throw new Error('Bengaluru not found — run `make seed-phase0` first.')

    // Rebuild the per-city availability matrix from scratch each run. Payload
    // gives these rows string ids with no natural key, so an upsert is not
    // possible — delete and reinsert is the honest idempotent approach.
    await client.query(
      `DELETE FROM species_seasonal_availability_seasons
        WHERE parent_id IN (SELECT id FROM species_seasonal_availability)`,
    )
    await client.query(`DELETE FROM species_seasonal_availability`)

    // ── Species ─────────────────────────────────────────────────────────────
    const speciesIds = new Map<string, number>()

    for (const s of SPECIES) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO species (common_name, slug, botanical_name, description,
                              care_light, care_water_interval_days,
                              care_soil_moisture_target_pct, care_difficulty, care_toxicity,
                              updated_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now())
         ON CONFLICT (slug) DO UPDATE
           SET common_name = EXCLUDED.common_name,
               botanical_name = EXCLUDED.botanical_name,
               description = EXCLUDED.description,
               care_light = EXCLUDED.care_light,
               care_water_interval_days = EXCLUDED.care_water_interval_days,
               care_soil_moisture_target_pct = EXCLUDED.care_soil_moisture_target_pct,
               care_difficulty = EXCLUDED.care_difficulty,
               care_toxicity = EXCLUDED.care_toxicity,
               updated_at = now()
         RETURNING id`,
        [
          s.commonName,
          s.slug,
          s.botanicalName,
          s.description,
          s.light,
          s.waterIntervalDays,
          s.soilMoistureTargetPct,
          s.difficulty,
          s.toxicity,
        ],
      )
      speciesIds.set(s.slug, res.rows[0]!.id)

      // Seasonal availability — the per-city matrix. A species out of season is
      // simply not listed for that city, which is how we "substitute hardy SKUs,
      // never pause" through the lethal window.
      //
      // Payload splits a `hasMany` select into a parent row plus one child row
      // per VALUE, keyed by the parent's string id — not by _parent_id. Two
      // tables, three steps.
      // `id` is NOT NULL with no default: Payload generates it in application
      // code, so a raw-SQL seed must supply one. Deterministic is fine here
      // because the rows are deleted and rebuilt on every run.
      const availId = `avail-${s.slug}`
      await client.query(
        `INSERT INTO species_seasonal_availability (id, _order, _parent_id, city_id, hardy)
         VALUES ($1, 0, $2, $3, $4)`,
        [availId, res.rows[0]!.id, cityId, s.hardy],
      )

      for (const [i, season] of s.seasons.entries()) {
        await client.query(
          `INSERT INTO species_seasonal_availability_seasons ("order", parent_id, value)
           VALUES ($1, $2, $3)`,
          [i + 1, availId, season],
        )
      }
    }

    // ── Planters ────────────────────────────────────────────────────────────
    for (const p of PLANTERS) {
      await client.query(
        `INSERT INTO planters (name, uplift_bp, cost_paise, material, colour, is_active,
                               updated_at, created_at)
         VALUES ($1,$2,$3,$4,$5,true, now(), now())
         ON CONFLICT DO NOTHING`,
        [p.name, p.upliftBp, p.costPaise, p.material, p.colour],
      )
    }

    // ── A traceable supplier batch ──────────────────────────────────────────
    const batch = await client.query<{ id: number }>(
      `INSERT INTO supplier_batches (batch_code, supplier_name, bill_id, supplier_gstin,
                                     nursery_location, date_received, quantity_received,
                                     updated_at, created_at)
       VALUES ('BATCH-2026-0001', 'Bengaluru Rural Suppliers', 'BILL-KA-2026-4471',
               '29ABCDE1234F1Z5', 'Hesaraghatta, Bengaluru North', now(), 500, now(), now())
       ON CONFLICT (batch_code) DO UPDATE SET updated_at = now()
       RETURNING id`,
    )
    const batchId = batch.rows[0]!.id

    // ── SKUs: XS and MD per species ─────────────────────────────────────────
    // MD carries a +450% size multiplier (SIZE_TIER_MULTIPLIER), so a 5.5×
    // ladder is reachable across tier × planter.
    let skuCount = 0
    for (const s of SPECIES) {
      for (const [tier, scale] of [
        ['XS', 1],
        ['MD', 2.1],
      ] as const) {
        const base = Math.round(s.basePricePaise * scale)
        /*
         * MRP must be the TOP OF THE LADDER, not `base × 1.21`.
         *
         * The first version wrote `Math.round(base * 1.21)` with the comment
         * "MRP inclusive of taxes, top of ladder". That was wrong on both halves:
         * 1.21 is the top planter's UPLIFT (12100bp), not its total, and no tax
         * was ever computed. For MONEY-PLANT-XS it produced 24079 against a
         * chargeable top of 43979 — we were selling 1.83× our own declared MRP on
         * 4 of 5 planter options, on the same PDP that declared it. MD SKUs were
         * 10.05× over. That is the textbook Legal Metrology r.6(1)(e) breach,
         * extended to online listings by r.6(10).
         *
         * An MRP is the MAXIMUM price at which the commodity may be sold, so it
         * must be at least the dearest selectable configuration. Computed the same
         * way `applyPlanter` does, and enforced by `skus_mrp_covers_ladder`.
         */
        const SIZE_MULTIPLIER_BP: Record<string, number> = {
          XS: 0,
          MD: 45_000,
          LG: 120_000,
          XL: 260_000,
        }
        const MAX_UPLIFT_BP = 12_100
        const entryPaise = Math.ceil((base * (10_000 + (SIZE_MULTIPLIER_BP[tier] ?? 0))) / 10_000)
        const mrp = entryPaise + Math.ceil((entryPaise * MAX_UPLIFT_BP) / 10_000)
        const code = `${s.slug.toUpperCase()}-${tier}`

        await client.query(
          `INSERT INTO skus (sku_code, species_id, city_id, size_tier, item_class,
                             base_price_paise,
                             legal_metrology_manufacturer_name,
                             legal_metrology_manufacturer_address,
                             legal_metrology_country_of_origin,
                             legal_metrology_common_name_declared,
                             legal_metrology_net_quantity,
                             legal_metrology_mrp_paise,
                             legal_metrology_dimensions_height_cm,
                             legal_metrology_dimensions_pot_diameter_cm,
                             legal_metrology_dimensions_spread_cm,
                             batch_id, bench_photo_url, is_published,
                             updated_at, created_at)
           VALUES ($1,$2,$3,$4,'plant',$5,
                   'Upvvan Nursery Pvt Ltd',
                   '12 Garden Road, Bengaluru, Karnataka 560001',
                   'India', $6, '1 plant', $7, $8, $9, $10, $11, NULL, true,
                   now(), now())
           ON CONFLICT (sku_code) DO UPDATE
             SET base_price_paise = EXCLUDED.base_price_paise,
                 legal_metrology_mrp_paise = EXCLUDED.legal_metrology_mrp_paise,
                 legal_metrology_dimensions_height_cm = EXCLUDED.legal_metrology_dimensions_height_cm,
                 updated_at = now()`,
          [
            code,
            speciesIds.get(s.slug),
            cityId,
            tier,
            base,
            s.commonName,
            mrp,
            Math.round(s.heightCm * scale),
            Math.round(s.potDiameterCm * scale),
            Math.round(s.spreadCm * scale),
            batchId,
          ],
        )
        skuCount++
      }
    }

    // ── CONSUMABLES ─────────────────────────────────────────────────────────
    // Refills are the actual business; plants are loss-leader acquisition
    // (business-model.md). So the catalogue must carry them, and they carry a
    // different remedy: REFUNDABLE IN MONEY within 24h, because soil and pots
    // have no mortality risk. Prompt test 3 requires a mixed cart to prove the
    // two remedies coexist on one order.
    //
    // Note the deliberate absence of dimensions — Legal Metrology r.6(1)(g)
    // requires them only "where size is relevant". A 5kg bag of cocopeat has no
    // meaningful dimension, and faking one to satisfy a schema would be worse
    // than the null. The plant rows above carry all three.
    const CONSUMABLES = [
      {
        code: 'SOIL-COCOPEAT-5KG',
        name: 'Cocopeat planting medium',
        net: '5 kg',
        pricePaise: 24900,
      },
      {
        code: 'SOIL-POTMIX-5KG',
        name: 'All-purpose pot mix',
        net: '5 kg',
        pricePaise: 21900,
      },
      {
        code: 'FERTILIZER-ORGANIC-1KG',
        name: 'Organic plant food',
        net: '1 kg',
        pricePaise: 34900,
      },
    ]

    for (const c of CONSUMABLES) {
      await client.query(
        `INSERT INTO skus (sku_code, species_id, city_id, size_tier, item_class,
                           base_price_paise,
                           legal_metrology_manufacturer_name,
                           legal_metrology_manufacturer_address,
                           legal_metrology_country_of_origin,
                           legal_metrology_common_name_declared,
                           legal_metrology_net_quantity,
                           legal_metrology_mrp_paise,
                           legal_metrology_dimensions_height_cm,
                           legal_metrology_dimensions_pot_diameter_cm,
                           legal_metrology_dimensions_spread_cm,
                           batch_id, bench_photo_url, is_published,
                           updated_at, created_at)
         VALUES ($1, NULL, $2, 'XS', 'consumable', $3,
                 'Upvvan Nursery Pvt Ltd',
                 '12 Garden Road, Bengaluru, Karnataka 560001',
                 'India', $4, $5, $6, NULL, NULL, NULL,
                 $7, NULL, true, now(), now())
         ON CONFLICT (sku_code) DO UPDATE
           SET base_price_paise = EXCLUDED.base_price_paise,
               legal_metrology_mrp_paise = EXCLUDED.legal_metrology_mrp_paise,
               updated_at = now()`,
        [c.code, cityId, c.pricePaise, c.name, c.net, c.pricePaise, batchId],
      )
      skuCount++
    }

    await client.query('COMMIT')

    console.log('✓ Catalogue seeded')
    console.log(`  ${SPECIES.length} species · ${PLANTERS.length} planters · ${skuCount} SKUs`)
    console.log('  Guarantee tier T0 (48h) · all SKUs traceable to BATCH-2026-0001')
    console.log(`  ${SPECIES.filter((s) => s.hardy).length}/${SPECIES.length} hardy for the summer window`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('✗ Catalogue seed failed:', (err as Error).message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()