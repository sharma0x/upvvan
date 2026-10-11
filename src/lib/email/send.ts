import 'server-only'

import nodemailer, { type Transporter } from 'nodemailer'

import { config } from '@/lib/config'
import { query } from '@/lib/db/pool'
import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * Transactional e-mail.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * The audit that shaped this project found that every competitor's most damaging
 * failure is silence after purchase: Kyari at Trustpilot 1.4/5 with a "ghost
 * customer service" cluster, Urvann at 2.1/10, IGP with an escalation path that
 * produced "ZERO response". All three publish a support promise. None of them
 * sends a human anything when money moves.
 *
 * Until this module the site had exactly one outbound message — the sign-in OTP,
 * hand-rolled inside better-auth's hook. There was no order confirmation, no
 * notification to the person who has to pack the box, and nothing at all to a
 * rider. A storefront where the founder finds out about an order by opening the
 * database is not runnable by a founder.
 *
 * ── THE RULE THAT SHAPES EVERYTHING HERE: A SEND MUST NOT THROW ─────────────
 *
 * Not one caller is allowed to fail because SMTP is down. The reasons are
 * concrete, not stylistic:
 *
 *   · An order that is COMMITTED must not be reported as failed to the customer.
 *     The stock is decremented and the row exists; a mail outage cannot un-send
 *     that, and telling someone their order failed makes them order again and
 *     double-charge them.
 *   · Payment capture is the worst possible place to throw. A gateway timeout
 *     plus an e-mail timeout is a support incident about a charge the customer
 *     did make.
 *   · Every caller is therefore `void`-ed or awaited-and-logged, and every
 *     message is written to `email_log` first, so a failed send is a visible row
 *     somebody can re-send rather than a thing that silently did not happen.
 *
 * ── WHY THE LOG IS A TABLE AND NOT A RETURN VALUE ───────────────────────────
 *
 * Because the interesting failures are the ones nobody sees. An SMTP provider
 * that accepts a message and drops it looks identical to success from here. A row
 * per attempt, with `status` and `error`, is what turns "the mail probably went
 * out" into a question with an answer — and it is visible to the owner in the
 * admin panel, which is the whole point of the exercise.
 */
export type EmailKind =
  | 'order_confirmation'
  | 'order_receipt'
  | 'order_admin_alert'
  | 'dispatch_rider'
  /*
   * ── WHY THIS IS A SEPARATE KIND ────────────────────────────────────────────
   *
   * The customer's delivery code used to be logged as `dispatch_rider`, the same
   * kind as the rider's internal dispatch brief. Both went to the same template
   * family and both went to `dispatch_rider` in `email_log`, so the one screen an
   * owner opens to answer "did the customer actually get it?" could not tell the
   * two apart except by reading the recipient — and one of them is internal
   * operational mail while the other is the credential a delivery depends on.
   *
   * `internal: true` is what makes it worse: `resendEmail` re-sends an internal
   * message to the customer verbatim. Merging the two kinds meant a mis-click in
   * the Emails panel could forward a rider's payout brief to a customer's inbox.
   */
  | 'delivery_code_reissue'
  | 'claim_ack'
  /*
   * A DECISION, not an acknowledgement. Separate from `claim_ack` because the
   * one screen an owner uses to answer "did they get it?" has to be able to tell
   * "we have your claim" from "we rejected your claim" without opening each one.
   */
  | 'claim_resolution'
  | 'claim_admin_alert'
  | 'quote_ack'
  | 'quote_admin_alert'
  | 'contact_ack'
  | 'contact_admin_alert'

let transporter: Transporter | null = null

/**
/**
 * ── THE QUEUED SWEEPER ───────────────────────────────────────────────────────
 *
 * sendEmail writes the row as queued, sends, then writes the outcome back. So a row
 * that is still queued means one of three things: the send is genuinely in flight,
 * the process died between the two writes, or updateRecord failed and its catch
 * swallowed it.
 *
 * The third case is the one that hurts, because the Emails screen is what an owner
 * opens to answer "did the customer actually get it?". A permanently queued row
 * there reads as "sending" for ever, and "sending" is not an answer.
 *
 * So on boot, any queued row older than a window no SMTP hop legitimately takes is
 * marked failed, with the reason written on it. Deliberately NOT retried:
 * resending an acknowledgement to a customer who already got one is worse than
 * showing an honest failure, and the resendEmail control on that screen exists for
 * a human who decides otherwise.
 *
 * The window is generous — fifteen minutes — because catching it late still beats
 * never.
 */
const QUEUED_STALE_MINUTES = 15

export async function sweepStaleQueuedEmails(): Promise<number> {
  try {
    const db = await import('@/lib/db/pool')
    const { rowCount } = await db.getPool().query(
      `UPDATE email_log
          SET status = 'failed',
              error = COALESCE(error, 'abandoned: the process exited before the send settled'),
              updated_at = now()
        WHERE status = 'queued'
          AND created_at < now() - ($1 || ' minutes')::interval`,
      [String(QUEUED_STALE_MINUTES)],
    )
    if ((rowCount ?? 0) > 0) {
      console.error(
        `[email] swept ${rowCount} abandoned email_log row(s) stuck at queued for over ` +
          `${QUEUED_STALE_MINUTES} minutes. Re-send them from the Emails panel if they matter.`,
      )
    }
    return rowCount ?? 0
  } catch (error) {
    // A boot-time housekeeping failure must never stop the app booting.
    console.error('[email] queued sweep failed:', (error as Error).message)
    return 0
  }
}

/*
 * ── WHERE THE SWEEP IS FIRED FROM, AND WHY IT IS NOT `instrumentation.ts` ────
 *
 * It used to be fired from `src/instrumentation.ts`, which is the natural home
 * for once-per-process boot work. It cannot live there any more: Next bundles
 * `instrumentation.ts` for the Edge runtime as well as Node, the Edge compiler
 * has no fallback for Node builtins, and this module reaches `pg` and
 * `nodemailer`. That turned `pnpm dev` into a 500 on every route. The full
 * diagnosis is in that file's header, and
 * `src/lib/email/__tests__/instrumentation-boundary.test.ts` fails if anything
 * Node-only becomes reachable from there again.
 *
 * Firing on the FIRST SEND rather than at boot is not a downgrade, and it is
 * worth being precise about why, because "it got lazier" reads like a cost:
 *
 *   · An abandoned row can only come from a process that died between writing
 *     the intent and writing the outcome. A boot sweep describes what was
 *     abandoned *before this process started*. This one describes what was
 *     abandoned *right now*, including by a process that crashed ten minutes
 *     ago while this one has been up since morning.
 *   · It runs before this process writes its own `queued` row, so the row an
 *     owner could misread is corrected before a second one appears beside it.
 *   · It costs one indexed UPDATE, once, on the first send — not on every boot
 *     of every process, most of which send nothing at all.
 *
 * The window it does not cover is the one between a process dying and the next
 * send happening. That window is bounded by when the next order or OTP arrives,
 * not by when a deploy happens, which is the better of the two.
 */
const BOOTSTRAP_KEY = Symbol.for('upvvan.email.bootstrap')

type GlobalWithBootstrap = typeof globalThis & { [BOOTSTRAP_KEY]?: boolean }

function ensureBootstrapped(): void {
  const scope = globalThis as GlobalWithBootstrap
  if (scope[BOOTSTRAP_KEY]) return
  /*
   * Set BEFORE the sweep, not after. `sweepStaleQueuedEmails` never rejects, but
   * two sends arriving in the same tick would otherwise both see the flag unset
   * and issue the same UPDATE twice.
   */
  scope[BOOTSTRAP_KEY] = true
  void sweepStaleQueuedEmails()
}

/**
 * Drop the memoised transport. FOR TESTS.
 *
 * `getTransport` caches the transporter for the life of the process, which is
 * the right behaviour for production — nodemailer pools sockets internally, and
 * rebuilding per send would open a connection per e-mail.
 *
 * It does mean a test cannot point the module at a different SMTP server by
 * swapping `nodemailer.createTransport`: the cached instance is returned first
 * and the swap is never consulted. The first version of the failure-path test did
 * exactly that, and reported that a REFUSED connection had "succeeded" — which
 * reads as a defect in the failure handling and was really a test that never
 * reached the code it meant to test.
 *
 * So the cache is made resettable rather than worked around. Named for what it
 * is; nothing in the request path calls it.
 */
export function resetTransportForTests(): void {
  transporter = null
}

function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      ...(config.email.user && config.email.password
        ? { auth: { user: config.email.user, pass: config.email.password } }
        : {}),
      // Mailpit is plain SMTP on loopback; opportunistic STARTTLS logs a warning
      // per send and adds nothing.
      ignoreTLS: config.env !== 'production',
    })
  }
  return transporter
}

export interface SendEmailInput {
  kind: EmailKind
  to: string
  /** What the recipient is: their name, or "the packing table". */
  toName?: string
  subject: string
  text: string
  html: string
  /**
   * Sent as a header so a bounced or delayed message can be traced back to the
   * row that caused it. Cheap, and the difference between "which of 400 e-mails
   * did this customer get" and an answer.
   */
  replyTo?: string
  /** Suppress the customer copy for admin-only alerts. */
  internal?: boolean
}

/**
 * Send one message. Returns whether it was accepted by the SMTP server.
 *
 * NEVER throws. Callers are order-placement and payment-capture code paths, and a
 * mail outage must not be able to fail a payment.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  ensureBootstrapped()

  const settings = await loadBusinessSettings()
  const fromName = settings.tradingName
  const from = config.email.from

  const recordId = await record(input, from)

  try {
    const info = await getTransport().sendMail({
      from: `"${fromName}" <${from}>`,
      to: input.toName ? `"${input.toName}" <${input.to}>` : input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo && settings.customerCareEmail
        ? { replyTo: settings.customerCareEmail }
        : {}),
      headers: {
        'X-Upvvan-Kind': input.kind,
        ...(recordId ? { 'X-Upvvan-Log': String(recordId) } : {}),
      },
    })

    await updateRecord(recordId, 'sent', info.messageId ?? null, null)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Loud, and twice: once in the log table for a human to see, once on the
    // console for whoever is watching. This is the line that turns "the site is
    // slow to confirm orders" into a diagnosis.
    console.error(`[email] ${input.kind} to ${input.to} FAILED: ${message}`)
    await updateRecord(recordId, 'failed', null, message)
    return false
  }
}

/** Fire-and-forget helper for call sites that must not be slowed by SMTP. */
export function sendEmailInBackground(input: SendEmailInput): void {
  void sendEmail(input).catch((error: unknown) => {
    console.error('[email] unhandled:', error instanceof Error ? error.message : error)
  })
}

/* ── the log ───────────────────────────────────────────────────────────────── */

async function record(input: SendEmailInput, from: string): Promise<number | null> {
  try {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO email_log
         (kind, recipient, recipient_name, subject, from_address, body_text, internal_only,
          status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'queued', now())
       RETURNING id`,
      [
        input.kind,
        input.to,
        input.toName ?? null,
        input.subject,
        from,
        input.text.slice(0, 8000),
        input.internal ?? false,
      ],
    )
    return rows[0]?.id ?? null
  } catch (error) {
    // The table may not exist yet on a fresh clone. Never let logging stop a send.
    console.error(
      '[email] could not write email_log:',
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

async function updateRecord(
  id: number | null,
  status: 'sent' | 'failed',
  messageId: string | null,
  error: string | null,
): Promise<void> {
  if (id === null) return
  try {
    await query(
      /*
       * Every parameter is CAST, and that is not decoration.
       *
       * This statement previously failed with
       *
       *     inconsistent types deduced for parameter $2
       *
       * on every single call. The cause is `$2` appearing twice — once as the
       * value for `status` and once inside `CASE WHEN $2 = 'sent'` — while `$3`
       * and `$4` are frequently JS `null`, which reaches the driver as an
       * untyped parameter. Postgres then cannot settle on one type for `$2` and
       * refuses the whole statement.
       *
       * ── WHY IT SAT THERE UNNOTICED FOR 44 MESSAGES ────────────────────────
       *
       * Because the failure was swallowed by the catch directly below, which logs
       * and returns — deliberately, since a bookkeeping write must never fail a
       * payment. The mail WAS sent. The row still said `queued`, `sent_at` was
       * null, and there was no message id.
       *
       * So the screen an owner opens to answer "did the customer actually get
       * it?" reported "queued" for every message, including forty-four that were
       * demonstrably sitting in Mailpit. A log that is confidently wrong is worse
       * than no log, because it is believed.
       *
       * Explicit casts remove the ambiguity entirely and make the statement's
       * types independent of what the caller happens to pass.
       */
      `UPDATE email_log
          SET status = $2::text,
              provider_message_id = $3::text,
              error = $4::text,
              sent_at = CASE WHEN $2::text = 'sent' THEN now() ELSE NULL END
        WHERE id = $1::int`,
      [id, status, messageId, error?.slice(0, 2000) ?? null],
    )
  } catch (err) {
    console.error('[email] could not update email_log:', err instanceof Error ? err.message : err)
  }
}

/**
 * Re-send a logged message.
 *
 * Exists because the failure mode this table was built for is real: a message
 * that failed at 2am and was never retried is a customer who believes they have
 * been ignored. The owner needs a button, not a psql session.
 */
export async function resendEmail(id: number): Promise<boolean> {
  const { rows } = await query<{
    kind: EmailKind
    recipient: string
    recipient_name: string | null
    subject: string
    body_text: string
  }>(`SELECT kind, recipient, recipient_name, subject, body_text FROM email_log WHERE id = $1`, [
    id,
  ])
  const row = rows[0]
  if (!row) return false

  return sendEmail({
    kind: row.kind,
    to: row.recipient,
    toName: row.recipient_name ?? undefined,
    subject: `${row.subject} (resent)`,
    text: row.body_text,
    // Plain-text only on a resend: the original HTML is not stored, and wrapping
    // stored plain text in a <pre> is honest about that rather than pretending to
    // reproduce a layout we no longer have.
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6"><pre style="white-space:pre-wrap">${escapeHtml(row.body_text)}</pre></div>`,
    internal: true,
  })
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
