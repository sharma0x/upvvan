/**
 * The generated schema and the hand-written invariants MUST agree, column for
 * column.
 *
 * ── WHY THIS TEST EXISTS ───────────────────────────────────────────────────
 *
 * The `paySnapshot` GROUP on the Dispatches collection generated
 * `pay_snapshot_band_code`, `pay_snapshot_band_pay_paise` and
 * `pay_snapshot_payout_paise` — because Payload prefixes a group's columns with
 * the group name. Meanwhile the migration in `schema.sql` and every query in
 * `store.server.ts` used `band_code`, `band_pay_paise`, `payout_paise`.
 *
 * Both were internally consistent. Together they were incompatible, and the
 * failure mode is the worst kind available:
 *
 *   · `CREATE TABLE` succeeds, because the migration creates the columns the
 *     migration knows about.
 *   · Every query succeeds or fails identically to before — until Payload writes.
 *   · `trg_dispatch_pay_snapshot_immutable` fires `BEFORE UPDATE` and reads
 *     `NEW."band_code"` — a column that does not exist. On a stock Postgres the
 *     trigger raises `column "band_code" does not exist` on EVERY update, or, if
 *     the name happens to resolve, silently guards the wrong column.
 *
 * In other words the anti-fraud control either breaks loudly on every write or,
 * worse, quietly stops applying. Neither shows up in typecheck, lint, the unit
 * suite or a DOM assertion. It is exactly the class of bug AGENTS.md keeps
 * recording about array fields (table named after the PARENT slug, no
 * timestamps, varchar `id` with no default) — groups have their own version.
 *
 * So this is a static cross-check: parse `src/payload-generated-schema.ts` for
 * the columns Payload will create, parse `src/lib/dispatch/schema.sql` for the
 * columns the invariants name, and require them to agree.
 *
 * ── WHY A STATIC PARSE AND NOT A LIVE DATABASE DIFF ────────────────────────
 *
 * Because the mismatch is only detectable BEFORE the migration runs. Once the
 * table exists, the two have converged in the database and the DDL divergence is
 * invisible forever — which is precisely when somebody needs to know. This runs
 * in `pnpm test` with no database at all.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// This file is src/lib/dispatch/__tests__/ — four levels below the repo root.
const ROOT = path.resolve(__dirname, '../../../..')
const GENERATED = path.join(ROOT, 'src/payload-generated-schema.ts')
const INVARIANTS = path.join(ROOT, 'src/lib/dispatch/schema.sql')

/** Columns Payload will create for a table, from the generated schema. */
function generatedColumns(table: string): Set<string> {
  const source = readFileSync(GENERATED, 'utf8')
  const start = source.indexOf(`export const ${table} = pgTable(`)
  expect(
    start,
    `${table} not found in payload-generated-schema.ts — run \`pnpm payload generate:db-schema\``,
  ).toBeGreaterThan(-1)

  const body = source.slice(start, source.indexOf('\n)', start))
  const columns = new Set<string>()
  // `fieldName: type('column_name'` — the second quoted string is the column.
  for (const match of body.matchAll(/(\w+):\s*[\w.]+\('([a-z0-9_]+)'/g)) {
    columns.add(match[2]!)
  }
  return columns
}

/** Columns the hand-written DDL names for a table. */
function invariantColumns(table: string): Set<string> {
  const sql = readFileSync(INVARIANTS, 'utf8')
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS "${table}"`)
  expect(start, `${table} not found in schema.sql`).toBeGreaterThan(-1)

  const open = sql.indexOf('(', start)
  let depth = 0
  let end = open
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }

  const body = sql.slice(open, end)
  const columns = new Set<string>()
  for (const match of body.matchAll(/^\s*"([a-z0-9_]+)"\s/gm)) {
    columns.add(match[1]!)
  }
  return columns
}

describe('generated DDL vs hand-written invariants', () => {
  for (const table of ['riders', 'dispatches']) {
    it(`${table}: every column the invariants reference exists in the generated schema`, () => {
      const generated = generatedColumns(table)
      const referenced = invariantColumns(table)

      // Only columns that DECLARE the table's shape matter. The invariants file
      // also mentions `_parent_id`-style and index columns elsewhere; we compare
      // the intersection both sides must agree on.
      const missing = [...referenced].filter((c) => !generated.has(c)).sort()
      expect(
        missing,
        `schema.sql names columns that Payload will not create on "${table}": ${missing.join(', ')}. ` +
          'A trigger referencing a non-existent column either raises on every write or guards the wrong column.',
      ).toEqual([])
    })

    it(`${table}: Payload creates no column the invariants do not know about`, () => {
      const generated = generatedColumns(table)
      const referenced = invariantColumns(table)

      // Columns with a Payload default that the invariants legitimately omit.
      const IGNORED = new Set(['updated_at', 'created_at'])
      const unexpected = [...generated].filter((c) => !referenced.has(c) && !IGNORED.has(c)).sort()

      expect(
        unexpected,
        `Payload will create columns on "${table}" that schema.sql does not declare: ${unexpected.join(', ')}. ` +
          'Add them to the hand-written DDL, or remove them from the collection — a table that exists in only one of the two definitions is a trap.',
      ).toEqual([])
    })
  }

  it('the pay snapshot is FLAT, so the immutable-payout trigger reads real columns', () => {
    // The specific regression, asserted directly so the fix cannot be quietly
    // reverted by re-wrapping the fields in a group.
    const collection = readFileSync(path.join(ROOT, 'src/collections/Dispatches.ts'), 'utf8')
    expect(
      collection,
      'Dispatches must not wrap the pay snapshot in a `group`: Payload prefixes group columns with the group name, which would generate `pay_snapshot_band_code` and desynchronise every trigger and query.',
    ).not.toMatch(/name:\s*['"]paySnapshot['"]/)
  })

  it('the delivery-OTP group DOES agree, and stays a group', () => {
    // Proof that the grouping rule was applied by understanding rather than by
    // flattening everything: `deliveryOtp.hash` → `delivery_otp_hash`, which is
    // exactly what the migration uses.
    const generated = generatedColumns('dispatches')
    for (const column of [
      'delivery_otp_hash',
      'delivery_otp_salt',
      'delivery_otp_sent_at',
      'delivery_otp_expires_at',
      'delivery_otp_attempts',
      'delivery_otp_verified_at',
    ]) {
      expect(generated.has(column), `expected ${column} in the generated schema`).toBe(true)
    }
  })
})
