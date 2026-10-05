import { NextResponse } from 'next/server'

import { clientIp } from '@/lib/orders/client-ip'
import { orderCookie } from '@/lib/orders/cookie'
import { db, normaliseCode, phoneTail } from '@/lib/orders/db'
import { consume } from '@/lib/orders/rate-limit'
import { PaymentGatewayConfig, paymentGateway } from '@/lib/payments/gateway'
import { paymentConfig } from '@/lib/payments/config'

/**
 * POST /api/payments/intent — create a payment intent for an existing order.
 *
 * ── WHY AN INTENT IS CREATED HERE AND NOT INSIDE POST /api/orders ────────────
 *
 * Because creating an intent is not taking money, and the two must be separable
 * to be honest. The order is real the moment the customer submits checkout; the
 * payment is real only when capture succeeds. Collapsing them is what produced the
 * original bug — a checkout that said "Order placed" while the response body said
 * `paymentState: 'awaiting_gateway'`, so the UI and the API disagreed and the UI
 * won.
 *
 * ── AUTHORISATION ───────────────────────────────────────────────────────────
 * Code PLUS the phone on the order, same as order lookup. The order code alone is
 * 48 bits of CSPRNG — unguessable, not authorised. An intent for someone else's
 * order would let an attacker make a stranger's order look charged, which is a
 * fraud primitive and not merely an information leak.
 */

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    orderCode?: string
    phone?: string
  }

  const code = normaliseCode(String(body.orderCode ?? ''))
  const tail = phoneTail(String(body.phone ?? ''))

  if (!code || !tail) {
    return NextResponse.json(
      { message: 'Enter your order code and the phone number on the order.' },
      { status: 400 },
    )
  }

  /*
   * Rate limit BEFORE the database query.
   *
   * The order of these two operations is the whole control. Querying first and
   * then limiting still lets an attacker make the database do the work; the
   * limiter is there to make the guessing expensive, so it has to run first.
   */
  const ip = clientIp(request)
  const limit = consume(ip, 'payment-intent')
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const pool = db()

  const order = await pool.query<{
    id: number
    order_code: string
    status: string
    revenue_paise: string
    payment_state: string | null
    payment_intent_id: string | null
  }>(
    `SELECT "id", "order_code", "status", "revenue_paise", "payment_state", "payment_intent_id"
       FROM "orders"
      WHERE "order_code" = $1
        AND right(regexp_replace("customer_phone"::text, '\\D', '', 'g'), 4) = $2`,
    [code, tail],
  )

  const row = order.rows[0]
  if (!row) {
    // One message for "no such order" and "wrong phone". Distinguishing them
    // turns this endpoint into an oracle for confirming which codes are real,
    // which is precisely the enumeration the random code exists to prevent.
    return NextResponse.json(
      { message: 'We could not find an order with that code and phone number.' },
      { status: 404 },
    )
  }

  if (row.payment_state === 'captured') {
    // Already paid. Returning the same answer as a fresh intent would invite a
    // second charge for one order, which is the failure mode a double-tapped pay
    // button produces.
    return NextResponse.json(
      {
        orderCode: row.order_code,
        paymentState: 'captured',
        message: 'This order has already been paid.',
      },
      { status: 200 },
    )
  }

  if (row.status === 'CANCELLED') {
    return NextResponse.json(
      { message: 'This order was cancelled. Nothing further will be charged.' },
      { status: 409 },
    )
  }

  const cfg: PaymentGatewayConfig = paymentConfig()

  // INTEGER PAISE, coerced and asserted. A `numeric` column arrives from the pg
  // driver as a string, and a gateway that accepts 199.5 is a gateway that rounds.
  const amountPaise = Number(row.revenue_paise)
  if (!Number.isInteger(amountPaise)) {
    console.error(
      `[payments] order ${row.order_code} has non-integer revenue_paise (${row.revenue_paise}); refusing to create an intent`,
    )
    return NextResponse.json(
      { message: 'We could not start the payment for this order. Please contact us.' },
      { status: 500 },
    )
  }

  const intent = await paymentGateway.createIntent(row.order_code, amountPaise)

  // The intent id is persisted so capture is idempotent and so support can match
  // a customer's screenshot to a charge. NOT the money — the money is not moved.
  await pool.query(
    `UPDATE "orders"
        SET "payment_intent_id" = $2,
            "payment_state" = 'created',
            "payment_failure_code" = NULL,
            "updated_at" = now()
      WHERE "id" = $1`,
    [row.id, intent.id],
  )

  const res = NextResponse.json({
    orderCode: row.order_code,
    intentId: intent.id,
    /** INTEGER PAISE. The client formats it; it must never send a rupee figure back. */
    amountPaise: intent.amountPaise,
    currency: intent.currency,
    paymentState: intent.state,
    provider: intent.provider,
    // Honest, and the reason the order page can render "Payment pending".
    simulated: cfg.provider === 'simulated',
  })

  // The caller has just proved code + phone here too, so they get the same signed
  // cookie. By the time capture succeeds and they land on /order/<code>, the clean
  // URL is already authorised and no phone ever reaches the address bar.
  res.cookies.set(orderCookie(row.order_code))
  return res
}
