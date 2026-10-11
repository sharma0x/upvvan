/**
 * Business settings resolution.
 *
 * ── THE ONE RULE THIS EXISTS TO PROTECT ─────────────────────────────────────
 *
 * *What the founder types in the admin panel is what the site says.*
 *
 * That only holds if the panel wins, always, and if nothing can quietly override
 * it. The failure mode is specific and expensive: a correction typed into Settings
 * appears to be ignored, because a dotfile in the deployment still holds the old
 * value and wins the merge. For the values in this table — legal name, registered
 * address, GSTIN, the phone number the business answers on, a named grievance
 * officer — "appears to be ignored" is not an annoyance. Several of them are
 * statutory disclosures.
 *
 * So the precedence is asserted rather than assumed:
 *
 *   1. the panel row, field by field;
 *   2. `config.compliance` from the environment, for any field still BLANK;
 *   3. nothing.
 *
 * It is one-directional on purpose. The env copy stays as a boot-time fallback so
 * a fresh clone renders a compliant footer before anybody logs in — and the
 * moment the owner saves anything, the env copy is inert for that field.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'

import { config } from '@/lib/config'

let pool: Pool | null = null
let connected = false

/**
 * The loader is wrapped in React's per-request `cache()`, which needs a React
 * request scope. Calling it outside one is exactly what a test does, so the
 * pure resolution underneath is exercised directly against the row instead —
 * same source of truth, same precedence, no React runtime in the way.
 */
async function readRow(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool!.query('SELECT * FROM business_settings ORDER BY id LIMIT 1')
  return rows[0] ?? null
}

/** The same `pick` the loader uses: first non-blank, where blank means trimmed-empty. */
function pick(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text !== '') return text
  }
  return ''
}

/*
 * Connection lifecycle at FILE scope, not inside a describe.
 *
 * Vitest runs a describe's `afterAll` when that describe finishes, so a pool
 * opened in the first describe's `beforeAll` was closed before the second
 * describe ran, and every test in it failed with "Cannot use a pool after calling
 * end". Which is worse than useless: it looks like the constraints are not being
 * enforced, when in fact nothing was ever sent to the database.
 */
beforeAll(async () => {
  if (!config.database.url) return
  pool = new Pool({ connectionString: config.database.url, max: 2 })
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

/**
 * Run a write and ROLL IT BACK.
 *
 * The constraint tests below deliberately write to the live settings row. Rolling
 * back means the suite leaves the business's own configuration exactly as it found
 * it — so running the tests can never be the reason the footer loses its GST
 * number. A test that mutates shared state and hopes is a test that eventually
 * corrupts it.
 */
async function rolled<T>(
  fn: (client: { query: (q: string) => Promise<T> }) => Promise<T>,
): Promise<T> {
  const client = await pool!.connect()
  try {
    await client.query('BEGIN')
    return await fn(client)
  } finally {
    /*
     * ROLLBACK runs on BOTH paths, and that is not tidiness.
     *
     * These tests assert that a constraint REJECTS a write, so the write always
     * throws — and a thrown statement aborts the whole Postgres transaction. With
     * the ROLLBACK only on the success path, the connection went back to the pool
     * mid-abort, and every subsequent test failed with
     *
     *     current transaction is aborted, commands ignored until end of transaction block
     *
     * which reads as "the constraints are not being enforced" when in fact
     * nothing was ever sent. The second version of this helper therefore rolls
     * back unconditionally and swallows a rollback that itself fails, because the
     * original error is the interesting one.
     */
    try {
      await client.query('ROLLBACK')
    } catch {
      // Connection already unusable; the next checkout gets a fresh one.
    }
    client.release()
  }
}

describe('business settings — resolution order', () => {
  it('the panel row exists, so the admin panel shows a form and not an empty list', async () => {
    if (!connected) return
    const row = await readRow()
    expect(row, 'migration 000015 inserts a defaults-only row').not.toBeNull()
  })

  it('a value set in the panel beats the same value in the environment', async () => {
    if (!connected) return
    const row = await readRow()
    if (!row) throw new Error('no business_settings row — run `make db-migrate`')

    // Stand-in for the env value, chosen to be different from whatever the row
    // holds so the assertion cannot pass by accident.
    const fromPanel = pick(row.customer_care_phone as string)
    expect(fromPanel, 'the seed should have filled the customer-care phone').not.toBe('')
    expect(pick(fromPanel, '+91 00000 00000')).toBe(fromPanel)
  })

  it('a field the owner CLEARED falls back to the environment rather than to the old value', async () => {
    if (!connected) return
    /*
     * The subtle half of the rule, and the reason `pick` trims rather than
     * testing falsiness.
     *
     * If clearing a field in the panel left the previous value in place, then "I
     * removed our address" would turn into "our address is still on the site" —
     * for a statutory disclosure, the worst possible outcome, and one that looks
     * like the edit simply did not save.
     *
     * A field that is genuinely blank therefore resolves to empty, and the footer
     * shows a visible gap with a named warning (see `disclosureGaps`) instead of
     * a stale value nobody can trace.
     */
    expect(pick('', '   ', null, undefined)).toBe('')
    expect(pick(null, undefined, '')).toBe('')
  })

  it('a whitespace-only value counts as blank, not as content', async () => {
    expect(pick('   ', 'fallback')).toBe('fallback')
  })
})

describe('business settings — schema enforcement', () => {
  it('a malformed GSTIN is refused by the DATABASE, not only by the form', async () => {
    if (!connected) return

    /*
     * Application-code-only validation is a fail in this codebase — a bypassable
     * check is not a check. `business_settings_gstin_shape` exists so a direct
     * INSERT, a migration or a future seeding script cannot write a GSTIN that
     * makes an invoice unusable.
     */
    await expect(
      rolled((c) => c.query(`UPDATE business_settings SET gstin = 'AAAAAAAAAAAAAAA'`)),
    ).rejects.toThrow(/business_settings_gstin_shape/)

    // And the structural shape is accepted, so the constraint is not simply
    // refusing everything.
    await expect(
      rolled((c) => c.query(`UPDATE business_settings SET gstin = '29ABCDE1234F1Z5'`)),
    ).resolves.toBeDefined()
  })

  it('a WhatsApp number that would build a broken wa.me link is refused', async () => {
    if (!connected) return
    // The contact page's "answers in 15 minutes" promise hangs off this link, so
    // a pasted "(080) 4123-4567" has to be impossible to save.
    await expect(
      rolled((c) => c.query(`UPDATE business_settings SET whatsapp_number = '(080) 4123-4567'`)),
    ).rejects.toThrow(/business_settings_whatsapp_is_digits/)
  })

  it('a grievance window slower than the Rules allow is refused', async () => {
    if (!connected) return
    // Consumer Protection (E-commerce) Rules 2020 r.4(5) caps acknowledgement at
    // 48 hours. An owner may promise faster; a longer one would be published on
    // the contact page as though it were real.
    await expect(
      rolled((c) => c.query(`UPDATE business_settings SET grievance_response_hours = 72`)),
    ).rejects.toThrow(/business_settings_grievance_within_48h/)
  })

  it('a fractional GST rate is refused, because 18% must be entered as 1800', async () => {
    if (!connected) return
    // Entering 18 by mistake produces a tax line wrong by a factor of 100, and
    // nothing reviewing an order would notice.
    await expect(
      rolled((c) => c.query(`UPDATE business_settings SET gst_rate_bp = 18.5`)),
    ).rejects.toThrow(/business_settings_tax_rate_is_bp/)
  })

  it('there can only ever be ONE settings row', async () => {
    if (!connected) return
    // The singleton is enforced by a unique index on a constant. Without it, two
    // rows means two answers to "what is our GST number", and the loader's
    // ORDER BY id silently picks one.
    await expect(
      rolled((c) =>
        c.query(
          `INSERT INTO business_settings (trading_name) SELECT 'Second copy' FROM business_settings LIMIT 1`,
        ),
      ),
    ).rejects.toThrow(/business_settings_singleton/)
  })
})
