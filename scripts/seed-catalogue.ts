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

  /**
   * One line, the benefit, in our voice.
   *
   * Ugaoo's is "Designers' favourite statement plant" — a REASON, not a
   * restatement of the name. "Money Plant" on a card tells a customer nothing;
   * "Grows in almost any light and forgives a missed watering" tells them why
   * this one.
   */
  summary: string

  /**
   * What actually arrives in the parcel, measured at the bench.
   *
   * THE most important string in this file. The single most-complained-about
   * failure across every audited competitor is "the plant was smaller than the
   * photo" — FNP customers report 3x3-inch pots against a declared 4x4, and
   * Bloomscape's Trustpilot is dominated by "I don't think they have plants in
   * the sizes they're selling them".
   *
   * A DB CHECK requires at least 40 characters, because a vague note ("a nice
   * healthy plant") is worse than none: it occupies the field that was supposed
   * to carry a measurement and reads as though we had nothing precise to say.
   */
  benchNote: string

  /** Drives the kitchen-windowsill collection. */
  edible: boolean
  /** Drives the air-purifying collection. Deliberately NOT claimed broadly. */
  airPurifying: boolean
  vastuFriendly: boolean

  /**
   * The seven-field long-form care guide — LIGHT · WATER · HUMIDITY ·
   * TEMPERATURE · FOOD · ADDITIONAL. Toxicity comes from `toxicity` above so
   * the prose cannot contradict the safety filter.
   */
  careGuide: {
    light: string
    water: string
    humidity: string
    temperature: string
    feeding: string
    additional: string
  }
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

    summary: 'Grows in almost any light, and forgives a missed watering.',
    benchNote:
      'You receive a well-rooted vine in a 4-inch grow pot, roughly 20 cm of trailing growth with at least six leaves. It is a starter plant, not a mature hanging basket — if you want it on a shelf rather than a desk, ask us for the MD size.',
    edible: false,
    airPurifying: true,
    vastuFriendly: true,
    careGuide: {
      light:
        'Happy in almost anything from a dim corner to a bright room, and it grows faster the more light it gets. Direct midday sun through glass will scorch the leaves, which is why we list it as tolerant rather than demanding.',
      water:
        'Water when the top 40% of the soil feels dry — push a finger two knuckles in and if it comes out clean, wait. Do not use a calendar. It stores nothing, so unlike the ZZ plant it does not forgive a month of neglect; a forgotten fortnight in a plastic pot will show as yellow leaves at the bottom.',
      humidity:
        'Ordinary Indian indoor humidity is fine. It will do better with more, and it will tolerate less.',
      temperature:
        'Comfortable anywhere from about 15°C to 35°C. Above 38°C on a west-facing ledge for a whole afternoon it will tip.',
      feeding:
        'Once a month through spring and summer with any balanced liquid feed. Nothing at all in winter — it is barely growing, and feeding a resting plant is how you burn its roots.',
      additional:
        'Pinch the growing tip to make it bushy rather than long. Wipe the leaves monthly — dust on a broad leaf is the main thing that makes an otherwise healthy plant look neglected.',
    },
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

    summary:
      'Survives three weeks of forgetting. The right plant if you are not disciplined about watering.',
    benchNote:
      'You receive an upright specimen with five or more stiff, variegated blades, 30–40 cm tall in a 5-inch grow pot. These do not branch — one clump, several blades. Height varies leaf by leaf and 40 cm is a ceiling, not a promise.',
    edible: false,
    airPurifying: true,
    vastuFriendly: true,
    careGuide: {
      light:
        'Genuinely tolerant of everything from a windowless hallway to a bright room. It will grow faster in bright indirect light, and it is one of the few plants that will not eventually die in low light — it will just stop growing.',
      water:
        'The most over-watered plant in the world, and the reason most people kill one. Let the soil dry out COMPLETELY — all of it, not the top half — and then wait another two weeks. You are looking at three weeks between waterings in an Indian summer and six in winter.',
      humidity: 'None needed. Normal indoor air is fine.',
      temperature:
        'Tolerates from about 10°C to 38°C, which makes it one of the few things on this site that genuinely does not mind a Bengaluru April.',
      feeding:
        'Twice a year at most, in spring. Feeding a snake plant is close to a waste of money and more likely to damage it than help it.',
      additional:
        'Nothing. Do not repot unless the roots are visibly bursting out of the pot. Do not water on a schedule. The only maintenance job it has is being left alone.',
    },
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

    summary: 'Stores water in its rhizomes, so it wilts later than anything else we sell.',
    benchNote:
      'You receive a clump of 4–6 stems with glossy leaves, 35–45 cm of upright growth in a 6-inch grow pot. Leaf count varies between plants and 4 is a normal plant, not a damaged one.',
    edible: false,
    airPurifying: true,
    vastuFriendly: true,
    careGuide: {
      light:
        'One of the very few plants that is genuinely happy in a dim corridor. More light makes faster growth; none will not kill it. This is the single best recommendation we have for a windowless room.',
      water:
        'Same rule as the snake plant, for the same reason — the rhizomes hold water. Let it dry out completely. If the leaves are upright, it does not need water, whatever the calendar says.',
      humidity:
        'Prefers higher humidity than a dry Indian room in winter. A mug of water with pebbles under the pot, or a tray of water nearby, is genuinely useful from November to February.',
      temperature:
        "15°C to 30°C. Below about 12°C the leaves blacken from the tips down, which is the usual reason people conclude they have 'killed' a ZZ plant.",
      feeding:
        'Once or twice a year. It grows slowly by design, and more fertiliser does not make it faster — it makes the leaves curl.',
      additional:
        'Dust the leaves, which are broad and glossy and show everything. Never repot into a pot more than a size larger; a big pot of wet soil is how you kill one.',
    },
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

    summary: 'A small tree that outlives its owner. Give it sun and let the soil dry fully.',
    benchNote:
      'You receive a single-stemmed plant with 12–18 leaves, roughly 20–30 cm tall in a 4-inch terracotta-coloured grow pot. New leaves at the top are bright red when stressed by sun — that is normal, not damage.',
    edible: false,
    airPurifying: false,
    vastuFriendly: true,
    careGuide: {
      light:
        'Wants the most light we can honestly offer indoors: a bright window, and four to six hours of sun if you have one. Unlike the other plants here, this one is actively harmed by a dim room — it will stretch, go leggy and lose its compact shape.',
      water:
        'Let it dry out completely, including the bottom of the pot. This is a succulent and treats excess water as a threat rather than a resource. In a Bengaluru winter it may need water once a month.',
      humidity: 'No requirement at all. Ordinary dry indoor air is fine.',
      temperature:
        '15°C to 32°C. Frost will kill it, which matters if you put it on a balcony in December.',
      feeding:
        'Once in spring with a low-nitrogen feed. High nitrogen produces soft, sappy growth that snaps, which is a common jade complaint.',
      additional:
        'Rotate the pot a quarter-turn monthly so it grows evenly rather than leaning at the window. Prune only to shape; the thick trunk is the plant.',
    },
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

    summary: 'Droops when it is thirsty and recovers within hours — the most honest plant we sell.',
    benchNote:
      'You receive a flowering-size plant with 6–10 white blooms or buds, 40–50 cm of foliage in a 6-inch pot. Peace lilies are sold in flower deliberately, because the flower is how you can tell a healthy one from a stressed one. It is NOT in our summer catalogue — see the seasonal note.',
    edible: false,
    airPurifying: true,
    vastuFriendly: true,
    careGuide: {
      light:
        "Bright indirect light, and it will flower well there. It survives low light for months but will not flower in it, which is the usual complaint about a peace lily that 'has no flowers'.",
      water:
        'This is the one plant here where watering on a schedule works, because it gives you the signal: the leaves droop visibly within a day or two of running dry and stand back up within hours of a drink. Water when the top 50% is dry and stop when water runs out of the drainage hole, then empty the saucer.',
      humidity:
        'Wants good humidity. In a dry air-conditioned Bengaluru office it will brown at the leaf tips; a pebble tray genuinely helps.',
      temperature:
        '18°C to 30°C. It is the most heat-sensitive plant we sell and drops its flowers above about 32°C, which is why it comes out of the catalogue for March to June.',
      feeding:
        'Once a month in spring and summer, at half strength. Pale, dry, crispy leaves are usually over-feeding, not under-feeding.',
      additional:
        'Remove spent flowers at the stem so it does not put energy into seed. Wipe the leaves — it shows dust more than any other plant here.',
    },
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

    summary: 'The one plant every Indian kitchen already has a place for.',
    benchNote:
      'You receive a bushy plant with two or three stems, 25–35 cm tall, already established and flowering at the tip. Tulsi is fast and forgiving: a pinch of the top makes it twice as bushy within a fortnight, so the plant you receive is smaller than it will be in a month. That is the plant working, not a short shipment.',
    edible: true,
    airPurifying: false,
    vastuFriendly: true,
    careGuide: {
      light:
        'Needs direct sun — three hours is a minimum, and six is better. This is the only plant on this site that genuinely wants to be outdoors in a balcony or on a south or west ledge. It will not last indoors for long.',
      water:
        'Damp, not dry. Water when the top 2 cm feels dry, which in a hot balcony in April can be every other day. Unlike every other plant here, tulsi does not tolerate drying out.',
      humidity: 'Indifferent. It grows in Bengaluru monsoon humidity without complaint.',
      temperature:
        '18°C to 36°C. Hardier than it looks; it is the reason Indian households have kept one for centuries.',
      feeding:
        'A little every two weeks through the growing season. It is a herb, not an ornamental — feeding it is how you get leaves rather than flowers.',
      additional:
        'Pinch the flower buds regularly to keep it leafy, and take a cutting in the monsoon to replace the parent rather than buying a new plant. That is how every Indian kitchen has ever propagated it.',
    },
  },
]

/** Planters. Uplift is bounded to the proven band (29%–121%) and validated in SQL. */
const PLANTERS = [
  {
    name: 'Grow pot — decorate on arrival',
    upliftBp: 0,
    costPaise: 2000,
    material: 'plastic',
    colour: 'black',
  },
  {
    name: 'Coir-wrapped terracotta',
    upliftBp: 4500,
    costPaise: 8500,
    material: 'terracotta',
    colour: 'terracotta',
  },
  {
    name: 'Unglazed ceramic, matte white',
    upliftBp: 6000,
    costPaise: 12000,
    material: 'ceramic',
    colour: 'white',
  },
  {
    name: 'Handmade stoneware, sage glaze',
    upliftBp: 8500,
    costPaise: 18500,
    material: 'stoneware',
    colour: 'sage',
  },
  {
    name: 'Studio planter, high-gloss charcoal',
    upliftBp: 12100,
    costPaise: 28000,
    material: 'stoneware',
    colour: 'charcoal',
  },
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
        `INSERT INTO species (common_name, slug, botanical_name, description, summary, bench_note,
                              care_light, care_water_interval_days,
                              care_soil_moisture_target_pct, care_difficulty, care_toxicity,
                              toxicity_witnessed_at,
                              edible, air_purifying, vastu_friendly,
                              care_guide_light, care_guide_water, care_guide_humidity,
                              care_guide_temperature, care_guide_feeding, care_guide_additional,
                              updated_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                 -- $11 is reused here as an enum literal AND as a column value,
                 -- and Postgres refuses to deduce one type for both. $21 carries
                 -- the same value as text, which the CASE can compare against.
                 CASE WHEN $21::text = 'safe' THEN now() ELSE NULL END,
                 $12,$13,$14,$15,$16,$17,$18,$19,$20, now(), now())
         ON CONFLICT (slug) DO UPDATE
           SET common_name = EXCLUDED.common_name,
               botanical_name = EXCLUDED.botanical_name,
               description = EXCLUDED.description,
               summary = EXCLUDED.summary,
               bench_note = EXCLUDED.bench_note,
               care_light = EXCLUDED.care_light,
               care_water_interval_days = EXCLUDED.care_water_interval_days,
               care_soil_moisture_target_pct = EXCLUDED.care_soil_moisture_target_pct,
               care_difficulty = EXCLUDED.care_difficulty,
               care_toxicity = EXCLUDED.care_toxicity,
               toxicity_witnessed_at = EXCLUDED.toxicity_witnessed_at,
               edible = EXCLUDED.edible,
               air_purifying = EXCLUDED.air_purifying,
               vastu_friendly = EXCLUDED.vastu_friendly,
               care_guide_light = EXCLUDED.care_guide_light,
               care_guide_water = EXCLUDED.care_guide_water,
               care_guide_humidity = EXCLUDED.care_guide_humidity,
               care_guide_temperature = EXCLUDED.care_guide_temperature,
               care_guide_feeding = EXCLUDED.care_guide_feeding,
               care_guide_additional = EXCLUDED.care_guide_additional,
               updated_at = now()
         RETURNING id`,
        [
          s.commonName,
          s.slug,
          s.botanicalName,
          s.description,
          s.summary,
          s.benchNote,
          s.light,
          s.waterIntervalDays,
          s.soilMoistureTargetPct,
          s.difficulty,
          s.toxicity,
          s.edible,
          s.airPurifying,
          s.vastuFriendly,
          s.careGuide.light,
          s.careGuide.water,
          s.careGuide.humidity,
          s.careGuide.temperature,
          s.careGuide.feeding,
          s.careGuide.additional,
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
      /*
       * Consumables carry a DESCRIPTION because the card renders it, and a rail of
       * three bare names with a price is not a merchandising decision — it is a
       * receipt. Each description says what it is FOR, which is the only reason
       * someone buys soil from a nursery rather than a hardware shop.
       *
       * They are also the highest-margin line in the business: a 5kg bag ships at
       * the same courier rate as a 5ft plant, has no mortality, cannot generate a
       * return leg, and a customer who buys one is demonstrably already gardening.
       * Both TrustBasket and Paudhewale quietly became supplies businesses.
       */
      {
        code: 'SOIL-COCOPEAT-5KG',
        name: 'Cocopeat planting medium',
        net: '5 kg',
        pricePaise: 24900,
        description:
          'What we pot in ourselves. Holds moisture without going sour, and it is the medium every plant on this site arrives in — so repotting into it changes nothing about how your plant behaves.',
      },
      {
        code: 'SOIL-POTMIX-5KG',
        name: 'All-purpose pot mix',
        net: '5 kg',
        pricePaise: 21900,
        description:
          'Cocopeat, perlite and vermiculite, mixed. Use it when you are repotting an indoor plant that has been in the same soil for more than two years, or any time the old soil has gone hard and drains slowly.',
      },
      {
        code: 'FERTILIZER-ORGANIC-1KG',
        name: 'Organic plant food',
        net: '1 kg',
        pricePaise: 34900,
        description:
          'A dry organic feed, diluted as the label says. Feed through spring and summer, never in winter, and never more often than every two weeks — over-feeding is the most common way we get told a plant is dying.',
      },
    ]

    for (const c of CONSUMABLES) {
      await client.query(
        `INSERT INTO skus (sku_code, species_id, city_id, size_tier, item_class,
                           description, base_price_paise,
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
         VALUES ($1, NULL, $2, 'XS', 'consumable', $8, $3,
                 'Upvvan Nursery Pvt Ltd',
                 '12 Garden Road, Bengaluru, Karnataka 560001',
                 'India', $4, $5, $6, NULL, NULL, NULL,
                 $7, NULL, true, now(), now())
         ON CONFLICT (sku_code) DO UPDATE
           SET description = EXCLUDED.description,
               base_price_paise = EXCLUDED.base_price_paise,
               legal_metrology_mrp_paise = EXCLUDED.legal_metrology_mrp_paise,
               updated_at = now()`,
        [c.code, cityId, c.pricePaise, c.name, c.net, c.pricePaise, batchId, c.description],
      )
      skuCount++

      /*
       * `sku_stock` rows for consumables.
       *
       * The loader LEFT-JOINs stock and COALESCEs a missing row to 0 — so a
       * consumable with no stock row renders as "Sold out" and refuses to be
       * added to a cart. That is the correct behaviour for a missing row, which
       * is exactly why the seed has to write one. Stock is enforced at checkout
       * too, so a consumable with no row could be paid for and only then be
       * rejected at the bench.
       */
      await client.query(
        `INSERT INTO sku_stock (sku_id, stock_on_hand, updated_at, created_at)
         SELECT id, 200, now(), now() FROM skus WHERE sku_code = $1
         ON CONFLICT (sku_id) DO NOTHING`,
        [c.code],
      )
    }

    await client.query('COMMIT')

    console.log('✓ Catalogue seeded')
    console.log(`  ${SPECIES.length} species · ${PLANTERS.length} planters · ${skuCount} SKUs`)
    console.log('  Guarantee tier T0 (48h) · all SKUs traceable to BATCH-2026-0001')
    console.log(
      `  ${SPECIES.filter((s) => s.hardy).length}/${SPECIES.length} hardy for the summer window`,
    )
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
