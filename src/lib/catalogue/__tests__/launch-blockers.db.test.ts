/**
 * Launch blockers — every constraint added by `20261005_000007_launch_blockers.ts`.
 *
 * ── WHY THIS FILE IS ALL ILLEGAL WRITES ─────────────────────────────────────
 *
 * Each of these was found by an adversarial stakeholder writing DIRECTLY to
 * Postgres, bypassing every hook, every Payload validation, and every route
 * handler. A passing test here therefore means the database itself refuses the
 * write — which is the only claim that matters. Calling an application function
 * would have proved nothing about the layer that was actually broken.
 *
 * Everything is wrapped so the fixture state is restored, and every write is
 * either expected to throw or followed by an explicit cleanup.
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

/** Run a statement inside a transaction and ROLLBACK, so nothing persists. */
async function attempt(statement: string, values: unknown[] = []): Promise<string> {
  const client = await pool!.connect()
  try {
    await client.query('BEGIN')
    await client.query(statement, values as never[])
    await client.query('ROLLBACK')
    return 'ACCEPTED'
  } catch (err) {
    await client.query('ROLLBACK')
    return (err as Error).message
  } finally {
    client.release()
  }
}

let bengaluruId = 0
let hyderabadId = 0
let plantSkuId = 0
let plantBasePaise = 0

beforeAll(async () => {
  if (!config.database.url) return
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: config.database.url })
    await pool.query('SELECT 1')
    connected = true

    const cities = await exec<{ id: number; slug: string }>(
      `SELECT "id", "slug" FROM "cities" WHERE "slug" IN ('bengaluru','hyderabad')`,
    )
    bengaluruId = cities.find((c) => c.slug === 'bengaluru')!.id
    hyderabadId = cities.find((c) => c.slug === 'hyderabad')!.id

    const sku = await exec<{ id: number; base_price_paise: string }>(
      `SELECT "id", "base_price_paise" FROM "skus"
        WHERE "is_published" AND "item_class" = 'plant' ORDER BY "id" LIMIT 1`,
    )
    plantSkuId = sku[0]!.id
    plantBasePaise = Number(sku[0]!.base_price_paise)
  } catch (err) {
    console.warn(`[launch-blockers] SKIPPED — ${(err as Error).message}`)
  }
})

afterAll(async () => {
  await pool?.end()
  pool = null
})

describe('launch blockers — illegal direct writes only', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // A · Legal Metrology
  // ═══════════════════════════════════════════════════════════════════════

  describe('A · Legal Metrology r.6(1) declarations', () => {
    it('REJECTS a blank manufacturer name on a published SKU', async () => {
      if (!connected) return
      // NOT NULL does not stop ''. Every one of these was accepted before
      // `skus_declarations_non_blank`, and rendered as an empty <dd> on the PDP.
      const msg = await attempt(
        `UPDATE "skus" SET "legal_metrology_manufacturer_name" = '' WHERE "id" = $1`,
        [plantSkuId],
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/skus_declarations_non_blank/)
    })

    it('REJECTS a whitespace-only net quantity', async () => {
      if (!connected) return
      const msg = await attempt(
        `UPDATE "skus" SET "legal_metrology_net_quantity" = '   ' WHERE "id" = $1`,
        [plantSkuId],
      )
      expect(msg).not.toBe('ACCEPTED')
    })

    it('REJECTS a blank country of origin', async () => {
      if (!connected) return
      const msg = await attempt(
        `UPDATE "skus" SET "legal_metrology_country_of_origin" = '' WHERE "id" = $1`,
        [plantSkuId],
      )
      expect(msg).not.toBe('ACCEPTED')
    })

    it('REQUIRES a plant to name its species', async () => {
      if (!connected) return
      const msg = await attempt(`UPDATE "skus" SET "species_id" = NULL WHERE "id" = $1`, [
        plantSkuId,
      ])
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/skus_plant_requires_species/)
    })

    it('ALLOWS a consumable with no species — a bag of soil is not a variety', async () => {
      if (!connected) return
      // The counterpart. Forcing a species onto consumables was the original bug.
      const msg = await attempt(
        `INSERT INTO "skus" ("sku_code","city_id","size_tier","item_class","base_price_paise",
                             "legal_metrology_manufacturer_name","legal_metrology_manufacturer_address",
                             "legal_metrology_country_of_origin","legal_metrology_common_name_declared",
                             "legal_metrology_net_quantity","legal_metrology_mrp_paise",
                             "is_published","updated_at","created_at")
         VALUES ('TEST-CONSUMABLE-NO-SPECIES', $1, 'XS', 'consumable', 10000,
                 'Upvvan Nursery Pvt Ltd','12 Garden Road, Bengaluru','India','Cocopeat','5 kg',10000,
                 true, now(), now())`,
        [bengaluruId],
      )
      // Rejected for an unrelated reason (batch required to publish) — but NOT
      // for a missing species, which is what this test is about.
      expect(msg).not.toMatch(/skus_plant_requires_species/)
    })
  })

  describe('A · MRP must cover the planter ladder (r.6(1)(e), r.6(10))', () => {
    it('REJECTS an MRP below the top of the ladder', async () => {
      if (!connected) return
      // THE finding. The seed set MRP = base × 1.21, which is the *uplift value*
      // of the top planter, not its total. Every XS SKU sold 1.83× its declared
      // MRP and every MD SKU 10.05×, on the same PDP that declared it.
      const msg = await attempt(
        `UPDATE "skus" SET "legal_metrology_mrp_paise" = $2 WHERE "id" = $1`,
        [plantSkuId, Math.round(plantBasePaise * 1.21)],
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/below the top of the planter ladder/)
    })

    it('REJECTS a float MRP', async () => {
      if (!connected) return
      const msg = await attempt(
        `UPDATE "skus" SET "legal_metrology_mrp_paise" = 12345.67 WHERE "id" = $1`,
        [plantSkuId],
      )
      expect(msg).not.toBe('ACCEPTED')
    })

    it('ACCEPTS an MRP at or above the ladder top', async () => {
      if (!connected) return
      const msg = await attempt(
        `UPDATE "skus" SET "legal_metrology_mrp_paise" = $2 WHERE "id" = $1`,
        [plantSkuId, plantBasePaise * 10],
      )
      expect(msg).toBe('ACCEPTED')
    })

    it('every PUBLISHED SKU now declares an MRP covering its ladder', async () => {
      if (!connected) return
      // The data is fixed, not just the constraint. A trigger that rejects new
      // bad rows while 12 published rows stay bad is not a fix.
      //
      // This query MIRRORS `skus_mrp_covers_ladder()` in migration 000013, branch
      // for branch. It used to apply the planter ladder to everything and failed
      // on `SOIL-COCOPEAT-5KG` — declaring MRP ₹249 against a ladder top of
      // ₹550.29 for a terracotta pot it cannot be sold in.
      //
      // That was the TEST being wrong, not the seed. 000013 had already narrowed
      // the trigger to plants, for the reason its own comment gives: a pot picker
      // is a variant of a plant, and there is no planter variant of a bag of
      // cocopeat. Two copies of one rule drift, and the drift is invisible until
      // the data disagrees — so the rule lives in exactly one place and the
      // non-plant branch is spelled out here rather than assumed away.
      const rows = await exec<{ sku_code: string; declared: number; top: number; class: string }>(`
        SELECT "sku_code",
               "item_class" AS class,
               "legal_metrology_mrp_paise" AS declared,
               CASE WHEN "item_class" IS DISTINCT FROM 'plant'
                 -- No pot ladder: the only selectable configuration is itself.
                 THEN "base_price_paise"
                 ELSE ceil("base_price_paise" * (10000 + CASE "size_tier"
                        WHEN 'MD' THEN 45000 WHEN 'LG' THEN 120000
                        WHEN 'XL' THEN 260000 ELSE 0 END) / 10000)
                      + ceil(ceil("base_price_paise" * (10000 + CASE "size_tier"
                        WHEN 'MD' THEN 45000 WHEN 'LG' THEN 120000
                        WHEN 'XL' THEN 260000 ELSE 0 END) / 10000) * 12100 / 10000)
               END AS top
          FROM "skus" WHERE "is_published"
      `)
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(
          Number(row.declared),
          `${row.sku_code} declares ${row.declared} but its ladder tops out at ${row.top}`,
        ).toBeGreaterThanOrEqual(Number(row.top))
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // B · Money
  // ═══════════════════════════════════════════════════════════════════════

  describe('B · money is integer paise, everywhere it is stored', () => {
    it('REJECTS a fractional revenue_paise', async () => {
      if (!connected) return
      const msg = await attempt(
        `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                "revenue_paise","contribution_paise","updated_at","created_at")
         VALUES ('TEST-FLOAT-REV', $1, 'PLACED', 'prepaid', '560001', 199.5, 10, now(), now())`,
        [bengaluruId],
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/orders_money_is_paise/)
    })

    it('REJECTS a negative revenue_paise', async () => {
      if (!connected) return
      const msg = await attempt(
        `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                "revenue_paise","contribution_paise","updated_at","created_at")
         VALUES ('TEST-NEG-REV', $1, 'PLACED', 'prepaid', '560001', -5000, 10, now(), now())`,
        [bengaluruId],
      )
      expect(msg).not.toBe('ACCEPTED')
    })

    it('REJECTS a negative line price', async () => {
      if (!connected) return
      const msg = await attempt(
        `UPDATE "orders_items" SET "price_paise" = -99999 WHERE "id" = (
           SELECT "id" FROM "orders_items" ORDER BY "_order" DESC LIMIT 1)`,
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/orders_items_price_is_paise/)
    })

    it('REJECTS revenue that does not equal the sum of its lines', async () => {
      if (!connected) return
      // Otherwise `revenue_paise = 999999` on a 1-paise line is a legal row, and
      // city_pnl — the instrument for deciding whether to keep a city — reports
      // whatever was written.
      //
      // The trigger is DEFERRABLE INITIALLY DEFERRED (it has to be: the order is
      // inserted before its lines exist), so the test must force it. Without
      // SET CONSTRAINTS this passes while verifying nothing.
      const client = await pool!.connect()
      let msg = 'ACCEPTED'
      try {
        await client.query('BEGIN')
        await client.query(
          `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                  "revenue_paise","contribution_paise","updated_at","created_at")
           VALUES ('TEST-UNRECONCILED', $1, 'PLACED', 'prepaid', '560001', 999999, 10, now(), now())`,
          [bengaluruId],
        )
        await client.query('SET CONSTRAINTS ALL IMMEDIATE')
        await client.query('ROLLBACK')
      } catch (err) {
        msg = (err as Error).message
        await client.query('ROLLBACK').catch(() => {})
      } finally {
        client.release()
      }
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/sum to/)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // C · The guarantee tier is not a free choice
  // ═══════════════════════════════════════════════════════════════════════

  describe('C · guarantee tiers are configuration, not a request parameter', () => {
    it('REJECTS T2 while the flag is OFF', async () => {
      if (!connected) return
      const flags = await exec<{ t1: boolean; t2: boolean }>(
        `SELECT "guarantee_t1_enabled" AS t1, "guarantee_t2_enabled" AS t2
           FROM "price_books" WHERE "city_id" = $1 LIMIT 1`,
        [bengaluruId],
      )
      expect(flags[0]!.t2, 'this test assumes T2 is disabled — flip the flag if not').toBe(false)

      const msg = await attempt(
        `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                "revenue_paise","contribution_paise","guarantee_tier",
                                "updated_at","created_at")
         VALUES ('TEST-T2', $1, 'PLACED', 'prepaid', '560001', 0, 0, 'T2', now(), now())`,
        [bengaluruId],
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/90-day promise/)
    })

    it('REJECTS T1 while the flag is OFF', async () => {
      if (!connected) return
      const flags = await exec<{ t1: boolean }>(
        `SELECT "guarantee_t1_enabled" AS t1 FROM "price_books" WHERE "city_id" = $1 LIMIT 1`,
        [bengaluruId],
      )
      expect(flags[0]!.t1, 'this test assumes T1 is disabled').toBe(false)

      const msg = await attempt(
        `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                "revenue_paise","contribution_paise","guarantee_tier",
                                "updated_at","created_at")
         VALUES ('TEST-T1', $1, 'PLACED', 'prepaid', '560001', 0, 0, 'T1', now(), now())`,
        [bengaluruId],
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/T1 \(30 days\) is disabled/)
    })

    it('ACCEPTS T0 — the tier we can actually price today', async () => {
      if (!connected) return
      const msg = await attempt(
        `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                "revenue_paise","contribution_paise","guarantee_tier",
                                "updated_at","created_at")
         VALUES ('TEST-T0', $1, 'PLACED', 'prepaid', '560001', 0, 0, 'T0', now(), now())`,
        [bengaluruId],
      )
      expect(msg).toBe('ACCEPTED')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // D · The licence gate
  // ═══════════════════════════════════════════════════════════════════════

  describe('D · a city needs a licence to trade', () => {
    it('REJECTS activating Hyderabad while its licence is only filed', async () => {
      if (!connected) return
      // THE finding. `cities_live_requires_licence` only read `status`, but the
      // serviceability gate reads `is_active` — so this exact UPDATE made an
      // unlicensed city serviceable, and a raw order insert then followed.
      const msg = await attempt(`UPDATE "cities" SET "is_active" = true WHERE "id" = $1`, [
        hyderabadId,
      ])
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/cities_active_requires_live_licence/)
    })

    it('REJECTS an order for a city that is not trading', async () => {
      if (!connected) return
      const msg = await attempt(
        `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode",
                                "revenue_paise","contribution_paise","updated_at","created_at")
         VALUES ('TEST-UNLICENSED-CITY', $1, 'PLACED', 'prepaid', '560001', 100, 10, now(), now())`,
        [hyderabadId],
      )
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/not trading/)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // E · Delivery bands — the incentive fix
  // ═══════════════════════════════════════════════════════════════════════

  describe('E · rider pay bands', () => {
    it('REJECTS a gap in band coverage', async () => {
      if (!connected) return
      // Monotonic pay and no overlap were both checked. CONTIGUITY was not, so a
      // city with only A (0-3) and D (7-12) was accepted and bandForDistance then
      // threw NO_MATCHING_BAND for the whole 3-7km middle — a rider paid nothing.
      // A throwaway city with NO bands. Adding TST-A/TST-D to Bengaluru would
      // trip the pre-existing OVERLAP trigger first (Bengaluru already has A/B/C
      // covering 0-12km), and the test would pass while proving nothing about
      // contiguity. Monotonic pay and no overlap are both satisfied here, so the
      // only trigger that can fire is the contiguity one.
      const client = await pool!.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `INSERT INTO "cities" ("name","slug","state","status","is_active","licence_status",
                                 "licence_number","licence_approved_at","tax_rate_bp","updated_at","created_at")
           VALUES ('Test Band City','test-band-city','Karnataka','live',true,'approved',
                   'TEST-LIC-0001', now(), 1800, now(), now())`,
        )
        const { rows: tc } = await client.query<{ id: number }>(
          `SELECT "id" FROM "cities" WHERE "slug" = 'test-band-city'`,
        )
        await client.query(
          `INSERT INTO "delivery_bands" ("city_id","code","label","min_km","max_km","pay_paise","updated_at","created_at")
           VALUES ($1, 'TST-A', 'TST A 0-3', 0, 3, 4500, now(), now()),
                  ($1, 'TST-D', 'TST D 7-12', 7, 12, 7500, now(), now())`,
          [tc[0]!.id],
        )
        // The contiguity trigger is DEFERRABLE, so it is not checked until the
        // transaction ends. Force it now — otherwise the test passes for the
        // wrong reason (nothing was verified yet).
        await client.query('SET CONSTRAINTS trg_bands_contiguous IMMEDIATE')
        await client.query('ROLLBACK')
        throw new Error('ACCEPTED')
      } catch (err) {
        const msg = (err as Error).message
        await client.query('ROLLBACK').catch(() => {})
        // A and D do not OVERLAP and pay is monotonic, so the pre-existing
        // trigger stays quiet and this message can only be the contiguity one.
        expect(msg).not.toBe('ACCEPTED')
        expect(msg).toMatch(/leave a gap/)
      } finally {
        client.release()
      }
    })

    it('REJECTS deleting every band for a city', async () => {
      if (!connected) return
      // Left Bengaluru live and paying nothing.
      const client = await pool!.connect()
      let msg = 'ACCEPTED'
      try {
        await client.query('BEGIN')
        await client.query(`DELETE FROM "delivery_bands" WHERE "city_id" = $1`, [bengaluruId])
        await client.query('SET CONSTRAINTS trg_bands_need_tiers IMMEDIATE')
        await client.query('ROLLBACK')
      } catch (err) {
        msg = (err as Error).message
        await client.query('ROLLBACK').catch(() => {})
      } finally {
        client.release()
      }
      expect(msg).not.toBe('ACCEPTED')
    })

    it('REJECTS a single flat band — the structure the thesis rejects', async () => {
      if (!connected) return
      // One band trivially satisfies monotonicity. A flat per-order payment is
      // precisely what produced a competitor's 1.4/5 rating.
      const client = await pool!.connect()
      let msg = 'ACCEPTED'
      try {
        await client.query('BEGIN')
        await client.query(`DELETE FROM "delivery_bands" WHERE "city_id" = $1`, [bengaluruId])
        await client.query(
          `INSERT INTO "delivery_bands"
                              ("city_id","code","label","min_km","max_km","pay_paise","updated_at","created_at")
                            VALUES ($1, 'FLAT', 'Flat 0-1000km', 0, 1000, 4500, now(), now())`,
          [bengaluruId],
        )
        await client.query('SET CONSTRAINTS trg_bands_need_tiers IMMEDIATE')
        await client.query('ROLLBACK')
      } catch (err) {
        msg = (err as Error).message
        await client.query('ROLLBACK').catch(() => {})
      } finally {
        client.release()
      }
      expect(msg).not.toBe('ACCEPTED')
      expect(msg).toMatch(/delivery band/)
    })

    it('the live city still has its three bands and monotonic pay', async () => {
      if (!connected) return
      const rows = await exec<{ code: string; min_km: number; max_km: number; pay_paise: string }>(
        `SELECT "code", "min_km", "max_km", "pay_paise"
           FROM "delivery_bands" WHERE "city_id" = $1 ORDER BY "min_km"`,
        [bengaluruId],
      )
      expect(rows.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < rows.length; i++) {
        expect(
          Number(rows[i]!.pay_paise),
          `${rows[i]!.code} (${rows[i]!.min_km}-${rows[i]!.max_km}km) must pay more than ${rows[i - 1]!.code}`,
        ).toBeGreaterThan(Number(rows[i - 1]!.pay_paise))
      }
      expect(Number(rows[0]!.min_km)).toBe(0)
    })
  })
})
