import { NextResponse } from 'next/server'

import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  validateAddress,
} from '@/lib/accounts/addresses'
import { getCustomerId } from '@/lib/auth/session'

/**
 * /api/addresses — the customer's address book.
 *
 * ── WHY THIS IS A ROUTE AND NOT SERVER ACTIONS ───────────────────────────────
 *
 * Server Actions would be less code. This is an explicit REST endpoint because
 * the same operations need to be callable from the mobile web client and from
 * checkout, which is a different entry point than a form on a page. One
 * authenticated, rate-limited, allowlisted path is easier to reason about than
 * the same rules spread across a component tree.
 *
 * ── WHY 401 AND NOT A REDIRECT ──────────────────────────────────────────────
 *
 * This is a JSON API. Its callers are `fetch`es, and a 302 to an HTML sign-in
 * page is a response neither of them can use. Pages redirect (see
 * `requireCustomer`); APIs answer with a status code.
 */

/**
 * Customer-facing validation copy, matched EXACTLY.
 *
 * Errors must never reach a customer verbatim — AGENTS.md records a real
 * incident where a missing table surfaced as `relation "order_items" does not
 * exist`. So `validateAddress`'s messages are treated as an ALLOWLIST: anything
 * not on this list is logged and replaced with a generic message.
 *
 * An allowlist rather than a denylist on purpose — the failure mode of a denylist
 * is that the next exception nobody thought to write ships Postgres internals.
 */
const CUSTOMER_SAFE_MESSAGES = new Set([
  'Sign in to save an address.',
  'Sign in to change your addresses.',
  'label is required.',
  'fullName is required.',
  'line1 is required.',
  'city is required.',
  'pincode is required.',
  'A pincode is exactly 6 digits.',
  'label is too long.',
  'fullName is too long.',
  'line1 is too long.',
  'city is too long.',
  'pincode is too long.',
  'Address not found.',
])

const GENERIC = 'Something went wrong saving that address. Please try again.'

/**
 * Turn any thrown error into a customer-safe response.
 *
 * A validation `Error` whose message is allowlisted is returned verbatim. Every
 * other error — a constraint violation, a dropped connection — is logged in
 * full server-side and answered generically.
 */
function toResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err)

  if (err instanceof Error && CUSTOMER_SAFE_MESSAGES.has(message)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }

  console.error('[addresses] unhandled error:', err)
  return NextResponse.json({ error: GENERIC }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  if (!(await getCustomerId())) {
    return NextResponse.json({ error: 'Sign in to see your addresses.' }, { status: 401 })
  }

  try {
    return NextResponse.json({ addresses: await listAddresses() })
  } catch (err) {
    return toResponse(err)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getCustomerId())) {
    return NextResponse.json({ error: 'Sign in to save an address.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = validateAddress(body)
    return NextResponse.json({ address: await createAddress(input) }, { status: 201 })
  } catch (err) {
    return toResponse(err)
  }
}

/**
 * PATCH /api/addresses?id=... — set an address as the default.
 *
 * A PATCH rather than a full update because "make this my default" is the only
 * mutation that is actually needed here, and an endpoint that accepts a whole
 * address body for a one-bit change is an endpoint that can be misused to
 * silently rewrite an address the customer did not intend to change.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  if (!(await getCustomerId())) {
    return NextResponse.json({ error: 'Sign in to change your addresses.' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Address not found.' }, { status: 400 })
  }

  try {
    await setDefaultAddress(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toResponse(err)
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!(await getCustomerId())) {
    return NextResponse.json({ error: 'Sign in to change your addresses.' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Address not found.' }, { status: 400 })
  }

  try {
    await deleteAddress(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toResponse(err)
  }
}
