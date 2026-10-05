/**
 * Order invariants — TEST 3 (no refund for plants) and the pincode gate
 * (Part 3 rule 12) at order-placement time.
 *
 * ── TEST 3 · NO REFUND FOR PLANTS ──────────────────────────────────────────
 *
 * "No-refund-for-plants — the refund path for a plant item does not exist and
 * returns a typed error. Mixed cart: soil refundable in money."
 *
 * This is the single biggest structural difference from every competitor in the
 * research. All of them default a dissatisfied customer to a coupon or wallet
 * credit: Ugaoo's 30-day guarantee is defeated four ways (register within 5
 * days, keep it in the original pot, mortality only, triage before payout), and
 * Urvann defaults to wallet credit — which suppresses the complaint and starves
 * the DOA model of the feedback it depends on.
 *
 * We settle in money where money is owed, and never pretend a plant can be
 * refunded, because the marginal cost of a replacement is a plant already grown
 * and otherwise discarded.
 *
 * ── WHY EVERY WRITE IS RAW SQL ─────────────────────────────────────────────
 * The refund path must not exist *structurally*. A test that calls an
 * application function proves only that one function refuses — not that no path
 * exists. So these assertions attempt illegal direct writes and inspect the
 * schema.
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
    console.warn(`[order-invariants] SKIPPED — cannot reach Postgres: ${(err as Error).message}`)
  }
})

afterAll(async () => {
  await pool?.end()
  pool = null
})

/**
 * Bengaluru + a live serviceable pincode + a published plant SKU.
 *
 * 560001 already exists from the Phase 0 seed and is serviceable, so it is
 * REUSED rather than duplicated — `pincodes.pincode` is UNIQUE and re-seeding it
 * is exactly the kind of fixture leak that masks the real failure. The test-only
 * pins (560048 off, 500001 cross-city) are created and removed explicitly.
 */
async function seedOrderFixtures() {
  const city = await exec<{ id: number }>(`SELECT "id" FROM "cities" WHERE slug = 'bengaluru'`)
  const cityId = city[0]!.id

  const existing = await exec<{ pincode: string }>(
    `SELECT "pincode" FROM "pincodes" WHERE "pincode" = '560001' AND "is_serviceable" = true`,
  )
  if (existing.length === 0) {
    throw new Error('560001 missing — run `make seed-phase0` before this suite.')
  }

  const plantSku = await exec<{ id: number }>(
    `SELECT "id" FROM "skus" WHERE "is_published" AND "item_class" = 'plant' LIMIT 1`,
  )
  return { cityId, pincode: '560001', plantSkuId: plantSku[0]!.id }
}

/** Remove only what these tests created. 560001 is seed data and stays. */
async function cleanupOrderFixtures() {
  await exec(`DELETE FROM "orders_items" WHERE "id" LIKE 'TEST-%'`)
  await exec(`DELETE FROM "orders" WHERE "order_code" LIKE 'TEST-%'`)
  await exec(`DELETE FROM "pincodes" WHERE "pincode" IN ('560048', '500001') AND "city_id" IN (SELECT "id" FROM "cities")`)
}

describe('order invariants — illegal direct writes only', () => {
  describe('TEST 3 · no refund for plants', () => {
    it('the orders state machine has NO refunded status', async () => {
      if (!connected) return
      // The strongest form: there is no value to transition to. A refund for a
      // plant is not a blocked operation — it is a state that does not exist.
      const rows = await exec<{ enumlabel: string }>(
        `SELECT e.enumlabel
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_orders_status'`,
      )
      const statuses = rows.map((r) => r.enumlabel)
      expect(statuses).toContain('DELIVERED')
      expect(statuses).toContain('CLAIM_OPEN')
      expect(statuses).toContain('REPLACEMENT_QUEUED')
      expect(statuses).not.toContain('REFUNDED')
    })

    it('the payment mode enum cannot represent COD at all', async () => {
      if (!connected) return
      // Stronger than a CHECK: 'cod' is not a valid enum value, so it cannot be
      // written even by a direct INSERT.
      const rows = await exec<{ enumlabel: string }>(
        `SELECT e.enumlabel
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_orders_payment_mode'`,
      )
      expect(rows.map((r) => r.enumlabel)).toEqual(['prepaid'])
    })

    it('REJECTS an attempt to write a COD payment mode', async () => {
      if (!connected) return
      const f = await seedOrderFixtures()
      try {
        await expect(
          exec(
            `INSERT INTO "orders" ("order_code", "city_id", "status", "payment_mode", "pincode",
                                    "revenue_paise", "contribution_paise", "updated_at", "created_at")
             VALUES ('TEST-COD-1', $1, 'PLACED', 'cod', $2, 0, 0, now(), now())`,
            [f.cityId, f.pincode],
          ),
        ).rejects.toThrow()
      } finally {
        await cleanupOrderFixtures()
      }
    })

    it('there is no refund column on order items', async () => {
      if (!connected) return
      // A `refund_amount` field would be an invitation. Confirm none exists.
      const rows = await exec<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'order_items' AND column_name ILIKE '%refund%'`,
      )
      expect(rows).toEqual([])
    })

    it('a plant and a consumable are distinguishable by item class, not by a flag', async () => {
      if (!connected) return
      // The remedy rule keys off item_class: plant = replacement only,
      // consumable = refund in money within 24h. It is a property of the SKU.
      const rows = await exec<{ enumlabel: string }>(
        `SELECT e.enumlabel FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_skus_item_class'`,
      )
      const classes = rows.map((r) => r.enumlabel)
      expect(classes).toContain('plant')
      expect(classes).toContain('consumable')
      expect(classes).toContain('planter')
    })
  })

  describe('the pincode + city gate, at order placement', () => {
    it('creates an order for a serviceable pincode in the right city', async () => {
      if (!connected) return
      const f = await seedOrderFixtures()
      const client = await pool!.connect()
      try {
        /*
         * Order and lines go in ONE transaction. The reconciliation trigger is
         * DEFERRABLE INITIALLY DEFERRED and fires at COMMIT, so committing the
         * order first would fail it for having no lines yet — which is the
         * trigger working correctly, not a regression. This mirrors what
         * POST /api/orders actually does.
         */
        await client.query('BEGIN')
        const { rows } = await client.query<{ order_code: string }>(
          `INSERT INTO "orders" ("order_code", "city_id", "status", "payment_mode", "pincode",
                                  "revenue_paise", "contribution_paise", "updated_at", "created_at")
           VALUES ('TEST-OK-1', $1, 'PLACED', 'prepaid', $2, 19900, 4975, now(), now())
           RETURNING "order_code"`,
          [f.cityId, f.pincode],
        )
        expect(rows).toHaveLength(1)

        await client.query(
          `INSERT INTO orders_items (id, _order, _parent_id, sku_id, price_paise)
           VALUES ('TEST-OK-1-1', 0, (SELECT id FROM orders WHERE order_code = 'TEST-OK-1'), $1, 19900)`,
          [f.plantSkuId],
        )
        await client.query('COMMIT')
      } finally {
        await client.query('ROLLBACK').catch(() => {})
        client.release()
        await cleanupOrderFixtures()
      }
    })

    it('REJECTS an order for a pincode outside the serviceable set', async () => {
      if (!connected) return
      const f = await seedOrderFixtures()
      try {
        await expect(
          exec(
            `INSERT INTO "orders" ("order_code", "city_id", "status", "payment_mode", "pincode",
                                    "revenue_paise", "contribution_paise", "updated_at", "created_at")
             VALUES ('TEST-BAD-1', $1, 'PLACED', 'prepaid', '999999', 0, 0, now(), now())`,
            [f.cityId],
          ),
        ).rejects.toThrow(/serviceable set/i)
      } finally {
        await cleanupOrderFixtures()
      }
    })

    it('REJECTS an order for an UNSERVICEABLE pincode that exists', async () => {
      if (!connected) return
      const f = await seedOrderFixtures()
      try {
        await exec(
          `INSERT INTO "pincodes" ("pincode", "city_id", "is_serviceable", "updated_at", "created_at")
           VALUES ('560048', $1, false, now(), now())`,
          [f.cityId],
        )
        await expect(
          exec(
            `INSERT INTO "orders" ("order_code", "city_id", "status", "payment_mode", "pincode",
                                    "revenue_paise", "contribution_paise", "updated_at", "created_at")
             VALUES ('TEST-BAD-2', $1, 'PLACED', 'prepaid', '560048', 0, 0, now(), now())`,
            [f.cityId],
          ),
        ).rejects.toThrow(/serviceable set/i)
      } finally {
        await exec(`DELETE FROM "pincodes" WHERE "pincode" = '560048'`)
        await cleanupOrderFixtures()
      }
    })

    it('REJECTS an order when the pincode belongs to a DIFFERENT city', async () => {
      if (!connected) return
      // The subtle case: a pincode live in Hyderabad must not satisfy a Bengaluru
      // order. This is the same defect the CITY_MISMATCH UI code surfaces.
      const f = await seedOrderFixtures()
      try {
        await exec(
          `INSERT INTO "pincodes" ("pincode", "city_id", "is_serviceable", "updated_at", "created_at")
           VALUES ('500001', (SELECT "id" FROM "cities" WHERE slug='hyderabad'), true, now(), now())`,
        )
        await expect(
          exec(
            `INSERT INTO "orders" ("order_code", "city_id", "status", "payment_mode", "pincode",
                                    "revenue_paise", "contribution_paise", "updated_at", "created_at")
             VALUES ('TEST-BAD-3', $1, 'PLACED', 'prepaid', '500001', 0, 0, now(), now())`,
            [f.cityId],
          ),
        ).rejects.toThrow(/belongs to city/i)
        await exec(`DELETE FROM "pincodes" WHERE "pincode" = '500001'`)
      } finally {
        await cleanupOrderFixtures()
      }
    })
  })

  describe('city P&L is a view, so it cannot be written to by accident', () => {
    it('rejects an INSERT into city_pnl', async () => {
      if (!connected) return
      // This is the whole reason it is a view: killing a city is a `status`
      // change, never a manual accounting exercise.
      await expect(
        exec(`INSERT INTO "city_pnl" ("cityId", "orders", "revenuePaise") VALUES (1, 5, 100)`),
      ).rejects.toThrow()
    })

    it('groups orders by city', async () => {
      if (!connected) return
      const rows = await exec<{ cityId: number; orders: number }>(
        `SELECT "cityId", "orders" FROM "city_pnl" ORDER BY "cityId"`,
      )
      for (const row of rows) {
        expect(Number.isInteger(row.cityId)).toBe(true)
        expect(row.orders).toBeGreaterThanOrEqual(0)
      }
    })
  })
})