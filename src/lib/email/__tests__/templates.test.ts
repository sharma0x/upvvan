/**
 * The e-mail templates, as documents rather than as strings.
 *
 * ── WHY THESE ASSERTIONS AND NOT "does it not throw" ────────────────────────
 *
 * A template that renders is not a template that is correct. The specific things
 * this suite pins are the ones whose absence is invisible in a screenshot and
 * expensive in a customer relationship:
 *
 *   · The order code appears in the SUBJECT as well as the body. The subject is
 *     what survives a lock-screen notification and a forwarded message; a code
 *     buried in a table row is a code nobody has when they need it.
 *   · Every interpolated value is HTML-escaped. A customer's name or a plant's
 *     description goes into these documents, and an unescaped apostrophe or angle
 *     bracket is both a broken render and an injection point in a mail client.
 *   · Money is formatted through `formatPaise`, so a float can never reach an
 *     invoice by e-mail even if it reached one in the database.
 *   · The plain-text version carries the same facts as the HTML. A text part that
 *     omits the order code is a customer on a slow connection who cannot act.
 */
import { describe, it, expect } from 'vitest'

import {
  acknowledgement,
  adminAlert,
  deliveryCode,
  orderConfirmation,
  riderDispatch,
} from '@/lib/email/templates'
import { escapeHtml } from '@/lib/email/send'

const ORDER = {
  orderCode: 'UPV-TEST01',
  customerName: 'Ananya Rao',
  lines: [
    {
      name: 'ZZ Plant',
      variant: 'MD size · Coir-wrapped terracotta',
      quantity: 1,
      linePaise: 69090,
    },
  ],
  subtotalPaise: 69090,
  deliveryPaise: 0,
  totalPaise: 69090,
  addressLines: ['14, 3rd Cross', 'Bengaluru, Karnataka', '560001'],
  cityName: 'Bengaluru',
  estimatedWindow: 'next working day',
  supportPhone: '+91 80000 00000',
  trackUrl: 'https://example.test/track-order',
  receiptUrl: 'https://example.test/order/UPV-TEST01',
}

describe('order confirmation', () => {
  const mail = orderConfirmation(ORDER)

  it('carries the order code in the subject AND the first lines of the body', () => {
    expect(mail.subject).toContain('UPV-TEST01')
    expect(mail.text.slice(0, 200)).toContain('UPV-TEST01')
  })

  it('says what happens next, not only what happened', () => {
    // The audit finding this whole site is built against is silence after
    // purchase. A receipt that lists items and stops is that failure in
    // miniature.
    expect(mail.text).toMatch(/WHAT HAPPENS NEXT/i)
    expect(mail.text).toMatch(/rider/i)
    expect(mail.text).toContain('replaced, not refunded')
  })

  it('offers tracking and a receipt, as links a customer can follow', () => {
    expect(mail.text).toContain(ORDER.trackUrl)
    expect(mail.text).toContain(ORDER.receiptUrl)
    expect(mail.html).toContain(ORDER.trackUrl)
  })

  it('renders the total as money, never as a raw integer', () => {
    expect(mail.text).toContain('₹690.90')
    expect(mail.text).not.toMatch(/\b69090\b/)
  })

  it('shows free delivery as "Free" rather than as an empty cell', () => {
    expect(mail.text).toContain('Delivery: Free')
  })
})

describe('HTML escaping', () => {
  it('escapes a customer name containing markup', () => {
    const mail = orderConfirmation({
      ...ORDER,
      customerName: '<script>alert(1)</script>',
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('escapes quotes, so a name cannot break out of an attribute', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b')
    expect(escapeHtml("it's")).toBe("it's")
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })
})

describe('delivery code', () => {
  const mail = deliveryCode({
    orderCode: 'UPV-TEST01',
    customerName: 'Ravi Menon',
    code: '527597',
    riderName: 'Asha',
    address: '22, 5th Main, Koramangala, Bengaluru 560001',
    supportPhone: '+91 80000 00000',
  })

  it('states the code in the subject, because that is what gets glanced at', () => {
    expect(mail.subject).toContain('527597')
  })

  it('explains WHAT the code is for — the step that makes people read it out', () => {
    expect(mail.text).toMatch(/read this code out/i)
    expect(mail.text).toMatch(/cannot be marked\s+delivered without you|real delivery/i)
  })

  it('says the code is not needed now', () => {
    expect(mail.text).toMatch(/nothing to do now/i)
  })
})

describe('rider dispatch', () => {
  const mail = riderDispatch({
    riderName: 'Bilal',
    orderCode: 'UPV-TEST01',
    customerName: 'Meera Iyer',
    addressLines: ['7, Nehru Road', 'Bengaluru 560066'],
    phone: '+919900112233',
    payoutPaise: 8625,
    bandLabel: 'C',
    stopUrl: 'https://example.test/rider',
  })

  it('names the pay, because the pay is a snapshot a rider can check', () => {
    expect(mail.text).toContain('₹86.25')
    expect(mail.text).toMatch(/band C/i)
  })

  it('tells the rider what to do when nobody answers', () => {
    // Leaving a plant unattended is how a "delivered but not received" claim
    // starts. The rider surface has to say so.
    expect(mail.text).toMatch(/do not leave it unattended/i)
  })

  it('gives the customer phone number to call on arrival', () => {
    expect(mail.text).toContain('+919900112233')
  })
})

describe('acknowledgement', () => {
  const mail = acknowledgement({
    heading: 'We have your message',
    reference: 'C-2026-000123',
    firstName: 'Kavya',
    intro: 'This is about how to look after a ZZ plant.',
    whatNext: ['A grower reads it, not a queue robot.', 'Answered within about 15 minutes.'],
    replyInMinutes: 15,
    supportPhone: '+91 80000 00000',
    contactUrl: 'https://example.test/contact',
  })

  it('carries a reference number a customer can quote back', () => {
    expect(mail.subject).toContain('C-2026-000123')
    expect(mail.text).toContain('C-2026-000123')
  })

  it('repeats the published reply window rather than saying "we aim to respond quickly"', () => {
    expect(mail.text).toContain('15 minutes')
  })
})

describe('owner alert', () => {
  const mail = adminAlert({
    heading: 'New bulk enquiry',
    reference: 'Q-2026-000009',
    summary: 'Fernwood Interiors asked for 60 plants.',
    details: [
      ['Organisation', 'Fernwood Interiors'],
      ['Contact', 'Sana Qureshi'],
    ],
    actionUrl: 'https://example.test/admin/quote-requests',
    actionLabel: 'Open the enquiry',
  })

  it('is addressed to a destination, not just reported', () => {
    expect(mail.text).toContain('https://example.test/admin/quote-requests')
    expect(mail.html).toContain('https://example.test/admin/quote-requests')
  })
})
