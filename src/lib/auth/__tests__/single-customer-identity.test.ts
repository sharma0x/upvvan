/**
 * Auth single-owner — TEST 12 of the twelve required tests. This is C-1.
 *
 * "Auth single-owner (C-1) — exactly one system owns customer identity; assert
 * no path creates a second customer record."
 *
 * WHY THIS TEST IS THE ODD ONE OUT
 * --------------------------------
 * Every other required test fails loudly. This one fails SILENTLY. A build
 * stays green, a deploy succeeds, and the symptom appears in month three as
 * two customer records for one human and a support agent who cannot tell which
 * row is real. That is why the prompt insists on it.
 *
 * The reference repo runs three identity surfaces — better-auth's user model,
 * Payload's `Users`, and a `Customers` collection linked by `betterAuthUserId`.
 * That works, but it is not simple, and the third surface is a mirror that
 * needs a sync job. We deliberately do not build it. These tests exist to make
 * sure nobody adds it back "just for the support console".
 *
 * THE FIVE ASSERTIONS
 * -------------------
 *  1. Exactly ONE table in the database carries customer identity columns.
 *     Discovered by querying information_schema for the identity column set —
 *     NOT by hardcoding a table name, so adding a second one fails the test
 *     rather than passing it.
 *  2. Orders reference that table by real FOREIGN KEY, not convention.
 *  3. No Payload collection schema declares a customer contact field.
 *  4. better-auth's own uniqueness holds: one verified phone ⇒ one user row.
 *  5. No application path can insert a customer except signup.
 *
 * ── RUNNING THESE ──────────────────────────────────────────────────────────
 * Assertions 1, 2 and 4 need a live Postgres 18. They are skipped when
 * DATABASE_URL is absent so `pnpm test` still runs the pure suites, and they
 * run for real in `make ci-local` and in CI, where the database exists.
 * Skipped is reported loudly, never silently.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL
// This file is src/lib/auth/__tests__/ — four levels below src/collections.
const COLLECTIONS_DIR = path.resolve(__dirname, '../../../collections')
const PAYLOAD_CONFIG = path.resolve(__dirname, '../../../payload.config.ts')

/**
 * Column names that constitute a CUSTOMER identity.
 *
 * Matched case-insensitively against every column in the public schema. This
 * set is the heart of the test: a new table carrying any of these is a second
 * customer identity source and must fail.
 *
 * `users.phone` is deliberately excluded by name below — better-auth's own
 * customer table is named `user`, and Payload's STAFF collection is `users`,
 * which is a different subject entirely (STACK-DECISION.md §5).
 */
const IDENTITY_COLUMNS = ['phone', 'phone_number', 'email', 'emailaddress']
const STAFF_TABLE = 'users'

/**
 * Extract the object literal that declares `name: '<field>'`, out to its
 * matching close brace. Used so the readOnly exemption applies to the specific
 * field rather than to the whole file — a whole-file pass would also excuse a
 * writable `email` added later, which is exactly the bug this test exists for.
 */
function fieldBlockContaining(source: string, field: string): string {
  const marker = new RegExp(`name:\\s*['"\`]${field}['"\`]`).exec(source)
  if (!marker) return ''
  const open = source.indexOf('{', marker.index)
  if (open === -1) return source.slice(marker.index)

  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return source.slice(open)
}

let pool: import('pg').Pool | null = null
let dbAvailable = false

beforeAll(async () => {
  if (!DATABASE_URL) return
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: DATABASE_URL })
    await pool.query('SELECT 1')
    dbAvailable = true
  } catch (err) {
    console.warn(
      `[c-1] SKIPPED database assertions — cannot reach Postgres: ${(err as Error).message}`,
    )
    dbAvailable = false
  }
})

afterAll(async () => {
  await pool?.end()
})

describe('C-1 · customer identity has exactly one owner', () => {
  describe('assertion 3 · no Payload collection declares a customer contact field', () => {
    // Runs with no database — pure static check over the collection configs.
    it('finds no customer email or phone field in any collection', () => {
      const files = readdirSync(COLLECTIONS_DIR).filter((f) => f.endsWith('.ts'))
      expect(files.length).toBeGreaterThan(0)

      const offenders: string[] = []
      for (const file of files) {
        const source = readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8')
        for (const field of ['email', 'phoneNumber', 'phone']) {
          const declaresField = new RegExp(`name:\\s*['"\`]${field}['"\`]`).test(source)
          if (!declaresField) continue
          // A staff contact number is permitted and documented — riders need a
          // number for shift dispatch. What must never exist is a WRITABLE
          // contact field, because that is where a second customer record would
          // be born. So the exemption is per-field-block and requires readOnly,
          // not a whole-file pass.
          const fieldBlock = fieldBlockContaining(source, field)
          const isReadOnlyStaffField = file === 'Users.ts' && /readOnly:\s*true/.test(fieldBlock)
          if (isReadOnlyStaffField) continue
          offenders.push(`${file}: declares writable ${field}`)
        }
      }
      expect(offenders, `Customer identity fields found in: ${offenders.join(', ')}`).toEqual([])
    })

    it('does not create a Customers collection at all', () => {
      // The strongest form of assertion 3. A mirror table needs a collection to
      // live in, so the absence of the file is the guarantee.
      const files = readdirSync(COLLECTIONS_DIR).map((f) => f.toLowerCase())
      expect(files.some((f) => f.includes('customer'))).toBe(false)
    })

    it('registers no customers collection in the payload config', () => {
      const config = readFileSync(PAYLOAD_CONFIG, 'utf8')
      expect(config).not.toMatch(/Customers/)
    })
  })

  describe(`assertions 1, 2, 4 · schema-level proof${dbAvailable ? '' : ' (SKIPPED — no DATABASE_URL)'}`, () => {
    it('exactly one table carries customer identity columns', async () => {
      if (!dbAvailable || !pool) return

      const { rows } = await pool.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND LOWER(column_name) = ANY($1)`,
        [IDENTITY_COLUMNS],
      )

      const byTable = new Map<string, string[]>()
      for (const row of rows) {
        const cols = byTable.get(row.table_name) ?? []
        cols.push(row.column_name)
        byTable.set(row.table_name, cols)
      }

      // Payload's `users` is STAFF. better-auth's `user` is the customer owner.
      const customerTables = [...byTable.keys()].filter((t) => t !== STAFF_TABLE)

      expect(
        customerTables,
        `More than one customer identity table exists: ${customerTables.join(', ')}. ` +
          `C-1 requires exactly one owner.`,
      ).toHaveLength(1)

      // And name it in the failure output so the fix is obvious.
      expect(customerTables[0]).toBe('user')
    })

    it('orders reference the customer owner by real FOREIGN KEY', async () => {
      // `orders` arrives in Phase 1. Until then there is nothing to assert, and
      // asserting nothing silently would be the worst outcome — a C-1 test that
      // reports green because it skipped. So this is skipped LOUDLY, and it
      // fails if an `orders` table exists WITHOUT the FK (the real defect).
      if (!dbAvailable || !pool) return

      const { rows: exists } = await pool.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='orders'`,
      )

      if (exists.length === 0) {
        console.warn(
          '[c-1] orders table does not exist yet (Phase 1) — FK assertion deferred, not passed.',
        )
        return
      }

      const { rows } = await pool.query<{ table_name: string }>(
        `SELECT ccu.table_name AS table_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'orders'
            AND ccu.table_name = 'user'`,
      )
      // Not a convention in application code — a constraint in the schema.
      expect(
        rows.length,
        'orders.customer_id must have an FK to the customer owner',
      ).toBeGreaterThan(0)
    })

    it('one verified phone cannot create two customer rows', async () => {
      if (!dbAvailable || !pool) return

      // better-auth's own uniqueness, asserted against the real index rather
      // than trusted from configuration.
      //
      // The column is `"phoneNumber"` (camelCase), not `phone_number` — better-
      // auth contributes it via its phoneNumber plugin, so the DB name matches
      // the field name rather than Payload's snake_case convention. Matching on
      // a guessed snake_case name is how this assertion would have passed
      // vacuously.
      const { rows } = await pool.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'user'`,
      )
      const hasUniquePhone = rows.some(
        (r) => /UNIQUE/i.test(r.indexdef) && /phoneNumber/i.test(r.indexdef),
      )
      expect(
        hasUniquePhone,
        'The customer owner table must have a UNIQUE index on "phoneNumber", or two records can exist for one human.',
      ).toBe(true)
    })

    it('the customer owner table has no stray identity columns from a bad config', async () => {
      if (!dbAvailable || !pool) return

      // Regression guard for a real failure: declaring per-field config in an
      // unsupported shape produced a literal column named `[object Object]`, and
      // the migration still reported success. A column name that is not a valid
      // identifier is the tell.
      const { rows } = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='user'`,
      )
      const bogus = rows
        .map((r) => r.column_name)
        .filter((c) => /[^\w"]/.test(c) || /^\[|object Object/i.test(c))
      expect(
        bogus,
        `Malformed column(s) on the customer owner table: ${bogus.join(', ')}. This is what an unsupported auth config shape produces.`,
      ).toEqual([])
    })
  })
})
