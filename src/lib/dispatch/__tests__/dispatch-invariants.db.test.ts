/**
 * DB-LAYER PROOFS. These attempt ILLEGAL RAW SQL that bypasses all application
 * code.
 *
 * The point is stated in AGENTS.md and it is the whole reason this file exists:
 * "If a constraint only exists in TypeScript, those writes succeed and the test
 * fails. That is the point."
 *
 * Every assertion here is therefore "this write MUST be refused by PostgreSQL",
 * executed through the `pg` driver with no Payload, no service layer and no
 * validation hook in the path. If one ever succeeds, the invariant is gone
 * regardless of what the application code says — a second code path, a console,
 * a script, or a future admin endpoint can all write around TypeScript.
 *
 * The invariants under test:
 *   1. DELIVERED cannot be set without a verified customer OTP
 *   2. a DELIVERED event cannot even be RECORDED without one
 *   3. the ledger cannot be edited or deleted — by anyone, including the owner
 *   4. the pay snapshot is immutable
 *   5. a per-rider multiplier may not flatten the city's distance bands
 *   6. only legal transitions, and no way back from a terminal state
 *   7. an inactive rider cannot be given a drop
 *   8. an order gets exactly one dispatch
 *   9. money is integer paise, and the payout matches its own snapshot
 *
 * ── WHY SQLSTATE, NOT MESSAGE TEXT ─────────────────────────────────────────
 * The first draft matched on the error MESSAGE. That couples the proof to the
 * prose, and prose is exactly what changes when somebody improves an error
 * message — at which point a passing proof fails for the wrong reason and gets
 * "fixed" by loosening the assertion until it proves nothing. SQLSTATE is the
 * contract: `P0001` for a trigger RAISE, `23514` for a CHECK, `23505` for unique,
 * `23503` for FK, `23001` for the `restrict_violation` raised explicitly.
 *
 * Message text IS asserted in two places — the OTP rules — because there the
 * wording is rider-facing copy and is therefore genuinely part of the contract.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { config } from '@/lib/config'

/**
 * The pool is created LAZILY, in `beforeAll`, and only when `DATABASE_URL` is set.
 *
 * ── WHY THIS IS NOT `new Pool(...)` AT MODULE SCOPE ─────────────────────────
 * The first draft constructed the pool at module scope. Vitest does not load
 * `.env`, so under `npx vitest run` `config.database.url` is empty — and `pg`
 * treats an EMPTY connection string as "use my default", which is
 * `postgres://localhost:5432`. Postgres 18 is on :55432, so every test in the
 * file died with:
 *
 *   Error: connect ECONNREFUSED ::1:5432
 *
 * The suite that asserts these invariants therefore never ran. Nine proofs that
 * the anti-fraud triggers actually refuse illegal SQL were silently not executing,
 * and a red suite with an obviously environmental cause gets ignored.
 *
 * This mirrors `schema-invariants.db.test.ts`, which guards with
 * `if (!config.database.url) return` and skips with a loud warning. Copying the
 * established pattern is the fix; inventing a third one is what caused it.
 */
let pool: import('pg').Pool | null = null
let connected = false

/**
 * The single accessor every proof goes through.
 *
 * `pool` is nullable because it is opened lazily and may be skipped entirely, and
 * Threading `!` through 16 call sites (or widening the type) would make the
 * nullability invisible at each use — which is exactly the state the file was in
 * when the pool was constructed at module scope and every proof died on a
 * connection error instead of a missing database.
 *
 * One function that throws a clear, non-environmental message is what the
 * sibling suite does, and it is the reason a skip reads as a skip.
 */
function db(): import('pg').Pool {
  if (!pool) {
    throw new Error(
      'dispatch-invariants: no database connection. These are DB-LAYER proofs — they are skipped, not passed, without one.',
    )
  }
  return pool
}

beforeAll(async () => {
  if (!config.database.url) {
    console.warn(
      '[dispatch-invariants] SKIPPED — DATABASE_URL is unset. Load the env (set -a && . ./.env && set +a) to execute these proofs.',
    )
    return
  }
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: config.database.url })
    await pool.query('SELECT 1')
    connected = true
  } catch (err) {
    console.warn(`[dispatch-invariants] SKIPPED — cannot reach Postgres: ${(err as Error).message}`)
  }
})

const stamp = Date.now().toString().slice(-8)
const riderPhone = `98${stamp}01`
const inactivePhone = `98${stamp}02`

/** Every SQLSTATE that means "the database refused this", and nothing else. */
const REFUSALS = new Set([
  'P0001', // raise_exception — every trigger in schema.sql
  '23514', // check_violation
  '23505', // unique_violation
  '23503', // foreign_key_violation
  '23001', // restrict_violation
])

let cityId = 0
let zoneId = 0
let riderId = 0
let inactiveRiderId = 0
let orderSeq = 0
let pincode = '560001'
/** Orders created by this suite, cleaned up at the end. */
const createdOrders: number[] = []
/** False when we adopted a live city's bands rather than authoring them. */
let bandsAreOurs = true
let createdCity = 0

async function expectRefused(label: string, sql: string): Promise<string> {
  try {
    await db().query(sql)
  } catch (err) {
    const { code, message } = err as { code?: string; message?: string }
    expect(
      code !== undefined && REFUSALS.has(code),
      `${label}: expected a constraint refusal, got SQLSTATE ${code}: ${message}`,
    ).toBe(true)
    return message ?? ''
  }
  throw new Error(`${label}: THE WRITE SUCCEEDED — the invariant is not in the database.`)
}

/**
 * A fresh order per proof.
 *
 * Needed because `dispatches_order_id_key` is UNIQUE — which is itself invariant
 * 8. Sharing one order across tests would make every proof after the first fail
 * with a unique violation for a reason unrelated to what it tests, and that is how
 * a real regression gets lost in noise.
 */
async function newOrder(): Promise<number> {
  const { rows } = await db().query<{ id: number }>(
    `INSERT INTO "orders" ("order_code","city_id","status","payment_mode","pincode","zone_id",
                            "revenue_paise","contribution_paise","guarantee_tier","updated_at","created_at")
     VALUES ($1,$2,'PLACED','prepaid',$3,$4,0,0,'T0',now(),now()) RETURNING "id"`,
    [`UPV-DT-${stamp}-${orderSeq++}`, cityId, pincode, zoneId],
  )
  const id = rows[0]!.id
  createdOrders.push(id)
  return id
}

/**
 * Walk a dispatch forward to DELIVERED the only way the schema permits.
 *
 * The STATUS has to be advanced as well as the timestamps — setting
 * `out_for_delivery_at` while the row is still ASSIGNED leaves the transition
 * trigger correctly refusing `ASSIGNED -> DELIVERED`, which is this suite's own
 * invariant 6 doing its job.
 */
async function deliverLegitimately(id: number): Promise<void> {
  await db().query(`UPDATE "dispatches" SET "status"='PICKED_UP', "picked_up_at"=now() WHERE "id"=${id}`)
  await db().query(
    `UPDATE "dispatches" SET "status"='OUT_FOR_DELIVERY', "out_for_delivery_at"=now() WHERE "id"=${id}`,
  )
  await db().query(
    `UPDATE "dispatches" SET "delivery_otp_verified_at"=now() WHERE "id"=${id}`,
  )
  await db().query(
    `UPDATE "dispatches" SET "status"='DELIVERED', "delivered_at"=now() WHERE "id"=${id}`,
  )
}

/** A dispatch on a brand-new order, so each proof is independent. */
async function makeDispatch(): Promise<number> {
  const oid = await newOrder()
  const { rows } = await db().query<{ id: number }>(
    `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status",
                                 "band_code","band_pay_paise","pay_multiplier_bp","payout_paise","assigned_at")
     VALUES ($1,$2,$3,'ASSIGNED','A',4500,10000,4500,now()) RETURNING "id"`,
    [oid, riderId, zoneId],
  )
  return rows[0]!.id
}

beforeAll(async () => {
  /*
   * Bail out cleanly when there is no database to test against.
   *
   * Without this the setup below queries a null pool and every proof throws
   * `cannot read properties of null`, which reads as a broken schema rather than
   * a missing database. Nine anti-fraud proofs that never executed is the worst
   * possible failure mode for this file, so skipping loudly is the point.
   */
  if (!connected || !pool) return

  const live = await db().query<{ id: number }>(
    `SELECT "id" FROM "cities" WHERE "status"='live' AND "is_active" = true ORDER BY "id" LIMIT 1`,
  )

  if (live.rows[0]) {
    cityId = live.rows[0].id
    // Reuse the live city's own serviceable pincode: `trg_order_serviceable`
    // refuses an order for a pincode outside the serviceable set.
    const pin = await db().query<{ pincode: string }>(
      `SELECT "pincode" FROM "pincodes" WHERE "city_id"=$1 AND "is_serviceable" = true LIMIT 1`,
      [cityId],
    )
    pincode = pin.rows[0]?.pincode ?? '560001'
  } else {
    const city = await db().query<{ id: number }>(
      `INSERT INTO "cities" ("name","slug","state","status","is_active","licence_status","licence_approved_at","updated_at","created_at")
       VALUES ($1,$2,'Karnataka','live',true,'approved',now(),now(),now()) RETURNING "id"`,
      [`Dispatch Test ${stamp}`, `dispatch-test-${stamp}`],
    )
    cityId = city.rows[0]!.id
    createdCity = cityId
    pincode = `99${stamp}00`.slice(0, 6)
    await db().query(
      `INSERT INTO "pincodes" ("pincode","city_id","is_serviceable","updated_at","created_at")
       VALUES ($1,$2,true,now(),now())`,
      [pincode, cityId],
    )
  }

  const zone = await db().query<{ id: number }>(
    `INSERT INTO "zones" ("name","city_id","is_active","updated_at","created_at")
     VALUES ($1,$2,true,now(),now()) RETURNING "id"`,
    [`Dispatch Test Zone ${stamp}`, cityId],
  )
  zoneId = zone.rows[0]!.id

  /*
   * REUSE the city's bands; only author them for a city this suite created.
   *
   * Inserting duplicates into a live city is refused by the Phase 0 band-overlap
   * trigger — correctly. Bands must partition distance with no overlap, so a
   * second 0-3km band is an illegal configuration, not a harmless fixture. That
   * refusal is the invariant working, so the fixture respects it rather than
   * working around it.
   */
  const existing = await db().query<{ n: number }>(
    `SELECT COUNT(*)::int AS "n" FROM "delivery_bands" WHERE "city_id" = $1`,
    [cityId],
  )
  if (existing.rows[0]!.n === 0) {
    for (const [code, min, max, pay] of [
      ['A', 0, 3, 4500],
      ['B', 3, 7, 6000],
      ['C', 7, 12, 7500],
    ] as const) {
      await db().query(
        `INSERT INTO "delivery_bands" ("city_id","code","label","min_km","max_km","pay_paise","updated_at","created_at")
         VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
        [cityId, code, `${code} test band`, min, max, pay],
      )
    }
  } else {
    bandsAreOurs = false
  }

  const rider = await db().query<{ id: number }>(
    `INSERT INTO "riders" ("name","phone","city_id","zone_id","active","pay_multiplier_bp","updated_at","created_at")
     VALUES ($1,$2,$3,$4,true,10000,now(),now()) RETURNING "id"`,
    [`Dispatch Test Rider ${stamp}`, riderPhone, cityId, zoneId],
  )
  riderId = rider.rows[0]!.id

  const inactive = await db().query<{ id: number }>(
    `INSERT INTO "riders" ("name","phone","city_id","zone_id","active","pay_multiplier_bp","updated_at","created_at")
     VALUES ($1,$2,$3,$4,false,10000,now(),now()) RETURNING "id"`,
    [`Dispatch Test Inactive ${stamp}`, inactivePhone, cityId, zoneId],
  )
  inactiveRiderId = inactive.rows[0]!.id
})

afterAll(async () => {
  if (!pool) return
  /*
   * Teardown must drop the append-only trigger to delete ledger rows — which is
   * itself the honest demonstration of the only way past append-only: a DDL
   * change, visible in the migration history C-3 mandates. It is restored
   * immediately afterwards.
   */
  await db().query(`DROP TRIGGER IF EXISTS trg_dispatch_events_append_only ON "dispatch_events"`)
  if (createdOrders.length) {
    await db().query(
      `DELETE FROM "dispatch_events" WHERE "dispatch_id" IN (SELECT "id" FROM "dispatches" WHERE "order_id" = ANY($1::int[]))`,
      [createdOrders],
    )
    await db().query(`DELETE FROM "dispatches" WHERE "order_id" = ANY($1::int[])`, [createdOrders])
  }
  await db().query(
    `CREATE TRIGGER trg_dispatch_events_append_only BEFORE UPDATE OR DELETE ON "dispatch_events"
     FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_events_append_only()`,
  )
  await db().query(`DELETE FROM "riders" WHERE "phone" = ANY($1::varchar[])`, [
    [riderPhone, inactivePhone],
  ])
  if (bandsAreOurs) {
    await db().query(`DELETE FROM "delivery_bands" WHERE "city_id" = $1`, [cityId])
  }
  if (createdOrders.length) {
    await db().query(`DELETE FROM "orders" WHERE "id" = ANY($1::int[])`, [createdOrders])
  }
  await db().query(`DELETE FROM "zones" WHERE "id" = $1`, [zoneId])
  if (createdCity) {
    await db().query(`DELETE FROM "pincodes" WHERE "city_id" = $1`, [createdCity])
    await db().query(`DELETE FROM "cities" WHERE "id" = $1`, [createdCity])
  }
  await pool?.end()
})

describe('INVARIANT 1 · DELIVERED requires a verified customer OTP', () => {
  it('refuses status=DELIVERED with no verified code', async () => {
    const id = await makeDispatch()
    const message = await expectRefused(
      'mark delivered without an OTP',
      `UPDATE "dispatches" SET "status"='DELIVERED', "delivered_at"=now(),
         "out_for_delivery_at"=now(), "picked_up_at"=now() WHERE "id"=${id}`,
    )
    // The wording IS part of the contract here: it is rider-facing copy naming the
    // real reason, and a bare "constraint violation" is useless at a doorstep.
    expect(message).toMatch(/OTP/i)
  })

  it('refuses it even when a code was SENT but never verified', async () => {
    const id = await makeDispatch()
    await expectRefused(
      'delivered with a sent-but-unverified code',
      `UPDATE "dispatches" SET "status"='DELIVERED', "delivered_at"=now(),
         "out_for_delivery_at"=now(), "picked_up_at"=now(),
         "delivery_otp_hash"='deadbeef', "delivery_otp_salt"='cafe', "delivery_otp_sent_at"=now()
       WHERE "id"=${id}`,
    )
  })

  it('ALLOWS it once a code is genuinely verified — the control is not a blanket ban', async () => {
    // A guard that refuses everything is not a guard; its only real-world fix is
    // "delete the check".
    const id = await makeDispatch()
    await deliverLegitimately(id)
    const { rows } = await db().query<{ status: string }>(
      `SELECT "status"::text AS "status" FROM "dispatches" WHERE "id"=$1`,
      [id],
    )
    expect(rows[0]!.status).toBe('DELIVERED')
  })
})

describe('INVARIANT 2 · a DELIVERED event cannot be RECORDED without one either', () => {
  it('refuses the INSERT, so the audit trail cannot be the thing that lies', async () => {
    // Stronger than invariant 1. Invariant 1 stops the status column lying; this
    // stops the log lying — otherwise the obvious "fix" for a stuck dispatch is to
    // write a DELIVERED event by hand, which satisfies every reader of the log
    // while the customer never received a plant.
    const id = await makeDispatch()
    const message = await expectRefused(
      'record a DELIVERED event with no OTP',
      `INSERT INTO "dispatch_events" ("dispatch_id","kind","actor_kind","detail")
       VALUES (${id},'DELIVERED','rider','{}')`,
    )
    expect(message).toMatch(/OTP/i)
  })
})

describe('INVARIANT 3 · the ledger is append-only for EVERY role', () => {
  it('refuses UPDATE', async () => {
    const id = await makeDispatch()
    await db().query(
      `INSERT INTO "dispatch_events" ("dispatch_id","kind","actor_kind","detail") VALUES ($1,'ASSIGNED','staff','{}')`,
      [id],
    )
    await expectRefused(
      'update an event',
      `UPDATE "dispatch_events" SET "actor_kind"='rider' WHERE "dispatch_id"=${id}`,
    )
  })

  it('refuses DELETE', async () => {
    const id = await makeDispatch()
    await db().query(
      `INSERT INTO "dispatch_events" ("dispatch_id","kind","actor_kind","detail") VALUES ($1,'ASSIGNED','staff','{}')`,
      [id],
    )
    await expectRefused(
      'delete an event',
      `DELETE FROM "dispatch_events" WHERE "dispatch_id"=${id}`,
    )
  })

  it('refuses DELETE run as the TABLE OWNER', async () => {
    // The trigger has no role exemption at all. Asserted from the same
    // superuser-adjacent connection this suite already holds, because a
    // tamper-evident log you can quietly switch off is not tamper-evident.
    const id = await makeDispatch()
    await db().query(
      `INSERT INTO "dispatch_events" ("dispatch_id","kind","actor_kind","detail") VALUES ($1,'ASSIGNED','staff','{}')`,
      [id],
    )
    await expectRefused('delete as owner', `DELETE FROM "dispatch_events" WHERE "dispatch_id"=${id}`)
  })
})

describe('INVARIANT 4 · the pay snapshot is immutable', () => {
  const cases: Array<[string, string]> = [
    ['the band rate', `UPDATE "dispatches" SET "band_pay_paise"=99900, "payout_paise"=99900 WHERE "id"=%d`],
    ['the multiplier', `UPDATE "dispatches" SET "pay_multiplier_bp"=50000 WHERE "id"=%d`],
    ['the band code', `UPDATE "dispatches" SET "band_code"='C' WHERE "id"=%d`],
    ['the payout alone', `UPDATE "dispatches" SET "payout_paise"=1 WHERE "id"=%d`],
  ]

  for (const [label, sql] of cases) {
    it(`refuses a rewrite of ${label}`, async () => {
      const id = await makeDispatch()
      await expectRefused(`rewrite ${label}`, sql.replace('%d', String(id)))
    })
  }
})

describe('INVARIANT 5 · a multiplier may not flatten the bands', () => {
  it('refuses a multiplier so small the rounded payouts collide', async () => {
    // At 1bp the 4500/6000/7500 bands all ceil to 1 paise — flat per-order pay
    // arriving through the multiplier field instead of the band table. Found by a
    // property test, not by reading code.
    const message = await expectRefused(
      'flatten the bands via the multiplier',
      `UPDATE "riders" SET "pay_multiplier_bp"=1 WHERE "id"=${riderId}`,
    )
    expect(message).toMatch(/longer route would pay the same/i)
  })

  it('still accepts a multiplier AT the safe floor', async () => {
    await db().query(`UPDATE "riders" SET "pay_multiplier_bp"=7 WHERE "id"=${riderId}`)
    const { rows } = await db().query<{ bp: number }>(
      `SELECT "pay_multiplier_bp" AS "bp" FROM "riders" WHERE "id"=$1`,
      [riderId],
    )
    expect(Number(rows[0]!.bp)).toBe(7)
    await db().query(`UPDATE "riders" SET "pay_multiplier_bp"=10000 WHERE "id"=${riderId}`)
  })
})

describe('INVARIANT 6 · legal transitions only, and no way back', () => {
  it('refuses skipping the pickup', async () => {
    const id = await makeDispatch()
    await expectRefused(
      'ASSIGNED -> OUT_FOR_DELIVERY',
      `UPDATE "dispatches" SET "status"='OUT_FOR_DELIVERY', "out_for_delivery_at"=now() WHERE "id"=${id}`,
    )
  })

  it('refuses going backwards from FAILED', async () => {
    const id = await makeDispatch()
    await db().query(
      `UPDATE "dispatches" SET "status"='FAILED', "failure_reason"='test' WHERE "id"=${id}`,
    )
    await expectRefused('FAILED -> ASSIGNED', `UPDATE "dispatches" SET "status"='ASSIGNED' WHERE "id"=${id}`)
  })

  it('refuses un-delivering', async () => {
    const id = await makeDispatch()
    await deliverLegitimately(id)
    await expectRefused('DELIVERED -> ASSIGNED', `UPDATE "dispatches" SET "status"='ASSIGNED' WHERE "id"=${id}`)
  })

  it('refuses a timestamp ordering that could not have happened', async () => {
    const id = await makeDispatch()
    await expectRefused(
      'picked up before assignment',
      `UPDATE "dispatches" SET "picked_up_at"=now() - interval '2 days' WHERE "id"=${id}`,
    )
  })
})

describe('INVARIANT 7 · an inactive rider cannot be given a drop', () => {
  it('refuses the dispatch', async () => {
    const oid = await newOrder()
    const message = await expectRefused(
      'dispatch to an inactive rider',
      `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status","band_code","band_pay_paise","payout_paise")
       VALUES (${oid},${inactiveRiderId},${zoneId},'ASSIGNED','A',4500,4500)`,
    )
    expect(message).toMatch(/not active/i)
  })
})

describe('INVARIANT 8 · one dispatch per order', () => {
  it('refuses a second dispatch for the same order', async () => {
    // This is what makes "unassigned" computable as the ABSENCE of a row rather
    // than a status flag somebody has to remember to clear.
    const oid = await newOrder()
    await db().query(
      `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status","band_code","band_pay_paise","payout_paise")
       VALUES ($1,$2,$3,'ASSIGNED','A',4500,4500)`,
      [oid, riderId, zoneId],
    )
    await expectRefused(
      'second dispatch for the same order',
      `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status","band_code","band_pay_paise","payout_paise")
       VALUES (${oid},${riderId},${zoneId},'ASSIGNED','A',4500,4500)`,
    )
  })
})

describe('INVARIANT 9 · money is integer paise and matches its snapshot', () => {
  it('refuses a fractional payout', async () => {
    const oid = await newOrder()
    await expectRefused(
      'fractional paise',
      `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status","band_code","band_pay_paise","payout_paise")
       VALUES (${oid},${riderId},${zoneId},'ASSIGNED','A',4500,4500.5)`,
    )
  })

  it('refuses a negative payout', async () => {
    const oid = await newOrder()
    await expectRefused(
      'negative payout',
      `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status","band_code","band_pay_paise","payout_paise")
       VALUES (${oid},${riderId},${zoneId},'ASSIGNED','A',-4500,-4500)`,
    )
  })

  it('refuses a payout that disagrees with its own snapshot', async () => {
    // The row stores band, multiplier and payout so it is self-describing; the
    // CHECK is what stops those three from disagreeing.
    const oid = await newOrder()
    await expectRefused(
      'payout != band x multiplier',
      `INSERT INTO "dispatches" ("order_id","rider_id","zone_id","status","band_code","band_pay_paise","pay_multiplier_bp","payout_paise")
       VALUES (${oid},${riderId},${zoneId},'ASSIGNED','A',4500,10000,9999)`,
    )
  })

  it('refuses a rider multiplier of zero', async () => {
    await expectRefused(
      'zero multiplier',
      `UPDATE "riders" SET "pay_multiplier_bp"=0 WHERE "id"=${riderId}`,
    )
  })
})