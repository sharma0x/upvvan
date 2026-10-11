import 'server-only'

import { getPool } from '@/lib/db/pool'
import type { CityRef } from '@/lib/geo/serviceability'

/**
 * Every city, for the coverage checker.
 *
 * ── WHY THE DROPDOWN WAS EMPTY ───────────────────────────────────────────────
 *
 * `src/app/page.tsx` rendered `<Hero cities={[]} … />` — a hardcoded empty array
 * sitting where the city list was supposed to go. The `<select>` in
 * `ServiceabilityChecker` maps over that array, so it rendered zero `<option>`
 * elements: an empty dropdown above a "Check coverage" button.
 *
 * Nothing caught it. The page returned 200, the element existed with an `id` and a
 * `name`, and there is no assertion anywhere that a `<select>` has options. The
 * button next to it was correctly disabled, so the form looked deliberate.
 *
 * It is worth saying what this is NOT: it is not "the database had no cities".
 * There are two — Bengaluru (live) and Hyderabad (pending licence). The list was
 * never read from anywhere.
 *
 * ── WHY HYDERABAD IS LISTED AT ALL ───────────────────────────────────────────
 *
 * Because the question the customer is asking is "do you deliver to me?", and
 * Hyderabad is a city people live in and type into that form.
 *
 * Dropping it would mean the dropdown silently defaults to Bengaluru for somebody
 * in Telangana, and they get an answer about the wrong city — which is the failure
 * the city gate exists to prevent. Listing it with "not open here yet" gives them
 * the true answer at the point they asked.
 *
 * So active cities come first and unopened ones follow, marked. A city is never
 * hidden for being unopened; it is labelled.
 */
export async function loadCityRefs(): Promise<CityRef[]> {
  const db = await getPool()

  const { rows } = await db.query<{
    id: number
    slug: string
    name: string
    state: string | null
    status: string
    is_active: boolean
  }>(
    `SELECT "id", "slug", "name", "state", "status", "is_active"
       FROM "cities"
      WHERE "status" <> 'killed'
      ORDER BY "is_active" DESC, "name" ASC`,
  )

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.is_active,
    stateCode: row.state,
  }))
}
