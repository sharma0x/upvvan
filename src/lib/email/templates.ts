import 'server-only'

import { formatPaise } from '@/lib/catalogue/pricing'
import { escapeHtml } from '@/lib/email/send'

/**
 * E-mail templates.
 *
 * ── WHY THE PLAIN-TEXT VERSION IS AUTHORED, NOT DERIVED ─────────────────────
 *
 * Both parts are written by hand because they are different documents. The plain
 * text is what a person on a slow connection or a screen reader actually reads;
 * the HTML is what a person on a phone reads. Generating one from the other
 * produces the characteristic result — a wall of escaped angle brackets, or a
 * stripped-down text that has lost the sentence explaining what to do next.
 *
 * ── WHY EVERY TEMPLATE STATES THE ORDER CODE TWICE ──────────────────────────
 *
 * Once in the subject, once in the first line. The subject is what survives a
 * notification preview, a lock screen, and a forwarded message; the first line is
 * what someone reads when they are worried. A code buried in a table row is a
 * code nobody has when they need it.
 *
 * ── WHY NO IMAGE IS LOADED ──────────────────────────────────────────────────
 *
 * A remote image in a transactional mail is a tracking pixel, a request to a
 * third party from a customer who has just given us their address, and a reason
 * the message fails to render on a locked phone. Every template here is
 * self-contained HTML with inline styles.
 */

/** Minimal shell. Inline styles only — mail clients strip <style> blocks. */
function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f5f2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border:1px solid #e2ded6">
        <tr><td style="padding:24px 24px 8px">
          <p style="margin:0;font:600 15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#3d6b4f">Upvvan</p>
          <h1 style="margin:8px 0 0;font:600 20px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;color:#23291f">${escapeHtml(heading)}</h1>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;font:400 15px/1.65 system-ui,-apple-system,Segoe UI,sans-serif;color:#4a4f45">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:0 24px 24px">
          <p style="margin:0;font:400 12px/1.6 system-ui,-apple-system,sans-serif;color:#7b8177;border-top:1px solid #e2ded6;padding-top:16px">
            Pre-paid only. A plant guarantee is a replacement, never a refund.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#3d6b4f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font:600 15px/1 system-ui,-apple-system,sans-serif">${escapeHtml(label)}</a></p>`
}

export interface OrderLine {
  name: string
  variant: string
  quantity: number
  linePaise: number
}

export interface OrderEmailInput {
  orderCode: string
  customerName: string
  lines: OrderLine[]
  subtotalPaise: number
  deliveryPaise: number
  totalPaise: number
  addressLines: string[]
  cityName: string
  estimatedWindow: string
  supportPhone: string
  trackUrl: string
  receiptUrl: string
}

/** Shared itemised block. Both order e-mails use it, so they cannot disagree. */
function linesHtml(lines: OrderLine[]): string {
  const rows = lines
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eeebe4">
          <span style="font-weight:600">${escapeHtml(line.name)}</span>
          ${line.variant ? `<br><span style="font-size:13px;color:#7b8177">${escapeHtml(line.variant)}</span>` : ''}
          <br><span style="font-size:13px;color:#7b8177">Qty ${line.quantity}</span>
        </td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #eeebe4;white-space:nowrap">
          ${escapeHtml(formatPaise(line.linePaise))}
        </td>
      </tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}</table>`
}

function totalsHtml(input: OrderEmailInput): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
    ${input.deliveryPaise === 0 ? '<tr><td style="padding:2px 0">Delivery</td><td align="right" style="padding:2px 0">Free</td></tr>' : `<tr><td style="padding:2px 0">Delivery</td><td align="right" style="padding:2px 0">${escapeHtml(formatPaise(input.deliveryPaise))}</td></tr>`}
    <tr><td style="padding:6px 0;font-weight:600">Total paid</td><td align="right" style="padding:6px 0;font-weight:600">${escapeHtml(formatPaise(input.totalPaise))}</td></tr>
    <tr><td colspan="2" style="font-size:12px;color:#7b8177">Includes GST</td></tr>
  </table>`
}

/** Sent the moment the order is created. Says what happens next, not just what happened. */
export function orderConfirmation(input: OrderEmailInput): {
  subject: string
  text: string
  html: string
} {
  const subject = `${input.orderCode} — we have your order, ${input.customerName.split(' ')[0]}`

  const text = [
    `Order ${input.orderCode}`,
    '',
    `Thank you, ${input.customerName}. Your order is with us and payment has been taken.`,
    '',
    'WHAT YOU ORDERED',
    ...input.lines.map(
      (l) =>
        `  ${l.name}${l.variant ? ` (${l.variant})` : ''} × ${l.quantity} — ${formatPaise(l.linePaise)}`,
    ),
    '',
    `Delivery: ${input.deliveryPaise === 0 ? 'Free' : formatPaise(input.deliveryPaise)}`,
    `Total paid: ${formatPaise(input.totalPaise)} (includes GST)`,
    '',
    'DELIVERING TO',
    ...input.addressLines.map((l) => `  ${l}`),
    '',
    `Expected: ${input.estimatedWindow}`,
    '',
    `Track it any time: ${input.trackUrl}`,
    `Receipt and invoice: ${input.receiptUrl}`,
    '',
    'WHAT HAPPENS NEXT',
    `  1. A grower packs your plants by hand.`,
    `  2. One of our own riders brings it — you will get a call from the number on your order.`,
    `  3. If anything is wrong, photograph it and tell us. Plants are replaced, not refunded.`,
    '',
    `Questions: call or WhatsApp ${input.supportPhone}.`,
  ].join('\n')

  const html = shell(
    `Order ${input.orderCode} is confirmed`,
    `<p style="margin:0 0 12px">Thank you, ${escapeHtml(input.customerName)}. Payment is taken and your plants are on the bench.</p>
     ${linesHtml(input.lines)}
     ${totalsHtml(input)}
     <p style="margin:16px 0 4px"><strong>Delivering to</strong></p>
     <p style="margin:0;color:#4a4f45">${input.addressLines.map(escapeHtml).join('<br>')}</p>
     <p style="margin:16px 0 0"><strong>Expected:</strong> ${escapeHtml(input.estimatedWindow)}</p>
     <p style="margin:12px 0 0">Your rider will call the number on your order before arriving — it is one of ours, not a courier's.</p>
     ${button(input.trackUrl, 'Track this order')}
     <p style="margin:0;font-size:13px"><a href="${escapeHtml(input.receiptUrl)}" style="color:#3d6b4f">Receipt and invoice</a></p>
     <p style="margin:16px 0 0;font-size:13px;color:#7b8177">If anything arrives wrong, photograph it and tell us — plants are replaced, not refunded. Call or WhatsApp ${escapeHtml(input.supportPhone)}.</p>`,
  )

  return { subject, text, html }
}

/** To the person who has to physically pack a box, within seconds of the sale. */
export function adminNewOrder(input: OrderEmailInput & { cityName: string }): {
  subject: string
  text: string
  html: string
} {
  const subject = `NEW ORDER ${input.orderCode} — ${input.cityName} — ${formatPaise(input.totalPaise)}`

  const text = [
    `New order ${input.orderCode}`,
    '',
    `${input.cityName} · ${formatPaise(input.totalPaise)} · pre-paid`,
    '',
    'PACK',
    ...input.lines.map((l) => `  ${l.name}${l.variant ? ` (${l.variant})` : ''} × ${l.quantity}`),
    '',
    'DELIVER TO',
    `  ${input.customerName}`,
    ...input.addressLines.map((l) => `  ${l}`),
    `  Phone: ${input.supportPhone}`,
    '',
    'This order is paid. Pack it before the promise time.',
    `Open: ${input.receiptUrl}`,
  ].join('\n')

  const html = shell(
    `New order ${input.orderCode}`,
    `<p style="margin:0 0 12px"><strong>${escapeHtml(input.cityName)}</strong> · ${escapeHtml(formatPaise(input.totalPaise))} · pre-paid · expected ${escapeHtml(input.estimatedWindow)}</p>
     ${linesHtml(input.lines)}
     ${totalsHtml(input)}
     <p style="margin:16px 0 4px"><strong>Deliver to</strong></p>
     <p style="margin:0">${escapeHtml(input.customerName)}<br>${input.addressLines.map(escapeHtml).join('<br>')}</p>
     ${button(input.receiptUrl, 'Open in admin')}`,
  )

  return { subject, text, html }
}

/** To the rider. The one message that has to be readable on a phone in a van. */
export function riderDispatch(input: {
  riderName: string
  orderCode: string
  customerName: string
  addressLines: string[]
  phone: string
  payoutPaise: number
  bandLabel: string
  stopUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `New drop ${input.orderCode} — ${input.customerName} — ${input.bandLabel}`

  const text = [
    `New drop: ${input.orderCode}`,
    '',
    `Deliver to: ${input.customerName}`,
    ...input.addressLines.map((l) => `  ${l}`),
    `Call on arrival: ${input.phone}`,
    '',
    `Distance band ${input.bandLabel}. Your pay for this drop: ${formatPaise(input.payoutPaise)}.`,
    '',
    'On handover, photograph the plant with the customer in frame, then mark delivered.',
    `Open: ${input.stopUrl}`,
    '',
    'If nobody answers, do not leave it unattended — mark it failed and the order comes back to the office.',
  ].join('\n')

  const html = shell(
    `New drop ${input.orderCode}`,
    `<p style="margin:0 0 12px"><strong>${escapeHtml(input.customerName)}</strong></p>
     <p style="margin:0">${input.addressLines.map(escapeHtml).join('<br>')}</p>
     <p style="margin:16px 0 0"><strong>Call on arrival:</strong> ${escapeHtml(input.phone)}</p>
     <p style="margin:16px 0 0;padding:12px;background:#f2f6f2;border-radius:6px">
       Band ${escapeHtml(input.bandLabel)} · your pay <strong>${escapeHtml(formatPaise(input.payoutPaise))}</strong>
     </p>
     <p style="margin:16px 0 0;font-size:13px;color:#7b8177">Photograph the plant with the customer in frame at handover, then mark it delivered. If nobody answers, mark it failed — do not leave it unattended.</p>
     ${button(input.stopUrl, 'Open today’s run')}`,
  )

  return { subject, text, html }
}

/** Acknowledgement that carries the reference number a human will be held to. */
export function acknowledgement(input: {
  heading: string
  reference: string
  firstName: string
  intro: string
  whatNext: string[]
  replyInMinutes: number
  supportPhone: string
  contactUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `${input.reference} — we have it, ${input.firstName}`

  const text = [
    input.heading,
    '',
    `Your reference: ${input.reference}`,
    '',
    input.intro,
    '',
    'WHAT HAPPENS NEXT',
    ...input.whatNext.map((step, i) => `  ${i + 1}. ${step}`),
    '',
    `We answer WhatsApp messages in about ${input.replyInMinutes} minutes during business hours.`,
    `Or call ${input.supportPhone}.`,
    `Details: ${input.contactUrl}`,
  ].join('\n')

  const html = shell(
    `${input.heading} · ${input.reference}`,
    `<p style="margin:0 0 12px">${escapeHtml(input.intro)}</p>
     <p style="margin:0 0 12px"><strong>Your reference: ${escapeHtml(input.reference)}</strong></p>
     <p style="margin:16px 0 4px"><strong>What happens next</strong></p>
     <ol style="margin:0;padding-left:20px">${input.whatNext.map((s) => `<li style="margin:4px 0">${escapeHtml(s)}</li>`).join('')}</ol>
     <p style="margin:20px 0 0;font-size:13px;color:#7b8177">We answer WhatsApp messages in about ${input.replyInMinutes} minutes during business hours, or call ${escapeHtml(input.supportPhone)}.</p>
     ${button(input.contactUrl, 'Open the contact page')}`,
  )

  return { subject, text, html }
}

/**
 * A decision we made about a customer's problem.
 *
 * ── WHY IT IS NOT `acknowledgement` ─────────────────────────────────────────
 *
 * `acknowledgement` means "we have received this". It opens every message with
 * "we have it" and ends with a response-time promise — which is a lie when the
 * thing has already been decided, and worse, it buries the decision. A customer
 * reading "we have it" three days after we rejected their claim concludes they
 * have been ignored.
 *
 * So the subject states the outcome. Accepted, rejected, whatever it is, it is
 * the first thing they read. That is also the only version of this message that
 * can be trusted on a rejection.
 */
export function decisionNotice(input: {
  reference: string
  outcome: string
  firstName: string
  paragraphs: string[]
  /** What the customer can do now. `[]` renders no block. */
  whatNext: string[]
  supportPhone: string
  contactUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `${input.outcome} · ${input.reference}`

  const text = [
    `${input.outcome}`,
    '',
    ...input.paragraphs.flatMap((p) => [p, '']),
    ...(input.whatNext.length > 0
      ? ['WHAT YOU CAN DO', ...input.whatNext.map((s, i) => `  ${i + 1}. ${s}`), '']
      : []),
    `Call or WhatsApp ${input.supportPhone} and quote ${input.reference}.`,
    `Details: ${input.contactUrl}`,
  ].join('\n')

  const html = shell(
    `${input.outcome}`,
    `${input.paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join('')}
     <p style="margin:0 0 12px"><strong>Your reference: ${escapeHtml(input.reference)}</strong></p>
     ${
       input.whatNext.length > 0
         ? `<p style="margin:16px 0 4px"><strong>What you can do</strong></p>
     <ol style="margin:0;padding-left:20px">${input.whatNext
       .map((s) => `<li style="margin:4px 0">${escapeHtml(s)}</li>`)
       .join('')}</ol>`
         : ''
     }
     <p style="margin:20px 0 0;font-size:13px;color:#7b8177">Quote ${escapeHtml(input.reference)} if you contact us.</p>
     ${button(input.contactUrl, 'Open your order')}`,
  )

  return { subject, text, html }
}

/** To the owner: something arrived that a person needs to see. */
export function adminAlert(input: {
  heading: string
  reference: string
  summary: string
  details: Array<[string, string]>
  actionUrl: string
  actionLabel: string
}): { subject: string; text: string; html: string } {
  const subject = `${input.heading} · ${input.reference}`

  const text = [
    input.heading,
    '',
    `Reference: ${input.reference}`,
    '',
    input.summary,
    '',
    ...input.details.map(([k, v]) => `  ${k}: ${v}`),
    '',
    input.actionUrl,
  ].join('\n')

  const html = shell(
    input.heading,
    `<p style="margin:0 0 12px">${escapeHtml(input.summary)}</p>
     <p style="margin:0 0 12px"><strong>${escapeHtml(input.reference)}</strong></p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
       ${input.details
         .map(
           ([k, v]) =>
             `<tr><td style="padding:3px 0;color:#7b8177">${escapeHtml(k)}</td><td style="padding:3px 0">${escapeHtml(v)}</td></tr>`,
         )
         .join('')}
     </table>
     ${button(input.actionUrl, input.actionLabel)}`,
  )

  return { subject, text, html }
}
/**
 * The proof-of-delivery code.
 *
 * ── WHY THE CUSTOMER GETS THIS BEFORE THE RIDER ARRIVES ─────────────────────
 *
 * A delivery is only closable on a code the customer reads out, so a code that
 * arrives at the door is a delivery that cannot be completed. It is sent at
 * assignment — while the rider is still at the depot — because a customer holding
 * the code while they work through an area will actually answer their phone and
 * read it out, and a customer asked for a code on a doorstep is a customer who
 * does not have it.
 *
 * The wording tells them what the code is FOR, which is the part that stops the
 * failure mode: a customer who thinks it is a marketing code reads nothing out,
 * and the rider ends up standing there with no way to close the drop.
 */
export function deliveryCode(input: {
  orderCode: string
  customerName: string
  code: string
  riderName: string
  address: string
  supportPhone: string
}): { subject: string; text: string; html: string } {
  const subject = `${input.orderCode} — your delivery code is ${input.code}`

  const text = [
    `Your delivery code: ${input.code}`,
    '',
    `Order ${input.orderCode}, going to ${input.address}.`,
    '',
    `${input.riderName} is bringing it — they will call the number on your order on arrival.`,
    '',
    'Please read this code out to them when they hand the plant over. It is how we',
    'confirm a real delivery, and it is the reason a parcel cannot be marked as',
    'delivered without you.',
    '',
    'Nothing to do now — the code is for when the rider reaches you.',
    '',
    `If nobody arrives, or the plant is wrong, call or WhatsApp ${input.supportPhone}.`,
  ].join('\n')

  const html = shell(
    `Your delivery code is ${escapeHtml(input.code)}`,
    `<p style="margin:0 0 4px">Order <strong>${escapeHtml(input.orderCode)}</strong> to ${escapeHtml(input.address)}.</p>
     <p style="margin:16px 0;padding:14px;background:#f2f6f2;border-radius:6px;text-align:center">
       <span style="font:600 26px/1.2 ui-monospace,Menlo,monospace;letter-spacing:3px">${escapeHtml(input.code)}</span>
     </p>
     <p style="margin:0 0 12px">Please read this out when ${escapeHtml(input.riderName)} hands the plant over. It is how we confirm a real delivery — a parcel cannot be marked delivered without you.</p>
     <p style="margin:0 0 12px;font-size:13px;color:#7b8177">Nothing to do now. The code is for when the rider reaches you.</p>
     <p style="margin:0;font-size:13px;color:#7b8177">If nobody arrives, or the plant is wrong, call or WhatsApp ${escapeHtml(input.supportPhone)}.</p>`,
  )

  return { subject, text, html }
}
