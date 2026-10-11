import { NextResponse } from 'next/server'

import { consume } from '@/lib/orders/rate-limit'
import { clientIp } from '@/lib/orders/client-ip'
import { db } from '@/lib/orders/db'
import { config } from '@/lib/config'
import { loadBusinessSettings } from '@/lib/settings/server'
import { sendEmail } from '@/lib/email/send'
import { contactMailbox } from '@/lib/email/address'
import { acknowledgement, adminAlert } from '@/lib/email/templates'

/**
 * POST /api/contact — the contact form on `/contact`.
 *
 * ── WHY THIS EXISTS AND IS NOT A `mailto:` ──────────────────────────────────
 *
 * The audit's finding about this category is that support is where every
 * competitor fails, and they all fail the same way: a published mailbox, no
 * response-time promise, and a review corpus full of "ghost customer service".
 * Urvann runs one WhatsApp line that is also the published phone number for a
 * claimed 12–15 lakh customers. Kyari sits at Trustpilot 1.4/5. IGP's escalation
 * path produced "ZERO response".
 *
 * This endpoint exists so the promise on `/contact` is MEASURABLE. It writes a
 * row with a reference and a `received_at`, and the distribution of
 * `first_response_at - received_at` is a number we can be held to. A mailbox is
 * not. Publishing "under 4 working hours" without recording when the message
 * arrived would be the same unverifiable claim the category runs on.
 *
 * ── WHY THE REFERENCE IS GENERATED HERE AND NOT BY THE CLIENT ───────────────
 *
 * Because it is the thing a customer quotes in a follow-up, so it has to be
 * ours and it has to be stable. It is derived from the row id, so it is
 * guaranteed to resolve and a client cannot mint a reference that collides with a
 * real one.
 *
 * ── ERROR HANDLING — THE ALLOWLIST RULE ─────────────────────────────────────
 *
 * AGENTS.md records a real incident: returning `err.message` from a route leaked
 * Postgres internals to a customer, and a missing array table surfaced to a
 * storefront as `relation "order_items" does not exist`.
 *
 * So this route NEVER returns a caught error's message. Every failure path is
 * either a business rule — whose wording IS the customer-facing copy, written
 * here rather than taken from a validation library, because "tell us what it is
 * doing and for how long" is actionable and "invalid input" is not — or a
 * generic 500 with nothing from the exception in the response. Everything
 * unexpected goes to `console.error` where an operator will see it.
 */

const MAX_NAME = 120
const MAX_CONTACT = 200
const MAX_MESSAGE = 2000
const MAX_ORDER_CODE = 40

/** Topics the form offers. Mirrors the `<select>`; anything else is refused. */
const TOPICS = new Set(['plant', 'order', 'coverage', 'stock', 'corporate', 'care', 'other'])

export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIp(request)

  /*
   * Rate limited before any parsing.
   *
   * A contact form that is not limited is a spam relay with our domain on it.
   * The limit is on the IP rather than on a field, so it cannot be sidestepped by
   * varying the payload — which is the whole failure mode of limiting on an
   * e-mail address.
   */
  const limit = consume(ip, 'contact')
  if (!limit.allowed) {
    return NextResponse.json(
      {
        message: `That is a few messages in a short time. Try WhatsApp instead — it is faster anyway, and the number is at the top of this page.`,
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const topic = String(body.topic ?? '').trim()
  const name = String(body.name ?? '')
    .trim()
    .slice(0, MAX_NAME)
  const contact = String(body.contact ?? '')
    .trim()
    .slice(0, MAX_CONTACT)
  const message = String(body.message ?? '')
    .trim()
    .slice(0, MAX_MESSAGE)
  const orderCode = String(body.orderCode ?? '')
    .trim()
    .slice(0, MAX_ORDER_CODE)
  const optIn = body.optIn === true || body.optIn === 'on' || body.optIn === 'true'

  // ── Business rules. These messages ARE the copy. ───────────────────────────
  if (!TOPICS.has(topic)) {
    return NextResponse.json(
      { message: 'Tell us what this is about so it reaches the right person.' },
      { status: 400 },
    )
  }
  if (name.length < 2) {
    return NextResponse.json(
      { message: 'Add your name, so we know who we are replying to.' },
      { status: 400 },
    )
  }
  if (contact.length < 5) {
    return NextResponse.json(
      {
        message:
          'Add a mobile number or an e-mail. We only use it to reply to this — nothing on this form goes anywhere else.',
      },
      { status: 400 },
    )
  }
  if (message.length < 10) {
    return NextResponse.json(
      {
        message:
          'Tell us a little more — one sentence is enough. If it is about a plant, what it is doing and how long it has been like that is usually all we need for a diagnosis.',
      },
      { status: 400 },
    )
  }

  try {
    const { rows } = await db().query<{ id: number }>(
      `INSERT INTO contact_messages (topic, name, contact_detail, order_code, message, opt_in, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [topic, name, contact, orderCode || null, message, optIn, ip],
    )
    const id = rows[0]!.id

    /*
     * A corporate enquiry is a LEAD, not a support message, and it belongs in the
     * pipeline a person actually works. Recording it in both places is
     * deliberate: `quote_requests` is the reportable pipeline number, and
     * `contact_messages` is the complete record of what was asked.
     *
     * `minimum_quantity` is written at the published MOQ rather than left NULL,
     * because `quote_requests_meets_published_moq` is a CHECK and a NULL would
     * fail it. The real figure is corrected by whoever triages it — and a four
     * unit "corporate" enquiry is not a lead anyway.
     */
    if (topic === 'corporate') {
      await db()
        .query(
          `INSERT INTO quote_requests (organisation, contact_name, email, phone,
                                       minimum_quantity, occasion, notes, status)
           VALUES ($1, $2, $3, $4, $5, 'other', $6, 'new')
           ON CONFLICT DO NOTHING`,
          [
            // The organisation is not on this form — six fields of company
            // details is the reason most corporate forms are abandoned half
            // filled. The sender's name stands in and is corrected in triage.
            name,
            name,
            /*
             * NULL rather than a placeholder, and the CHECK now accepts it.
             *
             * This used to fabricate `pending:<phone>` into the e-mail column and
             * `0000000000` into the phone column. The e-mail CHECK then refused the
             * row, the route's `.catch()` swallowed it, and the request still
             * returned 201 — so a corporate enquiry submitted with a MOBILE
             * NUMBER, which is what the field's own label ("Mobile or e-mail")
             * invites and how an Indian B2B lead actually arrives, was never put
             * in the pipeline. The customer had a reference number and no lead
             * existed.
             *
             * See `20261006_000021_quote_reachable_by_phone.ts`.
             */
            looksLikeEmail(contact) ? contact : null,
            looksLikePhone(contact) ? contact : null,
            CORPORATE_MOQ,
            `Came in through the contact form (reference ${formatReference(id)}). ${message}`,
          ],
        )
        .catch((err: unknown) => {
          // A lead-enrichment failure must NOT lose the message. The contact row
          // is already committed; log and carry on.
          //
          // But it is LOGGED as an error, not a debug line, because this used to
          // fire on every phone-only corporate enquiry and the only symptom was a
          // quieter log than anybody was reading. A B2B lead that is silently not
          // recorded is the failure mode this whole log line is for.
          console.error('[contact] could not create the quote-request lead:', err)
        })
    }

    /*
     * ── TWO MESSAGES, AND THE PAGE PROMISES BOTH ─────────────────────────────
     *
     * The contact page publishes a response time — under 15 minutes on WhatsApp,
     * under 4 working hours by e-mail — and every competitor in the audit publishes
     * one too, with the same result: Kyari 1.4/5 on Trustpilot with a "ghost
     * customer service" cluster. A published promise with no acknowledgement
     * behind it is indistinguishable from no service at all, and it is the single
     * thing a person who has just had a problem is actually looking for.
     *
     * So the customer gets a reference number they can quote, and the owner gets
     * the message with that reference on it. The reference is the point: it makes
     * the conversation about a thing rather than about whether anybody is
     * listening, and it is what `contact_messages.first_response_at` is measured
     * against.
     *
     * Sent after the row is committed and NOT awaited. The row is the record; the
     * mail is a courtesy, and a mail server being down must not turn a delivered
     * message into a 500 that invites the customer to send it again.
     */
    void notifyContactMessage({
      reference: formatReference(id),
      name,
      topic,
      message,
      contactDetail: contact,
    }).catch((err: unknown) => {
      console.error('[contact] notification failed:', err)
    })

    return NextResponse.json({ reference: formatReference(id) }, { status: 201 })
  } catch (err) {
    /*
     * NOTHING from the exception reaches the customer. The message tells them to
     * use e-mail, which is actionable; the detail goes to the log.
     */
    console.error('[contact] could not record a message:', err)
    return NextResponse.json(
      {
        message:
          'Something went wrong on our side and we did not want to lose your message. E-mail care@upvvan and we will pick it up there.',
      },
      { status: 500 },
    )
  }
}

/**
 * The published corporate MOQ, duplicated here.
 *
 * Duplication, deliberately, and the constant is named so it is greppable: the
 * same value lives in the `/corporate` page copy and in the `quote_requests`
 * CHECK constraint (`20261005_000012_storefront_invariants.ts`). Writing the
 * default once in a module the migration can import is not possible — migrations
 * do not import application code — so the tie is enforced by a test that reads
 * both and fails loudly if they drift. A CHECK that silently accepted a
 * different MOQ than the page advertises is the whole failure this avoids.
 */
const CORPORATE_MOQ = 10

function looksLikeEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/**
 * `C-2026-000123`.
 *
 * Readable enough to quote down a phone line, and specific enough that two
 * messages about two orders are not confused. Derived from the row id, so it is
 * ours, it is stable, and it cannot collide with a client-invented value.
 */
function formatReference(id: number): string {
  return `C-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`
}

/**
 * The customer acknowledgement, and the alert to the person who will answer it.
 *
 * ── WHY THE ACKNOWLEDGEMENT NAMES A HUMAN ACTION AND A TIME ─────────────────
 *
 * "We have received your message" is what every automated form says, and it is
 * indistinguishable from a form that goes nowhere. So the acknowledgement states
 * what happens next in terms somebody can hold us to, and the reply window is read
 * from `business_settings` rather than hardcoded — which means the number on the
 * page and the number in the e-mail cannot disagree, because they are the same
 * number.
 */
async function notifyContactMessage(input: {
  reference: string
  name: string
  topic: string
  message: string
  contactDetail: string
}): Promise<void> {
  const settings = await loadBusinessSettings()
  const base = config.server.url.replace(/\/$/, '')
  const firstName = input.name.split(' ')[0] ?? input.name
  const replyIn = settings.supportResponseMinutes

  const TOPIC_COPY: Record<string, string> = {
    plant: 'a plant you have received',
    order: 'an order or a delivery',
    claim: 'damage or a claim',
    care: 'how to look after a plant',
    wholesale: 'wholesale or bulk orders',
    other: 'something else',
  }
  const topicPhrase = TOPIC_COPY[input.topic] ?? 'your message'

  const ack = acknowledgement({
    heading: 'We have your message',
    reference: input.reference,
    firstName,
    intro: `Thank you — this is about ${topicPhrase}, and a person reads every one of these.`,
    whatNext: [
      'A grower reads it, not a queue robot.',
      `You get an answer on ${input.contactDetail.includes('@') ? 'e-mail' : 'WhatsApp or by phone'} within about ${replyIn} minutes during our working hours (${settings.businessHours}).`,
      'If it is about an order, quote your order code and we will look at it while we reply.',
      'If we get it wrong, tell us. A complaint is answered by the named grievance officer on the contact page, acknowledged within the published window.',
    ],
    replyInMinutes: replyIn,
    supportPhone: settings.customerCarePhone || 'our published number',
    contactUrl: `${base}/contact`,
  })

  // The customer may have given a phone rather than an e-mail, so the address
  // falls back to the phone mailbox — the same rule as order mail, for the same
  // reason.
  await sendEmail({
    kind: 'contact_ack',
    to: contactMailbox(input.name, input.contactDetail),
    toName: input.name,
    subject: ack.subject,
    text: ack.text,
    html: ack.html,
  })

  const ownerAddress = config.email.orderAlertsEmail || settings.customerCareEmail
  if (ownerAddress) {
    const alert = adminAlert({
      heading: `New message · ${TOPIC_COPY[input.topic] ?? input.topic}`,
      reference: input.reference,
      summary: `${input.name} wrote in about ${TOPIC_COPY[input.topic] ?? input.topic}.`,
      details: [
        ['From', input.name],
        ['Contact', input.contactDetail],
        ['Topic', input.topic],
        ['Message', input.message.slice(0, 400)],
      ],
      actionUrl: `${config.server.url.replace(/\/$/, '')}/admin/contact-messages`,
      actionLabel: 'Open the inbox',
    })

    await sendEmail({
      kind: 'contact_admin_alert',
      to: ownerAddress,
      subject: alert.subject,
      text: alert.text,
      html: alert.html,
      internal: true,
    })
  }
}
