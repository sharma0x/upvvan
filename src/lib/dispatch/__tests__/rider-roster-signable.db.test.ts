/**
 * Every rider on the roster can actually start a shift.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * `scripts/seed-phase0.ts` generated rider phones as:
 *
 *     `9900000${String(index + 1).padStart(4, '0')}`
 *      ^^^^^^^ seven digits ^^^^^^^^ four more
 *
 * — ELEVEN digits, "99000000001". `POST /api/rider/session` accepts
 * `^[6-9]\d{9}$`: exactly ten, starting 6-9. So the seed provisioned a roster
 * that no rider could sign in with. The seed printed "✓ Seed complete", the
 * roster rendered in the dispatcher, and the ONLY symptom a person ever saw was
 * a rider typing the number off their own card into a form that told them
 * "Enter your 10-digit phone number."
 *
 * Nothing caught it, and the reason is the shape of the bug rather than its size:
 * there was no code path to test. The endpoint was correct. The validation was
 * correct. The database was correct — it faithfully stored eleven digits. The
 * thing that was wrong was a ROW, and no assertion in the repository ever read
 * the roster and asked whether those rows are usable.
 *
 * ── WHY THIS IS A DATA TEST AND NOT A UNIT TEST ───────────────────────────────
 *
 * Testing `normalisePhone('99000000001') === null` would pass on the code that
 * shipped this bug, because the code WAS right. Only a test that goes to
 * Postgres and reads what was actually provisioned can see the seam between
 * "the validator is correct" and "the thing being validated is usable".
 *
 * ── WHY THE ASSERTION IS PER-ROW AND NOT "THERE IS AT LEAST ONE GOOD ONE" ────
 *
 * A single signable rider is enough for the seed's own comment to look true —
 * "the roster has a rider on it" — while every other rider on that roster is
 * stuck at the door. One healthy row hides N broken ones, so each row is
 * asserted on its own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from '@/lib/config'

let pool: import('pg').Pool | null = null
let connected = false

/**
 * The acceptance shape of `POST /api/rider/session`, restated here rather than
 * imported.
 *
 * Imported, the test would fail to catch the day the endpoint's rule changes
 * WITHOUT the roster being migrated — which is precisely the drift that caused
 * this. The roster is data that has to be re-provisioned by hand; the endpoint
 * is code that changes freely. Asserting the literal ten-digit rule makes the
 * test a statement about the ROSTER, and the failure message names the row.
 */
const SIGNIN_ACCEPTS = /^[6-9][0-9]{9}$/

beforeAll(async () => {
  if (!config.database.url) return
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: config.database.url })
    await pool.query('SELECT 1')
    connected = true
  } catch {
    // No database is a reason to skip, never a reason to pass silently.
    connected = false
  }
})

afterAll(async () => {
  await pool?.end()
})

interface RosterRow {
  id: number
  name: string
  phone: string
  active: boolean
}

describe('the rider roster can be signed into', () => {
  it('has at least one rider to check', async () => {
    if (!connected || !pool) return
    const { rows } = await pool.query<RosterRow>(
      `SELECT "id", "name", "phone", "active" FROM "riders" WHERE "active"`,
    )
    // An empty roster skips every assertion below, which is how "the roster is
    // unusable" and "there is no roster" look identical to a green suite.
    expect(
      rows.length,
      'No active riders. Run `make seed-phase0` — every assertion below is vacuous on an empty roster.',
    ).toBeGreaterThan(0)
  })

  it('gives every active rider a number the sign-in endpoint will accept', async () => {
    if (!connected || !pool) return
    const { rows } = await pool.query<RosterRow>(
      `SELECT "id", "name", "phone", "active" FROM "riders" WHERE "active" ORDER BY "id"`,
    )

    const unusable = rows
      .filter((r) => !SIGNIN_ACCEPTS.test(r.phone))
      .map((r) => `  riders.id=${r.id}  ${r.name}  phone="${r.phone}"  (${r.phone.length} digits)`)

    expect(
      unusable.length,
      unusable.length === 0
        ? ''
        : 'These riders cannot start a shift. `POST /api/rider/session` accepts exactly\n' +
            'ten digits starting 6-9, and rejects anything else with "Enter your\n' +
            '10-digit phone number." — so the rider sees a sign-in form that refuses\n' +
            'the number printed on their own card.\n\n' +
            'The usual cause is `scripts/seed-phase0.ts` building the phone from a\n' +
            'prefix and a pad that add up to eleven digits.\n\n' +
            unusable.join('\n'),
    ).toBe(0)
  })

  it('gives every rider a distinct number', async () => {
    if (!connected || !pool) return
    // The roster has no UNIQUE constraint on `phone`. Two riders sharing one is
    // not a crash — it is one rider receiving the other's codes, so it would sit
    // here until somebody tried to debug a shift that never appeared.
    const { rows } = await pool.query<{ phone: string; n: string }>(
      `SELECT "phone", count(*)::text AS n FROM "riders" GROUP BY "phone" HAVING count(*) > 1`,
    )
    expect(
      rows.map((r) => `${r.phone} x${r.n}`).join(', '),
      'Duplicate rider phone numbers. Each rider must be able to sign in without ' +
        "receiving a colleague's code.",
    ).toBe('')
  })
})
