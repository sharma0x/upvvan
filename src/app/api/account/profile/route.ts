import { NextResponse } from 'next/server'

import { getCustomerId } from '@/lib/auth/session'
import { adoptGuestOrders, updateProfile, validateProfile } from '@/lib/accounts/profile'

/**
 * /api/account/profile — the customer's own name and e-mail.
 *
 * ── WHY THIS IS A ROUTE ─────────────────────────────────────────────────────
 *
 * Because `updateUser` needs the raw incoming `Cookie` header, and a Server
 * Action body does not carry it the way `auth.api.*` expects. The same shape as
 * `/api/addresses`: an authenticated, allowlisted, rate-limited path that both
 * the profile form and any future client can call.
 *
 * ── WHY `adoptGuestOrders` RIDES ALONG ──────────────────────────────────────
 *
 * A customer who checked out as a guest and THEN signed in has an account with
 * no orders in it, which is the single most confusing state this product can put
 * a buyer in. Linking by verified phone is the whole fix, and doing it here means
 * it happens at the moment the customer does something deliberate ("save my
 * details") rather than on a timer.
 *
 * It is idempotent and it only fills a NULL `customer_id`, so calling it on every
 * save costs one indexed UPDATE that matches nothing after the first time.
 */

/**
 * Customer-facing copy, matched EXACTLY.
 *
 * The allowlist is the control AGENTS.md asks for: an error string from a
 * library, a driver or a constraint must never become the text on a customer's
 * screen. A denylist would fail the first time somebody writes a new error;
 * an allowlist fails safe.
 */
const CUSTOMER_SAFE_MESSAGES = new Set([
  'Sign in to edit your profile.',
  'Tell us your name so the rider knows who to ask for.',
  'That name is too long.',
  'That does not look like a name.',
  'That email address is too long.',
  'That does not look like an email address. Leave it blank if you prefer SMS.',
])

const GENERIC = 'We could not save that just now. Please try again.'

function toResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err)

  if (err instanceof Error && CUSTOMER_SAFE_MESSAGES.has(message)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }

  console.error('[account/profile] unhandled error:', err)
  return NextResponse.json({ error: GENERIC }, { status: 500 })
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getCustomerId())) {
    return NextResponse.json({ error: 'Sign in to edit your profile.' }, { status: 401 })
  }

  try {
    const input = validateProfile(await request.json())
    await updateProfile(input)
    const adopted = await adoptGuestOrders()
    return NextResponse.json({ ok: true, adoptedOrders: adopted })
  } catch (err) {
    return toResponse(err)
  }
}
