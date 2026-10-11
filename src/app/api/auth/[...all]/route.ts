import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'

/**
 * better-auth's HTTP surface.
 *
 * ── WHY THIS FILE IS THE WHOLE REASON SIGN-IN WORKS ─────────────────────────
 *
 * better-auth is configuration plus a request handler. Until this file existed,
 * `src/lib/auth.ts` described a complete, correctly-configured identity system
 * that nothing could reach: there was no `/api/auth/*` route, so every endpoint
 * the plugin defines 404'd. The sign-in page would have called a route that did
 * not exist, and the failure would have looked like a frontend bug.
 *
 * This is the single seam. `toNextJsHandler` mounts every endpoint the plugin
 * contributes — sign-in, send-otp, verify, session, sign-out — under
 * `/api/auth`. We do not hand-write individual routes, because a hand-written
 * route is a route we can get subtly wrong (a missed cookie, a wrong status
 * code) while better-auth already handles all of it.
 *
 * ── WHY `export const dynamic = 'force-dynamic'` ────────────────────────────
 *
 * better-auth's handlers read and write session cookies and MUST never be
 * cached. Without this, Next may serve a cached response for
 * `/api/auth/get-session`, which is how a signed-in customer gets rendered the
 * signed-out page and how a sign-out appears not to work until a hard refresh.
 * Every one of those is a confusing bug in front of a customer, so the setting
 * is stated explicitly rather than left to the default.
 */
export const dynamic = 'force-dynamic'

export const { GET, POST } = toNextJsHandler(auth)
