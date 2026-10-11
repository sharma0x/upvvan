import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Help text must not promise delivery the code does not perform.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * The profile form said:
 *
 *     Optional. We send your confirmation, your delivery code and your invoice here.
 *
 * and the code does not do that, and deliberately will not.
 *
 * `src/lib/email/address.ts` routes every customer message to a mailbox derived
 * from the PHONE, and documents why in detail:
 *
 *     It reaches the same mailbox the OTP went to, so a customer who cannot log
 *     in can still find their receipt — the two are one channel, not two.
 *
 * `contactEmail` is unverified. Nothing proves the person typing it into their own
 * profile owns it. Sending a receipt — which carries the customer's name, address
 * and phone — to an address anyone can type is a privacy leak dressed as a
 * convenience. So the phone stays the only delivery channel, on purpose.
 *
 * Which means the copy above was simply false. A customer who filled in their email
 * and then waited for a receipt that was never going to arrive had been told a lie
 * by our own interface, and the dashboard invites them to fill it in.
 *
 * ── WHY A STATIC CHECK AND NOT A RUNTIME ONE ─────────────────────────────────
 *
 * The obvious check is "send a receipt, assert the recipient". That cannot work
 * here, because the truth of the sentence is a claim about the FUTURE: the code
 * deliberately does not mail this address, so no runtime event can ever satisfy
 * the promise. There is no correct behaviour to assert — only a promise to audit.
 *
 * So this is an audit of what the interface claims, checked here where it is
 * cheap, because the alternative is finding out from a customer.
 */
const PROFILE_FORM = resolve(__dirname, '..', '..', '..', 'components', 'auth', 'ProfileForm.tsx')
const PROFILE_PAGE = resolve(__dirname, '..', '..', '..', 'app', 'account', 'profile', 'page.tsx')

/**
 * Phrases that assert a message WILL be delivered to the contact email.
 *
 * Written as the claim, not the negation, because a copy audit has to enumerate
 * promises — you cannot grep for every way of being wrong.
 */
const DELIVERY_PROMISES = [
  /we send your .*(?:here|to your email)/i,
  /your receipt lives/i,
  /sent to your email/i,
  /emailed to you/i,
  /we'?ll email you/i,
  /you'?ll receive .*(?:by email|at this address)/i,
  /delivered to your email/i,
]

function assertNoDeliveryPromise(file: string): void {
  const source = readFileSync(file, 'utf8')
  const claims = DELIVERY_PROMISES.filter((pattern) => pattern.test(source)).map(String)

  expect(
    claims,
    `${file} tells the customer their e-mail is a delivery channel.\n` +
      `It is not, on purpose — \`contactEmail\` is unverified, and a receipt carries a\n` +
      `name, an address and a phone. \`src/lib/email/address.ts\` sends every customer\n` +
      `message to the phone-derived mailbox so the OTP and the receipt are one channel.\n` +
      `Say what the address is for: a copy on request.`,
  ).toEqual([])
}

describe('customer-facing copy about the contact email', () => {
  it('the profile form does not promise email delivery', () => {
    assertNoDeliveryPromise(PROFILE_FORM)
  })

  it('the profile page does not promise email delivery', () => {
    assertNoDeliveryPromise(PROFILE_PAGE)
  })

  it('still tells the customer what the address is for', () => {
    /*
     * The fix for a lie is not silence. Removing the sentence entirely leaves a
     * field with no explanation, which invites the same question the copy was
     * answering — and "we keep this address on file" is the true statement, so it
     * is the one that has to survive.
     */
    const source = readFileSync(PROFILE_FORM, 'utf8')
    expect(source).toMatch(/keep this address on file/i)
    // `\s+` because Prettier rewraps prose, so "the" and "phone" can land on
    // different lines. A copy assertion must survive a formatter run.
    expect(source).toMatch(/go to the\s+phone/i)
  })
})
