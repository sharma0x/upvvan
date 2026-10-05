import { createHmac, timingSafeEqual } from 'node:crypto'

import { config } from '@/lib/config'

/**
 * Proof that a visitor proved they own an order.
 *
 * ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
 *
 * Order lookup is authorised by code + phone. But a page whose URL must carry the
 * phone is a page whose URL leaks the phone — into browser history, into a
 * `Referer` header on any outbound link, into a support ticket when someone pastes
 * the link, and into a screenshot. The whole reason the order code was moved off
 * `Date.now()` was to stop orders being enumerable and leakable; handing the phone
 * out in the address bar would have handed back most of what that fixed.
 *
 * ── THE SHAPE OF THE FIX ────────────────────────────────────────────────────
 *
 * Verify once with code + phone, then set an HMAC-signed cookie naming the order
 * code, and redirect to the clean `/order/<code>` URL. Subsequent renders are
 * authorised by the signature, not by anything in the URL.
 *
 * Signed rather than merely set, and that distinction is the whole security
 * property: a cookie value is attacker-controlled data. An unsigned cookie saying
 * `upvvan.order=UPV-ABC` would be forged in one line of curl and would render
 * somebody else's address. The HMAC means producing a valid value requires the
 * server's secret.
 *
 * ── WHY THE SECRET IS PAYLOAD_SECRET ────────────────────────────────────────
 *
 * Reusing the existing secret rather than adding a new env var keeps operational
 * surface small, and the two uses are compatible: HMAC with a distinct info string
 * (`upvvan.order-lookup.v1`) means an order-lookup token can never collide with,
 * or be replayed as, any other HMAC this application produces.
 */

/** Distinct from any other HMAC in the app, so a token cannot be cross-purpose. */
const INFO = 'upvvan.order-lookup.v1'

/**
 * How long a verified link stays usable.
 *
 * Long enough that a customer who bookmarks the order page finds it still working
 * after dinner, short enough that a laptop left open in a café does not keep
 * rendering somebody's address for a week. Thirty days matches the guarantee
 * window we sell on a T1 tier, which is the longest period we invite a customer to
 * come back to this page.
 */
export const ORDER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** The cookie NAME for an order. Keyed by code so several orders can coexist. */
export function orderCookieName(orderCode: string): string {
  return `upvvan.order.${orderCode}`
}

export function signOrderCode(orderCode: string): string {
  return createHmac('sha256', config.payload.secret).update(`${INFO}:${orderCode}`).digest('base64url')
}

/**
 * Constant-time compare.
 *
 * A plain `===` on a signature is a timing oracle: the comparison returns early on
 * the first differing byte, so an attacker can recover a valid signature one byte
 * at a time by measuring. `timingSafeEqual` is the standard fix and it is one line.
 */
export function verifyOrderSignature(orderCode: string, signature: string): boolean {
  const expected = Buffer.from(signOrderCode(orderCode))
  const actual = Buffer.from(signature)
  // timingSafeEqual throws on a length mismatch, so the length check comes first —
  // and it is not a leak, because the length is not secret.
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export interface OrderCookieOptions {
  name: string
  value: string
  maxAge: number
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  path: string
}

/**
 * Cookie attributes.
 *
 * `httpOnly` so a script on the page cannot read it (and therefore cannot exfiltrate
 * it). `sameSite: 'lax'` so it survives a top-level navigation from a payment
 * provider's redirect — which is a real case, not a hypothetical one — while
 * refusing to ride along on a cross-site POST.
 *
 * `secure` tracks `config.env`: a cookie marked Secure over plain HTTP in local dev
 * is silently dropped by the browser, and the symptom is a page that forgets it was
 * verified the moment you refresh. That is a confusing bug to chase, so the flag
 * follows the environment rather than being set unconditionally.
 */
export function orderCookie(orderCode: string): OrderCookieOptions {
  return {
    name: orderCookieName(orderCode),
    value: signOrderCode(orderCode),
    maxAge: ORDER_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    path: '/',
  }
}