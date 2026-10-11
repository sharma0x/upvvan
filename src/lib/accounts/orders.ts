import 'server-only'

import { getCustomerId } from '@/lib/auth/session'
import { getPool as sharedPool } from '@/lib/db/pool'
import { canonicalStatus, type OrderStatus } from '@/lib/orders/status'

/**
 * The signed-in customer's orders.
 *
 * ── WHY ORDERS LIVE HERE AND NOT IN `addresses.ts` ──────────────────────────
 *
 * They used to. That file grew an order query while it was the only thing in
 * `accounts/`, and "listCustomerOrders" inside a module called `addresses` is the
 * kind of thing that makes the next reader assume the address book owns order
 * data — or worse, copy the query and drop its ownership predicate. Split by
 * subject, not by accident.
 *
 * ── WHY THERE IS NO `customerId` PARAMETER ──────────────────────────────────
 *
 * The customer comes from the SESSION. See `addresses.ts` for the full argument;
 * it is worth repeating here because this is the query where the leak would
 * actually hurt: every row carries a delivery address and a plant list.
 *
 * ── WHY THE STATUS IS CANONICALISED HERE ────────────────────────────────────
 *
 * The column carries fourteen enum labels, four of them legacy (`PLACED`,
 * `ROUTED`, `RESOLVED`, `CLAIM_REJECTED`). The previous account page mapped them
 * with its OWN copy keyed on `PLACED`/`DISPATCHED`/`REFUNDED` — three names the
 * database cannot produce and one it never had — so every order written since the
 * payment lifecycle landed fell through the lookup and rendered the raw enum
 * string to the customer:
 *
 *     OUT_FOR_DELIVERY · delivering to 560001
 *
 * `canonicalStatus` is the single normaliser, and `STATUS_COPY` the single set of
 * words. Reading them from here rather than redeclaring them is the fix, and the
 * fix is structural: there is no second copy left to drift.
 */

/** `numeric` comes back from `pg` as a STRING. Refuse a fractional value. */
function paise(value: string | number, label: string): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n)) {
    throw new Error(`${label} is not integer paise (received ${String(value)}).`)
  }
  return n
}

async function getPool(): Promise<import('pg').Pool> {
  return sharedPool()
}

export interface AccountOrderItem {
  /** The `orders_items` id — the handle a review or a claim is filed against. */
  id: string
  name: string
  sizeTier: string | null
  itemClass: string
  pricePaise: number
}

export interface AccountOrder {
  orderCode: string
  /** Canonical lifecycle state. Never a raw enum label. */
  status: OrderStatus
  /** The raw column value, kept only so support can read what is stored. */
  storedStatus: string
  paymentState: string | null
  pincode: string
  city: string | null
  revenuePaise: number
  createdAt: Date
  items: AccountOrderItem[]
  /** Set once a rider has picked the parcel up; the customer asks for this. */
  pickedUpAt: Date | null
  outForDeliveryAt: Date | null
  deliveredAt: Date | null
  /** Open claim reference, when there is one. `CLM-…`. */
  claimCode: string | null
  claimStatus: string | null
  /**
   * Whether a receipt can be downloaded.
   *
   * True once money has been captured. The receipt is the customer's proof of
   * payment for a plant they have already paid for, so withholding it until
   * delivery would be withholding the document for the transaction that has
   * completed.
   */
  canDownloadReceipt: boolean
}

/**
 * This customer's orders, newest first.
 *
 * Returns an empty array when signed out rather than throwing: callers pass the
 * result straight to `.map`, and a signed-out visitor reaching this through a
 * cached render should see an empty list, not an error page.
 */
export async function listCustomerOrders(): Promise<AccountOrder[]> {
  const customerId = await getCustomerId()
  if (!customerId) return []

  const db = await getPool()

  /*
   * Orders and their lines in ONE query rather than one query per order.
   *
   * `json_agg` over the lines, grouped by order. This runs on every account page
   * view, and a customer with nine orders should not wait on ten round trips to
   * see a list — N+1 on the page people return to most is the shape of slowness
   * that makes an app feel cheap.
   *
   * The dispatch columns come from a LEFT JOIN: an order that has not been
   * assigned yet is still an order, and the customer asking "is it on the way"
   * deserves an answer of "not yet" rather than an absent row.
   *
   * The claim is aggregated too, for the same reason. `order_claims` is a raw
   * table with no Payload collection and no admin UI (see `api/claims/route.ts`),
   * so if this query does not surface it, nothing in the product does — a
   * customer whose plant died has literally no way to find out what happened.
   */
  const { rows } = await db.query<{
    order_code: string
    status: string
    payment_state: string | null
    pincode: string
    address_city: string | null
    revenue_paise: string
    created_at: Date
    picked_up_at: Date | null
    out_for_delivery_at: Date | null
    delivered_at: Date | null
    items: Array<{
      id: string
      common_name: string | null
      size_tier: string | null
      item_class: string
      price_paise: string
    }> | null
    claim_id: number | null
    claim_status: string | null
  }>(
    `SELECT o."order_code",
            o."status"::text                              AS "status",
            o."payment_state"                             AS "payment_state",
            o."pincode",
            o."address_city",
            o."revenue_paise",
            o."created_at",
            d."picked_up_at"                              AS "picked_up_at",
            d."out_for_delivery_at"                       AS "out_for_delivery_at",
            d."delivered_at"                              AS "delivered_at",
            c."id"                                        AS "claim_id",
            c."status"                                    AS "claim_status",
            (
              SELECT json_agg(json_build_object(
                       'id',        i."id",
                       'common_name', sp."common_name",
                       'size_tier',  s."size_tier",
                       'item_class', s."item_class",
                       'price_paise', i."price_paise"
                     ) ORDER BY i."_order")
                FROM "orders_items" i
                LEFT JOIN "skus" s     ON s."id" = i."sku_id"
                LEFT JOIN "species" sp ON sp."id" = s."species_id"
               WHERE i."_parent_id" = o."id"
            )                                             AS "items"
       FROM "orders" o
       LEFT JOIN "dispatches"  d ON d."order_id" = o."id"
       LEFT JOIN "order_claims" c ON c."order_id" = o."id"
      WHERE o."customer_id" = $1
      ORDER BY o."created_at" DESC`,
    [customerId],
  )

  return rows.map((row) => ({
    orderCode: row.order_code,
    status: canonicalStatus(row.status),
    storedStatus: row.status,
    paymentState: row.payment_state,
    pincode: row.pincode,
    city: row.address_city,
    revenuePaise: paise(row.revenue_paise, 'order revenue'),
    createdAt: row.created_at,
    pickedUpAt: row.picked_up_at,
    outForDeliveryAt: row.out_for_delivery_at,
    deliveredAt: row.delivered_at,
    claimCode: row.claim_id == null ? null : `CLM-${String(row.claim_id).padStart(6, '0')}`,
    claimStatus: row.claim_status,
    canDownloadReceipt: row.payment_state === 'captured',
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      name: item.common_name ?? 'Plant',
      sizeTier: item.size_tier,
      itemClass: item.item_class,
      // A nested `json_build_object` returns JSON numbers, not the string the
      // column would arrive as. Both shapes are handled so this stays correct
      // whichever way the query is later refactored.
      pricePaise: paise(item.price_paise, 'order item price'),
    })),
  }))
}
