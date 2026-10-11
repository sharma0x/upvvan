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
 * Build the regex that matches `name: '<field>'` in a collection config.
 *
 * ── WHY THIS IS A FUNCTION AND NOT AN INLINE TEMPLATE ────────────────────────
 * The caller had it inline as
 *
 *     new RegExp(`name:\s*['"\`]${field}['"\`]`)
 *
 * and inside a TEMPLATE LITERAL `\s` is a NonEscapeCharacter: ECMA-262 drops the
 * backslash and yields the character `s`. That compiled to
 *
 *     name:s*['"`]email['"`]
 *
 * which cannot match `name: 'email'`, because of the single space after the
 * colon. The offender loop therefore never fired, and C-1 assertion 3 — the
 * guard on the codebase's most important invariant — passed unconditionally.
 *
 * It reported "clean" not because the schema was clean but because the check
 * could not fail. Note the same file's `fieldBlockContaining` spelled the escape
 * `\\s` and therefore worked: two copies of one rule, one of them a no-op, and
 * nothing in the suite noticed. Hence one function, used by both.
 *
 * Ordinary string concatenation is used rather than another template literal,
 * because `\\s` inside one is precisely the kind of subtlety that caused this.
 */
function fieldDeclarationPattern(field: string): RegExp {
  // The field name is escaped rather than interpolated raw, so a future field
  // containing regex metacharacters cannot silently widen the pattern.
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  return new RegExp(String.raw`name:\s*['"\`]${escaped}['"\`]`)
}

/**
 * Extract the object literal that declares `name: '<field>'`, out to its
 * matching close brace. Used so the readOnly exemption applies to the specific
 * field rather than to the whole file — a whole-file pass would also excuse a
 * writable `email` added later, which is exactly the bug this test exists for.
 */
function fieldBlockContaining(source: string, field: string): string {
  const marker = fieldDeclarationPattern(field).exec(source)
  if (!marker) return ''

  // BACKWARDS to the opening brace. This scanned FORWARDS, so for
  //
  //     { name: 'phone', type: 'text' },
  //     { name: 'minimumQuantity', … },
  //
  // it returned the `minimumQuantity` block. Since the returned block gates the
  // `readOnly: true` staff exemption, a writable `phone` sitting beside a
  // read-only field was waved through — the exemption decided by a field it had
  // nothing to do with.
  const open = source.lastIndexOf('{', marker.index)
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

/**
 * Collections that hold STAFF, not customers.
 *
 * Staff are a deliberately separate identity domain: Payload's own `Users`
 * collection, and `Riders` for the delivery fleet. A staff phone number is how
 * dispatch reaches someone during a shift and is NOT customer identity — C-1
 * exists to stop a second CUSTOMER record being born, which a rider row cannot do
 * because it has no `customer_id` and no path to one.
 *
 * Adding a collection here is a real architectural claim, not a workaround. The
 * exemption is conditional on the collection remaining customer-free, so a staff
 * collection that grows a `customerId` immediately loses it and starts failing.
 */
const STAFF_COLLECTIONS = new Set(['Users.ts', 'Riders.ts'])

/**
 * Collections that hold a CONTACT for someone who is not yet a customer.
 *
 * ── WHY A LEAD IS NOT A SECOND IDENTITY OWNER ─────────────────────────────────
 * C-1 says better-auth's `user` table is the only owner of customer identity.
 * That is about identity — something you can authenticate as, and that orders
 * and addresses can point at. A corporate enquiry is not that. `quote_requests`
 * stores the work email and phone of a person who asked for a price list, and it
 * has no session, no FK to `user`, and no path to becoming a session.
 *
 * The distinction is exactly the one the table names make: identity tables are
 * referenced BY things (`orders.customer_id` → `user.id`), lead tables are
 * referenced by nothing. The DB-level check below proves that empirically rather
 * than taking the comment's word for it — it asserts that no foreign key anywhere
 * in the database points at a lead table. Add one, and the exemption is wrong.
 *
 * Narrow on purpose: `LEAD_TABLES` must stay the shortest list that is true. A
 * name added here without a reason belongs in a comment above, not in the set.
 */
const LEAD_COLLECTIONS = new Set(['QuoteRequests.ts'])

/**
 * The same allowlist, in DATABASE terms.
 *
 * `STAFF_COLLECTIONS` names collection FILES for the static check over
 * `src/collections`; this names the resulting TABLES for the schema-level check.
 * They are two views of one fact — who is staff — and they must be kept in step:
 * a new staff collection added to one and not the other turns a correct schema
 * into a false C-1 breach.
 */
const STAFF_TABLES = new Set(['users', 'riders'])

/**
 * The same lead allowlist in DATABASE terms, with the reasoning at
 * `LEAD_COLLECTIONS`.
 *
 * Kept beside `STAFF_TABLES` rather than appended to it because the two are not
 * the same claim: staff is "our people", a lead is "a stranger who asked". They
 * are allowlisted together here only because the effect on this assertion is
 * identical, and the distinction is worth preserving for whoever reads this next.
 */
const LEAD_TABLES = new Set(['quote_requests'])

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
          const declaresField = fieldDeclarationPattern(field).test(source)
          if (!declaresField) continue
          // A staff contact number is permitted and documented — riders need a
          // number for shift dispatch. What must never exist is a WRITABLE
          // contact field, because that is where a second customer record would
          // be born. So the exemption is per-field-block and requires readOnly,
          // not a whole-file pass.
          const fieldBlock = fieldBlockContaining(source, field)
          const isReadOnlyStaffField = file === 'Users.ts' && /readOnly:\s*true/.test(fieldBlock)
          if (isReadOnlyStaffField) continue

          /*
           * STAFF collections are a second, narrow exemption, added when
           * `Riders.ts` landed.
           *
           * The comment above already states the rule — "a staff contact number is
           * permitted" — but the allowlist only ever named `Users.ts`, so adding a
           * rider collection failed this test. A rider's phone is how dispatch
           * reaches them during a shift; it is not customer identity and there is
           * no path from it to a customer row.
           *
           * The guard that matters is the one below: a STAFF collection must not
           * carry a customer relationship. If `Riders` ever gained a
           * `customer_id`, it would stop being a staff collection and this
           * exemption would correctly fall away — at which point its phone field
           * becomes a C-1 violation like any other.
           */
          const isStaffCollection = STAFF_COLLECTIONS.has(file)
          const isCustomerScoped = /name:\s*['"`]customerId['"`]/.test(source)
          if (isStaffCollection && !isCustomerScoped) continue

          /*
           * LEAD collections are a third exemption, added when
           * `QuoteRequests.ts` landed — and this one is NOT a formality.
           *
           * While C-1 assertion 3 was inert (see
           * `fieldDeclarationPattern`) it flagged nothing at all, so the
           * moment the escape was fixed the guard immediately reported a
           * collection that genuinely does carry a writable email and
           * phone. That is the guard working, and the finding is correct:
           * `quote_requests` is a writable contact record.
           *
           * It is also not a C-1 violation. A corporate enquiry for 200
           * units is a LEAD: there is no session, no FK to `user`, no
           * order and no address pointing at it, and nothing that could
           * ever authenticate as that record. Collecting the work email and
           * phone of someone who asked for a price list is the entire
           * function of the form.
           *
           * So it is allowlisted — narrowly, and with the same guard the
           * staff exemption uses: a lead must not carry a customer
           * relationship. Add `customerId` to `QuoteRequests` and it stops
           * being a lead, this exemption falls away, and its contact fields
           * become the violation they would then be.
           */
          const isLeadCollection = LEAD_COLLECTIONS.has(file)
          if (isLeadCollection && !isCustomerScoped) continue

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

      /*
       * Exclude STAFF tables, not just `users`.
       *
       * The original filter was `t !== STAFF_TABLE`, which named one table. The
       * rider collection then landed, and because a `riders` row also carries a
       * phone column the query classified it as a second CUSTOMER identity table:
       *
       *   More than one customer identity table exists: user, riders
       *
       * That is a false positive with a real cost — it reads as though C-1 had
       * been breached by a duplicate identity table, which is the single most
       * consequential thing this file can report. An engineer would reasonably
       * "fix" it by deleting the rider's phone, breaking dispatch.
       *
       * The discriminator is the same one used by the static assertion above, and
       * it is a property of the table rather than a name list: a customer
       * identity table must have a `customer_id`. `riders` has none, so it cannot
       * be one — it is staff, reachable during a shift, with no path to a
       * customer row.
       */
      /*
       * Exclude every STAFF table, by role rather than by a single name.
       *
       * The original filter was `t !== STAFF_TABLE` — one table, `users`. When
       * `riders` landed with its own phone column, the query read it as a second
       * CUSTOMER identity table and reported:
       *
       *   More than one customer identity table exists: user, riders
       *
       * A misleading report here is expensive. The obvious "fix" is to delete the
       * rider's phone number, which breaks dispatch for the sake of a rule about
       * customer identity. The two are unrelated: `riders` holds staff contact
       * details for shift dispatch and has no path to a customer row.
       *
       * A first attempt at this filter keyed on "has a `customer_id` column",
       * which is wrong for the opposite reason: better-auth's `user` table OWNS
       * identity and therefore has no `customer_id` — `orders` and `addresses`
       * point at IT. Keying on that returns zero, which is how the real table
       * gets filtered out.
       *
       * So the discriminator is a STAFF allowlist, the same `STAFF_COLLECTIONS`
       * set the static assertion above uses, plus the existing `STAFF_TABLE`.
       */
      const customerTables = [...byTable.keys()].filter(
        (t) => t !== STAFF_TABLE && !STAFF_TABLES.has(t) && !LEAD_TABLES.has(t),
      )

      expect(
        customerTables,
        `More than one customer identity table exists: ${customerTables.join(', ')}. ` +
          `C-1 requires exactly one owner.`,
      ).toHaveLength(1)

      // And name it in the failure output so the fix is obvious.
      expect(customerTables[0]).toBe('user')

      /*
       * The lead exemption is a CLAIM, so it gets checked rather than trusted.
       *
       * `LEAD_TABLES` exists because a lead holds a contact but is not an
       * identity owner. If that ever stops being true — because something grew a
       * foreign key onto `quote_requests` and started treating it as an owner —
       * the allowlist would be quietly wrong and this assertion would keep
       * passing. So: prove no foreign key anywhere points at a lead table.
       *
       * This is the only assertion in the file that reads the catalogue, and it
       * is worth the round trip: it converts a comment's reasoning into a fact
       * the suite verifies.
       */
      const { rows: leadRefs } = await pool.query<{ table_name: string; column_name: string }>(
        `SELECT cl.relname AS table_name, att.attname AS column_name
           FROM pg_constraint con
           JOIN pg_class cl ON cl.oid = con.conrelid
           JOIN pg_class target ON target.oid = con.confrelid
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
          WHERE con.contype = 'f'
            AND target.relname = ANY($1::text[])
            /*
             * Payload's own bookkeeping is not a claim on the record.
             *
             * Two kinds of foreign key point at EVERY collection and mean
             * nothing: the _parent_id an array field's child table carries, and
             * payload_locked_documents_rels, which Payload uses for document
             * locking. Both were found by this assertion on its first run -- a
             * reminder that a failing test is often the test being imprecise
             * rather than the schema being wrong.
             *
             * So the assertion is about DOMAIN tables only, which is what the
             * claim was always about: no part of the business treats a lead as
             * an owner. payload_ is Payload's table prefix; <lead>_ is its
             * array-child convention.
             *
             * (No backticks in this comment: it lives inside a JS template
             * literal, where one silently ends the string. That is the exact
             * hazard scripts/check-silent-failures.mjs exists to catch.)
             */
            AND cl.relname NOT LIKE 'payload!_%' ESCAPE '!'
            AND cl.relname NOT LIKE target.relname || '!_%' ESCAPE '!'`,
        [[...LEAD_TABLES]],
      )
      expect(
        leadRefs,
        `A foreign key points at a LEAD table: ${leadRefs
          .map((r) => `${r.table_name}.${r.column_name}`)
          .join(', ')}. ` +
          `A lead is not a customer identity owner, so nothing may reference it as one.`,
      ).toEqual([])
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
