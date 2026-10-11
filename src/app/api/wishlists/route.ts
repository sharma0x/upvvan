import { NextResponse } from 'next/server'

import { getCustomerId } from '@/lib/auth/session'
import { getPool } from '@/lib/db/pool'

/**
 * /api/wishlists — "tell me when it is back".
 *
 * ── WHAT THIS IS FOR, GIVEN NOBODY HAS ONE ───────────────────────────────────
 *
 * The word "wishlist" appears zero times across seven research files covering
 * ten competitors. Not one has one. So this is not a feature we inherited; it is
 * the only place a "notify me" request can honestly go.
 *
 * Ugaoo captures an e-mail and a mobile for back-in-stock on a sold-out variant.
 * Our catalogue is seasonal and six species at a time, so a species genuinely
 * sells out and comes back with the weather. That makes the waitlist a real queue
 * rather than a hypothetical — and a waitlist is worth far more than a like,
 * because it is a customer who has told us which plant they want and agreed to be
 * contacted.
 *
 * ── WHY IT REQUIRES SIGNING IN, AND WHY THAT IS FAIR HERE ────────────────────
 *
 * Because a saved plant is an account feature: it has to survive the customer
 * coming back on a different phone, and it has to be joinable to an order later.
 * better-auth's OTP already signs a customer in from a number they can receive,
 * which is why this needs no new identity store.
 *
 * This is NOT the account wall the research warns about. That is a signup gate in
 * FRONT OF A PURCHASE — IGP requires name, email and phone before checkout and has
 * the worst complaint corpus in the dataset. This is a "we will tell you when it
 * is back" button, which is opt-in, costs one OTP, and gates nothing.
 *
 * ── WHY THE COLLECTION'S OWN `access.create` IS TURNED OFF ───────────────────
 *
 * It was `() => true`, which means `POST /api/wishlists` on Payload's REST API
 * accepted a row from anybody — no session, no validation, no rate limit. That is
 * an open write endpoint on the same origin as the storefront, and it writes a
 * table whose entire purpose is to hold a list of people who asked to be
 * contacted. See `src/collections/Wishlists.ts`.
 */
async function listWishlist(customerId: string) {
  const db = await getPool()
  const { rows } = await db.query<{
    id: number
    sku_id: number | null
    note: string | null
    created_at: Date
    common_name: string | null
    size_tier: string | null
    slug: string | null
    stock_on_hand: string | null
    price_paise: string | null
  }>(
    `SELECT w."id",
            w."sku_id",
            w."note",
            w."created_at",
            sp."common_name",
            s."size_tier",
            s."slug",
            st."stock_on_hand",
            s."base_price_paise" AS "price_paise"
       FROM "wishlists" w
       LEFT JOIN "skus" s     ON s."id" = w."sku_id"
       LEFT JOIN "species" sp ON sp."id" = s."species_id"
       LEFT JOIN "sku_stock" st ON st."sku_id" = s."id"
      WHERE w."better_auth_user_id" = $1
      ORDER BY w."created_at" DESC`,
    [customerId],
  )

  return rows.map((row) => ({
    id: row.id,
    skuId: row.sku_id,
    name: row.common_name ?? 'Plant',
    sizeTier: row.size_tier,
    slug: row.slug,
    note: row.note,
    savedAt: row.created_at,
    // `stock_on_hand` is the honest answer to "is it back yet" — and the whole point of
    // the waitlist is that a customer should never have to send the message that
    // asks it.
    inStock: Number(row.stock_on_hand ?? 0) > 0,
    pricePaise: row.price_paise == null ? null : Number(row.price_paise),
  }))
}

export async function GET(): Promise<NextResponse> {
  const customerId = await getCustomerId()
  if (!customerId) {
    return NextResponse.json({ error: 'Sign in to save a plant.' }, { status: 401 })
  }
  return NextResponse.json({ items: await listWishlist(customerId) })
}

export async function POST(request: Request): Promise<NextResponse> {
  const customerId = await getCustomerId()
  if (!customerId) {
    return NextResponse.json({ error: 'Sign in to save a plant.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { skuId?: unknown; note?: unknown }

  const skuId = String(body.skuId ?? '').trim()
  if (!/^\d+$/.test(skuId)) {
    return NextResponse.json({ error: 'That plant is not valid.' }, { status: 400 })
  }

  const note =
    typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 140) : null

  const db = await getPool()
  const sku = await db.query<{ id: number }>(
    `SELECT "id" FROM "skus" WHERE "id" = $1 AND "is_published"`,
    [skuId],
  )
  if (!sku.rows[0]) {
    return NextResponse.json({ error: 'That plant is not valid.' }, { status: 400 })
  }

  /*
   * Idempotent, deliberately.
   *
   * There is no UNIQUE index on (sku, customer) — see the migration — so saving
   * the same plant twice would create two rows and the customer would be
   * notified twice when it came back. `NOT EXISTS` in the INSERT closes that for
   * the one case a double-tapped button can cause, without introducing the
   * constraint that makes a customer on two devices an error.
   */
  const { rowCount } = await db.query(
    `INSERT INTO "wishlists" ("sku_id", "better_auth_user_id", "customer_email", "note", "created_at", "updated_at")
     SELECT $1, $2, NULL, $3, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "wishlists"
         WHERE "sku_id" = $1 AND "better_auth_user_id" = $2
      )`,
    [skuId, customerId, note],
  )

  return NextResponse.json({ ok: true, alreadySaved: (rowCount ?? 0) === 0 }, { status: 201 })
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const customerId = await getCustomerId()
  if (!customerId) {
    return NextResponse.json({ error: 'Sign in to save a plant.' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'That plant is not valid.' }, { status: 400 })
  }

  const db = await getPool()
  // The ownership predicate IS the authorisation.
  const { rowCount } = await db.query(
    `DELETE FROM "wishlists" WHERE "id" = $1 AND "better_auth_user_id" = $2`,
    [id, customerId],
  )
  if ((rowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'That plant is not valid.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
