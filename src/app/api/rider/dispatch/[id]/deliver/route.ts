import { NextResponse } from 'next/server'

import { isClaimEvidenceKind, OTP_LENGTH } from '@/lib/dispatch/otp'
import { TransitionError, verifyDeliveryOtp } from '@/lib/dispatch/store.server'
import { currentRider } from '@/lib/dispatch/session.server'

/**
 * POST /api/rider/dispatch/[id]/deliver — close a delivery with the customer's code.
 *
 * ── THIS ENDPOINT IS THE WHOLE ANTI-FRAUD DESIGN ───────────────────────────
 *
 * "Order marked delivered but not received" is the loudest complaint in the nine
 * research files, and it is what produced Urvann's 2.1/5. They answered it with a
 * ₹100 penalty in a 3PL contract. A penalty is a confession: it is written by an
 * operator who has worked out that lying is cheaper than delivering, and pricing
 * the lie does not change which action is cheaper for the rider on a busy evening.
 *
 * So there is no penalty here and no way to mark a delivery delivered without the
 * CUSTOMER's code. The code is on the customer's phone, which the rider does not
 * have, so the only route to DELIVERED runs through a conversation at the door
 * that the customer is part of. That is the control: not a threat delivered after
 * the event, but a requirement that the honest path is the only path.
 *
 * Three properties make it hold rather than merely exist:
 *
 *   1. The database refuses `status='DELIVERED'` without a verified OTP
 *      (`trg_dispatch_delivered_requires_otp`). No code path, no direct write,
 *      and no future refactor can reach DELIVERED around this.
 *   2. The close-out is appended to `dispatch_events`, which rejects UPDATE and
 *      DELETE unconditionally. A mutable boolean can be flipped back; a ledger
 *      cannot.
 *   3. Ownership is asserted inside the locked read, so one rider cannot close
 *      another's drop even with a valid code.
 *
 * The audit trail exists to settle a disputed delivery. It is NOT aimed at the
 * rider, and there is no penalty regime anywhere in this system to aim.
 */

interface Params {
  params: Promise<{ id: string }>
}

interface Body {
  code?: string
  claimEvidenceKind?: string
  claimEvidenceNote?: string
}

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const rider = await currentRider()
  if (!rider) {
    return NextResponse.json({ message: 'Sign in to close a delivery.' }, { status: 401 })
  }

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: 'That drop reference is not valid.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as Body

  // Shape-checked, not sanitised. A code that is not exactly the configured
  // length never reaches scrypt — a length check is cheaper and clearer than a
  // regex, and the length is configuration, so this stays correct if OTP_LENGTH
  // changes.
  const code = String(body.code ?? '').trim()
  if (code.length !== OTP_LENGTH || !/^\d+$/.test(code)) {
    return NextResponse.json(
      { message: `Enter the ${OTP_LENGTH}-digit code the customer received.` },
      { status: 400 },
    )
  }

  // A rider could post any value here; it is validated against the vocabulary
  // rather than trusted. `customer_declined` in particular is a value we record
  // honestly and never infer — it is how the refusal rate stays visible.
  const evidence = isClaimEvidenceKind(body.claimEvidenceKind)
    ? body.claimEvidenceKind
    : 'unboxing_video_requested'

  const note =
    typeof body.claimEvidenceNote === 'string' && body.claimEvidenceNote.trim() !== ''
      ? body.claimEvidenceNote.trim().slice(0, 500)
      : null

  try {
    const updated = await verifyDeliveryOtp({
      dispatchId: Number(id),
      code,
      actorKind: 'rider',
      actorLabel: rider.name,
      actorRiderId: rider.id,
      claimEvidenceKind: evidence,
      claimEvidenceNote: note,
    })

    return NextResponse.json({
      ok: true,
      dispatchId: updated.id,
      status: updated.status,
      deliveredAt: updated.deliveredAt,
      // The payout comes back on the close-out, not only at the start of the
      // run. A rider who is unsure what they earned should never have to guess,
      // and an incentive that is invisible at the moment of work is an incentive
      // that stops being trusted within a week.
      bandCode: updated.bandCode,
      payoutPaise: updated.payoutPaise,
      message: `Delivered. ${updated.orderCode} is closed.`,
    })
  } catch (err) {
    if (err instanceof TransitionError) {
      // These messages are written for the rider standing at the door. They name
      // the next action rather than the failure.
      return NextResponse.json({ message: err.message, code: err.code }, { status: err.status })
    }

    const raw = (err as { message?: string }).message ?? ''
    if (raw.includes('[upvvan]')) {
      return NextResponse.json({ message: raw.replace('[upvvan] ', '') }, { status: 409 })
    }

    console.error('[rider/deliver] failed:', raw)
    return NextResponse.json(
      { message: 'That did not save. Nothing has changed — ask the dispatcher for help.' },
      { status: 500 },
    )
  }
}
