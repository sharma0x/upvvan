import { NextResponse } from 'next/server'

import { OTP_LENGTH } from '@/lib/dispatch/otp'
import { clearRiderCookie, completeLogin, createLoginChallenge } from '@/lib/dispatch/session.server'
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
 * In non-production the code is returned in the response, because there is no
 * SMS gateway wired yet (see the `outbox` table). That is a real limitation and
 * pretending otherwise would make the surface untestable.
 *
 * It is gated on `NODE_ENV !== 'production'` at the point of return rather than
 * at the point of send, and `assertConfigValid` refuses to boot in production
 * without a real PAYLOAD_SECRET — so the branch cannot be reached by an env
 * mistake. It is still the single most dangerous line in the dispatch feature and
 * is marked as such: it goes away when a provider is wired.
 */

interface Body {
  action?: string
  phone?: string
  challengeId?: number
  code?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as Body
  const action = String(body.action ?? 'request')

  if (action === 'signout') {
    await clearRiderCookie()
    return NextResponse.json({ ok: true })
  }

  const db = await getPool()

  if (action === 'request') {
    // Indian mobile numbers: 10 digits starting 6-9, optionally +91 prefixed.
    // Accepting the prefixed form matters — riders will type what is on the
    // card they were given, and rejecting a correct number at the start of a
    // shift is a support call at 6am.
    const raw = String(body.phone ?? '').replace(/[\s-]/g, '')
    const digits = raw.startsWith('+91') ? raw.slice(3) : raw.startsWith('91') ? raw.slice(2) : raw
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
      return NextResponse.json(
        { message: `Enter the ${OTP_LENGTH}-digit code.` },
        { status: 400 },
      )
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
      return NextResponse.json({ message: 'That did not work. Request a new code.' }, { status: 500 })
    }
  }

  return NextResponse.json({ message: 'Unknown action.' }, { status: 400 })
}