import { NextResponse } from 'next/server'

import { clientIp } from '@/lib/orders/client-ip'
import { orderCookie } from '@/lib/orders/cookie'
import { db, loadOrder, normaliseCode, phoneTail } from '@/lib/orders/db'
import { consume } from '@/lib/orders/rate-limit'

/**
 * No module-scope `new Pool()`.
 *
 * This route module is pulled into the build graph by the page that renders it, and
 * a module-scope pool would open a database connection during `next build`.
 * `db()` memoises, so the pool is still created exactly once per process.
 *
 * GET /api/orders/lookup?orderCode=…&phone=…
 *
 * ── WHY CODE + PHONE AND NOT CODE ALONE ─────────────────────────────────────
 *
 * The code is now 48 bits of CSPRNG. That makes it unguessable, which is a
 * different property from "authorised". A code leaks routinely — a WhatsApp
 * forward, a screenshot in a group chat, a support agent pasting a link, browser
 * history on a shared laptop — and a leaked code that renders an address, a phone
 * number and an order history is a privacy incident.
 *
 * So the code is half the credential and the phone is the other half: something
 * the buyer knows and a screenshot-treader usually does not. The response is
 * deliberately limited — status, items, totals, timeline — and the full address is
 * only included because the buyer has just proved they are the buyer.
 *
 * ── WHY THE FAILURE MESSAGE IS IDENTICAL FOR BOTH CASES ─────────────────────
 *
 * "No such order" and "wrong phone" get the same 404 and the same sentence. If
 * they differed, this endpoint would confirm which codes exist, which restores the
 * exact enumeration the random code was introduced to close.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = normaliseCode(searchParams.get('orderCode') ?? '')
  const phone = searchParams.get('phone') ?? ''

  if (!code || !phoneTail(phone)) {
    return NextResponse.json(
      { message: 'Enter your order code and the phone number on the order.' },
      { status: 400 },
    )
  }

  /*
   * ── RATE LIMITING ─────────────────────────────────────────────────────────
   *
   * This endpoint is the one place a rate limiter genuinely matters, and the
   * reason is arithmetic rather than fear: the code is unguessable, but the phone
   * TAIL is four digits — 10,000 possibilities. Against a KNOWN code (from the
   * attacker's own order, or a leaked screenshot) an unlimited endpoint brute-forces
   * that space in minutes.
   *
   * The limiter is PER-INSTANCE IN MEMORY: it resets on restart and does not
   * coordinate across replicas. With a single process that is a real control; it is
   * documented rather than presented as a wall, and the database-backed replacement
   * is written out in src/lib/orders/rate-limit.ts.
   */
  const limit = consume(clientIp(request), 'order-lookup')
  if (!limit.allowed) {
    return NextResponse.json(
      {
        message: 'Too many attempts. Please wait a minute and try again.',
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const found = await loadOrder(db(), { orderCode: code, phone })

  if (!found) {
    return NextResponse.json(
      { message: 'We could not find an order with that code and phone number.' },
      { status: 404 },
    )
  }

  const res = NextResponse.json(
    {
      orderCode: found.order.orderCode,
      status: found.order.status,
      paymentState: found.order.paymentState,
      paymentReference: found.order.paymentReference,
      capturedAt: found.order.capturedAt,
      revenuePaise: found.order.revenuePaise,
      pincode: found.order.pincode,
      guaranteeTier: found.order.guaranteeTier,
      customerName: found.order.customerName,
      customerPhone: found.order.customerPhone,
      address: found.order.address,
      createdAt: found.order.createdAt,
      updatedAt: found.order.updatedAt,
      items: found.items,
      events: found.events,
    },
    { status: 200 },
  )

  /*
   * ── THE PROOF BECOMES A COOKIE ────────────────────────────────────────────
   *
   * This is where the phone stops travelling and starts being remembered. The
   * signed cookie lets `/order/<code>` render from a clean URL with nothing secret
   * in it — no history entry, no Referer leak, no phone in a pasted support link.
   *
   * Without this the order page would need `?phone=…` forever, which is a worse
   * answer than a 30-day cookie for the same information: the URL is captured by
   * proxies and screenshots, the cookie is not.
   */
  res.cookies.set(orderCookie(found.order.orderCode))
  return res
}
