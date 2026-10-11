import { NextResponse } from 'next/server'

import { consume } from '@/lib/orders/rate-limit'
import { clientIp } from '@/lib/orders/client-ip'
import { db } from '@/lib/orders/db'
import { pipelineOccasionFor, tierFor, validateQuoteRequest } from '@/lib/commerce/corporate'
import { config } from '@/lib/config'
import { formatPaise } from '@/lib/catalogue/pricing'
import { loadBusinessSettings } from '@/lib/settings/server'
import { sendEmail } from '@/lib/email/send'
import { contactMailbox } from '@/lib/email/address'
import { acknowledgement, adminAlert } from '@/lib/email/templates'

/**
 * POST /api/quote-requests — the self-serve corporate quote funnel.
 *
 * ── WHY THIS IS NOT A MAILBOX ────────────────────────────────────────────────
 *
 * FNP's corporate funnel is four steps and two of them are humans: enquiry form,
 * overview call, choose, deliver. Kyari ends every page with a phone number. So a
 * competitor cannot be beaten on being reachable — they are extremely reachable,
 * they are just opaque about what you are buying. What the audit found nobody
 * publishing is the PRICE and the QUEUE, and the only way to publish a queue is
 * to have one.
 *
 * So this writes a row with a reference and a `created_at`, and the page tells
 * the buyer a number of working hours. That number becomes measurable the moment
 * somebody cares to measure `first_quote_at - created_at`, and it is a promise we
 * can be held to rather than a claim about being customer-service-led.
 *
 * ── VALIDATION IS NOT DONE HERE ─────────────────────────────────────────────
 *
 * `validateQuoteRequest` in `corporate.ts` owns the rules and the wording. The
 * reason is that the CLIENT runs the same function: the message a buyer sees under
 * a box on the form is the same string this route would have returned, so the two
 * cannot disagree, and the copy is written once in the one module that owns it.
 * This route's job is to trust the module, not to re-derive it.
 *
 * ── ERROR HANDLING — THE ALLOWLIST RULE ─────────────────────────────────────
 *
 * Exactly as in `/api/contact`, and for the same reason: AGENTS.md records a real
 * incident where returning a caught error's message surfaced
 * `relation "order_items" does not exist` to a customer.
 *
 * Every failure path below is either a business rule — whose wording IS the copy
 * the buyer reads, written in the module rather than produced by a validator — or
 * a generic 500 carrying nothing from the exception. Everything unexpected goes
 * to `console.error`. There is no branch on this route that returns an error
 * message this file did not write.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIp(request)

  /*
   * Rate limited before any parsing, on the IP rather than on a field.
   *
   * A corporate form that is not limited is a spam relay with our domain on it,
   * and limiting on an organisation name or an e-mail address is trivially
   * sidestepped by varying the payload — which is precisely the failure mode of
   * field-based limiting. A separate purpose string from `contact` so exhausting
   * the quote form never locks a genuine customer out of support.
   */
  const limit = consume(ip, 'quote-requests')
  if (!limit.allowed) {
    return NextResponse.json(
      {
        message:
          'A few of these have come from your connection in a short time. Give it a minute — or e-mail sales@upvvan and we will pick it up there.',
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => ({}))

  const validated = validateQuoteRequest(body)
  if (!validated.ok) {
    return NextResponse.json({ message: validated.error }, { status: 400 })
  }
  const quote = validated.value

  /*
   * The occasion is translated here, at the boundary.
   *
   * `corporate.ts` speaks the buyer's vocabulary (they pick "Diwali"); the column
   * is an enum written in the reporting vocabulary (`festive`). `pipelineOccasionFor`
   * cannot return null for a validated request — the validator already refused any
   * slug with no mapping — so the guard below is unreachable-by-construction and
   * exists because an unreachable assumption is exactly what breaks silently.
   */
  const occasion = pipelineOccasionFor(quote.occasion)
  if (occasion === null) {
    console.error(
      `[quote-requests] validated occasion "${quote.occasion}" has no storage mapping. This is a bug in corporate.ts, not a customer error.`,
    )
    return NextResponse.json(
      {
        message:
          'Something went wrong on our side and we did not want to lose your request. E-mail sales@upvvan and we will pick it up there.',
      },
      { status: 500 },
    )
  }

  try {
    const { rows } = await db().query<{ id: number }>(
      `INSERT INTO quote_requests (
         organisation, contact_name, email, phone, minimum_quantity, occasion,
         budget_per_unit_paise, delivery_date, personalisation, notes, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new')
       RETURNING id`,
      [
        quote.organisation,
        quote.contactName,
        quote.email,
        quote.phone,
        quote.minimumQuantity,
        occasion,
        quote.budgetPerUnitPaise,
        // `delivery_date` is a timestamptz and the buyer gave a calendar date in
        // IST. Midnight IST is pinned explicitly rather than left to whatever the
        // server thinks: the column exists so someone can sort the pipeline by the
        // day the goods are actually wanted, and a UTC midnight lands on the wrong
        // calendar day in Bengaluru for half of every order. India observes no DST,
        // so +05:30 is exact rather than an approximation.
        quote.deliveryDate === null ? null : `${quote.deliveryDate}T00:00:00+05:30`,
        quote.personalisation,
        quote.notes,
      ],
    )
    const id = rows[0]!.id

    /*
     * ── TWO ACKNOWLEDGEMENTS ─────────────────────────────────────────────────
     *
     * A bulk enquiry is a person who has budgeted for plants and is comparing
     * suppliers. The worst thing this system can do is take the enquiry and go
     * quiet, because the next supplier to reply wins the order — and the audited
     * competitors lose their B2B business in exactly that way.
     *
     * So the buyer gets the tier they actually qualify for, quoted back at them,
     * plus a reference. Not "we will be in touch": the published per-unit price
     * and lead time, because a buyer who wanted a price should not have to wait
     * for one, and because quoting the tier we will honour is what stops the
     * sales conversation starting three emails later.
     *
     * Sent after the row is committed, not awaited, for the same reason as every
     * other notification here: the record exists whether or not SMTP is up.
     */
    const reference = formatReference(id)
    void notifyQuoteRequest({
      reference,
      organisation: quote.organisation,
      contactName: quote.contactName,
      email: quote.email,
      phone: quote.phone,
      quantity: quote.minimumQuantity,
      tierLabel: tierFor(quote.minimumQuantity).label,
      deliveryDate: quote.deliveryDate,
    }).catch((err: unknown) => {
      console.error('[quote-requests] notification failed:', err)
    })

    return NextResponse.json(
      {
        reference,
        /*
         * Echoed back rather than looked up again: the client already computed it
         * from the same pure module, and sending it means a buyer who edited their
         * quantity while the request was in flight sees the figure their order
         * was actually recorded at.
         */
        tierLabel: tierFor(quote.minimumQuantity).label,
      },
      { status: 201 },
    )
  } catch (err) {
    /*
     * NOTHING from the exception reaches the buyer. The 500 copy points at a
     * channel that still works when this one does not; the detail goes to the log.
     *
     * A CHECK violation here is worth naming for the reader: `minimum_quantity`
     * below the published MOQ, an e-mail or phone of the wrong shape, or a budget
     * that is not whole paise. All three are already refused by
     * `validateQuoteRequest`, so reaching one means code and schema have drifted —
     * which is exactly what the log line is for.
     */
    console.error('[quote-requests] could not record a quote request:', err)
    return NextResponse.json(
      {
        message:
          'Something went wrong on our side and we did not want to lose your request. E-mail sales@upvvan and we will pick it up there.',
      },
      { status: 500 },
    )
  }
}

/**
 * `Q-2026-000123`.
 *
 * ── WHY A `Q` AND NOT A REUSE OF THE CONTACT ROUTE'S `C-` ────────────────────
 *
 * `/api/contact` writes a corporate enquiry to this same table as a lead
 * enrichment. If both used `C-`, a buyer who called and then filled in the form
 * would have two references for one conversation, and support would have no way
 * to tell which one they were quoted against. Distinct prefixes, one table.
 *
 * Derived from the row id so it is ours, it is stable, it is unique across both
 * routes, and a client cannot mint one that collides with a real request.
 */
function formatReference(id: number): string {
  return `Q-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`
}

/**
 * The buyer's acknowledgement, and the alert to whoever does B2B.
 *
 * The buyer copy carries the PUBLISHED price tier rather than a promise to send
 * one. `tierFor` is the same pure function the quote page renders the ladder
 * with, so the number in the e-mail is by construction the number on the page —
 * which is the only way a self-serve tier ladder avoids becoming a negotiation.
 */
async function notifyQuoteRequest(input: {
  reference: string
  organisation: string
  contactName: string
  email: string
  phone: string
  quantity: number
  tierLabel: string
  deliveryDate: string | null
}): Promise<void> {
  const settings = await loadBusinessSettings()
  const tier = tierFor(input.quantity)
  const firstName = input.contactName.split(' ')[0] ?? input.contactName

  const ack = acknowledgement({
    heading: 'Your bulk enquiry is with us',
    reference: input.reference,
    firstName,
    intro:
      `Thank you for the ${input.quantity} plant enquiry for ${input.organisation}. ` +
      `At ${input.quantity} units you are on the ${input.tierLabel} tier.`,
    whatNext: [
      `${input.tierLabel} tier: ${formatPaise(tier.perUnitPaise)} per plant, ` +
        `for ${tier.from} units and above.`,
      'That is the published price. We do not discount below it, so what you have been quoted is what you will be invoiced.',
      input.deliveryDate
        ? `You asked for delivery on ${input.deliveryDate} — tell us if that has moved, because the lead time above is what has to fit around it.`
        : 'Tell us the delivery date you need and we will tell you honestly whether we can hit it.',
      'Plants are prepaid. We invoice on confirmation and deliver in one consignment so a whole floor arrives together.',
      'Anything that makes this easier — a floor plan, a brand brief, a delivery window — goes straight to the person answering you.',
    ],
    replyInMinutes: settings.supportResponseMinutes,
    supportPhone: settings.customerCarePhone || 'our published number',
    contactUrl: `${config.server.url.replace(/\/$/, '')}/corporate`,
  })

  await sendEmail({
    kind: 'quote_ack',
    to: contactMailbox(input.contactName, input.email),
    toName: input.contactName,
    subject: ack.subject,
    text: ack.text,
    html: ack.html,
  })

  const ownerAddress = config.email.orderAlertsEmail || settings.customerCareEmail
  if (ownerAddress) {
    const alert = adminAlert({
      heading: 'New bulk enquiry',
      reference: input.reference,
      summary: `${input.organisation} asked for ${input.quantity} plants — ${input.tierLabel} tier.`,
      details: [
        ['Organisation', input.organisation],
        ['Contact', `${input.contactName} · ${input.email} · ${input.phone}`],
        ['Quantity', String(input.quantity)],
        ['Tier', `${input.tierLabel} · ${formatPaise(tier.perUnitPaise)}/plant`],
        ['Wanted by', input.deliveryDate ?? 'not stated'],
      ],
      actionUrl: `${config.server.url.replace(/\/$/, '')}/admin/quote-requests`,
      actionLabel: 'Open the enquiry',
    })

    await sendEmail({
      kind: 'quote_admin_alert',
      to: ownerAddress,
      subject: alert.subject,
      text: alert.text,
      html: alert.html,
      internal: true,
    })
  }
}
