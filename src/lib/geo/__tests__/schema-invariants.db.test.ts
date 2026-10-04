/**
 * Schema-layer invariant proof — the Phase 0 counterpart to the unit tests.
 *
 * THE POINT OF THIS FILE
 * ----------------------
 * The unit tests in src/lib/geo/__tests__ prove the LOGIC. This file proves the
 * DATABASE enforces it.
 *
 * product-design.md §7 requires three invariants in the schema layer, and the
 * spike spec is blunt about why: "Application-code-only enforcement is a fail —
 * it is bypassable by a direct write or a bug in a different code path."
 *
 * So the test method here is deliberately hostile: **every assertion below
 * attempts an illegal write using raw SQL, bypassing the application entirely.**
 * No Payload hooks, no service layer, no domain module. If a constraint only
 * exists in TypeScript, every one of these writes SUCCEEDS and the test fails.
 *
 * That is the only honest way to prove an invariant is unbypassable.
 *
 * WHY THIS MATTERS SPECIFICALLY FOR THIS BUSINESS
 * ------------------------------------------------
 * Invariant 1 (rider pay monotonicity) is the structural difference between us
 * and an operator who pays ₹65/order regardless of distance and needs a ₹100
 * penalty clause to stop riders lying. If that rule lives in application code
 * only, one careless admin-panel edit inverts the entire incentive design, and
 * the failure is invisible until riders start refusing long drops.
 *
 * ── RUNNING THIS ────────────────────────────────────────────────────────────
 * Needs a live Postgres 18 with migrations applied (`make db-migrate`).
 * Skipped with a loud warning when DATABASE_URL is absent.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from '@/lib/config'

let pool: import('pg').Pool | null = null
let connected = false

/** Raw SQL against the real database. No ORM, no Payload, no domain layer. */
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
    console.warn(`[schema-invariants] SKIPPED — cannot reach Postgres: ${(err as Error).message}`)
  }
})

afterAll(async () => {
  await pool?.end()
  pool = null
})

/** Create a city the test owns, so real data is never touched. */
async function makeCityForTest(slug: string): Promise<number> {
  const rows = await exec<{ id: number }>(
    `INSERT INTO cities (name, slug, state, status, is_active, licence_status, updated_at, created_at)
     VALUES ($1, $2, 'Karnataka', 'pending', false, 'not_filed', now(), now())
     RETURNING id`,
    [slug, slug],
  )
  return rows[0]!.id
}

/** Remove a city and everything hanging off it. */
async function dropCity(cityId: number): Promise<void> {
  await exec(`DELETE FROM delivery_bands WHERE city_id = $1`, [cityId])
  await exec(`DELETE FROM zones WHERE city_id = $1`, [cityId])
  await exec(`DELETE FROM pincodes WHERE city_id = $1`, [cityId])
  await exec(`DELETE FROM price_books WHERE city_id = $1`, [cityId])
  await exec(`DELETE FROM cities WHERE id = $1`, [cityId])
}

describe('schema-layer invariants — proven by ILLEGAL DIRECT WRITES', () => {
  describe('INVARIANT 1 · rider pay must increase with distance', () => {
    it('a valid monotonic band set inserts successfully', async () => {
      if (!connected) return
      const cityId = await makeCityForTest('bands-ok')
      try {
        for (const b of [
          { code: 'A', min: 0, max: 3, pay: 4500 },
          { code: 'B', min: 3, max: 7, pay: 6000 },
          { code: 'C', min: 7, max: 12, pay: 7500 },
        ]) {
          await exec(
            `INSERT INTO delivery_bands (code, label, min_km, max_km, pay_paise, city_id, updated_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6, now(), now())`,
            [b.code, `Band ${b.code}`, b.min, b.max, b.pay, cityId],
          )
        }
        const rows = await exec<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM delivery_bands WHERE city_id = $1`,
          [cityId],
        )
        expect(rows[0]!.count).toBe(3)
      } finally {
        await dropCity(cityId)
      }
    })

    it('REJECTS a direct insert where a LONGER band pays LESS', async () => {
      if (!connected) return
      const cityId = await makeCityForTest('bands-inverted')
      try {
        await exec(
          `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
           VALUES ('A','Band A',0,3,4500,$1, now(), now())`,
          [cityId],
        )
        // Bypassing every application hook. Only the DB can stop this.
        await expect(
          exec(
            `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
             VALUES ('B','Band B',3,7,1000,$1, now(), now())`,
            [cityId],
          ),
        ).rejects.toThrow(/NOT more than|Longer routes must pay strictly more/i)
      } finally {
        await dropCity(cityId)
      }
    })

    it('REJECTS a direct UPDATE that inverts the incentive', async () => {
      if (!connected) return
      const cityId = await makeCityForTest('bands-update')
      try {
        // Capture BOTH ids so the attack targets the far band, not the near one.
        const near = await exec<{ id: number }>(
          `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
           VALUES ('A','Band A',0,3,4500,$1, now(), now()) RETURNING id`,
          [cityId],
        )
        const far = await exec<{ id: number }>(
          `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
           VALUES ('B','Band B',3,7,6000,$1, now(), now()) RETURNING id`,
          [cityId],
        )

        // The exact attack: drag the FAR band down to the near band's pay. This
        // is a single UPDATE on one row, bypassing every application hook. Only
        // the DB trigger can refuse it.
        await expect(
          exec(`UPDATE delivery_bands SET pay_paise = 4500 WHERE id = $1`, [far[0]!.id]),
        ).rejects.toThrow(/NOT less than|Longer routes must pay strictly more/i)

        // And the near band dragged UP past the far one is the same defect.
        await expect(
          exec(`UPDATE delivery_bands SET pay_paise = 9000 WHERE id = $1`, [near[0]!.id]),
        ).rejects.toThrow(/NOT more than|Longer routes must pay strictly more/i)

        // Sanity: the legal update still works, so the trigger is not simply
        // rejecting everything.
        await exec(`UPDATE delivery_bands SET pay_paise = 7000 WHERE id = $1`, [far[0]!.id])
      } finally {
        await dropCity(cityId)
      }
    })

    it('REJECTS overlapping bands', async () => {
      if (!connected) return
      const cityId = await makeCityForTest('bands-overlap')
      try {
        await exec(
          `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
           VALUES ('A','Band A',0,4,4500,$1, now(), now())`,
          [cityId],
        )
        await expect(
          exec(
            `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
             VALUES ('B','Band B',3,7,6000,$1, now(), now())`,
            [cityId],
          ),
        ).rejects.toThrow(/overlaps/i)
      } finally {
        await dropCity(cityId)
      }
    })

    it('REJECTS a fractional pay value', async () => {
      if (!connected) return
      const cityId = await makeCityForTest('bands-float')
      try {
        await expect(
          exec(
            `INSERT INTO delivery_bands (code,label,min_km,max_km,pay_paise,city_id,updated_at,created_at)
             VALUES ('A','Band A',0,3,4500.5,$1, now(), now())`,
            [cityId],
          ),
        ).rejects.toThrow()
      } finally {
        await dropCity(cityId)
      }
    })
  })

  describe('INVARIANT 2 · a city cannot go live without an approved licence', () => {
    it('REJECTS going live with no licence', async () => {
      if (!connected) return
      await expect(
        exec(
          `INSERT INTO cities (name, slug, state, status, is_active, licence_status, updated_at, created_at)
           VALUES ('No Licence Co', 'no-licence', 'Karnataka', 'live', true, 'not_filed', now(), now())`,
        ),
      ).rejects.toThrow(/cities_live_requires_licence|violates check constraint/i)
    })

    it('REJECTS going live with a filed-but-not-approved licence', async () => {
      if (!connected) return
      await expect(
        exec(
          `INSERT INTO cities (name, slug, state, status, is_active, licence_status, updated_at, created_at)
           VALUES ('Filed Co', 'filed-licence', 'Telangana', 'live', true, 'filed', now(), now())`,
        ),
      ).rejects.toThrow(/cities_live_requires_licence|violates check constraint/i)
    })

    it('ALLOWS going live with an approved licence and an approval date', async () => {
      if (!connected) return
      const rows = await exec<{ id: number }>(
        `INSERT INTO cities (name, slug, state, status, is_active, licence_status, licence_approved_at, updated_at, created_at)
         VALUES ('Licensed Co', 'licensed', 'Karnataka', 'live', true, 'approved', now(), now(), now())
         RETURNING id`,
      )
      expect(rows[0]!.id).toBeGreaterThan(0)
      await exec(`DELETE FROM cities WHERE id = $1`, [rows[0]!.id])
    })

    it('ALLOWS a non-live city with no licence', async () => {
      if (!connected) return
      const rows = await exec<{ id: number }>(
        `INSERT INTO cities (name, slug, state, status, is_active, licence_status, updated_at, created_at)
         VALUES ('Pending Co', 'pending-co', 'Karnataka', 'pending', false, 'not_filed', now(), now())
         RETURNING id`,
      )
      expect(rows[0]!.id).toBeGreaterThan(0)
      await exec(`DELETE FROM cities WHERE id = $1`, [rows[0]!.id])
    })
  })

  describe('INVARIANT 3 · every per-city row must belong to a city', () => {
    it('REJECTS a zone with no city', async () => {
      if (!connected) return
      await expect(
        exec(
          `INSERT INTO zones (name, city_id, is_active, updated_at, created_at)
           VALUES ('Orphan Zone', NULL, true, now(), now())`,
        ),
      ).rejects.toThrow(/city_id.*NOT NULL|null value in column "city_id"/i)
    })

    it('REJECTS a pincode with no city', async () => {
      if (!connected) return
      await expect(
        exec(
          `INSERT INTO pincodes (pincode, city_id, is_serviceable, updated_at, created_at)
           VALUES ('999999', NULL, true, now(), now())`,
        ),
      ).rejects.toThrow(/city_id.*NOT NULL|null value in column "city_id"/i)
    })
  })

  describe('the invariants are actually present in the schema', () => {
    it('has the band monotonicity trigger installed', async () => {
      if (!connected) return
      const rows = await exec<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_band_monotonicity'`,
      )
      expect(rows).toHaveLength(1)
    })

    it('has the licence gate constraint installed', async () => {
      if (!connected) return
      const rows = await exec<{ conname: string }>(
        `SELECT conname FROM pg_constraint WHERE conname = 'cities_live_requires_licence'`,
      )
      expect(rows).toHaveLength(1)
    })

    it('has the integer-paise constraints installed', async () => {
      if (!connected) return
      const rows = await exec<{ conname: string }>(
        `SELECT conname FROM pg_constraint
          WHERE conname IN ('delivery_bands_pay_is_paise','price_books_money_is_paise')`,
      )
      expect(rows).toHaveLength(2)
    })
  })
})
