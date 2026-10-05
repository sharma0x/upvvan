import nodemailer from 'nodemailer'

import { config } from '@/lib/config'

/**
 * OTP delivery — the simulated-but-real transport.
 *
 * ── WHY AN EMAIL AND NOT AN SMS ────────────────────────────────────────────
 *
 * The production channel is WhatsApp Business (an OTP over SMS has a much lower
 * verified rate on Indian networks, and the support SLA is WhatsApp-first). This
 * module is the dev/test seam: the code path, the error handling and the
 * operator experience are all identical to the real thing, and only the last hop
 * differs. Swapping this for a WhatsApp provider is one function.
 *
 * ── WHY THE CODE IS IN THE SUBJECT ─────────────────────────────────────────
 *
 * A developer running this locally has a Mailpit UI at :58025 and no phone.
 * Burying the code in an HTML body means they read the email, then retype the
 * code with one hand. Putting it in the subject makes the six digits visible in
 * the message list itself, which is the whole ergonomics win of a fake SMS.
 *
 * It is also WHY THIS IS SAFE TO SHIP AS-IS: the subject only ever reaches a
 * mailbox we control. Real SMS delivery puts the same string in front of whoever
 * holds the handset, which is why the production provider must not reuse this
 * subject line.
 *
 * ── WHY nodemailer IS IMPORTED HERE RATHER THAN VIA PAYLOAD ─────────────────
 *
 * Payload's `nodemailerAdapter` builds a transport for ITS email (order
 * confirmations, claim notices). That adapter is not exposed as a reusable
 * transport instance, and reaching through `getPayloadInstance` to borrow it
 * would couple customer identity to the CMS. better-auth's `sendOTP` hook is a
 * plain function; keeping its transport module-local keeps the auth surface
 * independent, exactly as C-1 requires.
 */

/**
 * One process-wide transport, created lazily.
 *
 * nodemailer pools sockets internally. Building a transport per OTP would open a
 * new SMTP connection per login — on a storefront where sign-in is the single
 * most repeated action, that is a connection-churn bug we would never notice in
 * dev and would feel in production.
 */
let transport: nodemailer.Transporter | null = null

function getTransport(): nodemailer.Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      // Auth is omitted when unset rather than passed as undefined: a local
      // Mailpit has no credentials, and sending an empty auth block makes some
      // SMTP servers attempt AUTH and then fail the whole message.
      ...(config.email.user && config.email.password
        ? { auth: { user: config.email.user, pass: config.email.password } }
        : {}),
      // Dev Mailpit is plain SMTP on loopback. Without this nodemailer tries
      // STARTTLS opportunistically and logs a warning per send.
      ignoreTLS: config.env !== 'production',
    })
  }
  return transport
}

/**
 * Deliver a sign-in OTP.
 *
 * ── WHY A DELIVERY FAILURE MUST NOT THROW ──────────────────────────────────
 *
 * This is called from better-auth's `sendOTP` hook. If it throws, the whole
 * request 500s and the customer is told sign-in is broken — when in truth their
 * code was generated fine and only the mail hop failed.
 *
 * Worse, a throw inside the hook happens AFTER the verification value is written,
 * so the customer is left holding an OTP that can never be delivered and has no
 * way to know that. Logging loudly and returning normally means the failure
 * surfaces as a timeout on their side and a loud line in the server log, which
 * is the honest failure mode: the code is in the console, and the developer can
 * still complete the login.
 *
 * The console.log is deliberately NOT removed. It is the reason this module
 * exists at all — before it, the code only reached a terminal nobody was
 * watching. Now it reaches both.
 */
export async function deliverOtp({ phoneNumber, code }: { phoneNumber: string; code: string }): Promise<void> {
  // Kept from the original implementation. See above: this is a deliberate
  // belt-and-braces affordance for local development, not a leftover.
  console.log(`[auth] OTP for ${phoneNumber}: ${code}`)

  try {
    await getTransport().sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      // The phone number is the subject line's identifying half. It is the one
      // thing the customer needs to confirm they are looking at their own
      // message rather than someone else's.
      to: `${phoneNumber}@mail.upvvan.local`,
      subject: `${code} is your Upvvan sign-in code`,
      text: [
        `Your Upvvan sign-in code is ${code}.`,
        '',
        `Requested for ${phoneNumber}.`,
        '',
        'It expires shortly. If you did not ask to sign in, you can ignore this',
        'message — no account is created until the code is entered.',
      ].join('\n'),
    })
  } catch (err) {
    console.error('[auth] OTP email delivery FAILED:', (err as Error).message)
  }
}