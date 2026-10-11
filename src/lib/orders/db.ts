import { Pool, type PoolClient } from 'pg'

import { newOrderCode } from '@/lib/payments/gateway'
import { canonicalStatus, type OrderStatus } from '@/lib/orders/status'
import { getPool as sharedPool } from '@/lib/db/pool'

/**
 * Shared database access for the order domain.
 *
 * ── WHY A SINGLE POOL HERE ───────────────────────────────────────────────────
 *
 * `POST /api/orders` and `order/[code]/page.tsx` each had their own
 * `let pool: Pool | null` module local. That works, but it means the checkout
 * transaction and the page that renders its result can be talking to different
 * pools with different snapshot views — which is how a freshly captured order
 * renders as "Payment pending" on the confirmation page. One pool, one place.
 */

/*
 * Delegates to the ONE process-wide pool.
 *
 * There were nine module-level pools in this codebase — this one was `max: 20`,
 * and `catalogue/loader.server.ts` was another `max: 20`, which is 40 connections
 * from two modules before anything else loads. `next build` prerenders dozens of
 * routes in parallel and died with
 *
 *     error: sorry, too many clients already
 *     Error occurred prerendering page "/collections/plants-for-a-bright-room"
 *
 * A pool exists to REUSE connections. Nine pools reusing the same handful is not
 * reuse; it is nine warm-up costs and nine places for a leak to hide. See
 * `src/lib/db/pool.ts`.
 *
 * Kept as a thin wrapper rather than replaced at every call site: the callers are
 * correct, and rewriting working call sites during an incident is how an incident
 * becomes an outage.
 */
export function db(): Pool {
  return sharedPool()
}

/**
 * A fresh, cryptographically random order code.
 *
 * Re-exported from the payments module because it was ORIGINALLY a payments
 * concern — the code was the payment page's capability — and it is still the
 * thing a customer reads out of a WhatsApp message. Kept in one place so there is
 * exactly one algorithm in the codebase and no chance of a second, weaker one.
 */
export { newOrderCode }

/**
 * ── ORDER LOOKUP BY CODE + PHONE ────────────────────────────────────────────
 *
 * Why the phone is required and not optional: the order code is now 48 bits of
 * CSPRNG, which is not guessable — but "unguessable" is not the same as
 * "authorised". A leaked code (browser history, a screenshot in a WhatsApp group,
 * a support agent pasting a link) reveals an address and a phone number. Pairing
 * the code with a number the buyer already knows is what makes this a credential
 * check rather than a bearer token.
 *
 * The phone is compared on its LAST FOUR DIGITS only. Storing and matching the
 * whole number would mean a lookup request carries a full customer identifier to
 * an endpoint whose only job is to say no. Four digits plus the code is
 * 10,000 possibilities against a value nobody can enumerate usefully, and it is
 * the same verification the customer does when reading a card statement.
 */
export interface OrderLookupKey {
  orderCode: string
  /** At least the last four digits; the full number is accepted and truncated. */
  phone: string
}

/**
 * Normalise an Indian mobile to `+91XXXXXXXXXX` — the form we STORE.
 *
 * Why this exists separately from `phoneTail`: those two answers are deliberately
 * different. `phoneTail` is the last FOUR digits and exists to be compared in a
 * `WHERE` clause without carrying a full customer identifier into a lookup request.
 * Storing a tail as though it were a number produces `+919876` — a number no rider
 * can dial and no customer recognises — which is how the first version of the
 * checkout wrote garbage into the delivery column while every regex test still
 * looked plausible.
 *
 * Storing `+91` + 10 digits is the E.164 form, which is what makes the stored value
 * sortable, dialable and comparable to a phone number captured by any other system.
 * Leading `0` (`098…`) and a bare country code are both accepted on input, because
 * those are the two forms an Indian customer actually types.
 */
export function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  // 91 + 10, or 0 + 10 (the form every Indian dialler uses domestically).
  let national = digits
  if (national.length === 12 && national.startsWith('91')) national = national.slice(2)
  else if (national.length === 11 && national.startsWith('0')) national = national.slice(1)

  if (national.length !== 10) return null
  if (!/^[6-9]/.test(national)) return null
  return `+91${national}`
}

/**
 * The last four digits of an Indian mobile, or null if it is not one.
 *
 * ── WHY THE LAST FOUR AND NOT THE WHOLE NUMBER ──────────────────────────────
 *
 * This is the value a lookup is authorised by. Storing and matching the WHOLE number
 * would mean a lookup request carries a complete customer identifier to an endpoint
 * whose only job is to say no — into an access log, a proxy log, an APM trace. Four
 * digits against a CSPRNG order code is 10,000 possibilities, and it is the same
 * verification the customer does when reading a card statement.
 *
 * Which is exactly why the lookup endpoint is rate limited: 10,000 against a KNOWN
 * code is brute-forceable at 4 requests/second forever, and "the code is secret" does
 * not protect the tail once someone has the code from a screenshot.
 */
export function phoneTail(phone: string): string | null {
  const national = normalisePhone(phone)
  return national === null ? null : national.slice(-4)
}

/**
 * Normalise a code for lookup. Uppercased and trimmed, nothing else — no
 * case-folding tricks, no stripping of internal characters, because a lookup that
 * "helpfully" normalises differently from storage is a lockout.
 */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase()
}

export interface OrderSummary {
  orderCode: string
  status: OrderStatus
  storedStatus: string
  paymentState: 'created' | 'processing' | 'captured' | 'failed' | null
  paymentReference: string | null
  capturedAt: Date | null
  revenuePaise: number
  pincode: string
  guaranteeTier: string
  customerName: string | null
  customerPhone: string | null
  address: {
    line1: string | null
    line2: string | null
    landmark: string | null
    city: string | null
    state: string | null
  } | null
  createdAt: Date
  updatedAt: Date
}

export interface OrderLineSummary {
  id: string
  commonName: string | null
  scientificName: string | null
  skuCode: string
  sizeTier: string
  itemClass: string
  /** INTEGER PAISE. Coerced from the `numeric` column, which pg returns as a string. */
  pricePaise: number
  /** Quantity is 1 per row: an order line IS one unit, and `orders_items` has no qty column. */
  quantity: number
  planterName: string | null
  /** Plant declared height, cm — the figure on the Legal Metrology declaration. */
  heightCm: number | null
}

export interface OrderEventSummary {
  status: OrderStatus
  /** Plain-language line for the timeline. Never an internal code. */
  note: string
  at: Date
}

/**
 * Load a full order for display.
 *
 * `as: 'for update'` is deliberately NOT used here. This is a read for rendering;
 * the write path takes the row lock explicitly when it needs it. A display query
 * that takes a row lock will block a concurrent checkout for the length of a
 * render.
 */
export async function loadOrder(
  client: Pool | PoolClient,
  key: OrderLookupKey,
): Promise<OrderBundle | null> {
  const tail = phoneTail(key.phone)
  if (!tail) return null

  // A `UNION ALL` would be tidier and slower to reason about; the tail is four
  // characters and the pair is verified in the WHERE clause, so the guarded branch
  // below can return null without a second round trip.
  const res = await client.query<OrderRecordRow>(
    `SELECT "id", "order_code", "status", "payment_state", "payment_reference",
            "payment_captured_at", "revenue_paise", "pincode", "guarantee_tier",
            "customer_name", "customer_phone",
            "address_line1", "address_line2", "address_landmark",
            "address_city", "address_state",
            "created_at", "updated_at"
       FROM "orders"
      WHERE "order_code" = $1
        AND right(regexp_replace("customer_phone"::text, '\\D', '', 'g'), 4) = $2`,
    [normaliseCode(key.orderCode), tail],
  )
  return hydrate(client, res.rows[0])
}

/**
 * Load an order by code alone.
 *
 * ONLY SAFE AFTER the signed-cookie check in `cookie.ts` has passed. This function
 * performs no authorisation of its own and says so at the top of its comment, because
 * "loadOrderByCode looks like lookup" is exactly the kind of function that gets
 * called from a route two months from now by someone who has not read the comment.
 * The name is deliberately longer than `loadOrder` so the difference is visible at
 * the call site.
 */
export async function loadOrderVerified(
  client: Pool | PoolClient,
  orderCode: string,
): Promise<OrderBundle | null> {
  const res = await client.query<OrderRecordRow>(
    `SELECT "id", "order_code", "status", "payment_state", "payment_reference",
            "payment_captured_at", "revenue_paise", "pincode", "guarantee_tier",
            "customer_name", "customer_phone",
            "address_line1", "address_line2", "address_landmark",
            "address_city", "address_state",
            "created_at", "updated_at"
       FROM "orders"
      WHERE "order_code" = $1`,
    [normaliseCode(orderCode)],
  )
  return hydrate(client, res.rows[0])
}

interface OrderRecordRow {
  id: number
  order_code: string
  status: string
  payment_state: string | null
  payment_reference: string | null
  payment_captured_at: Date | null
  revenue_paise: string
  pincode: string
  guarantee_tier: string
  customer_name: string | null
  customer_phone: string | null
  address_line1: string | null
  address_line2: string | null
  address_landmark: string | null
  address_city: string | null
  address_state: string | null
  created_at: Date
  updated_at: Date
}

export type OrderBundle = {
  order: OrderSummary
  items: OrderLineSummary[]
  events: OrderEventSummary[]
}

/**
 * Shared hydration: one order row in, the full bundle out.
 *
 * Two loaders exist (phone-guarded and cookie-verified) and they MUST agree on the
 * shape they return — a receipt rendered from one and a timeline from the other
 * would be a bug that only appears on the path someone forgot to test. So the row →
 * bundle mapping exists exactly once, here.
 */
async function hydrate(
  client: Pool | PoolClient,
  row: OrderRecordRow | undefined,
): Promise<OrderBundle | null> {
  if (!row) return null

  const items = await client.query<{
    id: string
    common_name: string | null
    botanical_name: string | null
    sku_code: string
    size_tier: string
    item_class: string
    price_paise: string
    planter_name: string | null
    height_cm: number | null
  }>(
    `SELECT oi."id",
            sp."common_name", sp."botanical_name",
            s."sku_code", s."size_tier", s."item_class",
            oi."price_paise",
            p."name" AS "planter_name",
            s."legal_metrology_dimensions_height_cm" AS "height_cm"
       FROM "orders_items" oi
       JOIN "skus" s ON s."id" = oi."sku_id"
       LEFT JOIN "species" sp ON sp."id" = s."species_id"
       LEFT JOIN "planters" p ON p."id" = oi."planter_id"
      WHERE oi."_parent_id" = $1
      ORDER BY oi."_order"`,
    [row.id],
  )

  const events = await client.query<{ status: string; note: string | null; created_at: Date }>(
    `SELECT "status", "note", "created_at"
       FROM "order_events"
      WHERE "order_id" = $1
      ORDER BY "created_at" ASC, "id" ASC`,
    [row.id],
  )

  return {
    order: {
      orderCode: row.order_code,
      status: canonicalStatus(row.status),
      storedStatus: row.status,
      paymentState: (row.payment_state ?? null) as OrderSummary['paymentState'],
      paymentReference: row.payment_reference,
      capturedAt: row.payment_captured_at,
      /*
       * A `numeric` column arrives as a STRING from the pg driver — see AGENTS.md.
       * Number() here is deliberate and is immediately asserted by formatPaise,
       * which throws on a non-integer rather than rendering a blank price.
       */
      revenuePaise: Number(row.revenue_paise),
      pincode: row.pincode,
      guaranteeTier: row.guarantee_tier,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      address:
        row.address_line1 || row.address_city
          ? {
              line1: row.address_line1,
              line2: row.address_line2,
              landmark: row.address_landmark,
              city: row.address_city,
              state: row.address_state,
            }
          : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    items: items.rows.map((i) => ({
      id: i.id,
      commonName: i.common_name,
      scientificName: i.botanical_name,
      skuCode: i.sku_code,
      sizeTier: i.size_tier,
      itemClass: i.item_class,
      pricePaise: Number(i.price_paise),
      quantity: 1,
      planterName: i.planter_name,
      heightCm: i.height_cm,
    })),
    events: events.rows.map((e) => ({
      status: canonicalStatus(e.status),
      note: e.note ?? '',
      at: e.created_at,
    })),
  }
}

/**
 * Append a timeline entry.
 *
 * Append-only: nothing in this codebase updates or deletes an `order_events` row.
 * The value of a customer-facing timeline is that it cannot be edited, and the
 * cheapest way to guarantee that is for no code path to exist that could.
 */
export async function appendEvent(
  client: PoolClient,
  args: {
    orderId: number
    status: string
    note: string
    /** Who caused it. Free text is wrong for machines but right for support. */
    actor: string
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "order_events" ("order_id", "status", "note", "actor", "created_at")
     VALUES ($1, $2, $3, $4, now())`,
    [args.orderId, args.status, args.note, args.actor],
  )
}

/**
 * The statuses the `enum_orders_status` Postgres type currently holds.
 *
 * Cached per process because it is schema, not data: it cannot change without a
 * migration, and a migration restarts the app. The refresh on failure keeps the
 * cache from being permanently wrong after someone applies the enum extension
 * against a long-running process.
 */
let enumCache: { at: number; labels: string[] } | null = null

export async function databaseOrderStatuses(client: Pool | PoolClient): Promise<string[]> {
  const fresh = enumCache && Date.now() - enumCache.at < 60_000
  if (fresh) return enumCache!.labels

  const res = await client.query<{ enumlabel: string }>(
    `SELECT e."enumlabel"
       FROM pg_enum e
       JOIN pg_type t ON t."oid" = e."enumtypid"
      WHERE t."typname" = 'enum_orders_status'`,
  )
  const labels = res.rows.map((r) => r.enumlabel)
  enumCache = { at: Date.now(), labels }
  return labels
}
