'use client'

import { createAuthClient } from 'better-auth/react'
import { phoneNumberClient } from 'better-auth/client/plugins'

import { publicOrigin } from '@/lib/public-config'

/**
 * Browser-side better-auth client.
 *
 * ── WHY A CLIENT AND NOT A RAW FETCH ────────────────────────────────────────
 *
 * The two calls this page makes — `phoneNumber.sendOtp` and
 * `phoneNumber.verify` — are not just POSTs. `verify` is what SETS the
 * httpOnly session cookie, and doing that with a hand-written `fetch` means
 * hand-managing `credentials: 'include'` and the cookie is silently dropped on
 * the first request where someone forgets it. The symptom is a sign-in that
 * reports success and then bounces the customer straight back to /sign-in.
 *
 * The client also mirrors the server's path automatically, so moving
 * `/api/auth` would break both halves together instead of one silently.
 *
 * `phoneNumberClient()` is REQUIRED, not optional: without it the client has no
 * `/phone-number/*` routes and both calls 404 — the same class of failure as
 * having no route handler at all.
 *
 * ── WHY baseURL IS ABSOLUTE, NOT THE RELATIVE '/api/auth' ───────────────────
 *
 * better-auth resolves `baseURL` with `new URL()`. A relative base throws
 * `BetterAuthError: Invalid base URL` the moment anything touches this module
 * outside a browser event handler — including React Server Component rendering,
 * which imports this file transitively through the account layout. That is a 500
 * on `/account` for a *signed-in* customer, which is the worst possible moment
 * for it to surface.
 *
 * ── WHY THE ORIGIN COMES FROM `public-config` AND NOT `config` ──────────────
 *
 * This module is `'use client'`, and `@/lib/config` THROWS when it is evaluated
 * in a production bundle — `secret('PAYLOAD_SECRET')` finds nothing, because
 * `process.env` in a browser is not the server's environment, and NODE_ENV is
 * `production`.
 *
 * The consequence was that `/sign-in` — the one page every returning customer must
 * pass through — rendered "This page did not load" in a real browser against a
 * production build, with this in the console:
 *
 *     ConfigError: PAYLOAD_SECRET is required in production.
 *
 * and nothing else in the repository could see it. Development works (the dev
 * fallback), curl works (the server-rendered HTML is correct), the build is clean,
 * the tests pass, the journey passes, the business simulation passes. Only a
 * browser loads the client bundle.
 *
 * `public-config.ts` exposes exactly one value — this origin — and refuses to grow.
 */
export const authClient = createAuthClient({
  baseURL: `${publicOrigin}/api/auth`,
  plugins: [phoneNumberClient()],
})

/**
 * Normalise an Indian mobile number to E.164.
 *
 * ── WHY THE CLIENT DOES THIS ────────────────────────────────────────────────
 *
 * `phoneNumber` carries a UNIQUE constraint, and it is the customer's identity.
 * "9876543210" and "+919876543210" are the same human and would otherwise become
 * TWO accounts — the exact failure C-1 exists to prevent. Normalising to a
 * single canonical form at the edge is what makes the uniqueness constraint mean
 * what it looks like it means.
 *
 * Indian numbers are 10 digits starting 6-9, so `98XXXXXXXX` becomes
 * `+919XXXXXXXX`. A number that is already in E.164 is left alone.
 *
 * This is presentation-layer normalisation, not validation: the server still
 * verifies the OTP against whatever was stored, and a customer with an unusual
 * number can still reach us on WhatsApp. Guessing at a wrong country code is
 * worse than passing the number through.
 */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '')

  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`

  // Already carries a leading +, or is not a number we recognise.
  return input.startsWith('+') ? `+${digits}` : input
}
