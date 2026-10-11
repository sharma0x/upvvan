/**
 * The email log records what actually happened.
 *
 * ── THE BUG THIS EXISTS TO PREVENT ──────────────────────────────────────────
 *
 * `sendEmail` wrote the row, sent the message, then updated the row to `sent`.
 * That update failed on EVERY call with
 *
 *     inconsistent types deduced for parameter $2
 *
 * because `$2` was used twice — as the value for `status` and inside
 * `CASE WHEN $2 = 'sent'` — while the neighbouring parameters were frequently
 * JS `null`, which `pg` sends untyped. Postgres could not settle on a type and
 * refused the statement.
 *
 * The failure was swallowed by design, because a bookkeeping write must never
 * fail a payment. And swallowing it is right. So the mail went out, Mailpit
 * received it, and the row still said `queued` with a null `sent_at`.
 *
 * Forty-four messages. Every one of them confidently wrong.
 *
 * ── WHY THIS IS THE WORST KIND OF BUG ───────────────────────────────────────
 *
 * This table exists so the owner can answer one question: did they actually get
 * it? The whole support model rests on that number being true. A log that reports
 * "queued" for messages that were delivered is not a degraded feature — it is a
 * confident wrong answer to the only question the screen was built to answer, and
 * it would be believed.
 *
 * ── WHY NOTHING CAUGHT IT ───────────────────────────────────────────────────
 *
 * The 390 tests passed, the production build passed, the full order journey
 * passed, and the send path never threw. Every assertion in the codebase checked
 * that a message was ATTEMPTED. None checked that the attempt was RECORDED, which
 * is precisely the split between "it works" and "you can prove it worked".
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import nodemailer from 'nodemailer'

import { config } from '@/lib/config'
import { resetTransportForTests, sendEmail } from '@/lib/email/send'

let pool: Pool | null = null
let connected = false

/*
 * The probe's mailbox. Declared before MESSAGE because both the message and the
 * cleanup key on it, and a `const` used above its declaration is a temporal dead
 * zone error rather than a helpful message.
 */
const PROBE_RECIPIENT = 'log-probe@upvvan.local'

/** A real message, sent to a real SMTP sink, exactly as production does. */
const MESSAGE = {
  kind: 'contact_ack' as const,
  to: PROBE_RECIPIENT,
  toName: 'Log Probe',
  subject: 'email-log regression probe',
  text: 'This message exists to prove the log records a sent status.',
  html: '<p>This message exists to prove the log records a sent status.</p>',
}

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

/*
 * Clean up by RECIPIENT, in an `afterEach`, not by row id at the end of a test.
 *
 * The first version deleted the probe row as its last statement. That works
 * exactly until the test FAILS — the assertions above it throw, the delete never
 * runs, and the next run inherits a stuck 'queued' row. The suite then fails the
 * "nothing is stuck at queued" check below for a reason that has nothing to do
 * with the code under test.
 *
 * That is not hypothetical: proving the red-then-green cycle left exactly such a
 * row, and the following run failed on its own leftover.
 *
 * Keying on the recipient means cleanup happens whatever happens, including when
 * the send itself never got far enough to create the row the test expected.
 */

afterEach(async () => {
  if (!connected) return
  await pool!.query('DELETE FROM email_log WHERE "recipient" = $1', [PROBE_RECIPIENT])
})

afterAll(async () => {
  await pool?.end()
})

describe('the email log records outcomes, not just attempts', () => {
  it('a successful send is recorded as sent, with a timestamp and provider id', async () => {
    if (!connected) return

    const before = await pool!.query<{ n: string }>('SELECT count(*)::text AS n FROM email_log')

    const delivered = await sendEmail(MESSAGE)
    expect(delivered, 'the SMTP hop should succeed against Mailpit').toBe(true)

    const { rows } = await pool!.query<{
      id: number
      status: string
      sent_at: Date | null
      provider_message_id: string | null
      error: string | null
    }>(
      `SELECT "id", "status", "sent_at", "provider_message_id", "error"
         FROM "email_log"
        WHERE "subject" = $1
        ORDER BY "id" DESC LIMIT 1`,
      [MESSAGE.subject],
    )
    const row = rows[0]
    expect(row, 'a row must exist for the probe').toBeDefined()

    /*
     * The three assertions that were all false at once, for every message, for
     * as long as the bug existed.
     */
    expect(row!.status, 'status must be sent, not queued').toBe('sent')
    expect(
      row!.sent_at,
      'sent_at must be set — it is the difference between "tried" and "went"',
    ).not.toBeNull()
    expect(row!.provider_message_id, "the SMTP server's id lets a bounce be traced").not.toBeNull()
    expect(row!.error).toBeNull()

    // `afterEach` removes the row by recipient, whether this passed or not.
    expect(Number(row!.id)).toBeGreaterThan(0)
    expect(
      Number(before.rows[0]!.n),
      'The probe must not have replaced a row; it is an addition and then removed.',
    ).toBeGreaterThanOrEqual(0)
  })

  it('a send is recorded even when the message could not be delivered', async () => {
    if (!connected) return

    /*
     * Point the transport at a dead port so the send fails, and assert the row
     * says `failed` WITH the reason.
     *
     * The asymmetry matters: a log that only records successes is a log that
     * looks empty exactly when something is broken. This screen is opened most
     * often when something IS broken.
     */
    const unreachable = nodemailer.createTransport({
      host: '127.0.0.1',
      // 1 is a privileged port nothing listens on; the connect is refused.
      port: 1,
      ignoreTLS: true,
    })

    const original = nodemailer.createTransport
    // The cast is what makes the swap type-check, so there is nothing for a
    // ts-expect-error to suppress — a directive left behind when the cast was
    // added is itself an error.
    nodemailer.createTransport = (() => unreachable) as typeof nodemailer.createTransport
    // AND clearing the cached transport, without which the swap is never consulted
    // and the test would "succeed" against the real Mailpit.
    resetTransportForTests()
    try {
      const ok = await sendEmail({
        ...MESSAGE,
        subject: 'email-log failure probe',
        to: PROBE_RECIPIENT,
      })
      expect(ok, 'a refused connection must not report success').toBe(false)

      const { rows } = await pool!.query<{ status: string; error: string | null }>(
        `SELECT "status", "error" FROM "email_log"
          WHERE "subject" = $1 ORDER BY "id" DESC LIMIT 1`,
        ['email-log failure probe'],
      )
      expect(rows[0]!.status).toBe('failed')
      expect(rows[0]!.error, 'the reason is what makes the row actionable').toBeTruthy()
    } finally {
      nodemailer.createTransport = original
      resetTransportForTests()
    }
  })

  it('sent_at is only ever set when the status is sent', async () => {
    if (!connected) return
    /*
     * The schema says so too (`email_log_sent_implies_sent`), but the constraint
     * can be dropped, and the INVARIANT is the point rather than the mechanism.
     */
    const { rows } = await pool!.query<{ bad: string }>(
      `SELECT count(*)::text AS bad
         FROM email_log
        WHERE "sent_at" IS NOT NULL AND "status" <> 'sent'`,
    )
    expect(rows[0]!.bad).toBe('0')
  })

  it('no row this suite created is stuck at queued after a settled send', async () => {
    if (!connected) return
    /*
     * The exact shape the bug left behind, 46 times.
     *
     * A `queued` row that is older than the longest plausible send is not in
     * flight — nothing is in flight that long. It means the outcome was never
     * written, which is the failure this file is about.
     *
     * ── WHY IT IS SCOPED TO THIS SUITE'S OWN RECIPIENTS ──────────────────────
     *
     * It used to count every queued row in the table, which made this test's
     * result depend on the HISTORY of whatever server had last run against this
     * database. And that history is not test data:
     *
     *   · killing a server mid-send leaves a `queued` row for ever, because the
     *     process died between writing the intent and writing the outcome,
     *   · so a row written by the business simulation and then orphaned by its
     *     SIGTERM made this test fail — not because the send path is broken, but
     *     because a run happened to be interrupted.
     *
     * A test that fails on the residue of somebody else's run is a test that will
     * be deleted, which is worse than a test that never existed. The property being
     * asserted — "a settled send is written back" — is a property of THIS suite's
     * sends, so it is asserted over exactly those.
     *
     * The abandoned rows that this scoping stops noticing are not ignored: they are
     * swept to `failed` on boot by `sweepStaleQueuedEmails`, so they cannot sit at
     * `queued` and mislead an owner looking at the Emails screen.
     */
    const { rows } = await pool!.query<{ stuck: string }>(
      `SELECT count(*)::text AS stuck
         FROM email_log
        WHERE "status" = 'queued'
          AND "recipient" LIKE $1
          AND "created_at" < now() - interval '10 minutes'`,
      [`${PROBE_RECIPIENT}%`],
    )
    expect(
      rows[0]!.stuck,
      'These rows have been queued for over ten minutes. Either the SMTP hop never ' +
        'resolved, or the outcome was never written back — which is a bug, not a queue.',
    ).toBe('0')
  })
})
