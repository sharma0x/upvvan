import { NextResponse } from 'next/server'

import { headers } from 'next/headers'

import { normaliseCode, phoneTail } from '@/lib/orders/db'
import { authoriseOrderAccess } from '@/lib/orders/access'
import { getPool } from '@/lib/db/pool'

/**
 * POST /api/reviews — rate a plant you have actually received.
 *
 * ── WHY A ROUTE AND NOT THE COLLECTION'S `create` ───────────────────────────
 *
 * `Reviews.access.create` is `() => false`, on purpose: a review is about a
 * delivered order LINE, and the identity that proves which line is the order code
 * plus the phone number on the order — the same credential `/order/<code>` and
 * `/api/claims` use. Payload's REST surface has no way to express that, so leaving
 * it open would mean "anybody can review anything", which is the one thing a review
 * wall cannot survive.
 *
 * So it had NO write path at all. `access.create: () => false` plus no route means
 * a review could never be written, which is the state this database was in: zero
 * rows, an average that reads `0 from 0`, and a trigger
 * (`reviews_must_be_about_a_delivered_line`) guarding a table nothing could reach.
 *
 * A review wall that can only ever be empty is worse than no wall, because the
 * PDP renders "4.6 from 128"-shaped slots. This route is the missing half.
 *
 * ── WHAT THE DATABASE STILL ENFORCES ─────────────────────────────────────────
 *
 * Everything that matters is a trigger, not a check in this handler:
 *
 *   · the line must belong to THIS order and this customer's proof,
 *   · the order must be DELIVERED / RESOLVED / CLAIM_OPEN / REPLACEMENT_QUEUED,
 *   · the review's SKU must be the SKU on that line,
 *   · `order_item_id` is UNIQUE, so one line yields one review and the count on a
 *     card is a count of distinct opinions,
 *   · no review body or author name may contain a phone number or an e-mail
 *     address — a review wall is the most-scraped page on a plant site.
 *
 * All five hold for a direct `INSERT` from `psql`, which is the standard this
 * codebase keeps. This handler re-checks so the customer gets a sentence rather
 * than a constraint-violation message; the trigger is what makes it true.
 */
const GENERIC = 'We could not record that just now. Please try again.'

function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    orderCode?: unknown
    phone?: unknown
    orderItemId?: unknown
    rating?: unknown
    title?: unknown
    review?: unknown
  }

  const code = normaliseCode(String(body.orderCode ?? ''))
  const tail = phoneTail(String(body.phone ?? ''))
  if (!code || !tail) {
    return fail('Enter your order code and the phone number on the order.', 400)
  }

  // Same authorisation as every other order-scoped surface: signed cookie, or a
  // customer session that owns the order.
  const access = await authoriseOrderAccess(code, (await headers()).get('cookie') ?? undefined)
  if (!access) return fail('We could not find an order with that code and phone number.', 404)

  const orderItemId = String(body.orderItemId ?? '').trim()
  if (!orderItemId) return fail('Tell us which plant this is about.', 400)

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail('Give it a rating out of five.', 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
  if (title.length < 3) return fail('A title, please.', 400)

  const reviewText = typeof body.review === 'string' ? body.review.trim().slice(0, 2000) : ''
  if (reviewText.length < 10) return fail('Say a little more — a sentence is enough.', 400)

  const pool = await getPool()

  // The line must be on THIS order. Without this a customer could attach a
  // five-star review to somebody else's ZZ plant.
  const line = await pool.query<{ skuId: number; status: string }>(
    `SELECT oi."sku_id" AS "skuId", o."status"::text AS "status"
       FROM "orders_items" oi
       JOIN "orders" o ON o."id" = oi."_parent_id"
      WHERE oi."id" = $1
        AND o."order_code" = $2
        AND right(regexp_replace(o."customer_phone"::text, '\\D', '', 'g'), 4) = $3`,
    [orderItemId, code, tail],
  )
  const lineRow = line.rows[0]
  if (!lineRow) return fail('That is not part of this order.', 400)

  if (!['DELIVERED', 'RESOLVED', 'CLAIM_OPEN', 'REPLACEMENT_QUEUED'].includes(lineRow.status)) {
    return fail('We can only take a review once the plant has arrived.', 409)
  }

  /*
   * The display name is DERIVED from the order, and the request never carries one.
   *
   * A free-text "your name" field on a review wall is how contact details end up
   * scraped — and there is already a database CHECK refusing any body or author
   * containing a phone number or an e-mail address, which is a good constraint to
   * have and a poor thing to rely on the customer not to trip it by typing their
   * number into a box labelled "name".
   *
   * So `Priya S.` comes from `orders.customer_name`: the name the business already
   * holds for this delivery, shortened, first name plus initial. It cannot be a
   * contact detail unless the customer's own name is one.
   *
   * (An earlier draft of this file took `authorName` from the request body and
   * rejected it when absent — i.e. it required the field whose whole point was to
   * not exist.)
   */
  const holder = await pool.query<{ customerName: string | null }>(
    `SELECT o."customer_name" AS "customerName"
       FROM "orders_items" oi
       JOIN "orders" o ON o."id" = oi."_parent_id"
      WHERE oi."id" = $1
        AND o."order_code" = $2`,
    [orderItemId, code],
  )
  const customerName = (holder.rows[0]?.customerName ?? '').trim()
  if (customerName.length < 2) {
    return fail(
      'We could not work out a name to show on this. Please contact us and we will add it.',
      400,
    )
  }
  const authorName = shortenForDisplay(customerName)

  const existing = await pool.query(`SELECT 1 FROM "reviews" WHERE "order_item_id" = $1`, [
    orderItemId,
  ])
  if ((existing.rowCount ?? 0) > 0) {
    return fail('You have already reviewed this plant.', 409)
  }

  try {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO "reviews"
         ("sku_id", "order_item_id", "rating", "title", "body", "author_name", "is_published", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, false, now(), now())
       RETURNING "id"`,
      [lineRow.skuId, orderItemId, rating, title, reviewText, authorName],
    )

    /*
     * `is_published = false`.
     *
     * Moderated, not deleted: the customer can ask for it to come down and we
     * retain the row, so a moderation decision is reversible and auditable.
     * Deleting a customer's words because they are inconvenient is exactly the
     * "ghost customer service" complaint that took a competitor to 1-star.
     *
     * The wall therefore shows nothing until somebody approves. That is honest —
     * an unmoderated wall is a liability — and it is why the admin panel is the
     * approval surface rather than this route.
     */
    return NextResponse.json(
      {
        ok: true,
        reviewId: rows[0]!.id,
        message:
          'Thank you. We read every one before it goes up — it will be on the plant page shortly.',
      },
      { status: 201 },
    )
  } catch (err) {
    const raw = (err as { message?: string }).message ?? ''

    if (raw.includes('reviews_order_item_id_key') || raw.includes('duplicate key')) {
      return fail('You have already reviewed this plant.', 409)
    }
    if (raw.includes('reviews_body_carries_no_contact_details')) {
      return fail(
        'Please take your phone number and e-mail out of the review — we publish these.',
        400,
      )
    }
    if (raw.includes('Only a DELIVERED order can be reviewed')) {
      return fail('We can only take a review once the plant has arrived.', 409)
    }
    if (raw.includes('does not exist')) {
      return fail('That is not part of this order.', 400)
    }

    console.error('[reviews] insert failed:', raw)
    return fail(GENERIC, 500)
  }
}

/**
 * `Meera Rao` → `Meera R.`, `Priya` → `Priya`.
 *
 * A review wall shows initials, not full names: it is the most-scraped page on a
 * plant site, and a surname is the only part anybody with the list actually
 * wants. It also means a customer cannot accidentally publish a name they would
 * rather not have next to a one-star review.
 */
function shortenForDisplay(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 40)
  const first = parts[0]!.slice(0, 40)
  const last = parts[parts.length - 1]!
  return `${first} ${last[0]!.toUpperCase()}.`
}
