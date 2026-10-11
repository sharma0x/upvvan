import { NextResponse } from 'next/server'

import { clientIp } from '@/lib/orders/client-ip'
import { loadBusinessSettings } from '@/lib/settings/server'
import { sendEmail } from '@/lib/email/send'
import { customerMailbox } from '@/lib/email/address'
import { orderConfirmation } from '@/lib/email/templates'
import { config } from '@/lib/config'
import { db, databaseOrderStatuses, normaliseCode, phoneTail } from '@/lib/orders/db'
import { consume } from '@/lib/orders/rate-limit'
import { appendEvent } from '@/lib/orders/db'
import {
  assertTransition,
  canonicalStatus,
  missingEnumValueError,
  supportsDatabaseStatus,
  type OrderStatus,
} from '@/lib/orders/status'
import { customerMessageFor, paymentGateway, type SimulatedOutcome } from '@/lib/payments/gateway'

/**
 * POST /api/payments/capture — authorise and capture, or fail honestly.
 *
 * ── THIS ROUTE IS THE WHOLE POINT ────────────────────────────────────────────
 *
 * It is the single place where an order stops being "awaiting payment". Before
 * it existed, `POST /api/orders` returned `paymentState: 'awaiting_gateway'` and
 * the order page rendered "Order placed" regardless — the API said pending, the UI
 * said done, and the UI won because the customer only ever sees the UI.
 *
 * So the rules are narrow and deliberate:
 *
 *   · An order may only reach PAID from PAYMENT_PENDING, and that transition is
 *     checked by `assertTransition` — the same table every other writer uses.
 *   · The status write is refused if the Postgres enum cannot hold the value, so
 *     a half-applied migration surfaces as an explicit error naming the missing
 *     enum value rather than as an order stuck in PLACED forever.
 *   · A DECLINE does not advance the order and does not roll it back. It leaves
 *     the order payable, because a customer's card being refused at 11pm is not a
 *     reason to make them rebuild their cart.
 *   · Capture is IDEMPOTENT. A double-tapped button, a retried webhook, a refresh
 *     mid-flight — all resolve to one charge.
 *
 * ── WHY THE STATUS UPDATE AND THE EVENT INSERT SHARE A TRANSACTION ───────────
 *
 * An order marked PAID with no timeline entry is an order whose receipt shows a
 * paid total and an empty "what happens next" — the customer concludes money moved
 * and nothing was sent. One transaction, both rows, or neither.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    intentId?: string
    orderCode?: string
    phone?: string
    /**
     * 'success' | 'decline'. Accepted ONLY because the gateway is simulated;
     * a real PSP would decide this, not the browser. It exists so the decline UI
     * is reachable in a test — an error path that cannot be exercised is an
     * error path that is broken.
     */
    simulate?: string
  }

  const code = normaliseCode(String(body.orderCode ?? ''))
  const intentId = String(body.intentId ?? '').trim()
  const tail = phoneTail(String(body.phone ?? ''))

  if (!code || !tail || !intentId) {
    return NextResponse.json(
      { message: 'Enter your order code and the phone number on the order.' },
      { status: 400 },
    )
  }

  const simulate: SimulatedOutcome = body.simulate === 'decline' ? 'decline' : 'success'

  const limit = consume(clientIp(request), 'payment-capture')
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const pool = db()

  const found = await pool.query<{
    id: number
    order_code: string
    status: string
    revenue_paise: string
    payment_intent_id: string | null
    payment_state: string | null
    payment_captured_at: Date | null
  }>(
    `SELECT "id", "order_code", "status", "revenue_paise", "payment_intent_id",
            "payment_state", "payment_captured_at"
       FROM "orders"
      WHERE "order_code" = $1
        AND right(regexp_replace("customer_phone"::text, '\\D', '', 'g'), 4) = $2`,
    [code, tail],
  )

  const order = found.rows[0]
  if (!order) {
    return NextResponse.json(
      { message: 'We could not find an order with that code and phone number.' },
      { status: 404 },
    )
  }

  /*
   * ── IDEMPOTENCY ───────────────────────────────────────────────────────────
   * Checked BEFORE the intent is handed to the gateway, so a repeat call never
   * even asks the (simulated) gateway to move money. Checking afterwards would
   * rely on the gateway being idempotent too, which is a property we want rather
   * than a property we depend on.
   */
  if (order.payment_state === 'captured') {
    return NextResponse.json({
      orderCode: order.order_code,
      paymentState: 'captured',
      status: canonicalStatus(order.status),
      capturedAt: order.payment_captured_at,
      message: 'Payment already received. Nothing further was charged.',
    })
  }

  if (order.status === 'CANCELLED') {
    return NextResponse.json(
      { message: 'This order was cancelled. Nothing further will be charged.' },
      { status: 409 },
    )
  }

  /*
   * The intent must be OURS and it must be FOR THIS ORDER.
   *
   * A caller-supplied intent id is otherwise an authorisation bypass: capture an
   * intent created for a cheap order against an expensive one and the money
   * recorded is the wrong amount. The gateway amount is compared to the order's
   * revenue, and a mismatch is refused rather than reconciled — we do not silently
   * charge a different number than the customer agreed to.
   */
  if (order.payment_intent_id && order.payment_intent_id !== intentId) {
    return NextResponse.json(
      { message: 'This payment is not the one for that order. Start the payment again.' },
      { status: 409 },
    )
  }

  const intent = paymentGateway.get(intentId)
  if (!intent) {
    // The in-memory gateway forgets intents on restart (documented in gateway.ts).
    // That is acceptable for a simulator and unacceptable for a real PSP, so the
    // message tells the customer to restart rather than implying a lost payment.
    return NextResponse.json(
      { message: 'This payment session has expired. Start the payment again.' },
      { status: 409 },
    )
  }

  if (intent.orderCode !== order.order_code) {
    return NextResponse.json({ message: 'This payment is not for that order.' }, { status: 409 })
  }

  const orderRevenuePaise = Number(order.revenue_paise)
  if (intent.amountPaise !== orderRevenuePaise) {
    console.error(
      `[payments] intent ${intentId} is for ${intent.amountPaise}p but order ${order.order_code} is ${orderRevenuePaise}p`,
    )
    return NextResponse.json(
      { message: 'The payment amount does not match your order. Nothing was charged.' },
      { status: 409 },
    )
  }

  // ── talk to the gateway ────────────────────────────────────────────────────
  const settled = await paymentGateway.capture(intent, simulate)

  // ── THE DECLINE PATH ───────────────────────────────────────────────────────
  if (settled.state === 'failed') {
    const failureCode = settled.failureCode ?? 'CARD_DECLINED'

    /*
     * The order is NOT advanced and NOT cancelled. It stays PAYMENT_PENDING and
     * stays payable, and the customer is told plainly that nothing was charged.
     *
     * The failure code is persisted and the MESSAGE is generated from it by the
     * payments module. The code never crosses to the client — a gateway decline
     * code in a customer-facing JSON body is an inventory of our PSP integration,
     * and "INSUFFICIENT_FUNDS" tells a customer things about their bank account
     * that we learned from a code, not from them.
     */
    await pool.query(
      `UPDATE "orders"
          SET "payment_state" = 'failed',
              "payment_failure_code" = $2,
              "updated_at" = now()
        WHERE "id" = $1`,
      [order.id, failureCode],
    )

    await pool.query(
      `INSERT INTO "order_events" ("order_id", "status", "note", "actor", "created_at")
       VALUES ($1, 'PAYMENT_PENDING', $2, 'payment', now())`,
      [order.id, 'Payment attempt did not go through. Nothing was charged.'],
    )

    return NextResponse.json(
      {
        orderCode: order.order_code,
        paymentState: 'failed',
        status: canonicalStatus(order.status),
        // Customer-facing prose. NOT the code.
        message: customerMessageFor(failureCode),
      },
      { status: 402 },
    )
  }

  if (settled.state !== 'captured' || !settled.capturedAt) {
    // 'created' or 'processing' — the gateway has not confirmed a charge, so the
    // order must not claim it has. Returning 202 rather than 200 is the difference
    // between "keep polling" and "you are paid".
    return NextResponse.json(
      {
        orderCode: order.order_code,
        paymentState: settled.state,
        message: 'Your payment is still being confirmed. We will email you the moment it clears.',
      },
      { status: 202 },
    )
  }

  // ── THE CAPTURE PATH ───────────────────────────────────────────────────────
  const from = canonicalStatus(order.status)

  /*
   * Refuse the transition BEFORE writing anything.
   *
   * `assertTransition` throws on an illegal move, and it throws rather than
   * returning false because a route that forgets to check a boolean is exactly the
   * bug this table was written to prevent. The message names both statuses and the
   * legal successors, so a failure here is diagnosable from a log line alone.
   */
  try {
    assertTransition(from, 'PAID')
  } catch (err) {
    console.error(`[payments] capture refused for ${order.order_code}:`, (err as Error).message)
    return NextResponse.json(
      {
        message:
          'We received your payment but could not confirm the order automatically. Our team has it and will call you — nothing further will be charged.',
      },
      { status: 500 },
    )
  }

  /*
   * The enum check. If the four new enum values have not been applied, this write
   * would fail at the driver with
   * `invalid input value for enum orders_status: "PAID"`, which reaches the
   * customer as a 500 with no explanation. Checking first turns that into a named
   * migration requirement in our own logs.
   */
  const supported = await databaseOrderStatuses(pool)
  if (!supportsDatabaseStatus(supported, 'PAID' as OrderStatus)) {
    console.error(missingEnumValueError('PAID').message)
    return NextResponse.json(
      {
        message:
          'We received your payment and could not confirm the order automatically. Our team has it and will call you — nothing further will be charged.',
      },
      { status: 500 },
    )
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    /*
     * Re-read the status INSIDE the transaction with the row locked.
     *
     * The status was read outside, so two concurrent captures of the same intent
     * both saw PAYMENT_PENDING. `FOR UPDATE` serialises them: the second waits, then
     * re-reads PAID, and the transition check below refuses it. Without the lock
     * the transition table is advisory and we are back to relying on the caller.
     */
    const locked = await client.query<{ status: string }>(
      `SELECT "status" FROM "orders" WHERE "id" = $1 FOR UPDATE`,
      [order.id],
    )
    const lockedFrom = canonicalStatus(locked.rows[0]!.status)
    if (lockedFrom !== 'PAYMENT_PENDING') {
      await client.query('ROLLBACK')
      return NextResponse.json(
        {
          orderCode: order.order_code,
          paymentState: 'captured',
          status: lockedFrom,
          message: 'Payment already received. Nothing further was charged.',
        },
        { status: 200 },
      )
    }

    await client.query(
      `UPDATE "orders"
          SET "status" = 'PAID',
              "payment_state" = 'captured',
              "payment_reference" = $2,
              "payment_captured_at" = $3,
              "payment_failure_code" = NULL,
              "updated_at" = now()
        WHERE "id" = $1`,
      [order.id, settled.gatewayPaymentId ?? null, settled.capturedAt],
    )

    await appendEvent(client, {
      orderId: order.id,
      status: 'PAID',
      note: 'Payment received in full. Your plant is reserved for packing.',
      actor: 'payment',
    })

    await client.query('COMMIT')

    /*
     * ── THE RECEIPT, AFTER THE COMMIT AND NOT AWAITED ──────────────────────
     *
     * The customer's confirmation was already sent when the order was placed; this
     * is the one that says the money moved, and it carries the gateway's reference
     * so a screenshot of their bank statement is enough for support to find the
     * charge.
     *
     * Placed here for the same reason as in `POST /api/orders`: never inside the
     * transaction (a row lock held across an SMTP round trip), never awaited (a
     * payment response whose latency the customer pays for), and never able to
     * throw — an e-mail failure here must not turn a captured payment into an
     * error page, because that is how a real charge becomes a disputed one.
     *
     * Failures land in `email_log` with status 'failed' and a re-send button, so
     * the gap is visible and closable rather than silent.
     */
    void sendReceipt(order.order_code).catch((err: unknown) => {
      console.error('[payments] receipt notification failed:', err)
    })

    return NextResponse.json({
      orderCode: order.order_code,
      paymentState: 'captured',
      status: 'PAID',
      capturedAt: settled.capturedAt,
      // The gateway's own reference. Shown to the customer so a screenshot is
      // enough for support to find the charge — that is the entire point of
      // keeping it.
      paymentReference: settled.gatewayPaymentId,
      message: 'Payment received.',
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})

    // NEVER surface err.message. A CHECK violation here means the order was
    // captured without a name, phone or address — `orders_captured_payment_has_contact`
    // — and the wording of that message is an inventory of our schema.
    console.error('[payments] capture transaction failed:', (err as Error).message)

    return NextResponse.json(
      {
        message:
          'We received your payment and could not confirm the order automatically. Our team has it and will call you — nothing further will be charged.',
      },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}

/**
 * The receipt e-mail, and a re-read of everything the template needs.
 *
 * ── WHY IT RE-READS THE ORDER RATHER THAN RECEIVING IT ──────────────────────
 *
 * Because the capture handler's row was read BEFORE the transaction and carries
 * none of it — no name, no phone, no items. Passing the values it happens to hold
 * would produce a receipt that is missing half of what it should say, which is
 * worse than no receipt: it looks like a system that does not know what it sold.
 *
 * One extra query on a path that has already spoken to a payment gateway is
 * nothing, and it means the receipt is correct even if the caller is not.
 */
async function sendReceipt(orderCode: string): Promise<void> {
  const settings = await loadBusinessSettings()

  const { rows } = await db().query<{
    order_code: string
    customer_name: string
    customer_phone: string
    revenue_paise: string
    address_line1: string
    address_line2: string | null
    address_landmark: string | null
    address_city: string | null
    pincode: string
    city_name: string | null
  }>(
    `SELECT o."order_code", o."customer_name", o."customer_phone", o."revenue_paise",
            o."address_line1", o."address_line2", o."address_landmark",
            o."address_city", o."pincode", c."name" AS city_name
       FROM "orders" o
       LEFT JOIN "cities" c ON c."id" = o."city_id"
      WHERE o."order_code" = $1`,
    [orderCode],
  )
  const order = rows[0]
  if (!order) return

  const items = await db().query<{
    display_name: string
    price_paise: string
    planter_name: string | null
    size_tier: string
  }>(
    `SELECT COALESCE(NULLIF(sp."common_name", ''), NULLIF(btrim(k."description"), ''), k."sku_code")
              AS display_name,
            i."price_paise", p."name" AS planter_name, k."size_tier"
       FROM "orders_items" i
       JOIN "skus" k ON k."id" = i."sku_id"
       LEFT JOIN "species" sp ON sp."id" = k."species_id"
       LEFT JOIN "planters" p ON p."id" = i."planter_id"
      WHERE i."_parent_id" = (SELECT "id" FROM "orders" WHERE "order_code" = $1)
      ORDER BY i."_order"`,
    [orderCode],
  )

  const base = config.server.url.replace(/\/$/, '')
  const template = orderConfirmation({
    orderCode: order.order_code,
    customerName: order.customer_name,
    lines: items.rows.map((i) => ({
      name: i.display_name,
      variant: [i.size_tier === 'XS' ? '' : `${i.size_tier} size`, i.planter_name]
        .filter(Boolean)
        .join(' · '),
      quantity: 1,
      linePaise: Number(i.price_paise),
    })),
    subtotalPaise: Number(order.revenue_paise),
    deliveryPaise: 0,
    totalPaise: Number(order.revenue_paise),
    addressLines: [
      order.address_line1,
      order.address_line2,
      order.address_landmark,
      order.address_city,
      order.pincode,
    ].filter((l): l is string => Boolean(l && l.trim() !== '')),
    cityName: order.city_name ?? '',
    estimatedWindow: 'next working day, or the same day if you order before the cutoff',
    supportPhone: settings.customerCarePhone || 'our published number',
    trackUrl: `${base}/track-order`,
    receiptUrl: `${base}/order/${order.order_code}`,
  })

  await sendEmail({
    kind: 'order_receipt',
    to: customerMailbox(order.customer_name, order.customer_phone),
    toName: order.customer_name,
    subject: `Payment received · ${order.order_code}`,
    text: template.text,
    html: template.html,
  })
}
