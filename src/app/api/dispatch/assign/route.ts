import { NextResponse } from 'next/server'

import { AssignmentError } from '@/lib/dispatch/assign'
import { createDispatch } from '@/lib/dispatch/store.server'
import { currentStaff } from '@/lib/dispatch/session.server'

/**
 * POST /api/dispatch/assign — hand an order to a rider.
 *
 * ── WHY THIS IS STAFF-ONLY AND UNCONDITIONALLY ─────────────────────────────
 * Every mutation here writes to `dispatch_events`, which is append-only. That
 * makes the ledger's integrity a function of who is allowed to write to it: one
 * unauthenticated path that can move a drop from ASSIGNED to anything is enough
 * for the whole audit trail to be worthless, because a trail that can be written
 * by anyone records nothing. So the identity check is a gate, not a nicety.
 *
 * ── ERRORS NEVER REACH THE OPERATOR VERBATIM ───────────────────────────────
 * `AssignmentError` messages ARE the operator-facing copy — they name the zone,
 * the band and what to do next, and they are written for a dispatcher standing
 * at a screen at 6pm. Everything else is logged and replaced with a generic
 * 500, for the reason AGENTS.md records: an `err.message` leak once reached a
 * customer as `relation "order_items" does not exist`.
 */

interface AssignBody {
  orderId?: string | number
  /** The routing engine's measured distance. See assign.ts on why this is required. */
  distanceKm?: number
  riderId?: string | number
}

export async function POST(request: Request): Promise<NextResponse> {
  const staff = await currentStaff()
  if (!staff) {
    return NextResponse.json(
      { message: 'Sign in to the ops console to assign a rider.' },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as AssignBody

  // Ids arrive as strings from a form post and as numbers from JSON. Validated
  // here rather than passed to Postgres: a bound parameter stops injection but
  // NOT a type error, and `WHERE id = 'abc'` raises 22P02 from the driver.
  const orderId = String(body.orderId ?? '').trim()
  if (!/^\d+$/.test(orderId)) {
    return NextResponse.json({ message: 'Which order?' }, { status: 400 })
  }

  const distanceKm = Number(body.distanceKm)
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return NextResponse.json(
      { message: 'Enter the drop distance in kilometres — the band and the rider pay both come from it.' },
      { status: 400 },
    )
  }

  const riderId = body.riderId != null ? String(body.riderId).trim() : undefined
  if (riderId != null && !/^\d+$/.test(riderId)) {
    return NextResponse.json({ message: 'That rider is not valid.' }, { status: 400 })
  }

  try {
    const assignment = await createDispatch({
      orderId: Number(orderId),
      distanceKm,
      forcedRiderId: riderId != null ? Number(riderId) : undefined,
      actorLabel: staff.email ?? `staff#${staff.id}`,
    })

    return NextResponse.json({
      ok: true,
      dispatchId: assignment.dispatchId,
      riderId: assignment.riderId,
      riderName: assignment.riderName,
      bandCode: assignment.bandCode,
      payoutPaise: assignment.payoutPaise,
      message: `${assignment.riderName} has it. Band ${assignment.bandCode}.`,
    })
  } catch (err) {
    // Business rules carry their own wording, and that wording is the copy the
    // operator should read.
    if (err instanceof AssignmentError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: 422 })
    }

    const raw = (err as { message?: string }).message ?? ''
    const isBusinessRule =
      raw.includes('already has a dispatch') ||
      raw.includes('does not exist') ||
      raw.includes('not active') ||
      raw.includes('does not deliver in this order') ||
      raw.includes('already holds') ||
      raw.includes('no longer configured')

    if (isBusinessRule) {
      return NextResponse.json({ message: raw }, { status: 422 })
    }

    console.error('[dispatch/assign] failed:', raw)
    return NextResponse.json(
      { message: 'Could not assign that drop. Nothing has changed — try again.' },
      { status: 500 },
    )
  }
}