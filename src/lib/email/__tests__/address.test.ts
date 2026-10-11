/**
 * Where a message goes.
 *
 * ── WHY THIS NEEDS A TEST AT ALL ────────────────────────────────────────────
 *
 * Because the mapping from "a person who contacted us" to "an address we can
 * send to" has no natural failure that shows up in a dev environment, and both
 * of its real failure modes are silent.
 *
 * The first version of the contact acknowledgement passed the contact field
 * straight into the phone-mailbox builder. Given `kavya.nair@example.com` that
 * strips to no digits, and the function's own no-phone fallback produced
 *
 *     unknown@mail.upvvan.local
 *
 * A syntactically valid, undeliverable address. The owner alert still arrived, so
 * the system LOOKED like it was working, and the acknowledgement the contact page
 * promises went nowhere — which is precisely the "ghost customer service"
 * complaint the page exists to prevent.
 *
 * Nothing in typecheck, lint, the unit suite or the build notices an address that
 * resolves to a mailbox nobody reads. Only an assertion does.
 */
import { describe, it, expect, vi } from 'vitest'

import { contactMailbox, customerMailbox } from '@/lib/email/address'

describe('customerMailbox', () => {
  it('keys the address on the PHONE, with the name only for the To: line', () => {
    // The phone is the identity; the name is decoration. Reversing that would
    // make two people with similar names collide.
    expect(customerMailbox('Ananya Rao', '9876543210')).toBe(
      'ananya.rao.9876543210@mail.upvvan.local',
    )
  })

  it('strips formatting from the number, so a pasted +91 98… still works', () => {
    expect(customerMailbox('Ravi Menon', '+91 98765-43210')).toBe(
      'ravi.menon.919876543210@mail.upvvan.local',
    )
  })

  it('does NOT invent a country code', () => {
    /*
     * The obvious-looking improvement is to prepend 91 when the number is ten
     * digits. It would be wrong: the mailbox local part is only an identity
     * token, and silently assuming India means a UAE or Singapore number becomes
     * a different person's address. Normalisation happens once, at the edge,
     * where the country code is already known — `normalisePhone` in orders/db.
     * Inventing one here would move that decision into a function that cannot
     * see it.
     */
    expect(customerMailbox('Ravi Menon', '9876543210')).not.toContain('919876543210')
  })

  it('is case- and punctuation-insensitive in the name', () => {
    const a = customerMailbox('  Kavya   Nair! ', '9900112233')
    const b = customerMailbox('kavya nair', '9900112233')
    expect(a).toBe(b)
  })

  it('never produces undefined or an empty local part', () => {
    // The exact regression: no digits at all once an e-mail was passed in here.
    const address = customerMailbox('Kavya Nair', 'kavya.nair@example.com')
    expect(address).toBe('unknown@mail.upvvan.local')
    expect(address).not.toContain('undefined')
    expect(address).not.toContain('@@')
  })

  /*
   * ── WHY THIS TEST HAD TO BE REWRITTEN ───────────────────────────────────────
   *
   * It set `process.env.CUSTOMER_EMAIL_DOMAIN` at runtime and expected the next
   * call to see it. That worked while `address.ts` read `process.env` on every
   * call — which is the thing this codebase forbids, because `src/lib/config.ts`
   * exists precisely so that ONE module reads the environment.
   *
   * Moving the read into config broke the test, correctly: config resolves once at
   * import, so mutating the environment afterwards cannot affect it. The test was
   * asserting an implementation detail (a per-call env read) rather than the
   * property anyone cares about (production must not send to the dev domain).
   *
   * So it now asserts the property in two halves, and the second half is the
   * interesting one:
   *
   *   1. the mailbox is built from `config.email.customerDomain`, not a literal;
   *   2. with a FRESH module registry and the env var set, config picks it up.
   *
   * `vi.resetModules()` is what makes (2) real. Without it the already-imported
   * config would answer from its cache and the test would pass for the wrong
   * reason — which is precisely the failure mode a green test that cannot fail is
   * supposed to protect against.
   */
  it('builds the mailbox from config, not a hardcoded dev domain', async () => {
    const { config } = await import('@/lib/config')
    expect(customerMailbox('Ravi', '+91 9876543210')).toBe(
      `ravi.919876543210@${config.email.customerDomain}`,
    )
  })

  it('honours a configured domain, so production is not the dev address', async () => {
    const before = process.env.CUSTOMER_EMAIL_DOMAIN
    process.env.CUSTOMER_EMAIL_DOMAIN = 'mail.upvvan.com'
    try {
      vi.resetModules()
      const [freshConfig, freshAddress] = await Promise.all([
        import('@/lib/config'),
        import('@/lib/email/address'),
      ])
      expect(freshConfig.config.email.customerDomain).toBe('mail.upvvan.com')
      expect(freshAddress.customerMailbox('Ravi', '+91 9876543210')).toBe(
        'ravi.919876543210@mail.upvvan.com',
      )
    } finally {
      if (before === undefined) delete process.env.CUSTOMER_EMAIL_DOMAIN
      else process.env.CUSTOMER_EMAIL_DOMAIN = before
      vi.resetModules()
    }
  })
})

describe('contactMailbox', () => {
  it('uses an e-mail address AS GIVEN — never run through the phone builder', () => {
    // The regression. An e-mail stripped of non-digits yields no digits, and the
    // phone fallback then produces a valid-looking address nobody receives.
    expect(contactMailbox('Kavya Nair', 'kavya.nair@example.com')).toBe('kavya.nair@example.com')
  })

  it('builds a mailbox from a phone number', () => {
    expect(contactMailbox('Vikram Shetty', '+919845000222')).toBe(
      'vikram.shetty.919845000222@mail.upvvan.local',
    )
  })

  it('treats a phone number as a phone even when it has odd spacing', () => {
    expect(contactMailbox('Vikram Shetty', '  98450 00222 ')).toBe(
      'vikram.shetty.9845000222@mail.upvvan.local',
    )
  })

  it('does not mistake a local-part-with-at for an e-mail', () => {
    // A single @ with no dot is not an address; treating it as one would send the
    // acknowledgement to something that cannot receive mail.
    const address = contactMailbox('Vikram Shetty', 'user@localhost')
    expect(address).not.toBe('user@localhost')
    expect(address).toMatch(/mail\.upvvan\.local$/)
  })

  it('survives an empty contact without producing a malformed address', () => {
    const address = contactMailbox('Nobody', '')
    expect(address).toMatch(/@.+/)
    expect(address.startsWith('@')).toBe(false)
  })
})
