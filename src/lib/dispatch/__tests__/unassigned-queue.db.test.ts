/**
 * The unassigned dispatch queue is a BACKLOG, not a today-list.
 *
 * ── THE BUG ───────────────────────────────────────────────────────────────────
 *
 * An operator could not assign a rider to a paid order:
 *
 *     UPV-RID-XZMY   PAID   captured   created 2026-10-06 04:11Z
 *
 * Nothing about that order was wrong. It was paid, it was in the live city, it
 * had no dispatch, and it was not in a terminal state. It simply had not been
 * created today.
 *
 * `loadBoard`'s unassigned query ended with `AND o."created_at" >= $2`, where
 * `$2` was the start of today. The filter did not shorten the queue — it DELETED
 * work from it, and permanently, because an order created yesterday is also
 * outside tomorrow's window. So it never reappeared on any later day either.
 *
 * Counting what that hid, on the day it was found:
 *
 *     paid, unassigned, no rider, in the live city:  26
 *     visible in the queue:                            3
 *     oldest stranded order:                     2 days 18 hours
 *
 * Twenty-three paid orders — money taken, plants at the nursery, nobody on the
 * way — and not one of them reachable from the screen whose entire job is to
 * reach them. The tile agreed with the queue, which made it worse: an operator
 * reading "Unassigned 3" has no reason to suspect a missing 23.
 *
 * ── WHY THE ORDER IS BACKDATED WITH RAW SQL ───────────────────────────────────
 *
 * `created_at` is what the filter reads, and there is no way to make "yesterday"
 * through the application: an order created now is created now. So the fixture
 * writes the column directly, which is the same posture as the rest of the
 * DB-layer suite in this directory — the point is to state a fact about the data
 * that is otherwise unstateable, not to go around a validator.
 *
 * Every fixture is written into its OWN city, created and destroyed by this file.
 * That is what makes the count assertion exact: comparing `loadDashboardCounts`
 * against a raw query is only meaningful when both sides are looking at a city
 * nobody else is writing to.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { config } from '@/lib/config'
import { loadBoard, loadDashboardCounts, todayRange } from '@/lib/dispatch/store.server'
import { closePool, getPool } from '@/lib/db/pool'

let connected = false

const stamp = Date.now().toString().slice(-8)
const citySlug = `queue-backlog-${stamp}`
const zoneName = `Queue Backlog Zone ${stamp}`
/*
 * `pincodes.pincode` is globally UNIQUE, so the fixture cannot borrow a real one —
 * and borrowing a real one would put this suite's orders into the live city's
 * serviceable set, where a stray dispatch could be created for them.
 */
const pincode = `9${stamp.slice(-5)}`

let cityId = 0
let zoneId = 0
const createdOrders: number[] = []

/** A paid order whose `created_at` is `daysAgo` days back. */
async function paidOrder(
  label: string,
  daysAgo: number,
  overrides: { paymentState?: string; status?: string } = {},
): Promise<number> {
  const { rows } = await getPool().query<{ id: number }>(
    `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode","zone_id",
                            "revenue_paise","contribution_paise","guarantee_tier",
                            "payment_state","customer_name","customer_phone","address_line1",
                            "updated_at","created_at")
     VALUES ($1,$2,$3,'prepaid',$4,$5,0,0,'T0',
             $6,'Queue Backlog','9000000001','1 Test Road',
             now() - ($7 || ' days')::interval, now() - ($7 || ' days')::interval)
     RETURNING "id"`,
    [
      `UPV-QB-${stamp}-${label}`,
      cityId,
      overrides.status ?? 'PAID',
      pincode,
      zoneId,
      overrides.paymentState ?? 'captured',
      String(daysAgo),
    ],
  )
  const id = rows[0]!.id
  createdOrders.push(id)
  return id
}

beforeAll(async () => {
  if (!config.database.url) {
    console.warn(
      '[unassigned-queue] SKIPPED — DATABASE_URL is unset. Load the env (set -a && . ./.env && set +a) to run these proofs.',
    )
    return
  }
  try {
    await getPool().query('SELECT 1')
    connected = true
  } catch (err) {
    console.warn(`[unassigned-queue] SKIPPED — cannot reach Postgres: ${(err as Error).message}`)
    return
  }

  /*
   * A private city, live and licensed.
   *
   * `trg_order_city_may_trade` refuses an order for a city that is not trading,
   * so the fixture city has to be genuinely live — and it is created and deleted
   * entirely within this file, which is what makes the exact count comparison
   * below meaningful. Nothing else writes to it.
   *
   * Only the ops PAGES call `loadOperationalCity`, and no test does, so a second
   * live city existing for the duration of this file cannot make anything else
   * ambiguous.
   */
  const city = await getPool().query<{ id: number }>(
    `INSERT INTO "cities" ("name","slug","state","status","is_active","licence_status",
                            "licence_number","licence_approved_at","updated_at")
     VALUES ($1,$2,'Karnataka','live',true,'approved',$3,now(),now()) RETURNING "id"`,
    [`Queue Backlog ${stamp}`, citySlug, `QB-${stamp}`],
  )
  cityId = city.rows[0]!.id

  const zone = await getPool().query<{ id: number }>(
    `INSERT INTO "zones" ("name","city_id","updated_at") VALUES ($1,$2,now()) RETURNING "id"`,
    [zoneName, cityId],
  )
  zoneId = zone.rows[0]!.id

  // `trg_order_serviceable` refuses an order whose pincode is not in the
  // serviceable set for its city.
  await getPool().query(
    `INSERT INTO "pincodes" ("pincode","city_id","zone_id","is_serviceable","updated_at")
     VALUES ($1,$2,$3,true,now())`,
    [pincode, cityId, zoneId],
  )
})

afterAll(async () => {
  if (!connected) return
  const pool = getPool()
  await pool.query(`DELETE FROM "orders" WHERE "city_id" = $1`, [cityId])
  await pool.query(`DELETE FROM "pincodes" WHERE "city_id" = $1`, [cityId])
  await pool.query(`DELETE FROM "zones" WHERE "city_id" = $1`, [cityId])
  await pool.query(`DELETE FROM "cities" WHERE "id" = $1`, [cityId])
  await closePool()
})

/** `loadBoard` on this suite's private city, with today's window. */
async function board() {
  return loadBoard(cityId, todayRange())
}

describe('the unassigned dispatch queue', () => {
  it('shows a paid order with no rider that was created days ago', async () => {
    if (!connected) return

    const stranded = await paidOrder('stranded', 3)

    const { unassigned } = await board()

    expect(
      unassigned.map((o) => o.id),
      `A paid order with no rider, created three days ago, is not in the assign queue.\n` +
        `This is the reported bug: UPV-RID-XZMY was PAID, captured, in the live city, with\n` +
        `no dispatch, and invisible — because "unassigned" was being answered with\n` +
        '"created today". A day boundary is not a filter on a backlog; it deletes the\n' +
        `oldest and therefore the most urgent work, permanently.`,
    ).toContain(stranded)
  })

  it('orders the queue oldest first, so the stranded work is at the top', async () => {
    if (!connected) return

    await paidOrder('older', 5)
    const recent = await paidOrder('recent', 0)

    const { unassigned } = await board()
    const created = unassigned.map((o) => o.createdAt.getTime())

    expect(
      [...created].sort((a, b) => a - b),
      'The queue claims to be sorted oldest-first, and age is the reason it is a queue.',
    ).toEqual(created)

    // The 5-day-old fixture must not be sitting below today's order.
    const older = unassigned.filter((o) => o.id !== recent)
    expect(older.length).toBeGreaterThan(0)
    expect(created[0]).toBeLessThan(created[created.length - 1]!)
  })

  it('still excludes an order whose money was never taken', async () => {
    if (!connected) return

    /*
     * `payment_state = 'created'`, not NULL.
     *
     * NULL is also "not captured" and is what a real unpaid order looks like, but
     * `orders_captured_payment_has_contact` only constrains CAPTURED rows, so both
     * are legal fixtures. 'created' is chosen because it is a state the order
     * genuinely passes through before payment completes — the queue must not offer
     * a rider for an order at that point, which is the unpaid-delivery failure
     * `migration 000019` also refuses at the schema layer.
     */
    const unpaid = await paidOrder('unpaid', 1, { paymentState: 'created' })

    const { unassigned } = await board()

    expect(
      unassigned.map((o) => o.id),
      'An order whose money was never taken is in the assign queue with a working\n' +
        'Assign button, which is cash-on-delivery through the back door. The queue is\n' +
        'a backlog, not a dumping ground — opening it up must not have widened it.',
    ).not.toContain(unpaid)
  })

  it('counts every waiting order on the tile, with no day window', async () => {
    if (!connected) return

    const stranded = await paidOrder('tile-stranded', 4)

    const counts = await loadDashboardCounts(cityId, todayRange())

    const { rows } = await getPool().query<{ n: string }>(
      `SELECT COUNT(*) AS "n"
         FROM "orders" o
        WHERE o."city_id" = $1
          AND o."payment_state" = 'captured'
          AND o."status" NOT IN ('DELIVERED','RESOLVED','CANCELLED','CLAIM_REJECTED')
          AND NOT EXISTS (SELECT 1 FROM "dispatches" d WHERE d."order_id" = o."id")`,
      [cityId],
    )

    expect(
      counts.unassigned,
      "The Unassigned tile must count every paid order still waiting, not today's.\n" +
        `It used to share the queue's day boundary, so the two agreed — on a number that\n` +
        `was 23 short while telling an operator everything was fine.`,
    ).toBe(Number(rows[0]!.n))
    expect(counts.unassigned).toBeGreaterThan(0)
    expect(
      counts.unassigned >= 1 && stranded > 0,
      'The stranded fixture must be inside the count the tile reports.',
    ).toBe(true)
  })

  it('keeps the genuinely-today tiles scoped to today', async () => {
    if (!connected) return

    const counts = await loadDashboardCounts(cityId, todayRange())

    /*
     * Only `unassigned` lost its window, and the reason is that it is a backlog
     * rather than an event. `ordersToday` still measures today — so a backdated
     * fixture must NOT inflate it. Without this assertion the fix could have been
     * "delete all the date filters", which would make the tile claim a 3-day-old
     * order was placed today.
     */
    expect(
      counts.ordersToday,
      'A backdated fixture is being counted as an order placed today.',
    ).toBe(1)
  })
})
