import { NextResponse } from 'next/server'

import { DISPATCH_STATUSES, type DispatchStatus } from '@/lib/dispatch/assign'
import { TransitionError, transitionStatus } from '@/lib/dispatch/store.server'
import { currentRider } from '@/lib/dispatch/session.server'

/**
 * POST /api/rider/dispatch/[id]/transition — advance a drop.
 *
 * ── THE RIDER OWNS THIS AND ONLY THEIR OWN DROPS ────────────────────────────
 * The `riderId` on the dispatch is checked against the session, not taken from
 * the request body. Without that check any signed-in rider could move any drop
 * on the board — including marking somebody else's drop delivered, which is the
 * fraud this whole system is built to make impossible. Ownership is enforced at
 * the row, in the same statement that writes the event.
 *
 * ── WHY DELIVERED IS REFUSED HERE RATHER THAN HANDLED ───────────────────────
 * `transitionStatus` throws OTP_REQUIRED for `to: 'DELIVERED'`, and
 * `/deliver` is the only path that can set it. A rider tapping "Mark delivered"
 * is told to ask the customer for their code.
 *
 * This is not a UI-only distinction. Even if this route accepted DELIVERED, the
 * database trigger would refuse the write — the route just saves the rider from
 * a Postgres error message in the middle of a doorstep.
 */

interface Params {
  params: Promise<{ id: string }>
}

interface Body {
  to?: string
  failureReason?: string
}

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const rider = await currentRider()
  if (!rider) {
    return NextResponse.json({ message: 'Sign in to move a drop.' }, { status: 401 })
  }

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: 'That drop reference is not valid.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const to = String(body.to ?? '') as DispatchStatus
  if (!DISPATCH_STATUSES.includes(to)) {
    return NextResponse.json({ message: 'That is not a step in a delivery.' }, { status: 400 })
  }

  try {
    const updated = await transitionStatus({
      dispatchId: Number(id),
      to,
      actorKind: 'rider',
      actorLabel: rider.name,
      // The session's rider, never anything from the body. Ownership is asserted
      // inside the same locked row read that performs the transition — see
      // `transitionStatus`.
      actorRiderId: rider.id,
      failureReason: body.failureReason ?? null,
    })

    return NextResponse.json({
      ok: true,
      dispatchId: updated.id,
      status: updated.status,
      pickedUpAt: updated.pickedUpAt,
      outForDeliveryAt: updated.outForDeliveryAt,
    })
  } catch (err) {
    if (err instanceof TransitionError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: err.status })
    }

    const raw = (err as { message?: string }).message ?? ''
    // The illegal-transition trigger's message is written for us to show a
    // rider: it explains what cannot happen and why. Everything else is internal.
    if (raw.includes('Illegal dispatch transition') || raw.includes('[upvvan]')) {
      return NextResponse.json({ message: raw.replace('[upvvan] ', '') }, { status: 409 })
    }

    console.error('[rider/transition] failed:', raw)
    return NextResponse.json(
      { message: 'That did not save. Nothing has changed — try again.' },
      { status: 500 },
    )
  }
}
