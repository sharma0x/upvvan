/**
 * Catalogue schema invariants — TEST 7 (Legal Metrology) and TEST 8 (batch
 * traceability) of the twelve required tests.
 *
 *   7 · "Legal Metrology completeness — PDP missing any mandatory declaration
 *       fails; dimensions required for plants."
 *   8 · "Batch traceability — SKU with no traceable batch cannot publish."
 *
 * ── WHY EVERY WRITE HERE IS RAW SQL ───────────────────────────────────────
 * Both rules are compliance obligations, which makes them the least acceptable
 * place for "the application always sets this correctly". So every assertion
 * below attempts an ILLEGAL DIRECT WRITE that bypasses Payload, its hooks and the
 * domain layer entirely.
 *
 * If a constraint lives only in TypeScript, these writes SUCCEED and the test
 * fails. That is the point: it is the only honest way to prove an invariant is
 * unbypassable.
 *
 * ── WHY THIS MATTERS SPECIFICALLY ─────────────────────────────────────────
 * A published listing carries legal weight. The Legal Metrology 2017 Amendment
 * r.6(10) puts the mandatory declarations on the ONLINE LISTING, not just the
 * package — so a listing missing a declaration is not an ugly page, it is a
 * non-compliant listing. And "never list a species you can't trace to a bill"
 * exists because CITES and the Wildlife (Protection) Act cover many traded
 * ornamentals; an untraceable SKU is a species we cannot defend.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from '@/lib/config'

let pool: import('pg').Pool | null = null
let connected = false

async function exec<T = any>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error('not connected')
  const res = await pool.query(text, values as never[])
  return res.rows as T[]
}

beforeAll(async () => {
  if (!config.database.url) return
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: config.database.url })
    await pool.query('SELECT 1')
    connected = true
  } catch (err) {
    console.warn(`[catalogue-invariants] SKIPPED — cannot reach Postgres: ${(err as Error).message}`)
  }
})

/**
 * Self-healing cleanup.
 *
 * Every fixture slug is prefixed `test-`, and the two real cities are named
 * explicitly. So the suite can guarantee it starts and ends with a clean
 * database regardless of how a previous run died — which is what happened
 * several times while this file was being written: `makeFixtures` sits OUTSIDE
 * the try block, so a throw inside it leaks a city and every later test then
 * fails on a duplicate slug, masking the real failure.
 *
 * Deterministic cleanup beats per-test teardown for database-backed suites: it
 * cannot itself fail, and it leaves nothing behind for the next run.
 */
const TEST_PREFIX = 'test-'
const SEED_CITIES = ['bengaluru', 'hyderabad']

async function purgeTestData(): Promise<void> {
  if (!pool) return
  await exec(
    `DELETE FROM skus WHERE sku_code LIKE $1 OR species_id IN (
       SELECT id FROM species WHERE slug LIKE $1)`,
    [`${TEST_PREFIX}%`],
  )
  await exec(`DELETE FROM supplier_batches WHERE batch_code LIKE $1`, [`${TEST_PREFIX}%`])
  await exec(`DELETE FROM species WHERE slug LIKE $1`, [`${TEST_PREFIX}%`])
  await exec(`DELETE FROM cities WHERE slug LIKE $1 AND slug <> ALL($2)`, [
    `${TEST_PREFIX}%`,
    SEED_CITIES,
  ])
}

beforeAll(async () => {
  if (!config.database.url) return
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: config.database.url })
    await pool.query('SELECT 1')
    connected = true
    await purgeTestData()
  } catch (err) {
    console.warn(`[catalogue-invariants] SKIPPED — cannot reach Postgres: ${(err as Error).message}`)
  }
})

afterAll(async () => {
  if (pool && connected) {
    await purgeTestData().catch(() => {
      // Cleanup must never mask a test result.
    })
  }
  await pool?.end()
  pool = null
})

/** A city + species + traceable batch to hang test SKUs off. */
async function makeFixtures(slug: string) {
  const city = await exec<{ id: number }>(
    `INSERT INTO cities (name, slug, state, status, is_active, licence_status,
                            licence_approved_at, updated_at, created_at)
     VALUES ($1, $2, 'Karnataka', 'live', true, 'approved', now(), now(), now()) RETURNING id`,
    [slug, slug],
  )
  const species = await exec<{ id: number }>(
    // NOTE the `care_` prefix: Payload flattens a named group into prefixed
    // columns. Declaring the care profile inline without the prefix is the kind
    // of thing that looks right and fails on first run.
    `INSERT INTO species (common_name, slug, care_light, care_water_interval_days,
                          care_soil_moisture_target_pct, care_difficulty, care_toxicity,
                          updated_at, created_at)
     VALUES ('Test Plant', $1, 'bright_indirect', 7, 40, 'easy', 'safe', now(), now())
     RETURNING id`,
    [`${slug}-species`],
  )
  const batch = await exec<{ id: number }>(
    `INSERT INTO supplier_batches (batch_code, supplier_name, bill_id, date_received,
                                   quantity_received, updated_at, created_at)
     VALUES ($1, 'Test Nursery', 'BILL-1234', now(), 50, now(), now()) RETURNING id`,
    [`${slug}-batch`],
  )
  return { cityId: city[0]!.id, speciesId: species[0]!.id, batchId: batch[0]!.id }
}

async function dropFixtures(f: { cityId: number; speciesId: number; batchId: number }) {
  await exec(`DELETE FROM skus WHERE species_id = $1`, [f.speciesId])
  await exec(`DELETE FROM supplier_batches WHERE id = $1`, [f.batchId])
  await exec(`DELETE FROM species WHERE id = $1`, [f.speciesId])
  await exec(`DELETE FROM cities WHERE id = $1`, [f.cityId])
}

/** A COMPLETE, compliant plant SKU. Individual tests break exactly one field. */
async function insertCompliantSku(
  f: { cityId: number; speciesId: number; batchId: number },
  code: string,
  overrides: Record<string, string | number | boolean | null> = {},
) {
  const base = {
    sku_code: code,
    species_id: f.speciesId,
    city_id: f.cityId,
    size_tier: 'MD',
    item_class: 'plant',
    base_price_paise: 19900,
    legal_metrology_manufacturer_name: 'Upvvan Nursery',
    legal_metrology_manufacturer_address: '12 Garden Road, Bengaluru 560001',
    legal_metrology_country_of_origin: 'India',
    legal_metrology_common_name_declared: 'Money Plant',
    legal_metrology_net_quantity: '1 plant',
    /*
     * MD tier at base 19900 puts the top of the planter ladder at 241885:
     *   entry  = ceil(19900 × 5.5) = 109450
     *   top    = 109450 + ceil(109450 × 1.21) = 241885
     *
     * The fixture used to declare 109450 — the ENTRY price, not the ladder top.
     * `skus_mrp_covers_ladder` correctly refuses it, which is the constraint
     * working: an MRP is the maximum chargeable price, and this listing is
     * selectable above it.
     */
    legal_metrology_mrp_paise: 241885,
    legal_metrology_dimensions_height_cm: 25,
    legal_metrology_dimensions_pot_diameter_cm: 12,
    legal_metrology_dimensions_spread_cm: 20,
    batch_id: f.batchId,
    is_published: true,
    ...overrides,
  }
  const keys = Object.keys(base)
  const cols = keys.map((k) => `"${k}"`).join(',')
  const vals = keys.map((k) => base[k as keyof typeof base])
  const placeholders = keys.map((_, i) => `$${i + 1}`)
  return exec(
    `INSERT INTO skus (${cols}, updated_at, created_at) VALUES (${placeholders}, now(), now()) RETURNING id`,
    vals,
  )
}

describe('catalogue schema invariants — illegal direct writes only', () => {
  describe('TEST 7 · Legal Metrology completeness', () => {
    it('accepts a fully compliant plant listing', async () => {
      if (!connected) return
      const f = await makeFixtures('test-lm-ok')
      try {
        const rows = await insertCompliantSku(f, 'LM-OK-1')
        expect(rows).toHaveLength(1)
      } finally {
        await dropFixtures(f)
      }
    })

    // Each of the seven declarations, omitted one at a time.
    const DECLARATIONS: Array<[string, string]> = [
      ['manufacturer name', 'legal_metrology_manufacturer_name'],
      ['manufacturer address', 'legal_metrology_manufacturer_address'],
      ['country of origin', 'legal_metrology_country_of_origin'],
      ['common name', 'legal_metrology_common_name_declared'],
      ['net quantity', 'legal_metrology_net_quantity'],
      ['MRP', 'legal_metrology_mrp_paise'],
    ]

    for (const [label, column] of DECLARATIONS) {
      it(`REJECTS a listing missing its ${label}`, async () => {
        if (!connected) return
        const f = await makeFixtures(`test-lm-miss-${column}`)
        try {
          await expect(insertCompliantSku(f, `LM-MISS-${column}`, { [column]: null })).rejects.toThrow()
        } finally {
          await dropFixtures(f)
        }
      })
    }

    it('REJECTS a PLANT listing with no dimensions', async () => {
      // "Dimensions where size is relevant" is EVERY plant in this category.
      if (!connected) return
      const f = await makeFixtures('test-lm-nodims')
      try {
        await expect(
          insertCompliantSku(f, 'LM-NODIMS', {
            legal_metrology_dimensions_height_cm: null,
            legal_metrology_dimensions_pot_diameter_cm: null,
            legal_metrology_dimensions_spread_cm: null,
          }),
        ).rejects.toThrow(/dimensions/i)
      } finally {
        await dropFixtures(f)
      }
    })

    it('ALLOWS a consumable with no dimensions — a bag of soil has no height', async () => {
      // The conditionality is the point: dimensions are required where size is
      // relevant, which is not everywhere.
      if (!connected) return
      const f = await makeFixtures('test-lm-consumable')
      try {
        const rows = await insertCompliantSku(f, 'LM-SOIL-1', {
          item_class: 'consumable',
          legal_metrology_dimensions_height_cm: null,
          legal_metrology_dimensions_pot_diameter_cm: null,
          legal_metrology_dimensions_spread_cm: null,
        })
        expect(rows).toHaveLength(1)
      } finally {
        await dropFixtures(f)
      }
    })

    it('REJECTS a zero height — present but tells the customer nothing', async () => {
      // Bloomscape's loudest review is a palm "laughably small for the container
      // it was in". A declaration only helps if it is a real one.
      if (!connected) return
      const f = await makeFixtures('test-lm-zero')
      try {
        await expect(
          insertCompliantSku(f, 'LM-ZERO', { legal_metrology_dimensions_height_cm: 0 }),
        ).rejects.toThrow()
      } finally {
        await dropFixtures(f)
      }
    })

    it('REJECTS a negative dimension', async () => {
      if (!connected) return
      const f = await makeFixtures('test-lm-neg')
      try {
        await expect(
          insertCompliantSku(f, 'LM-NEG', { legal_metrology_dimensions_spread_cm: -5 }),
        ).rejects.toThrow()
      } finally {
        await dropFixtures(f)
      }
    })

    it('REJECTS a fractional MRP — money is integer paise', async () => {
      if (!connected) return
      const f = await makeFixtures('test-lm-frac')
      try {
        await expect(
          insertCompliantSku(f, 'LM-FRAC', { legal_metrology_mrp_paise: 241885.5 }),
        ).rejects.toThrow()
      } finally {
        await dropFixtures(f)
      }
    })

    it('REJECTS a fractional base price', async () => {
      if (!connected) return
      const f = await makeFixtures('test-lm-fracprice')
      try {
        await expect(insertCompliantSku(f, 'LM-FRACP', { base_price_paise: 199.99 })).rejects.toThrow()
      } finally {
        await dropFixtures(f)
      }
    })
  })

  describe('TEST 8 · batch traceability', () => {
    it('REJECTS publishing a SKU with no batch', async () => {
      if (!connected) return
      const f = await makeFixtures('test-batch-none')
      try {
        await expect(insertCompliantSku(f, 'BATCH-NONE', { batch_id: null })).rejects.toThrow(
          /skus_publish_requires_batch|check constraint/i,
        )
      } finally {
        await dropFixtures(f)
      }
    })

    it('REJECTS creating a batch with no supplier bill at all', async () => {
      // STRONGER than the trigger: `bill_id` is NOT NULL at the column level, so
      // an untraceable batch cannot exist in the first place. The trigger is
      // kept as defence in depth, but this is the real guarantee — traceability
      // is structural, not conditional.
      if (!connected) return
      await expect(
        exec(
          `INSERT INTO supplier_batches (batch_code, supplier_name, bill_id, date_received,
                                         quantity_received, updated_at, created_at)
           VALUES ($1, 'Untraceable Nursery', NULL, now(), 10, now(), now())`,
          [`${TEST_PREFIX}nobill-batch`],
        ),
      ).rejects.toThrow(/bill_id/i)
    })

    it('REJECTS an EMPTY supplier bill', async () => {
      // NOT NULL does not stop '' — an empty string is the likelier accident.
      if (!connected) return
      await expect(
        exec(
          `INSERT INTO supplier_batches (batch_code, supplier_name, bill_id, date_received,
                                         quantity_received, updated_at, created_at)
           VALUES ($1, 'Blank Bill Nursery', '', now(), 10, now(), now())`,
          [`${TEST_PREFIX}blankbill-batch`],
        ),
      ).rejects.toThrow()
    })

    it('ALLOWS an unpublished SKU with no batch — drafts may be incomplete', async () => {
      // Drafts are drafts. The rule is about what is PUBLISHED, which is what
      // carries legal weight.
      if (!connected) return
      const f = await makeFixtures('test-batch-draft')
      try {
        const rows = await insertCompliantSku(f, 'BATCH-DRAFT', {
          batch_id: null,
          is_published: false,
        })
        expect(rows).toHaveLength(1)
      } finally {
        await dropFixtures(f)
      }
    })

    it('REJECTS a direct UPDATE that publishes an untraceable SKU', async () => {
      if (!connected) return
      const f = await makeFixtures('test-batch-update')
      try {
        const draft = await insertCompliantSku(f, 'BATCH-UPDATE', {
          batch_id: null,
          is_published: false,
        })
        await expect(
          exec(`UPDATE skus SET is_published = true WHERE id = $1`, [draft[0]!.id]),
        ).rejects.toThrow(/skus_publish_requires_batch|check constraint/i)
      } finally {
        await dropFixtures(f)
      }
    })
  })

  describe('the audit view reports compliance truthfully', () => {
    it('reports a compliant listing as compliant', async () => {
      if (!connected) return
      const f = await makeFixtures('test-audit-ok')
      try {
        await insertCompliantSku(f, 'AUDIT-OK')
        const rows = await exec<{ compliant: boolean }>(
          `SELECT compliant FROM listing_compliance_audit WHERE "skuCode" = 'AUDIT-OK'`,
        )
        expect(rows[0]!.compliant).toBe(true)
      } finally {
        await dropFixtures(f)
      }
    })

    it('reports an untraceable DRAFT as not compliant', async () => {
      if (!connected) return
      const f = await makeFixtures('test-audit-draft')
      try {
        await insertCompliantSku(f, 'AUDIT-DRAFT', {
          batch_id: null,
          is_published: false,
        })
        const rows = await exec<{ compliant: boolean; hasBatch: boolean }>(
          `SELECT compliant, "hasBatch" FROM listing_compliance_audit WHERE "skuCode" = 'AUDIT-DRAFT'`,
        )
        expect(rows[0]!.hasBatch).toBe(false)
        expect(rows[0]!.compliant).toBe(false)
      } finally {
        await dropFixtures(f)
      }
    })
  })

  describe('the constraints are actually present in the schema', () => {
    it('has every catalogue constraint installed', async () => {
      if (!connected) return
      const expected = [
        'skus_publish_requires_batch',
        'skus_legal_metrology_required',
        'skus_plant_dimensions_required',
        'skus_dimensions_positive',
        'skus_mrp_is_paise',
        'skus_price_is_paise',
      ]
      const rows = await exec<{ conname: string }>(
        `SELECT conname FROM pg_constraint WHERE conname = ANY($1)`,
        [expected],
      )
      expect(rows.map((r) => r.conname).sort()).toEqual(expected.sort())
    })

    it('has the batch-traceability trigger installed', async () => {
      if (!connected) return
      const rows = await exec<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_batch_traceable'`,
      )
      expect(rows).toHaveLength(1)
    })
  })
})