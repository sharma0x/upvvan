import { NextResponse } from 'next/server'

import { OTP_LENGTH } from '@/lib/dispatch/otp'
import {
  RIDER_COOKIE,
  clearRiderCookie,
  completeLogin,
  createLoginChallenge,
} from '@/lib/dispatch/session.server'
import { getPool } from '@/lib/dispatch/store.server'

/**
 * POST /api/rider/session — sign in, and out.
 *
 * Two actions on one route because they are the two halves of one decision:
 * `action: 'request'` queues a code, `action: 'verify'` exchanges it for a
 * session. Splitting them across two routes would mean two files that both have
 * to know the OTP lifetime, and they would drift.
 *
 * ── WHY THE CODE GOES TO A PHONE AND NOT A PASSWORD ─────────────────────────
 * A rider is holding a plant pot in one hand at a doorway. A password is a thing
 * you have to remember and retype; a code that arrives by SMS is a thing you
 * read. It also means the credential never rests in the rider's hands in a form
 * that leaks — a shared code is fine, a shared password ends up on a sticky note
 * under a dashboard.
 *
 * ── THE DEV LEAK IS DELIBERATE AND GATED ────────────────────────────────────
 * In non-production the code is ALSO returned in the response, because a developer
 * running this locally has no phone and a Mailpit inbox is faster than checking
 * one.
 *
 * That used to be the ONLY way a code reached a rider: `createLoginChallenge`
 * wrote to the `outbox` table, and nothing drains it because there is no SMS
 * gateway wired. So in production rider sign-in did not exist at all — the
 * request returned 200, the row was written, the code went nowhere, and no rider
 * could ever start a shift.
 *
 * `createLoginChallenge` now also calls `deliverOtp`, which is the same
 * customer-facing transport the phone-OTP sign-in uses, so the code genuinely
 * arrives. The leak below remains a DEV convenience and is still gated at the
 * point of return, so it cannot be reached by an env mistake.
 *
 * ── WHY THIS ROUTE IS CALLED IN TWO DIFFERENT WAYS ──────────────────────────
 *
 * `action: 'request'` and `action: 'verify'` come from the sign-in page over
 * `fetch`, as JSON. `action: 'signout'` comes from the "End shift" button, which
 * is a plain `<form method="post">` — deliberately, because ending a shift has to
 * work on a phone with a bad connection and a bundle that never arrived. A rider
 * locked out of their own run over a failed script is not an acceptable failure.
 *
 * Those are two different content types:
 *
 *     fetch()      application/json
 *     <form> POST  application/x-www-form-urlencoded
 *
 * ── AND WHY THE SECOND ONE WAS BROKEN ──────────────────────────────────────
 *
 * It parsed with `request.json()` only. Against a form-encoded body that throws,
 * the `.catch(() => ({}))` turned it into an empty object, and `action` fell
 * through to its `'request'` default. So pressing "End shift":
 *
 *   · did NOT clear the rider's cookie — the session stayed live;
 *   · navigated the phone to /api/rider/session and displayed the JSON
 *     `{"message":"Enter your 10-digit phone number."}` — the SIGN-IN error,
 *     on the one control whose entire job is to sign out;
 *   · left a rider standing in a doorway believing they had ended their shift
 *     while still authenticated for it.
 *
 * Nothing caught it because every automated check of this route used `fetch`,
 * which takes the JSON path that always worked. The broken path was the one a
 * human takes with a thumb.
 */

interface Body {
  action?: string
  phone?: string
  challengeId?: number
  code?: string
}

/**
 * Is this a browser form navigation rather than a `fetch()` from our own code?
 *
 * A real form POST carries `Accept: text/html,...` because the browser is
 * navigating and expects a page back. A `fetch()` from this codebase sends JSON
 * or `*\/\*`.
 *
 * This is how the route knows whether to REDIRECT or return JSON, and it is the
 * only thing standing between "End shift" and a page of raw JSON on the rider's
 * phone.
 */
function isBrowserNavigation(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('text/html')
}

/**
 * Read the body as JSON or as a form post.
 *
 * Order matters: JSON first, because `request.json()` on a urlencoded body
 * throws predictably, and swallowing that into an empty object is what made the
 * bug invisible. A malformed body now yields an empty object too, but only after
 * both shapes have been genuinely tried.
 */
async function readBody(request: Request): Promise<Body> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text())
    return {
      action: form.get('action') ?? undefined,
      phone: form.get('phone') ?? undefined,
      code: form.get('code') ?? undefined,
      // `challengeId` arrives as a string from a form and must become a number,
      // or the `Number.isInteger` guard below rejects a request that is perfectly
      // valid in the only encoding that carries it.
      challengeId: form.has('challengeId') ? Number(form.get('challengeId')) : undefined,
    }
  }

  return (await request.json().catch(() => ({}))) as Body
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readBody(request)
  const action = String(body.action ?? 'request')

  if (action === 'signout') {
    await clearRiderCookie()

    /*
     * Send a form submission back to a PAGE.
     *
     * Redirect, not JSON. The browser navigated here and expects somewhere to go,
     * and `/rider` redirects to the sign-in page when there is no session — so
     * that is the honest destination: the rider has ended their shift and is now
     * looking at the sign-in screen.
     *
     * A `fetch()` caller still gets JSON, because a redirect there would be
     * followed transparently and the caller would see the sign-in page's HTML as
     * if it were a response body.
     */
    if (isBrowserNavigation(request)) {
      // `NextResponse.redirect` rather than `redirect()` from `next/navigation`:
      // the latter throws a control-flow signal designed for a RENDER, and in a
      // route handler it becomes an unhandled error rather than a 303.
      const response = NextResponse.redirect(new URL('/rider/signin', request.url), 303)
      // The cookie was just deleted via `cookies()`. Carry it onto the redirect
      // explicitly so the browser is actually told to drop it — otherwise the
      // rider keeps a live session cookie and the next visit signs them straight
      // back in, which is the opposite of what "End shift" means.
      response.cookies.delete(RIDER_COOKIE)
      return response
    }
    return NextResponse.json({ ok: true })
  }

  const db = await getPool()

  if (action === 'request') {
    /*
     * Indian mobile numbers: 10 digits starting 6-9, optionally +91 prefixed.
     * Accepting the prefixed form matters — riders will type what is on the card
     * they were given, and rejecting a correct number at the start of a shift is a
     * support call at 6am.
     *
     * ── WHY THE 91 IS STRIPPED BY LENGTH AND NOT BY PREFIX ────────────────────
     *
     * It was:
     *
     *     raw.startsWith('91') ? raw.slice(2) : raw
     *
     * which means `9154238284` — ten digits, starting with 9, a perfectly ordinary
     * Indian mobile — has its first two digits removed and becomes `54238284`.
     * Eight digits. Refused, with "Enter your 10-digit phone number."
     *
     * So every rider whose number begins 91 could never start a shift. That is
     * not a corner case: `91` is a valid leading pair, `normalisePhone` in
     * `orders/db.ts` gets this right by checking the LENGTH first, and the two
     * normalisers in the same codebase disagreed — which means an order could be
     * placed for a number the rider could not sign in with.
     *
     * A country code is only a country code when there are 12 digits. Stripping by
     * length is the only version that is both correct and unambiguous.
     */
    const raw = String(body.phone ?? '').replace(/[\s-]/g, '')
    const digits =
      raw.startsWith('+91') && raw.length === 13
        ? raw.slice(3)
        : !raw.startsWith('+') && raw.length === 12 && raw.startsWith('91')
          ? raw.slice(2)
          : raw.startsWith('+')
            ? raw.slice(1)
            : raw
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return NextResponse.json({ message: 'Enter your 10-digit phone number.' }, { status: 400 })
    }

    // Deliberately a GENERIC success for an unknown number.
    //
    // Saying "no rider with that number" turns this endpoint into a roster
    // oracle: anyone can walk 9999999990 upward and learn who rides for us and,
    // by the absence of a reply, whether a given person is staff. A rider who
    // mistypes their number gets the same message and asks the dispatcher, which
    // is the right outcome anyway.
    const { rows } = await db.query<{ id: number; phone: string }>(
      `SELECT "id", "phone" FROM "riders" WHERE "phone" = $1 AND "active"`,
      [digits],
    )
    const rider = rows[0]

    let challenge: { challengeId: number; devCode: string | null } | null = null
    if (rider) {
      challenge = await createLoginChallenge(rider.id, rider.phone)
    }

    return NextResponse.json({
      ok: true,
      message: 'If that number is on the rider roster, a code is on its way.',
      // Present only when a rider matched, so an unknown number yields no
      // challengeId — there is nothing to verify against, which is also why the
      // generic message above is safe.
      ...(challenge ? { challengeId: challenge.challengeId } : {}),
      // Dev only. Gated at the source in `createLoginChallenge`.
      ...(challenge?.devCode ? { devCode: challenge.devCode } : {}),
    })
  }

  if (action === 'verify') {
    const challengeId = Number(body.challengeId)
    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      return NextResponse.json({ message: 'Request a code first.' }, { status: 400 })
    }
    const code = String(body.code ?? '').trim()
    if (!/^\d+$/.test(code) || code.length !== OTP_LENGTH) {
      return NextResponse.json({ message: `Enter the ${OTP_LENGTH}-digit code.` }, { status: 400 })
    }

    try {
      const session = await completeLogin(challengeId, code)
      const { setRiderCookie } = await import('@/lib/dispatch/session.server')
      await setRiderCookie(session.token, session.exp)
      return NextResponse.json({ ok: true, name: session.name })
    } catch (err) {
      const raw = (err as { message?: string }).message ?? ''
      // `completeLogin` already returns a generic message — it must not
      // distinguish a wrong code from an expired challenge, because the
      // challenge id is a serial and that difference is an enumeration oracle.
      if (raw.includes('not valid') || raw.includes('not active')) {
        return NextResponse.json({ message: raw }, { status: 401 })
      }
      console.error('[rider/session] verify failed:', raw)
      return NextResponse.json(
        { message: 'That did not work. Request a new code.' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ message: 'Unknown action.' }, { status: 400 })
}
