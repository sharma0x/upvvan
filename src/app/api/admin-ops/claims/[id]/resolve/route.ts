import { NextResponse } from 'next/server'

import { currentStaff } from '@/lib/dispatch/session.server'
import { ClaimTriageError, isClaimOutcome, resolveClaim } from '@/lib/claims/triage'

/**
 * POST /api/admin-ops/claims/<id>/resolve — decide a claim.
 *
 * ── WHY THIS ROUTE IS THE MOST IMPORTANT MISSING PIECE IN THE PRODUCT ────────
 *
 * A customer could open a claim. Nothing could ever close it.
 *
 * `POST /api/claims` writes `order_claims.status = 'OPEN'` and moves the order to
 * `CLAIM_OPEN`. No other code path in the repository wrote that column again, and
 * `order_claims` has no Payload collection — so there was no admin screen, no
 * route, and no button anywhere.
 *
 * Because `assertTransition` only allows `CLAIM_OPEN → REPLACEMENT_QUEUED |
 * DELIVERED`, the consequences were all downstream of one missing route:
 *
 *   · the order was pinned at `CLAIM_OPEN` forever,
 *   · a SECOND claim returned 409 — "we already have a claim open and it is
 *     being handled" — about a claim nobody was handling,
 *   · the guarantee could not be honoured, because honouring it means queueing a
 *     replacement and nothing in the system could queue anything.
 *
 * The support model this business sells is "a human answers". A claim a human
 * cannot answer is not a slow answer; it is the opposite of the promise.
 *
 * ── WHY IT IS STAFF-ONLY ─────────────────────────────────────────────────────
 *
 * It writes the order lifecycle and sends a message to a customer. Both are
 * things a customer must not be able to do about themselves — the whole claim
 * flow exists so that a person decides, using a photo and a context that only
 * they have.
 *
 * ── WHY `rejected` REQUIRES A NOTE ──────────────────────────────────────────
 *
 * Because the rejection is the one path that can do real damage. A claim rejected
 * with no recorded reason is indistinguishable, six months later, from a claim
 * ignored. The note is stored on the row and quoted in the e-mail, so the
 * customer's "ask for a grower" escalation has something to appeal against.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const staff = await currentStaff()
  if (!staff) {
    return NextResponse.json(
      { message: 'Sign in to the ops console to resolve claims.' },
      { status: 401 },
    )
  }

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: 'That claim is not valid.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    outcome?: unknown
    note?: unknown
  }

  if (!isClaimOutcome(body.outcome)) {
    return NextResponse.json(
      { message: 'Choose one: accept it, queue a replacement, or reject it.' },
      { status: 400 },
    )
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 600) || null : null

  if (body.outcome === 'rejected' && !note) {
    return NextResponse.json(
      { message: 'Say why, in a sentence. The customer is told, and it is stored on the claim.' },
      { status: 400 },
    )
  }

  try {
    const result = await resolveClaim({
      claimId: Number(id),
      outcome: body.outcome,
      note,
      actor: staff.email ?? `staff#${staff.id}`,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        body.outcome === 'rejected'
          ? `${result.claimCode} rejected. The customer has been told why, and the guarantee on this delivery is still open.`
          : `${result.claimCode} accepted. The order is now ${result.orderStatus}.`,
    })
  } catch (err) {
    if (err instanceof ClaimTriageError) {
      return NextResponse.json({ message: err.message }, { status: err.status })
    }
    console.error('[claims/resolve] failed:', err)
    return NextResponse.json(
      { message: 'Could not resolve that claim. Nothing has changed — try again.' },
      { status: 500 },
    )
  }
}
