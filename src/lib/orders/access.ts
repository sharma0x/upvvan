import 'server-only'

import type { Pool } from 'pg'

import { getCustomerId } from '@/lib/auth/session'
import { db } from '@/lib/orders/db'
import { orderCookieName, verifyOrderSignature } from '@/lib/orders/cookie'

/**
 * Who is allowed to see this order's receipt?
 *
 * ── THE TWO CREDENTIALS, AND WHY THERE ARE TWO ──────────────────────────────
 *
 * An order page shows a delivery address, a phone number, a full plant list and a
 * tax invoice. It is the most sensitive object in this product, and there are two
 * legitimate ways to prove you are the buyer:
 *
 *   1. THE SIGNED ORDER COOKIE. Set by `/api/orders/lookup` and by the checkout
 *      redirect after the customer proved the order code + the last four digits
 *      of their phone. Works for a guest, and keeps the phone out of the URL.
 *   2. THE CUSTOMER SESSION. `orders.customer_id` is a real foreign key to
 *      better-auth's `user.id`, and better-auth verified that number with an OTP.
 *
 * ── WHAT WAS BROKEN, AND WHY IT WAS A REAL FAILURE ──────────────────────────
 *
 * Only the cookie counted. So a customer who had signed in — created an account,
 * saved an address, seen their order history — could NOT open the receipt for
 * their own order unless they had separately been through the code+phone lookup
 * and still held the cookie. `/account` had no link to the invoice at all, so
 * from the one page built for signed-in customers there was no route to a
 * document they had already paid for.
 *
 * The two credentials are the SAME trust decision applied consistently, not a
 * new one: both ultimately rest on control of the phone number on the order.
 *
 * ── WHY THE SESSION PATH CANNOT BE AN IDOR ──────────────────────────────────
 *
 * Because the customer id is never an input. It comes from `getCustomerId()`,
 * which reads the session cookie, and it is matched against `orders.customer_id`
 * — a column that only ever holds better-auth's own user id. There is no query
 * parameter anywhere in this file, so "show me another customer's order" is not a
 * mistake that can be written, let alone one that passes review.
 *
 * ── WHY A LEAKED COOKIE IS STILL SAFE TO ACCEPT ─────────────────────────────
 *
 * The cookie is HMAC-signed with `payload.secret` and names the order code, so
 * producing one requires the server's secret. That is the property that makes a
 * URL-safe, screenshot-safe proof possible at all.
 */
export type OrderAuthorisation = 'session' | 'cookie' | null

/**
 * Whether this request is authorised for `orderCode`.
 *
 * `cookieJar` is passed in rather than read here so the page can keep using the
 * raw `Cookie` header it already has, and so this function stays pure enough to
 * reason about: two inputs, one boolean.
 */
export async function authoriseOrderAccess(
  orderCode: string,
  cookieHeader: string | undefined,
): Promise<OrderAuthorisation> {
  if (await orderBelongsToSignedInCustomer(orderCode)) return 'session'

  if (cookieHeader && verifyCookie(orderCode, cookieHeader)) return 'cookie'

  return null
}

/** Does this order's `customer_id` match the signed-in customer? */
async function orderBelongsToSignedInCustomer(orderCode: string): Promise<boolean> {
  const customerId = await getCustomerId()
  if (!customerId) return false

  const client = await pool()
  const { rowCount } = await client.query(
    `SELECT 1 FROM "orders" WHERE "order_code" = $1 AND "customer_id" = $2`,
    [orderCode, customerId],
  )
  return (rowCount ?? 0) > 0
}

/**
 * Is there a valid signed order cookie in this header?
 *
 * Parsed rather than delegated to `cookies()` so the callers keep control of
 * where the header came from — a page that has already read it should not read it
 * again, and a route that must work outside a Server Component should not have to
 * pretend to be one.
 */
export function verifyCookie(orderCode: string, cookieHeader: string): boolean {
  const name = orderCookieName(orderCode)
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    return verifyOrderSignature(orderCode, part.slice(eq + 1).trim())
  }
  return false
}

let poolPromise: Promise<Pool> | null = null
async function pool(): Promise<Pool> {
  if (!poolPromise) poolPromise = Promise.resolve(db())
  return poolPromise
}
