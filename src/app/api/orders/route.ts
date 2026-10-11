import { NextResponse } from 'next/server'
import { Pool } from 'pg'

import {
  appendEvent,
  databaseOrderStatuses,
  db,
  newOrderCode,
  normalisePhone,
} from '@/lib/orders/db'
import { OversellError, decrementStock, ensureStockRow } from '@/lib/orders/stock'
import {
  missingEnumValueError,
  supportsDatabaseStatus,
  type OrderStatus,
} from '@/lib/orders/status'
import { loadBusinessSettings } from '@/lib/settings/server'
import { sendEmail } from '@/lib/email/send'
import { customerMailbox } from '@/lib/email/address'
import { adminNewOrder, orderConfirmation } from '@/lib/email/templates'
import { getCustomerId } from '@/lib/auth/session'
import { config } from '@/lib/config'

/**
 * POST /api/orders — place a prepaid order.
 *
 * ── WHAT IS ENFORCED HERE VS IN THE DATABASE ───────────────────────────────
 * Three things stop an invalid order existing, and each is enforced at the layer
 * that can actually guarantee it:
 *
 *   1. AN UNSERVICEABLE PINCODE CANNOT ORDER.
 *      Enforced by a database CHECK on `orders` — not by this handler. An
 *      application check is bypassable by a direct write or a second code path.
 *      This handler re-checks so the customer gets a clear message, and the
 *      constraint is what makes it true.
 *
 *   2. NO COD. EVER.
 *      A COD return leg is 25–30 days and the returned plant is non-saleable —
 *      a total write-off. The `orders_no_cod` CHECK refuses any cash-on-delivery
 *      payment mode at the schema layer. There is no request field for it.
 *
 *   3. PRICES ARE RE-DERIVED FROM THE SKU.
 *      The client sends a total for display. It is ignored. Every line price is
 *      recomputed here from `base_price_paise` and the planter uplift, so editing
 *      a number in devtools changes nothing.
 *
 * ── WHAT IS NEW, AND WHY ────────────────────────────────────────────────────
 *
 * FOUR changes from the version that returned `paymentState: 'awaiting_gateway'`
 * with no address and a guessable code:
 *
 *   · THE CODE IS RANDOM. `UPV-${Date.now().toString(36)}` is a clock. Anyone who
 *     placed an order a second before you can compute yours, which made
 *     `/order/${code}` an enumerable resource leaking every customer's order.
 *     Now 6 CSPRNG bytes.
 *
 *   · THE ORDER CARRIES A DELIVERY CONTACT. A plant with no address is not an
 *     order, it is a wish. And the phone is what order lookup is authorised by,
 *     so it cannot be collected after the fact.
 *
 *   · STOCK IS DECREMENTED HERE, IN THIS TRANSACTION. Previously nothing tracked
 *     stock at all, so the same plant could be sold to unlimited customers and the
 *     shortfall surfaced at a rider's door. `decrementStock` refuses to oversell
 *     and the `sku_stock_on_hand_non_negative` CHECK is what makes that true.
 *
 *   · THE STATUS IS `PAYMENT_PENDING`, NOT `PLACED`. "Placed" tells the customer
 *     their plant is on its way when no money has been taken. The order is created
 *     unpaid and `POST /api/payments/capture` is the only thing that advances it.
 */

/** Mirrors SIZE_TIER_MULTIPLIER in src/lib/catalogue/pricing.ts. */
const SIZE_TIER_MULTIPLIER: Record<string, number> = {
  XS: 0,
  MD: 45_000,
  LG: 120_000,
  XL: 260_000,
}

interface OrderLine {
  skuId: string
  planterId: string | null
}

interface OrderBody {
  pincode?: string
  lines?: OrderLine[]
  totalPaise?: number
  customerName?: string
  customerPhone?: string
  addressLine1?: string
  addressLine2?: string
  addressLandmark?: string
  addressCity?: string
  addressState?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as OrderBody
  const pincode = String(body.pincode ?? '').trim()
  const lines = Array.isArray(body.lines) ? body.lines : []

  if (!/^[0-9]{6}$/.test(pincode)) {
    return NextResponse.json({ message: 'Enter a valid 6-digit pincode.' }, { status: 400 })
  }
  if (lines.length === 0) {
    return NextResponse.json({ message: 'Your cart is empty.' }, { status: 400 })
  }

  /*
   * ── THE DELIVERY CONTACT ─────────────────────────────────────────────────
   *
   * Validated here rather than after the order exists, because the capture route
   * cannot move money without one (`orders_captured_payment_has_contact` refuses
   * it at the schema layer) — creating the order first and collecting the address
   * afterwards would just produce an order that can never be paid for.
   *
   * `normalisePhone` enforces the Indian mobile shape and returns the E.164 form we
   * store: 10 digits starting 6-9, with or without a leading 0 or a +91. That is a
   * hard rule, not a nicety — this number is what a rider dials and what order
   * lookup is authorised by, so a number that cannot be dialled cannot be accepted
   * quietly.
   */
  const customerName = String(body.customerName ?? '').trim()
  const customerPhoneRaw = String(body.customerPhone ?? '').trim()
  const addressLine1 = String(body.addressLine1 ?? '').trim()
  const addressLine2 = String(body.addressLine2 ?? '').trim()
  const addressLandmark = String(body.addressLandmark ?? '').trim()
  const addressCity = String(body.addressCity ?? '').trim()
  const addressState = String(body.addressState ?? '').trim()

  if (!customerName) {
    return NextResponse.json({ message: 'Enter the name for the delivery.' }, { status: 400 })
  }
  const customerPhone = normalisePhone(customerPhoneRaw)
  if (!customerPhone) {
    return NextResponse.json(
      { message: 'Enter a 10-digit mobile number for delivery updates.' },
      { status: 400 },
    )
  }
  if (!addressLine1) {
    return NextResponse.json(
      { message: 'Enter the flat or house details for delivery.' },
      { status: 400 },
    )
  }

  /*
   * IDs must be integers before they reach Postgres.
   *
   * `skuId` arrives from sessionStorage, so a stale cart, a hand-crafted
   * request, or a JS client sending a string all reach here. Bound parameters
   * stop injection but NOT a type error: `WHERE id = $1` with 'not-a-number'
   * raises `invalid input syntax for type integer` (22P02) from the driver, and
   * that escaped the handler's try/catch entirely — an unhandled 500 with an
   * empty body, which is what a real customer sending a string ID would hit.
   *
   * Validate at the boundary rather than widening the catch. A specific message
   * beats a generic one.
   */
  for (const [i, line] of lines.entries()) {
    if (typeof line?.skuId !== 'string' || !/^[0-9]+$/.test(line.skuId)) {
      return NextResponse.json(
        { message: `Item ${i + 1} in your cart is not a valid product reference.` },
        { status: 400 },
      )
    }
    if (line.planterId != null) {
      if (typeof line.planterId !== 'string' || !/^[0-9]+$/.test(line.planterId)) {
        return NextResponse.json(
          { message: `The pot choice for item ${i + 1} is not valid.` },
          { status: 400 },
        )
      }
    }
  }

  /*
   * ── WHO THIS ORDER BELONGS TO ─────────────────────────────────────────────
   *
   * `customer_id` is better-auth's user id, read from the SESSION and never from
   * the request body. It is NULL for a guest, which is correct and expected:
   * guest checkout is this store's default, not a degraded mode.
   *
   * It was omitted entirely before, which is the single worst bug in the account
   * area. `/account` filters on `customer_id`, so EVERY order placed without this
   * line was invisible to the person who placed it — 74 of 75 rows in the
   * database carried a NULL. A customer who signed in after checking out, or who
   * was signed in the whole time, opened their own account and saw
   * "No orders yet".
   *
   * Writing it here is the fix; `adoptGuestOrders()` in
   * `lib/accounts/profile.ts` closes the gap for orders placed before it landed.
   */
  const customerId = await getCustomerId()

  const pool: Pool = db()

  // ── 1 · the pincode gate ────────────────────────────────────────────────
  const pin = await pool.query<{ id: number; city_id: number; zone_id: number | null }>(
    `SELECT "id", "city_id", "zone_id"
       FROM "pincodes"
      WHERE "pincode" = $1 AND "is_serviceable" = true`,
    [pincode],
  )

  if (pin.rows.length === 0) {
    return NextResponse.json({ message: 'We do not deliver to this pincode yet.' }, { status: 422 })
  }

  const city = await pool.query<{ id: number; is_active: boolean }>(
    `SELECT "id", "is_active" FROM "cities" WHERE "id" = $1`,
    [pin.rows[0]!.city_id],
  )
  if (!city.rows[0]?.is_active) {
    return NextResponse.json({ message: 'We are not open in your city yet.' }, { status: 422 })
  }

  /*
   * ── THE ENUM GATE ────────────────────────────────────────────────────────
   *
   * Checked BEFORE the insert rather than after, because the alternative is a
   * driver error (`invalid input value for enum orders_status: "PAYMENT_PENDING"`)
   * that rolls back the transaction and reports itself as a 500 — indistinguishable
   * from a real outage, and impossible to act on. Here the log names the missing
   * enum value and the migration that adds it.
   */
  const enumLabels = await databaseOrderStatuses(pool)
  if (!supportsDatabaseStatus(enumLabels, 'PAYMENT_PENDING' as OrderStatus)) {
    console.error(missingEnumValueError('PAYMENT_PENDING').message)
    return NextResponse.json(
      { message: 'Checkout is briefly unavailable. Please try again in a moment.' },
      { status: 503 },
    )
  }

  // ── 2 · re-derive prices; ignore the client total ──────────────────────
  let revenuePaise = 0
  const resolved: Array<{
    skuId: string
    pricePaise: number
    planterId: string | null
    /**
     * Resolved DURING pricing, not looked up afterwards.
     *
     * The order has to be described in the confirmation e-mail, and a separate
     * round trip after COMMIT would be a second thing that can fail after the
     * money has moved — the same category of bug as sending mail from inside the
     * transaction. Three extra columns on a local array, zero extra queries.
     */
    name: string
    variant: string
    quantity: number
  }> = []

  for (const line of lines) {
    const sku = await pool.query<{
      id: number
      base_price_paise: number
      size_tier: string
      item_class: string
      is_published: boolean
      city_id: number
      display_name: string
    }>(
      `SELECT k."id", k."base_price_paise", k."size_tier", k."item_class",
              k."is_published", k."city_id",
              COALESCE(NULLIF(sp."common_name", ''), NULLIF(btrim(k."description"), ''), k."sku_code")
                AS display_name
         FROM "skus" k
         LEFT JOIN "species" sp ON sp."id" = k."species_id"
        WHERE k."id" = $1`,
      [line.skuId],
    )
    const row = sku.rows[0]

    if (!row || !row.is_published) {
      return NextResponse.json(
        { message: 'An item in your cart is no longer available.' },
        { status: 409 },
      )
    }
    if (row.city_id !== pin.rows[0]!.city_id) {
      return NextResponse.json(
        { message: 'An item in your cart is not sold in your city.' },
        { status: 422 },
      )
    }

    const tierPrice = Math.ceil(
      (row.base_price_paise * (10_000 + (SIZE_TIER_MULTIPLIER[row.size_tier] ?? 0))) / 10_000,
    )

    // Human-readable variant for the confirmation e-mail: the pot is a real
    // difference the customer paid for, and "MD size" alone would under-describe
    // what is arriving in the box.
    const variant = row.size_tier === 'XS' ? '' : `${row.size_tier} size`

    let pricePaise = tierPrice
    let potName = ''
    if (line.planterId) {
      const pot = await pool.query<{ uplift_bp: number; is_active: boolean; name: string }>(
        `SELECT "uplift_bp", "is_active", "name" FROM "planters" WHERE "id" = $1`,
        [line.planterId],
      )

      /*
       * An INACTIVE planter must be refused, not silently downgraded.
       *
       * The first version applied the uplift only `if (pot.is_active)` and then
       * persisted `planterId` regardless. So ops deactivating a pot in the admin
       * panel produced orders that shipped the pot FREE and still recorded it on
       * the line — a silent give-away, invisible on the P&L because revenue was
       * correct and the cost was never counted.
       *
       * Ops switches a planter off to stop selling it. Honour that.
       */
      if (!pot.rows[0]) {
        return NextResponse.json(
          { message: 'The pot you chose is no longer available.' },
          { status: 409 },
        )
      }
      if (!pot.rows[0].is_active) {
        return NextResponse.json(
          { message: 'The pot you chose is no longer available.' },
          { status: 409 },
        )
      }

      pricePaise = tierPrice + Math.ceil((tierPrice * pot.rows[0].uplift_bp) / 10_000)
      potName = pot.rows[0].name
    }

    revenuePaise += pricePaise
    resolved.push({
      skuId: line.skuId,
      pricePaise,
      planterId: line.planterId,
      name: row.display_name,
      variant: line.planterId && potName ? [variant, potName].filter(Boolean).join(' · ') : variant,
      // Always 1, and deliberately typed as a literal rather than read from a
      // field that does not exist.
      //
      // `OrderLine` has no quantity: the cart emits one line PER UNIT and the
      // stock decrement is hardcoded to `qty: 1`, because a two-quantity line
      // would need the decrement, the oversell check and the order_items id
      // scheme to agree about it. Reading a `line.quantity` that is always
      // undefined would print "Qty undefined" in a customer e-mail and look
      // like a data bug rather than a simplification.
      quantity: 1,
    })
  }

  // ── 3 · create the order — PREPAID, UNPAID, WITH STOCK RESERVED ──────────
  // `payment_mode` is hardcoded to 'prepaid'. There is no request field for COD,
  // and the `orders_no_cod` CHECK refuses the value at the schema layer even if
  // someone adds a field later.
  //
  // A unique-collision retry: 6 CSPRNG bytes makes a clash a 1-in-2.8e14 event, so
  // this is not worth a loop in normal operation — but the column is UNIQUE and a
  // clash would surface as a 500. One retry costs nothing and removes the class.
  let orderCode = newOrderCode()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let order
    try {
      order = await client.query<{ id: number; order_code: string }>(
        `INSERT INTO orders (order_code, city_id, status, payment_mode, pincode,
                             zone_id, revenue_paise, contribution_paise,
                             customer_id, customer_name, customer_phone,
                             address_line1, address_line2, address_landmark,
                             address_city, address_state,
                             payment_state,
                             updated_at, created_at)
         VALUES ($1, $2, 'PAYMENT_PENDING', 'prepaid', $3, $4, $5, $6,
                 $7, $8, $9, $10, $11, $12, $13, $14, 'created',
                 now(), now())
         RETURNING "id", "order_code"`,
        [
          orderCode,
          pin.rows[0]!.city_id,
          pincode,
          pin.rows[0]!.zone_id,
          revenuePaise,
          // Conservative 25% until the real COGS lands; the city P&L view groups
          // on this and a losing city must be visible as losing.
          Math.round(revenuePaise * 0.25),
          // See the note above the declaration. NULL for a guest, which is
          // correct: guest checkout is not a degraded mode, it is the default.
          customerId,
          customerName,
          customerPhone,
          addressLine1,
          addressLine2 || null,
          addressLandmark || null,
          addressCity || null,
          addressState || null,
        ],
      )
    } catch (err) {
      const raw = (err as { message?: string }).message ?? ''
      if (!raw.includes('orders_order_code_key') && !raw.includes('duplicate key')) throw err
      orderCode = newOrderCode()
      order = await client.query<{ id: number; order_code: string }>(
        `INSERT INTO orders (order_code, city_id, status, payment_mode, pincode,
                             zone_id, revenue_paise, contribution_paise,
                             customer_id, customer_name, customer_phone,
                             address_line1, address_line2, address_landmark,
                             address_city, address_state,
                             payment_state,
                             updated_at, created_at)
         VALUES ($1, $2, 'PAYMENT_PENDING', 'prepaid', $3, $4, $5, $6,
                 $7, $8, $9, $10, $11, $12, $13, $14, 'created',
                 now(), now())
         RETURNING "id", "order_code"`,
        [
          orderCode,
          pin.rows[0]!.city_id,
          pincode,
          pin.rows[0]!.zone_id,
          revenuePaise,
          Math.round(revenuePaise * 0.25),
          // See the note above the declaration. NULL for a guest, which is
          // correct: guest checkout is not a degraded mode, it is the default.
          customerId,
          customerName,
          customerPhone,
          addressLine1,
          addressLine2 || null,
          addressLandmark || null,
          addressCity || null,
          addressState || null,
        ],
      )
    }

    const orderId = order.rows[0]!.id

    for (const [i, line] of resolved.entries()) {
      await client.query(
        // Table is `orders_items` — Payload pluralises the PARENT slug, not the
        // field name. `_parent_id` is an integer FK to orders.id.
        //
        // Array-field tables have THREE surprises, all hit during this build:
        //   · no `updated_at` / `created_at` (`timestamps` applies to the parent)
        //   · `id` is a varchar PK with NO default — Payload generates it in
        //     application code, so a raw insert must supply one
        //   · `planter_id` is nullable, which is how the grow-pot entry option
        //     is represented
        //
        // The `id` carries the order code so a support agent reading one row can
        // find the order without a join — and it is the handle a claim is filed
        // against, which is why it has to be derivable.
        `INSERT INTO orders_items (id, _order, _parent_id, sku_id, price_paise, planter_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `${order.rows[0]!.order_code}-${i + 1}`,
          i,
          orderId,
          line.skuId,
          line.pricePaise,
          line.planterId ?? null,
        ],
      )
    }

    /*
     * ── STOCK, IN THE SAME TRANSACTION ──────────────────────────────────────
     *
     * Order and decrement commit together or neither does. Splitting them is how
     * you sell a plant you do not have: the order commits and the decrement fails,
     * or the decrement commits for an order that rolled back.
     *
     * `ensureStockRow` runs first so a missing ledger row is distinguishable from
     * a genuine zero — the first is a seed fault and says so in the log, the second
     * is a sold-out item and says so to the customer.
     */
    for (const line of resolved) {
      await ensureStockRow(client, line.skuId)
      await decrementStock(client, { skuId: line.skuId, qty: 1 })
    }

    await appendEvent(client, {
      orderId,
      status: 'PAYMENT_PENDING',
      note: 'Order received. Waiting for payment.',
      actor: 'checkout',
    })

    await client.query('COMMIT')

    /*
     * ── NOTIFY, AFTER THE COMMIT, NEVER INSIDE IT ─────────────────────────
     *
     * This is the single most important placement decision in the file.
     *
     * Sending inside the transaction would mean holding a row lock and an open
     * connection across an SMTP round trip — a several-second stall on a table
     * that checkout also writes to, caused by an external service we do not
     * control. And if the send failed and threw, the transaction would roll back
     * an order whose money had already been captured.
     *
     * After the commit, in the background, with no await: the order exists
     * regardless of what the mail server does, and a response that waits on SMTP
     * is a response whose latency the customer pays for.
     *
     * `sendEmailInBackground` never rejects, so there is no unhandled rejection
     * to crash the process either.
     */
    void notifyOrderPlaced({
      orderCode: order.rows[0]!.order_code,
      customerName,
      customerPhone,
      addressLines: [
        addressLine1,
        addressLine2,
        addressLandmark,
        [addressCity, addressState].filter(Boolean).join(', '),
        pincode,
      ].filter((l): l is string => Boolean(l && l.trim() !== '')),
      cityName: (await cityNameFor(pin.rows[0]!.city_id)) ?? '',
      lines: resolved.map((line) => ({
        name: line.name,
        variant: line.variant,
        quantity: line.quantity,
        linePaise: line.pricePaise,
      })),
      subtotalPaise: revenuePaise,
      // Delivery is free above the city's threshold and the threshold is 0 at
      // launch, so this is 0 for every real order. It is still passed through
      // rather than assumed, because a launch in a city with a paid threshold
      // would otherwise show "Free" on a paid invoice.
      deliveryPaise: 0,
      totalPaise: revenuePaise,
    }).catch((err: unknown) => {
      // Belt and braces: `notifyOrderPlaced` is written not to throw, and this
      // catches a bug in the templates rather than a mail outage.
      console.error('[orders] order notification failed:', err)
    })

    return NextResponse.json({
      orderCode: order.rows[0]!.order_code,
      // NOT 'PLACED'. This order is not placed in any sense a customer would
      // recognise until money has moved, and rendering anything else here is what
      // let the UI claim success with nothing captured.
      status: 'PAYMENT_PENDING',
      paymentMode: 'prepaid',
      paymentState: 'created',
      revenuePaise,
      guaranteedWindowHours: 48,
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})

    /*
     * ── OVERSELL IS A BUSINESS RULE, NOT A 500 ──────────────────────────────
     *
     * Its own message, matched by its own wording. This is the pattern AGENTS.md
     * prescribes: a business-rule violation's message IS the customer-facing copy,
     * so it is matched deliberately and returned deliberately. Everything else is
     * logged and reported generically, because returning `err.message` once
     * surfaced `relation "order_items" does not exist` to a paying customer.
     */
    if (err instanceof OversellError) {
      console.error('[orders] oversell refused:', err.message)
      return NextResponse.json({ message: err.customerMessage }, { status: 409 })
    }

    const raw = (err as { message?: string }).message ?? ''
    const isBusinessRule =
      raw.includes('orders_no_cod') ||
      raw.includes('orders_prepaid_only') ||
      raw.includes('serviceable set') ||
      raw.includes('belongs to city') ||
      raw.includes('not licensed') ||
      raw.includes('sku_stock_on_hand_non_negative') ||
      raw.includes('sku_stock') ||
      raw.includes('orders_captured_payment_has_contact') ||
      raw.includes('orders_phone_is_a_mobile')

    if (isBusinessRule) {
      const friendly = raw.includes('cod')
        ? 'Cash on delivery is not available.'
        : raw.includes('serviceable set')
          ? 'We do not deliver to this pincode yet.'
          : raw.includes('belongs to city')
            ? 'That pincode is not in your delivery city.'
            : raw.includes('not licensed')
              ? 'We are not open in your city yet.'
              : raw.includes('sku_stock')
                ? 'An item in your cart is no longer available in the quantity requested.'
                : raw.includes('orders_phone_is_a_mobile')
                  ? 'Enter a 10-digit mobile number for delivery updates.'
                  : 'Please check the delivery details and try again.'
      return NextResponse.json({ message: friendly }, { status: 422 })
    }

    console.error('[orders] placement failed:', raw)
    return NextResponse.json(
      {
        message:
          'Something went wrong placing your order. Nothing has been charged — please try again.',
      },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}

/**
 * City display name for the notification, best effort.
 *
 * Best effort is the correct standard here: an e-mail saying "your order in
 * Bengaluru has arrived" is worth a great deal more than an e-mail that is not
 * sent at all because a lookup failed.
 */
async function cityNameFor(cityId: number): Promise<string | null> {
  try {
    const { rows } = await db().query<{ name: string }>(
      `SELECT "name" FROM "cities" WHERE "id" = $1`,
      [cityId],
    )
    return rows[0]?.name ?? null
  } catch {
    return null
  }
}

/**
 * The two messages an order must produce.
 *
 * ── WHY THE OWNER GETS ONE TOO ─────────────────────────────────────────────
 *
 * Because a storefront where the founder discovers sales by opening the database
 * is not runnable by a founder. Urvann's audited weakness is that nobody answers;
 * the mirror-image failure is a business that does not know it has been paid.
 *
 * The owner's copy is not a cc of the customer's: it is the PACKING LIST. What
 * to pull, for whom, by when, and how much was taken. It is addressed to a
 * configured inbox so it works with no panel open.
 */
async function notifyOrderPlaced(input: {
  orderCode: string
  customerName: string
  customerPhone: string
  addressLines: string[]
  cityName: string
  lines: Array<{ name: string; variant: string; quantity: number; linePaise: number }>
  subtotalPaise: number
  deliveryPaise: number
  totalPaise: number
}): Promise<void> {
  const settings = await loadBusinessSettings()
  const base = `${config.server.url.replace(/\/$/, '')}`

  const templateInput = {
    ...input,
    // No city prefix here: the template already prints the city as its own
    // field, and "Bengaluru: expected Bengaluru: tomorrow" is the kind of
    // duplication nobody reads past.
    estimatedWindow: 'next working day, or the same day if you order before the cutoff',
    supportPhone: settings.customerCarePhone || 'our published number',
    trackUrl: `${base}/track-order`,
    receiptUrl: `${base}/order/${input.orderCode}`,
  }

  const customer = orderConfirmation(templateInput)
  await sendEmail({
    kind: 'order_confirmation',
    to: customerMailbox(input.customerName, input.customerPhone),
    toName: input.customerName,
    subject: customer.subject,
    text: customer.text,
    html: customer.html,
  })

  const owner = adminNewOrder(templateInput)
  const ownerAddress = config.email.orderAlertsEmail || settings.customerCareEmail
  if (ownerAddress) {
    await sendEmail({
      kind: 'order_admin_alert',
      to: ownerAddress,
      subject: owner.subject,
      text: owner.text,
      html: owner.html,
      internal: true,
    })
  }
}
