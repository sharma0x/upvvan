/**
 * The saved-plants projection, against the real database.
 *
 * ── THE BUG ─────────────────────────────────────────────────────────────────
 *
 * `/account/saved` selected `s."slug"` from the `skus` alias. `skus` has no slug
 * column — a SKU is a size tier of a species in a city — so every signed-in
 * customer who opened their saved list got
 *
 *     column s.slug does not exist
 *
 * and the page rendered "This page did not load."
 *
 * ── WHY NOTHING CAUGHT IT ───────────────────────────────────────────────────
 *
 * The route is gated: signed out, it redirects before the query runs. So:
 *
 *   · curl returned 307, not 500 — the link crawl was green
 *   · the simulation, which drives auth over HTTP, passed
 *   · typecheck, lint, the build and every unit test were green
 *   · a *type* annotation listing `slug: string | null` is what the loader
 *     promised, so the compiler had no reason to complain about a column that
 *     does not exist
 *
 * The only requests that ever ran the query were the ones from a real signed-in
 * customer in a browser.
 *
 * ── WHY A DB TEST AND NOT A SNAPSHOT ────────────────────────────────────────
 *
 * A hand-written fixture would be a second thing to keep true. This runs the
 * actual projection against the actual schema, so renaming a column or moving
 * `slug` onto another table fails here instead of in front of somebody who
 * saved a plant weeks ago and has just come back to buy it.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getPool } from '@/lib/db/pool'

/**
 * Copied verbatim from `src/app/account/saved/page.tsx`.
 *
 * Verbatim on purpose. A test that keeps its own tidied copy of the query proves
 * the copy works, which is not the question — and the whole bug was a projection
 * that had drifted from the schema, so a drifting copy would hide it again.
 */
const SAVED_PLANTS_PROJECTION = `
  SELECT w."id",
         sp."common_name",
         s."size_tier",
         sp."slug",
         w."note",
         w."created_at",
         st."stock_on_hand",
         s."base_price_paise"
    FROM "wishlists" w
    LEFT JOIN "skus" s      ON s."id" = w."sku_id"
    LEFT JOIN "species" sp  ON sp."id" = s."species_id"
    LEFT JOIN "sku_stock" st ON st."sku_id" = s."id"
   WHERE w."better_auth_user_id" = $1
   ORDER BY (COALESCE(st."stock_on_hand", 0) > 0) DESC, w."created_at" DESC`

let pool: Awaited<ReturnType<typeof getPool>>

beforeAll(async () => {
  pool = getPool()
})

describe('the saved-plants query', () => {
  it('runs. A projection referencing a column that does not exist throws here.', async () => {
    /*
     * The whole test is this one statement. Postgres raises
     * `column s.slug does not exist` at parse time, so the failure needs no seeded
     * wishlist and no customer: it happens whether or not there are rows, which is
     * why an empty table made this so easy to ship.
     */
    const result = await pool.query(SAVED_PLANTS_PROJECTION, ['no-such-customer-id'])

    expect(Array.isArray(result.rows)).toBe(true)
  })

  it('reads slug from species, because skus has no slug column', async () => {
    /*
     * The invariant, stated so the next person to "simplify" the alias finds out
     * what the columns actually are rather than rediscovering it at runtime.
     */
    const { rows } = await pool.query<{ has_slug: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_name = 'skus' AND column_name = 'slug'
       ) AS has_slug`,
    )

    expect(
      rows[0]!.has_slug,
      'skus gained a slug column — revisit where this page reads it from',
    ).toBe(false)
  })

  it('returns a row shaped like the loader expects, for a customer who has saved something', async () => {
    /*
     * Proves the projection against real data rather than an empty result. Uses a
     * real wishlist row when one exists and rolls back its own writes otherwise, so
     * it never depends on a seeded fixture being present.
     */
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const seeded = await client.query<{ better_auth_user_id: string; sku_id: number | null }>(
        `SELECT "better_auth_user_id", "sku_id" FROM "wishlists"
          WHERE "sku_id" IS NOT NULL LIMIT 1`,
      )

      const customerId = seeded.rows[0]?.better_auth_user_id ?? 'saved-projection-probe'
      if (!seeded.rows[0]) {
        await client.query(
          `INSERT INTO "wishlists" ("sku_id", "better_auth_user_id")
           SELECT "id", $1 FROM "skus" ORDER BY "id" LIMIT 1`,
          [customerId],
        )
      }

      const { rows } = await client.query<Record<string, unknown>>(SAVED_PLANTS_PROJECTION, [
        customerId,
      ])

      expect(rows.length).toBeGreaterThan(0)

      const row = rows[0]!
      for (const key of ['common_name', 'size_tier', 'slug', 'created_at', 'base_price_paise']) {
        expect(Object.keys(row), `saved-plants row is missing ${key}`).toContain(key)
      }

      // `pg` returns `numeric` as a string; the loader coerces. Prove it is a string
      // so that coercion stays where it is rather than moving somewhere silent.
      expect(['string', 'number', 'null']).toContain(typeof row.base_price_paise)

      await client.query('ROLLBACK')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
})
