import { config } from '@/lib/config'

/**
 * Where a customer's messages go.
 *
 * ── WHY THIS IS NOT OBVIOUS ─────────────────────────────────────────────────
 *
 * Customers here authenticate by PHONE, not e-mail. better-auth owns identity
 * (C-1) and the `phoneNumber` plugin owns the UNIQUE("phoneNumber") constraint,
 * so there is no e-mail address on a customer record to send to — which means a
 * naive implementation has nowhere to send a confirmation and quietly omits it.
 * Omitting the confirmation is the exact failure the audit found at every
 * competitor, so it is solved explicitly here rather than skipped.
 *
 * ── WHY A MAILBOX DOMAIN RATHER THAN SKIPPING ───────────────────────────────
 *
 * The address is `name.phone@<domain>`, so the phone is the identity and the name
 * is decoration for whoever reads the To: line. Three consequences worth stating:
 *
 *   · It reaches the same mailbox the OTP went to, so a customer who cannot log
 *     in can still find their receipt — the two are one channel, not two.
 *   · It is reversible. When real SMS is wired up, the phone part is already a
 *     correct address and only the transport changes.
 *   · It never sends a customer's mail to the business. The owner's address is a
 *     separate, explicitly configured value; conflating the two would hand a
 *     customer's receipt to a support inbox and turn a convenience into a privacy
 *     incident.
 *
 * The domain is config (`config.email.customerDomain`), not a constant, because Mailpit in dev and a
 * real domain in production are the same code path with different values.
 */
export function customerMailbox(customerName: string, customerPhone: string): string {
  const domain = config.email.customerDomain

  // Digits only. A name or a `+91` prefix in the local part produces a mailbox
  // that looks right and is undeliverable.
  const local = customerPhone.replace(/\D/g, '')
  if (!local) {
    // No phone at all. This should be unreachable — `orders_phone_is_a_mobile`
    // refuses a captured order without one — but returning a syntactically valid
    // address is better than building `undefined@domain` and having the message
    // bounce for a reason nobody can read.
    return `unknown@${domain}`
  }

  const slug = customerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24)

  return slug ? `${slug}.${local}@${domain}` : `${local}@${domain}`
}

/**
 * Where a message goes when we have a CONTACT DETAIL rather than a phone.
 *
 * The contact form accepts either an e-mail address or a phone number — people
 * give whichever they have to hand, and requiring e-mail would lose the WhatsApp
 * users who are the ones this business actually wants to reach. So the value has
 * to be interpreted, not assumed.
 *
 * ── WHY THIS IS NOT JUST `customerMailbox` ──────────────────────────────────
 *
 * The first version passed the contact field straight into `customerMailbox`,
 * which strips everything that is not a digit. Given `kavya.nair@example.com` that
 * yields no digits at all, and the function's own no-phone fallback produced
 *
 *     unknown@mail.upvvan.local
 *
 * — a syntactically valid, silently undeliverable address. The acknowledgement
 * that the contact page promises was therefore going nowhere, while the owner
 * alert arrived and made the system look like it was working. That is precisely
 * the "ghost customer service" failure the page exists to prevent, introduced by
 * the fix for it.
 *
 * So: an e-mail goes to that e-mail, and anything else is treated as the phone it
 * is meant to be.
 */
export function contactMailbox(name: string, contact: string): string {
  const trimmed = contact.trim()
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return trimmed
  return customerMailbox(name, trimmed)
}
