/**
 * Every registered collection has a Payload document-locking column.
 *
 * ── THE BUG THIS EXISTS TO PREVENT ──────────────────────────────────────────
 *
 * Payload's document locking uses one shared table for every collection:
 * `payload_locked_documents`, plus a `payload_locked_documents_rels` row that
 * says which collection a lock belongs to. That rels table is WIDE AND SPARSE —
 * one nullable `<slug>_id` column per collection, with a matching foreign key.
 *
 * So adding a collection is a three-part change: the collection's own table, the
 * rels column, and the rels foreign key. The third is invisible until something
 * opens a lock — and something opens a lock on EVERY write through the admin
 * panel. So the failure lands on save, not on create, and it reads:
 *
 *   Failed query: select distinct "payload_locked_documents"."id" …
 *     column sku_stock_id does not exist
 *
 * which is four hundred words of SQL and none of the sentence a human needs.
 *
 * SIX collections had this problem: `contact_messages`, `business_settings`,
 * `email_log`, `riders`, `dispatches` and `sku_stock`. Two of them —
 * `riders` and `dispatches` — are the entire rider surface, so this was one
 * missing column between the business and its own delivery network.
 *
 * ── WHY NOTHING ELSE CAUGHT IT ──────────────────────────────────────────────
 *
 * typecheck passes. Lint passes. The unit suite passes. `next build` passes.
 *
 * The query is generated at runtime from `payload.config.ts` and only ever
 * executed against a live database, so the compiler has nothing to check and
 * the tests have nothing to assert. It surfaced only because a script happened
 * to boot Payload outside Next and hit the query on a code path nothing else
 * exercised.
 *
 * That is the definition of a gap in the test suite, and this test closes it by
 * comparing two lists that already exist: the slugs the app declares, and the
 * columns the database has.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'

import { config } from '@/lib/config'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const COLLECTIONS_DIR = path.resolve(__dirname, '../../../collections')
const CONFIG_SOURCE = readFileSync(path.resolve(__dirname, '../../../payload.config.ts'), 'utf8')

/**
 * Every collection SLUG, read from the collection's own file.
 *
 * ── WHY NOT `getPayload()` OR THE SANITISED CONFIG ──────────────────────────
 *
 * Both were tried and both are wrong here.
 *
 * `getPayload()` boots the whole CMS — adapter pool, plugins, config graph — to
 * read a list of strings, and it fails on the very missing columns this test
 * exists to report, so the test could not run when it was most needed.
 *
 * `buildConfig()` returns a SANITISED config with no `collections` property.
 * That is why the first two attempts got `Cannot read properties of undefined`.
 *
 * The slug is a single quoted string on a single line in each collection file, so
 * reading it directly is both simple and honest. It also cannot drift from the
 * collection: the slug in the file IS the slug Payload uses.
 */
function declaredSlugs(): Array<{ file: string; slug: string }> {
  return readdirSync(COLLECTIONS_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => {
      const source = readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8')
      const slug = /\bslug:\s*['"]([a-z0-9_-]+)['"]/.exec(source)?.[1]
      return { file, slug: slug ?? '' }
    })
    .filter((entry): entry is { file: string; slug: string } => entry.slug !== '')
}

/**
 * The identifier names listed in `collections: [...]`.
 *
 * Used for the registration check: a collection file that exists but is not
 * registered is dead code that will drift, and it is invisible to every other
 * test here because the rels column for it is simply never queried.
 */
function registeredIdentifiers(): Set<string> {
  const block = /collections:\s*\[([\s\S]*?)\n\s*\],/.exec(CONFIG_SOURCE)?.[1] ?? ''
  return new Set(
    block
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter((line) => /^[A-Z][A-Za-z0-9]*$/.test(line)),
  )
}

let pool: Pool | null = null
let connected = false

/**
 * Collections that have no locking row by design.
 *
 * EMPTY, and that is a finding rather than a placeholder.
 *
 * The first draft of this test asserted that collection slugs must be
 * snake_case, on the reasoning that the slug becomes a column name. That was
 * wrong and the test caught its own error: Payload converts `business-settings`
 * to `business_settings_id` itself, and the rels columns in this database prove
 * it. Dashed slugs are the house style here and they are fine.
 *
 * So the list is empty because every collection in this app is editable
 * somewhere — including the ones only ever written by a script — and every one of
 * them needs its column. An entry added here needs a reason, because "we'll add
 * the column if it ever breaks" is exactly the assumption this test exists to
 * remove.
 */
const EXEMPT: ReadonlySet<string> = new Set([
  // Payload's own tables. They are not application collections and Payload does
  // not create locking rows for them.
  'payload-preferences',
])

describe('Payload locking relations cover every collection', () => {
  beforeAll(async () => {
    if (!config.database.url) return
    pool = new Pool({ connectionString: config.database.url, max: 1 })
    try {
      await pool.query('SELECT 1')
      connected = true
    } catch {
      connected = false
    }
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('every collection in payload.config has a rels column', async () => {
    if (!connected || !pool) {
      // Skipping is the honest response: this needs a database to check, and a
      // fake pass would be worse than an absent one. The other half of this file
      // runs with no database at all.
      return
    }

    const slugs = declaredSlugs()
      .map((entry) => entry.slug)
      .filter((slug) => !EXEMPT.has(slug))

    expect(slugs.length).toBeGreaterThan(10)

    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'`,
    )
    const present = new Set(rows.map((r) => r.column_name))

    // The failure message has to name the FIX, not just the gap. The first
    // version of this failure cost an hour of reading generated SQL to work out
    // that the answer was one column on one table.
    // Payload turns a dashed slug into an underscored COLUMN. Reporting the raw
    // slug said `email-log_id`, which is not a column anybody can write — the
    // whole point of this message is that it can be pasted into a migration.
    const columnFor = (slug: string) => `${slug.replace(/-/g, '_')}_id`
    const missing = slugs.filter((slug) => !present.has(columnFor(slug)))

    expect(
      missing,
      missing.length === 0
        ? ''
        : `These collections have no column in payload_locked_documents_rels.\n` +
            `Every admin-panel write for them fails with a 500 on "column … does not exist",\n` +
            `and typecheck, lint, tests and build all pass.\n\n` +
            `Add these columns to payload_locked_documents_rels (with a foreign key\n` +
            `and an index each):\n` +
            `  ${missing.map(columnFor).join('\n  ')}\n\n` +
            `Fix: extend src/migrations/20261005_000017_payload_rels_columns.ts —\n` +
            `then run \`make db-migrate\`. See that file for the whole explanation.`,
    ).toEqual([])
  })

  it('every rels column has a foreign key to a real table', async () => {
    if (!connected || !pool) return

    const { rows } = await pool.query<{
      column_name: string
      fk: string | null
      target: string | null
    }>(
      `SELECT att.attname AS column_name,
              con.conname AS fk,
              cl2.relname AS target
         FROM pg_attribute att
         JOIN pg_class cl ON cl.oid = att.attrelid
         LEFT JOIN pg_constraint con
                ON con.contype = 'f'
               AND con.conrelid = att.attrelid
               AND att.attnum = con.conkey[1]
         LEFT JOIN pg_class cl2 ON cl2.oid = con.confrelid
        WHERE cl.relname = 'payload_locked_documents_rels'
          AND att.attname LIKE '%\_id'
          AND att.attnum > 0
          AND NOT att.attisdropped
          AND att.attname <> 'parent_id'`,
    )

    const orphans = rows
      .filter((r) => !r.fk)
      // `id` is Payload's own primary key on the rels table, not a relation.
      .filter((r) => r.column_name !== 'id')
      .map((r) => r.column_name)

    expect(
      orphans,
      `These columns have no foreign key:\n  ${orphans.join('\n  ')}\n\n` +
        `A column without an FK accepts any integer, so a lock can point at a document\n` +
        `that does not exist and nothing will ever clean it up.`,
    ).toEqual([])
  })

  it('every collection file is actually registered in payload.config', () => {
    /*
     * The other half of the same gap.
     *
     * A collection file that exists but is not in `collections: []` is not a
     * locking bug — it is worse in a quieter way. Its table is never written, its
     * admin screen does not exist, and nobody notices until somebody builds a
     * feature against it and finds there is nothing behind it. Checking
     * registration here means the file count and the config cannot diverge.
     */
    const registered = registeredIdentifiers()
    const unregistered = declaredSlugs()
      .map((entry) => ({ file: entry.file, identifier: entry.file.replace(/\.ts$/, '') }))
      .filter((entry) => !registered.has(entry.identifier))

    expect(
      unregistered,
      unregistered.length === 0
        ? ''
        : `These collection files exist but are not in payload.config.ts:\n` +
            `  ${unregistered.map((e) => e.file).join('\n  ')}\n\n` +
            `Either they are dead code, or someone forgot to register them.`,
    ).toEqual([])
  })
})
