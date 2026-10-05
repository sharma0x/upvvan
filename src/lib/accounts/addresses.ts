import 'server-only'

import { config } from '@/lib/config'
import { getCustomerId } from '@/lib/auth/session'

/**
 * Customer account data — order history and the address book.
 *
 * ── WHY THIS FILE HAS NO `customer_id` PARAMETER ────────────────────────────
 *
 * Every function here takes the customer from the SESSION and nowhere else.
 *
 * This is the single most important line in the file. The obvious shape is
 * `listOrders(customerId)` called by a page that read the id from the URL — and
 * that shape makes "show me another customer's orders" a one-line mistake that
 * typechecks, passes every test, and leaks one customer's address and order
 * history to another. There is no version of this API where a caller can supply
 * an id, so the mistake cannot be written.
 *
 * ── WHY RAW SQL AND NOT THE PAYLOAD LOCAL API ───────────────────────────────
 *
 * Two reasons, both about the single-DDL-history rule. `customer_id` here is a
 * plain text column with a real FK to better-auth's `user` table — a table
 * better-auth owns and creates through its own migration runner. Payload's Local
 * API cannot express a relationship to a table it does not manage, so an
 * `Addresses` collection would have to fake the link with a text field and lose
 * the foreign key. That is precisely the "dangling reference wearing the
 * costume of a relationship" that `20261005_000006_customer_identity_fk.ts`
 * exists to prevent.
 *
 * So: hand-written SQL against tables whose DDL is in our migrations, and a
 * real FK rather than a convention.
 */

let pool: import('pg').Pool | null = null

/**
 * A lazily-created module-local pool, matching `geo/loader.server.ts` and
 * `catalogue/loader.server.ts`. Next's dev server would otherwise open a fresh
 * connection per request.
 */
async function getPool(): Promise<import('pg').Pool> {
  if (!pool) {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: config.database.url })
  }
  return pool
}

/* ── ORDERS ────────────────────────────────────────────────────────────────── */

/**
 * `numeric` comes back from `pg` as a STRING, not a number — the driver is
 * being faithful to the column type. `formatPaise` then runs `Number.isInteger`
 * on a string and returns false, so the price renders blank.
 *
 * Coerced here, at the loader boundary, with a refusal rather than a silent
 * pass: this is where a float would otherwise enter a paise column.
 */
function paise(value: string | number, label: string): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n)) {
    throw new Error(`${label} is not integer paise (received ${String(value)}).`)
  }
  return n
}

export interface AccountOrder {
  orderCode: string
  status: string
  pincode: string
  revenuePaise: number
  createdAt: Date
  items: { name: string; sizeTier: string | null; pricePaise: number }[]
}

interface OrderRow {
  order_code: string
  status: string
  pincode: string
  revenue_paise: string
  created_at: Date
}

/**
 * This customer's orders, newest first.
 *
 * Returns an empty array when signed out rather than throwing — callers pass the
 * result straight to `.map`, and a signed-out visitor reaching this through a
 * cached render should see an empty list, not an error page.
 */
export async function listCustomerOrders(): Promise<AccountOrder[]> {
  const customerId = await getCustomerId()
  if (!customerId) return []

  const db = await getPool()

  const { rows } = await db.query<OrderRow>(
    `SELECT "order_code", "status", "pincode", "revenue_paise", "created_at"
       FROM "orders"
      WHERE "customer_id" = $1
      ORDER BY "created_at" DESC`,
    [customerId],
  )

  if (rows.length === 0) return []

  /*
   * Items are fetched for all orders in ONE query rather than per order. This
   * function runs on every account page view; N+1 would mean a customer with
   * nine orders waits on ten round-trips.
   */
  const { rows: items } = await db.query<{
    order_code: string
    common_name: string | null
    size_tier: string | null
    price_paise: string
  }>(
    `SELECT o."order_code", sp."common_name", s."size_tier", oi."price_paise"
       FROM "orders" o
       JOIN "orders_items" oi ON oi."_parent_id" = o."id"
       LEFT JOIN "skus" s ON s."id" = oi."sku_id"
       LEFT JOIN "species" sp ON sp."id" = s."species_id"
      WHERE o."customer_id" = $1
      ORDER BY oi."_order"`,
    [customerId],
  )

  const itemsByOrder = new Map<string, AccountOrder['items']>()
  for (const item of items) {
    const list = itemsByOrder.get(item.order_code) ?? []
    list.push({
      name: item.common_name ?? 'Plant',
      sizeTier: item.size_tier,
      pricePaise: paise(item.price_paise, 'order item price'),
    })
    itemsByOrder.set(item.order_code, list)
  }

  return rows.map((o) => ({
    orderCode: o.order_code,
    status: o.status,
    pincode: o.pincode,
    revenuePaise: paise(o.revenue_paise, 'order revenue'),
    createdAt: o.created_at,
    items: itemsByOrder.get(o.order_code) ?? [],
  }))
}

/* ── ADDRESS BOOK ──────────────────────────────────────────────────────────── */

export interface CustomerAddress {
  id: string
  label: string
  fullName: string
  line1: string
  line2: string | null
  city: string
  pincode: string
  isDefault: boolean
}

/**
 * Validated input for creating or updating an address.
 *
 * A hand-written `interface` rather than a Payload schema type, because this
 * table is written by raw SQL (see the file header). Every field is validated
 * below — this is the boundary where customer input becomes a row.
 */
export interface AddressInput {
  label: string
  fullName: string
  line1: string
  line2?: string | null
  city: string
  pincode: string
  isDefault?: boolean
}

/**
 * Validate and normalise address input.
 *
 * ── WHY PINCODE IS TEXT, NEVER A NUMBER ────────────────────────────────────
 *
 * Indian pincodes are 6 digits and leading zeros are legal — "012345" is a real
 * pincode. Numeric coercion silently drops the zero and resolves the wrong
 * district, which is the same class of bug as the `numeric`-arrives-as-string
 * trap documented in AGENTS.md.
 *
 * Throws with a caller-safe `message`. These strings ARE the customer-facing
 * copy, matched by the API route's allowlist, so they must be written as though
 * a customer reads them.
 */
export function validateAddress(input: unknown): AddressInput {
  const o = (input ?? {}) as Record<string, unknown>

  const str = (key: string, max: number): string => {
    const value = typeof o[key] === 'string' ? (o[key] as string).trim() : ''
    if (!value) throw new Error(`${key} is required.`)
    if (value.length > max) throw new Error(`${key} is too long.`)
    return value
  }

  const pincode = str('pincode', 6)
  // The pattern comes from config, not a literal — it is a documented business
  // rule ("Indian pincodes are exactly 6 digits, configurable for a future
  // change") and duplicating the regex here would be the second source of truth
  // that config.ts exists to prevent.
  if (!new RegExp(config.business.pincodePattern).test(pincode)) {
    throw new Error('A pincode is exactly 6 digits.')
  }

  return {
    label: str('label', 40),
    fullName: str('fullName', 80),
    line1: str('line1', 160),
    line2: typeof o.line2 === 'string' && o.line2.trim() ? o.line2.trim().slice(0, 160) : null,
    city: str('city', 80),
    pincode,
    /*
     * `undefined` when the caller said nothing at all, NOT `false`.
     *
     * The distinction is load-bearing: `createAddress` uses a COALESCE so the
     * FIRST address a customer saves becomes their default automatically. That
     * only works if "unspecified" survives validation. Coercing to a hard
     * `false` here destroys the information and the default is never applied —
     * an address book with no default is a checkout dead end, and every row is
     * still written correctly, so nothing looks broken.
     */
    isDefault: o.isDefault === undefined ? undefined : o.isDefault === true,
  }
}

interface AddressRow {
  id: string
  label: string
  full_name: string
  line1: string
  line2: string | null
  city: string
  pincode: string
  is_default: boolean
}

/** This customer's saved addresses, default first. */
export async function listAddresses(): Promise<CustomerAddress[]> {
  const customerId = await getCustomerId()
  if (!customerId) return []

  const db = await getPool()
  const { rows } = await db.query<AddressRow>(
    `SELECT "id", "label", "full_name", "line1", "line2", "city", "pincode", "is_default"
       FROM addresses
      WHERE "customer_id" = $1
      ORDER BY "is_default" DESC, "created_at" ASC`,
    [customerId],
  )

  return rows.map(toAddress)
}

function toAddress(row: AddressRow): CustomerAddress {
  return {
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    pincode: row.pincode,
    isDefault: row.is_default,
  }
}

/**
 * Create an address for the signed-in customer.
 *
 * ── WHY THE TRANSACTION ─────────────────────────────────────────────────────
 *
 * Setting the default address requires clearing the previous default. Those are
 * two statements, and without a transaction a failure between them leaves the
 * customer with TWO defaults — at which point checkout cannot decide where to
 * deliver, and that is a real order going to the wrong address.
 */
export async function createAddress(input: AddressInput): Promise<CustomerAddress> {
  const customerId = await getCustomerId()
  if (!customerId) throw new Error('Sign in to save an address.')

  const db = await getPool()
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    if (input.isDefault) {
      await client.query(
        `UPDATE addresses SET is_default = false WHERE customer_id = $1 AND is_default = true`,
        [customerId],
      )
    }

    // `id` has no default: Payload generates ids in application code for its
    // own tables, and this one is written by hand, so we supply it. crypto.randomUUID
    // is available in the Node runtime this runs in.
    //
    // ── WHY $2 IS CAST EXPLICITLY ───────────────────────────────────────────
    //
    // This is a real Postgres error, not a style preference: reusing one
    // parameter in both a value position and inside a boolean expression makes
    // Postgres deduce two different types for it and refuse the statement with
    // `inconsistent types deduced for parameter $2`. Casting the inner use to
    // VARCHAR pins it to the same type the insert column already implies.
    const { rows } = await client.query<AddressRow>(
      `INSERT INTO addresses
         ("id", "customer_id", "label", "full_name", "line1", "line2", "city", "pincode", "is_default")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               COALESCE($9, NOT EXISTS (
                 SELECT 1 FROM addresses WHERE customer_id = $2::VARCHAR AND is_default = true
               )))
       RETURNING "id", "label", "full_name", "line1", "line2", "city", "pincode", "is_default"`,
      [
        crypto.randomUUID(),
        customerId,
        input.label,
        input.fullName,
        input.line1,
        input.line2,
        input.city,
        input.pincode,
        /*
         * MUST be null, not false, when the caller did not ask for a default.
         *
         * `COALESCE($9, NOT EXISTS(...))` only falls through when $9 is NULL.
         * Passing `false` short-circuits it to false and the "first address is
         * automatically the default" rule silently never applies — an address
         * book with no default is a checkout dead end, and the bug is invisible
         * because every row is still written correctly.
         *
         * `?? null` (not `?? false`) is what makes the COALESCE do its job.
         */
        input.isDefault ?? null,
      ],
    )

    await client.query('COMMIT')
    return toAddress(rows[0]!)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Make one of this customer's addresses the default. */
export async function setDefaultAddress(id: string): Promise<void> {
  const customerId = await getCustomerId()
  if (!customerId) throw new Error('Sign in to change your addresses.')

  const db = await getPool()
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    /*
     * `customer_id = $2` on the UPDATE is the ownership check AND the filter.
     * Without it this would let a signed-in customer set ANY address in the
     * table as their own default — an IDOR that leaks nothing but still hands
     * one customer control of another's delivery address.
     */
    const { rowCount } = await client.query(
      `UPDATE addresses SET is_default = true WHERE "id" = $1 AND "customer_id" = $2`,
      [id, customerId],
    )
    if (rowCount === 0) throw new Error('Address not found.')

    await client.query(
      `UPDATE addresses SET is_default = false
        WHERE "customer_id" = $1 AND is_default = true AND "id" <> $2`,
      [customerId, id],
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Delete one of this customer's addresses. */
export async function deleteAddress(id: string): Promise<void> {
  const customerId = await getCustomerId()
  if (!customerId) throw new Error('Sign in to change your addresses.')

  const db = await getPool()
  // Same ownership predicate as above: the WHERE clause is the authorisation.
  const { rowCount } = await db.query(
    `DELETE FROM addresses WHERE "id" = $1 AND "customer_id" = $2`,
    [id, customerId],
  )
  if (rowCount === 0) throw new Error('Address not found.')
}