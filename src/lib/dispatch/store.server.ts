/**
 * Server-side dispatch data access.
 *
 * WHY RAW SQL RATHER THAN THE PAYLOAD LOCAL API
 * ---------------------------------------------
 * Three reasons, and the first is load-bearing.
 *
 * 1. THE INVARIANTS ARE TRIGGERS, AND THE LOCAL API CAN WRITE AROUND THEM.
 *    `trg_dispatch_delivered_requires_otp` refuses any write that sets
 *    status='DELIVERED' without a verified OTP — for EVERY writer, including
 *    Payload's own data layer and a direct `psql` session. That is the point:
 *    an application-code-only check is bypassable, and Urvann's ₹100 penalty is
 *    what bypassable enforcement looks like in production.
 *
 * 2. `dispatches` carries a PAY SNAPSHOT that must be written in the same
 *    transaction as the append-only `ASSIGNED` event. Payload's create/update
 *    gives one statement per call; a dispatch that exists without its assignment
 *    event is a plant on a bike with no record of who was told to take it.
 *    `createDispatch` wraps both in one `BEGIN/COMMIT`.
 *
 * 3. `dispatch_events` is NOT a Payload collection. It has to be append-only at
 *    the database level with no role exemptions, so it cannot be a collection an
 *    authenticated admin can PATCH.
 *
 * ── MONEY: pg RETURNS `numeric` AS A STRING ─────────────────────────────────
 * This is the trap AGENTS.md calls out by name. `band_pay_paise` arrives as
 * `'4500'`, not `4500`. `Number.isInteger('4500')` is `false`, so an unguarded
 * value makes `formatPaise` throw — the price renders blank — and if it is
 * coerced somewhere deeper instead, a float eventually reaches a paise column.
 *
 * So every numeric column is coerced HERE, at the boundary, by `toPaise`, which
 * refuses a non-integral value outright rather than letting a string coerce
 * silently. This is the same discipline `loader.server.ts` uses for geo.
 */

import { Pool, type PoolClient } from 'pg'

import { config } from '@/lib/config'
import type { DistanceBand, Paise } from '@/lib/geo/bands'
import {
  type ActorKind,
  type ClaimEvidenceKind,
  type DispatchEventKind,
  MAX_OTP_ATTEMPTS,
  generateOtp,
  hashOtp,
  verifyOtp,
} from './otp'
import {
  type Assignment,
  type DispatchStatus,
  assignDispatch,
  humanStatus,
  isLegalTransition,
  snapshotPay,
} from './assign'
import { multiplierPreservesBandOrdering } from './pay'

let pool: Pool | null = null

export async function getPool(): Promise<Pool> {
  if (!pool) pool = new Pool({ connectionString: config.database.url })
  return pool
}

/**
 * Coerce a Postgres `numeric` to integer paise, refusing anything fractional.
 *
 * The driver being faithful to the column type is correct behaviour, not a bug —
 * so the fix is an assertion at the boundary, never a wider cast further in.
 */
export function toPaise(value: unknown, label: string): Paise {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`${label} is not a number: ${JSON.stringify(value)}`)
  }
  if (!Number.isInteger(n)) {
    throw new Error(
      `${label} is ${n}, which is not whole paise. Money is integer paise; a fractional value here means a float reached a money column.`,
    )
  }
  return n
}

/** `json_agg` returns numbers, route params return strings. Compare as strings. */
function sameId(a: string | number | null, b: string | number | null): boolean {
  if (a == null || b == null) return a === b
  return String(a) === String(b)
}

/** ISO day boundaries in the SERVER's timezone, matching `date_trunc` in SQL. */
export function todayRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

// ── rows ─────────────────────────────────────────────────────────────────────

export interface BandRow {
  code: string
  minKm: number
  maxKm: number
  payPaise: Paise
  label: string
}

export interface RiderRow {
  id: number
  name: string
  phone: string
  active: boolean
  cityId: number
  zoneId: number | null
  zoneName: string | null
  payMultiplierBp: number
  maxDropsPerDay: number | null
  maxDailyDrops: number | null
}

/** The projection a rider phone screen needs. Deliberately small: it is a phone. */
export interface DispatchRow {
  id: number
  orderCode: string
  status: DispatchStatus
  bandCode: string
  bandPayPaise: Paise
  payMultiplierBp: number
  payoutPaise: Paise
  pincode: string
  zoneName: string | null
  cityId: number
  orderStatus: string
  guaranteeTier: string
  assignedAt: Date
  pickedUpAt: Date | null
  outForDeliveryAt: Date | null
  deliveredAt: Date | null
  proofPhotoUrl: string | null
  claimEvidenceKind: ClaimEvidenceKind
  claimEvidenceNote: string | null
  deliveryOtpExpiresAt: Date | null
  deliveryOtpSentAt: Date | null
  deliveryOtpAttempts: number
  failureReason: string | null
}

export interface DispatchEventRow {
  id: number
  kind: DispatchEventKind
  actorKind: ActorKind
  actorLabel: string | null
  detail: Record<string, unknown>
  occurredAt: Date
}

export interface DashboardCounts {
  ordersToday: number
  unassigned: number
  inFlight: number
  delivered: number
  claimsOpen: number
  failed: number
  ridersOnShift: number
}

const DISPATCH_SELECT = `
  SELECT d."id",
         o."order_code"                                   AS "orderCode",
         d."status"::text                                 AS "status",
         d."band_code"                                    AS "bandCode",
         d."band_pay_paise"                               AS "bandPayPaise",
         d."pay_multiplier_bp"                            AS "payMultiplierBp",
         d."payout_paise"                                 AS "payoutPaise",
         o."pincode"                                      AS "pincode",
         z."name"                                         AS "zoneName",
         o."city_id"                                      AS "cityId",
         o."status"::text                                 AS "orderStatus",
         o."guarantee_tier"::text                         AS "guaranteeTier",
         d."assigned_at"                                  AS "assignedAt",
         d."picked_up_at"                                 AS "pickedUpAt",
         d."out_for_delivery_at"                          AS "outForDeliveryAt",
         d."delivered_at"                                 AS "deliveredAt",
         d."proof_photo_url"                              AS "proofPhotoUrl",
         d."claim_evidence_kind"                          AS "claimEvidenceKind",
         d."claim_evidence_note"                          AS "claimEvidenceNote",
         d."delivery_otp_expires_at"                      AS "deliveryOtpExpiresAt",
         d."delivery_otp_sent_at"                         AS "deliveryOtpSentAt",
         d."delivery_otp_attempts"                        AS "deliveryOtpAttempts",
         d."failure_reason"                               AS "failureReason"
    FROM "dispatches" d
    JOIN "orders" o ON o."id" = d."order_id"
    LEFT JOIN "zones" z ON z."id" = d."zone_id"
`

function mapDispatch(row: Record<string, unknown>): DispatchRow {
  return {
    id: Number(row.id),
    orderCode: String(row.orderCode),
    status: row.status as DispatchStatus,
    bandCode: String(row.bandCode),
    bandPayPaise: toPaise(row.bandPayPaise, `Dispatch ${row.id} band_pay_paise`),
    payMultiplierBp: Number(row.payMultiplierBp),
    payoutPaise: toPaise(row.payoutPaise, `Dispatch ${row.id} payout_paise`),
    pincode: String(row.pincode),
    zoneName: row.zoneName == null ? null : String(row.zoneName),
    cityId: Number(row.cityId),
    orderStatus: String(row.orderStatus),
    guaranteeTier: String(row.guaranteeTier),
    assignedAt: row.assignedAt as Date,
    pickedUpAt: (row.pickedUpAt as Date) ?? null,
    outForDeliveryAt: (row.outForDeliveryAt as Date) ?? null,
    deliveredAt: (row.deliveredAt as Date) ?? null,
    proofPhotoUrl: row.proofPhotoUrl == null ? null : String(row.proofPhotoUrl),
    claimEvidenceKind: row.claimEvidenceKind as ClaimEvidenceKind,
    claimEvidenceNote: row.claimEvidenceNote == null ? null : String(row.claimEvidenceNote),
    deliveryOtpExpiresAt: (row.deliveryOtpExpiresAt as Date) ?? null,
    deliveryOtpSentAt: (row.deliveryOtpSentAt as Date) ?? null,
    deliveryOtpAttempts: Number(row.deliveryOtpAttempts),
    failureReason: row.failureReason == null ? null : String(row.failureReason),
  }
}

// ── bands + riders ───────────────────────────────────────────────────────────

/**
 * A city's band rows, as the domain type `bands.ts` speaks.
 *
 * `assertBandsAreMonotonic` is deliberately NOT called here — the caller runs it
 * through `assignDispatch`, which reports the failure with the order and city
 * that hit it. Validating here would throw with no context on a dashboard load.
 */
export async function loadBands(cityId: string | number): Promise<DistanceBand[]> {
  const db = await getPool()
  const { rows } = await db.query<{
    code: string
    minKm: number
    maxKm: number
    payPaise: string
    label: string
  }>(
    `SELECT "code", "min_km" AS "minKm", "max_km" AS "maxKm",
            "pay_paise" AS "payPaise", "label"
       FROM "delivery_bands"
      WHERE "city_id" = $1
      ORDER BY "min_km" ASC`,
    [cityId],
  )
  return rows.map((r) => ({
    code: r.code,
    minKm: Number(r.minKm),
    maxKm: Number(r.maxKm),
    payPaise: toPaise(r.payPaise, `Band ${r.code} pay_paise`),
    label: r.label,
  }))
}

/**
 * A zone's daily capacity, or null when ops has not set one.
 *
 * Read on its own inside `createDispatch` rather than folded into `loadRiders`,
 * because `loadRiders` joins the zone for DISPLAY (names) while this is a
 * capacity lookup keyed on the zone alone. Keeping them separate means an
 * unzoned rider yields null capacity — "no cap configured" — rather than
 * silently inheriting some other zone's limit.
 */
export async function loadZoneCapacity(zoneId: string | number): Promise<number | null> {
  const db = await getPool()
  const { rows } = await db.query<{ maxDailyDrops: string | null }>(
    `SELECT "max_daily_drops" AS "maxDailyDrops" FROM "zones" WHERE "id" = $1`,
    [zoneId],
  )
  const value = rows[0]?.maxDailyDrops ?? null
  return value == null ? null : Number(value)
}

export async function loadRiders(cityId: string | number): Promise<RiderRow[]> {
  const db = await getPool()
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT r."id", r."name", r."phone", r."active", r."city_id" AS "cityId",
            r."zone_id" AS "zoneId", z."name" AS "zoneName",
            r."pay_multiplier_bp" AS "payMultiplierBp",
            r."max_drops_per_day" AS "maxDropsPerDay",
            z."max_daily_drops" AS "maxDailyDrops"
       FROM "riders" r
       LEFT JOIN "zones" z ON z."id" = r."zone_id"
      WHERE r."city_id" = $1
      ORDER BY r."name" ASC`,
    [cityId],
  )
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    phone: String(row.phone),
    active: row.active === true,
    cityId: Number(row.cityId),
    zoneId: row.zoneId == null ? null : Number(row.zoneId),
    zoneName: row.zoneName == null ? null : String(row.zoneName),
    payMultiplierBp: Number(row.payMultiplierBp),
    maxDropsPerDay: row.maxDropsPerDay == null ? null : Number(row.maxDropsPerDay),
    maxDailyDrops: row.maxDailyDrops == null ? null : Number(row.maxDailyDrops),
  }))
}

/**
 * The operational city.
 *
 * Single-city by design (research/concept.md: own nursery, own riders, one city
 * at launch), so this resolves to exactly one city and REFUSES if more than one
 * is live, rather than quietly picking the lowest id.
 *
 * That refusal is the most useful guard in this module. Every per-city
 * commercial value — bands, zones, tax — is configured per city, so silently
 * picking one of two live cities means the console shows one city's orders while
 * assigning riders from the other, and nobody notices until a Bengaluru customer
 * gets a Hyderabad pincode. There is a documented precedent for that class of
 * bug: the `CITY_MISMATCH` code in `serviceability.ts` exists because it
 * actually happened.
 *
 * When the second city launches this becomes a city switcher — a configuration
 * change on the console, not a code change, which is the Phase 0 requirement that
 * "adding a new city must cost zero code changes".
 */
export async function loadOperationalCity(): Promise<{ id: number; name: string } | null> {
  const db = await getPool()
  const { rows } = await db.query<{ id: number; name: string }>(
    `SELECT "id", "name" FROM "cities"
      WHERE "status" = 'live' AND "is_active" = true
      ORDER BY "id" ASC`,
  )
  if (rows.length === 0) return null
  if (rows.length > 1) {
    throw new Error(
      `More than one city is live (${rows.map((r) => r.name).join(', ')}). ` +
        'The ops console is single-city by design — activate one, or add a city switcher before turning the second on.',
    )
  }
  return rows[0]!
}

/** JSON-safe serialisation of a `Date` across a server/client component boundary. */
export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listDispatchesForRider(
  riderId: string | number,
  day: { start: Date; end: Date },
): Promise<DispatchRow[]> {
  const db = await getPool()
  const { rows } = await db.query<Record<string, unknown>>(
    `${DISPATCH_SELECT}
      WHERE d."rider_id" = $1
        AND d."assigned_at" >= $2 AND d."assigned_at" < $3
      ORDER BY
        -- Band order, not insertion order. research/concept.md §4.1 requires the
        -- rider to see the distance band — and the run is planned shortest-first
        -- so the far drops are not the ones left when the light goes.
        (SELECT "min_km" FROM "delivery_bands" b
          WHERE b."city_id" = o."city_id" AND b."code" = d."band_code") ASC,
        d."assigned_at" ASC`,
    [riderId, day.start, day.end],
  )
  return rows.map(mapDispatch)
}

/**
 * Today's dispatches for the ops board, plus orders that have NO rider yet.
 *
 * The unassigned set is a LEFT JOIN from `orders`, because "unassigned" is the
 * absence of a dispatch row — deriving it from a status column would mean a
 * second thing to keep in sync, and this is the question the whole console
 * exists to answer.
 */
export async function loadBoard(
  cityId: string | number,
  day: { start: Date; end: Date },
): Promise<{ assigned: DispatchRow[]; unassigned: UnassignedOrder[] }> {
  const db = await getPool()

  const assigned = await db.query<Record<string, unknown>>(
    `${DISPATCH_SELECT}
      WHERE o."city_id" = $1
        AND d."assigned_at" >= $2 AND d."assigned_at" < $3
      ORDER BY d."assigned_at" ASC`,
    [cityId, day.start, day.end],
  )

  const pending = await db.query<Record<string, unknown>>(
    `SELECT o."id", o."order_code" AS "orderCode", o."pincode",
            o."zone_id" AS "zoneId", z."name" AS "zoneName",
            o."status"::text AS "orderStatus", o."revenue_paise" AS "revenuePaise",
            o."created_at" AS "createdAt",
            (SELECT COUNT(*) FROM "orders_items" i WHERE i."_parent_id" = o."id") AS "lineCount"
       FROM "orders" o
       LEFT JOIN "zones" z ON z."id" = o."zone_id"
       LEFT JOIN "dispatches" d ON d."order_id" = o."id"
      WHERE o."city_id" = $1
        AND d."id" IS NULL
        AND o."status" NOT IN ('DELIVERED','RESOLVED','CANCELLED','CLAIM_REJECTED')
        AND o."created_at" >= $2
      ORDER BY o."created_at" ASC
      LIMIT 200`,
    [cityId, day.start],
  )

  return {
    assigned: assigned.rows.map(mapDispatch),
    unassigned: pending.rows.map((row) => ({
      id: Number(row.id),
      orderCode: String(row.orderCode),
      pincode: String(row.pincode),
      zoneId: row.zoneId == null ? null : Number(row.zoneId),
      zoneName: row.zoneName == null ? null : String(row.zoneName),
      orderStatus: String(row.orderStatus),
      revenuePaise: toPaise(row.revenuePaise, `Order ${row.orderCode} revenue_paise`),
      createdAt: row.createdAt as Date,
      lineCount: Number(row.lineCount),
    })),
  }
}

export interface UnassignedOrder {
  id: number
  orderCode: string
  pincode: string
  zoneId: number | null
  zoneName: string | null
  orderStatus: string
  revenuePaise: Paise
  createdAt: Date
  lineCount: number
}

export async function getDispatch(id: string | number): Promise<DispatchRow | null> {
  const db = await getPool()
  const { rows } = await db.query<Record<string, unknown>>(
    `${DISPATCH_SELECT} WHERE d."id" = $1`,
    [id],
  )
  return rows[0] ? mapDispatch(rows[0]) : null
}

/**
 * A dispatch is read with its rider name and a lock on the row.
 *
 * FOR UPDATE because the transition path is read-modify-write: verify the
 * current status, then update it. Without the lock, two concurrent requests from
 * a double-tapped button both read PICKED_UP and both advance to
 * OUT_FOR_DELIVERY, which the legal-transition trigger rejects for the second —
 * so it fails safe, but the rider sees a database error instead of a message.
 */
export async function getDispatchForUpdate(
  client: PoolClient,
  id: string | number,
): Promise<DispatchRow | null> {
  const { rows } = await client.query<Record<string, unknown>>(
    `${DISPATCH_SELECT} WHERE d."id" = $1 FOR UPDATE OF d`,
    [id],
  )
  return rows[0] ? mapDispatch(rows[0]) : null
}

export async function loadEvents(dispatchId: string | number): Promise<DispatchEventRow[]> {
  const db = await getPool()
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT "id", "kind", "actor_kind" AS "actorKind", "actor_label" AS "actorLabel",
            "detail", "occurred_at" AS "occurredAt"
       FROM "dispatch_events"
      WHERE "dispatch_id" = $1
      ORDER BY "occurred_at" ASC, "id" ASC`,
    [dispatchId],
  )
  return rows.map((row) => ({
    id: Number(row.id),
    kind: row.kind as DispatchEventKind,
    actorKind: row.actorKind as ActorKind,
    actorLabel: row.actorLabel == null ? null : String(row.actorLabel),
    detail: (row.detail ?? {}) as Record<string, unknown>,
    occurredAt: row.occurredAt as Date,
  }))
}

/**
 * Open drops per rider for a day.
 *
 * Separate from `loadBoard` because the dispatch projection deliberately does not
 * carry `riderId` — the rider surface is one rider's own drops and has no reason
 * to see anyone else's, so the column stays out of the shared SELECT. The ops
 * console genuinely needs it, so it gets its own narrow aggregate rather than the
 * projection growing a field the rider-facing query has no use for.
 */
export async function loadRiderLoads(
  cityId: string | number,
  day: { start: Date; end: Date },
): Promise<Map<string, number>> {
  const db = await getPool()
  const { rows } = await db.query<{ riderId: number; n: string }>(
    `SELECT d."rider_id" AS "riderId", COUNT(*) AS "n"
       FROM "dispatches" d
       JOIN "orders" o ON o."id" = d."order_id"
      WHERE o."city_id" = $1
        AND d."assigned_at" >= $2 AND d."assigned_at" < $3
        AND d."status" NOT IN ('DELIVERED','FAILED','CANCELLED')
      GROUP BY d."rider_id"`,
    [cityId, day.start, day.end],
  )
  return new Map(rows.map((r) => [String(r.riderId), Number(r.n)]))
}

/**
 * Open drops per ZONE for a day — the ops capacity view.
 *
 * Zone capacity is a commercial decision (`zones.max_daily_drops`), and this is
 * the number that tells an operator whether it is about to bite. Expressed as
 * used/capacity rather than a percentage, because "8 of 8" is a fact an operator
 * can act on and "100%" is not.
 */
export async function loadZoneCapacityToday(
  cityId: string | number,
  day: { start: Date; end: Date },
): Promise<Array<{ zoneId: number; name: string; maxDailyDrops: number | null; used: number }>> {
  const db = await getPool()
  const { rows } = await db.query<{
    zoneId: number
    name: string
    maxDailyDrops: string | null
    used: string
  }>(
    `SELECT z."id" AS "zoneId", z."name", z."max_daily_drops" AS "maxDailyDrops",
            COUNT(d."id") FILTER (
              WHERE d."status" NOT IN ('DELIVERED','FAILED','CANCELLED')
            ) AS "used"
       FROM "zones" z
       LEFT JOIN "dispatches" d
         ON d."zone_id" = z."id"
        AND d."assigned_at" >= $2 AND d."assigned_at" < $3
      WHERE z."city_id" = $1 AND z."is_active" = true
      GROUP BY z."id", z."name", z."max_daily_drops"
      ORDER BY z."name" ASC`,
    [cityId, day.start, day.end],
  )
  return rows.map((r) => ({
    zoneId: Number(r.zoneId),
    name: r.name,
    maxDailyDrops: r.maxDailyDrops == null ? null : Number(r.maxDailyDrops),
    used: Number(r.used),
  }))
}

export async function loadDashboardCounts(
  cityId: string | number,
  day: { start: Date; end: Date },
): Promise<DashboardCounts> {
  const db = await getPool()
  const { rows } = await db.query<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*) FROM "orders"
         WHERE "city_id" = $1 AND "created_at" >= $2 AND "created_at" < $3) AS "ordersToday",
       (SELECT COUNT(*) FROM "orders" o
         WHERE o."city_id" = $1 AND o."created_at" >= $2
           AND o."status" NOT IN ('DELIVERED','RESOLVED','CANCELLED','CLAIM_REJECTED')
           AND NOT EXISTS (SELECT 1 FROM "dispatches" d WHERE d."order_id" = o."id")) AS "unassigned",
       (SELECT COUNT(*) FROM "dispatches" d
         JOIN "orders" o ON o."id" = d."order_id"
        WHERE o."city_id" = $1 AND d."assigned_at" >= $2 AND d."assigned_at" < $3
          AND d."status" IN ('ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY')) AS "inFlight",
       (SELECT COUNT(*) FROM "dispatches" d
         JOIN "orders" o ON o."id" = d."order_id"
        WHERE o."city_id" = $1 AND d."assigned_at" >= $2 AND d."assigned_at" < $3
          AND d."status" = 'DELIVERED') AS "delivered",
       (SELECT COUNT(*) FROM "dispatches" d
         JOIN "orders" o ON o."id" = d."order_id"
        WHERE o."city_id" = $1 AND d."assigned_at" >= $2 AND d."assigned_at" < $3
          AND o."status" = 'CLAIM_OPEN') AS "claimsOpen",
       (SELECT COUNT(*) FROM "dispatches" d
         JOIN "orders" o ON o."id" = d."order_id"
        WHERE o."city_id" = $1 AND d."assigned_at" >= $2 AND d."assigned_at" < $3
          AND d."status" = 'FAILED') AS "failed",
       (SELECT COUNT(*) FROM "riders" WHERE "city_id" = $1 AND "active") AS "ridersOnShift"`,
    [cityId, day.start, day.end],
  )
  const row = rows[0] ?? {}
  return {
    ordersToday: Number(row.ordersToday ?? 0),
    unassigned: Number(row.unassigned ?? 0),
    inFlight: Number(row.inFlight ?? 0),
    delivered: Number(row.delivered ?? 0),
    claimsOpen: Number(row.claimsOpen ?? 0),
    failed: Number(row.failed ?? 0),
    ridersOnShift: Number(row.ridersOnShift ?? 0),
  }
}

// ── writes ───────────────────────────────────────────────────────────────────

/**
 * Append an event.
 *
 * Never wrapped in its own error suppression: the whole anti-fraud value of the
 * ledger depends on an event existing whenever the status changes, so this runs
 * in the SAME transaction as the status write. A dispatch that moved to
 * DELIVERED without a DELIVERED event would leave the audit trail quietly wrong
 * while every screen looked fine.
 */
export async function appendEvent(
  client: PoolClient,
  args: {
    dispatchId: string | number
    kind: DispatchEventKind
    actorKind: ActorKind
    actorLabel?: string | null
    detail?: Record<string, unknown>
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "dispatch_events"
       ("dispatch_id", "kind", "actor_kind", "actor_label", "detail")
     VALUES ($1, $2, $3, $4, $5)`,
    [
      args.dispatchId,
      args.kind,
      args.actorKind,
      args.actorLabel ?? null,
      JSON.stringify(args.detail ?? {}),
    ],
  )
}

/**
 * Queue an OTP in the outbox.
 *
 * The SMS GATEWAY IS NOT WIRED — deliberately visible here rather than a
 * console.log. "The customer never got the code" and "the rider skipped the OTP"
 * look identical on a dispatch board, and the first is our failure while the
 * second is a process question. Keeping the outbox as a table means the unsent
 * state is queryable.
 */
async function queueOtp(
  client: PoolClient,
  toNumber: string,
  orderCode: string,
  code: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "outbox" ("channel", "to_number", "body", "kind")
     VALUES ('sms', $1, $2, 'delivery_otp')`,
    [
      toNumber,
      `Upvvan: your order ${orderCode} is out for delivery. Delivery code ${code}. Give it to the rider only when the plant is in your hands.`,
    ],
  )
}

export interface CreateDispatchArgs {
  orderId: string | number
  distanceKm: number
  actorLabel?: string | null
  /** Overrides allocation. Only used by the ops console's "assign to rider" pick. */
  forcedRiderId?: string | number
}

/** `assignDispatch`'s result plus the row it created. */
export type CreatedDispatch = Assignment & { dispatchId: number }

/**
 * Assign an order to a rider and SNAPSHOT the pay, in one transaction.
 *
 * `SELECT ... FOR UPDATE` on the order row is the concurrency guard. Without it,
 * two ops staff clicking Assign on the same order both pass the "no dispatch
 * exists" check, both insert, and one gets a unique-violation on
 * `dispatches_order_id_key` — which is safe, but surfaces as a 500 rather than
 * "already assigned".
 */
export async function createDispatch(args: CreateDispatchArgs): Promise<CreatedDispatch> {
  const db = await getPool()
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: orderRows } = await client.query<{
      id: number
      cityId: number
      zoneId: number | null
      orderCode: string
      phone: string | null
    }>(
      `SELECT o."id", o."city_id" AS "cityId", o."zone_id" AS "zoneId",
              o."order_code" AS "orderCode", u."phoneNumber" AS "phone"
         FROM "orders" o
         LEFT JOIN "user" u ON u."id" = o."customer_id"
        WHERE o."id" = $1
        FOR UPDATE OF o`,
      [args.orderId],
    )
    const order = orderRows[0]
    if (!order) throw new Error(`Order ${args.orderId} does not exist.`)

    const existing = await client.query<{ id: number }>(
      `SELECT "id" FROM "dispatches" WHERE "order_id" = $1`,
      [args.orderId],
    )
    if (existing.rows[0]) {
      throw new Error(`Order ${order.orderCode} already has a dispatch.`)
    }

    const bands = await loadBands(order.cityId)
    const riders = await loadRiders(order.cityId)

    const { start, end } = todayRange()
    const { rows: loadRows } = await client.query<{
      riderId: number
      status: string
    }>(
      `SELECT "rider_id" AS "riderId", "status"::text AS "status"
         FROM "dispatches"
        WHERE "assigned_at" >= $1 AND "assigned_at" < $2`,
      [start, end],
    )

    const assignment = assignDispatch({
      orderId: order.id,
      cityId: order.cityId,
      zoneId: order.zoneId,
      distanceKm: args.distanceKm,
      bands,
      riders: riders.map((r) => ({
        id: r.id,
        name: r.name,
        cityId: r.cityId,
        zoneId: r.zoneId,
        active: r.active,
        maxDropsPerDay: r.maxDropsPerDay,
        payMultiplierBp: r.payMultiplierBp,
      })),
      loads: loadRows.map((l) => ({
        riderId: l.riderId,
        status: l.status as DispatchStatus,
        assignedAt: start,
      })),
      zones: riders
        .filter((r) => r.zoneId != null && r.maxDailyDrops != null)
        .map((r) => ({ zoneId: r.zoneId as number, maxDailyDrops: r.maxDailyDrops })),
    })

    // An ops-console override is honoured, but the SAME snapshot and the SAME
    // capacity maths apply — it changes WHO, never WHAT they are paid.
    //
    // The snapshot is recomputed against the chosen rider's multiplier rather
    // than reused from `assignment`. Reusing it would pay a manually-chosen
    // rider at the automatically-chosen rider's rate, and since the multiplier
    // is the per-rider uplift, that is a silent pay error in whichever direction
    // the two riders' seniority happens to differ. The BAND never changes — only
    // the multiplier applied to it — so the incentive inversion still holds.
    // Extracted to a const first because TypeScript will not narrow a property
    // access (`args.forcedRiderId`) inside a closure — the callback could run
    // after a mutation, so the narrowing is not sound there. Reading it once
    // makes the narrowing local and obvious.
    const forcedRiderId = args.forcedRiderId ?? null
    const chosen =
      forcedRiderId != null
        ? riders.find((r) => sameId(r.id, forcedRiderId))
        : riders.find((r) => sameId(r.id, assignment.riderId))

    if (!chosen || !chosen.active) {
      throw new Error('That rider is not active and cannot be given a drop.')
    }
    if (!sameId(chosen.cityId, order.cityId)) {
      throw new Error('That rider does not deliver in this order’s city.')
    }

    // Re-resolve the band from the loaded set rather than reconstructing a
    // partial DistanceBand. If the band vanished between allocation and insert
    // the dispatch is refused outright — a payout for a band that does not
    // exist is exactly the "rider paid at zero" failure this module exists to
    // make impossible.
    const band = bands.find((b) => b.code === assignment.bandCode)
    if (!band) {
      throw new Error(
        `Band ${assignment.bandCode} is no longer configured for this city. Reassign the drop.`,
      )
    }

    // LAST LINE OF DEFENCE before a payout is committed.
    //
    // The collection hook and the DB trigger both refuse a multiplier that would
    // round two of this city's bands onto the same payout. This repeats the check
    // here because this is the code that actually writes the money, and because
    // the rider's multiplier can have been changed by a direct write between the
    // admin saving it and this drop being assigned.
    if (!multiplierPreservesBandOrdering(chosen.payMultiplierBp, bands)) {
      throw new Error(
        `${chosen.name}'s pay multiplier (${chosen.payMultiplierBp}bp) would pay a longer drop the same as a shorter one for this city's bands. Fix the rider's multiplier before assigning.`,
      )
    }

    const pay = snapshotPay(band, chosen.payMultiplierBp)
    // If ops forced a rider, the capacity check that `assignDispatch` performed
    // was performed on a DIFFERENT rider. Re-check the forced one, or an
    // override becomes a way to overload a rider past what the zone allows.
    if (args.forcedRiderId != null) {
      const zoneCap = chosen.zoneId == null ? null : (await loadZoneCapacity(chosen.zoneId))
      const cap = chosen.maxDropsPerDay ?? zoneCap
      if (cap != null) {
        const { rows: held } = await client.query<{ n: string }>(
          `SELECT COUNT(*) AS "n" FROM "dispatches"
            WHERE "rider_id" = $1 AND "assigned_at" >= $2 AND "assigned_at" < $3
              AND "status" NOT IN ('DELIVERED','FAILED','CANCELLED')`,
          [chosen.id, start, end],
        )
        if (Number(held[0]?.n ?? 0) >= cap) {
          throw new Error(
            `${chosen.name} already holds ${held[0]?.n} of ${cap} drops today. Raise their max_drops_per_day first.`,
          )
        }
      }
    }
    const { rows: inserted } = await client.query<{ id: number }>(
      `INSERT INTO "dispatches"
         ("order_id", "rider_id", "zone_id", "status",
          "band_code", "band_pay_paise", "pay_multiplier_bp", "payout_paise", "assigned_at")
       VALUES ($1, $2, $3, 'ASSIGNED', $4, $5, $6, $7, now())
       RETURNING "id"`,
      [
        order.id,
        chosen.id,
        chosen.zoneId,
        pay.bandCode,
        pay.bandPayPaise,
        pay.payMultiplierBp,
        pay.payoutPaise,
      ],
    )
    const dispatchId = inserted[0]!.id

    await appendEvent(client, {
      dispatchId,
      kind: 'ASSIGNED',
      actorKind: args.actorLabel ? 'staff' : 'system',
      actorLabel: args.actorLabel ?? null,
      detail: {
        bandCode: pay.bandCode,
        bandPayPaise: pay.bandPayPaise,
        payMultiplierBp: pay.payMultiplierBp,
        payoutPaise: pay.payoutPaise,
        distanceKm: args.distanceKm,
        // The band PAY is recorded as an event detail as well as on the row, so
        // a dispute about a rider's earnings can be settled from the ledger even
        // if the band table has since been rewritten.
        bandSnapshotReason: 'band pay is snapshotted at assignment so later band edits cannot rewrite history',
      },
    })

    // Send the customer's OTP up front rather than at the door. Two reasons: the
    // rider should not be the one generating a code they are about to be judged
    // by, and a customer who has the code while they are packing an area to
    // receive a plant is a customer who will actually read it out.
    const code = generateOtp()
    const { hash, salt } = hashOtp(code)
    await client.query(
      `UPDATE "dispatches"
          SET "delivery_otp_hash" = $1, "delivery_otp_salt" = $2,
              "delivery_otp_sent_at" = now(),
              "delivery_otp_expires_at" = now() + ($3 || ' seconds')::interval
        WHERE "id" = $4`,
      [hash, salt, String(config.auth.otpExpiresIn), dispatchId],
    )
    if (order.phone) {
      await queueOtp(client, order.phone, order.orderCode, code)
      await appendEvent(client, {
        dispatchId,
        kind: 'OTP_SENT',
        actorKind: 'system',
        detail: { channel: 'sms', expiresInSeconds: config.auth.otpExpiresIn },
      })
    }

    await client.query('COMMIT')

    // `dispatchId` is included because every caller needs it — the ops console
    // links straight to the drop it just created, and the response is what the
    // client navigates with. `assignment` alone cannot answer "which row".
    return {
      ...assignment,
      dispatchId,
      riderId: chosen.id,
      riderName: chosen.name,
      zoneId: chosen.zoneId,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export type TransitionErrorCode =
  | 'NOT_FOUND'
  | 'ILLEGAL_TRANSITION'
  | 'OTP_REQUIRED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_ATTEMPTS_EXHAUSTED'
  | 'NO_CUSTOMER_PHONE'
  | 'FORBIDDEN'

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: TransitionErrorCode,
    readonly status = 409,
  ) {
    super(message)
    this.name = 'TransitionError'
  }
}

/**
 * Advance a dispatch's status.
 *
 * `actorRiderId` is the OWNERSHIP check and it lives inside the locked read, not
 * in the route. That placement is the whole point: a check in the route is a
 * check on a row that can change underneath it, whereas the `FOR UPDATE` read
 * means the row cannot move between "is this mine?" and "advance it". A signed-in
 * rider who could move somebody else's drop would be able to mark another
 * rider's delivery complete — which is precisely the fraud the OTP exists to
 * stop, arriving through the door we left open.
 *
 * Pass null for a staff-actor transition (the ops console reissuing a code),
 * which is authorised by its own route.
 *
 * DELIVERED takes a separate path — `verifyDeliveryOtp` — because the trigger
 * refuses to set it any other way. This function rejecting it is the friendly
 * version of that: the rider gets "ask the customer for their code" rather than
 * a constraint-violation message from Postgres.
 */
export async function transitionStatus(args: {
  dispatchId: string | number
  to: DispatchStatus
  actorKind: ActorKind
  actorLabel?: string | null
  /** Non-null asserts the session's rider owns this drop. */
  actorRiderId?: string | number | null
  failureReason?: string | null
}): Promise<DispatchRow> {
  if (args.to === 'DELIVERED') {
    throw new TransitionError(
      'A delivery is closed with the customer’s code, not a status button. Ask the customer for the code they received.',
      'OTP_REQUIRED',
      400,
    )
  }

  const db = await getPool()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const current = await getDispatchForUpdate(client, args.dispatchId)
    if (!current) throw new TransitionError('That drop no longer exists.', 'NOT_FOUND', 404)

    if (args.actorRiderId != null) {
      const { rows: owned } = await client.query<{ riderId: number }>(
        `SELECT "rider_id" AS "riderId" FROM "dispatches" WHERE "id" = $1`,
        [args.dispatchId],
      )
      if (!owned[0] || Number(owned[0].riderId) !== Number(args.actorRiderId)) {
        throw new TransitionError(
          'That drop is not on your run. Ask the dispatcher to move it to you.',
          'FORBIDDEN',
          403,
        )
      }
    }

    if (!isLegalTransition(current.status, args.to)) {
      throw new TransitionError(
        // `/g` because `OUT_FOR_DELIVERY` has two underscores. A string-pattern
        // `replace` replaces only the FIRST match, which rendered the rider-facing
        // message as "cannot become out for_delivery" — a status vocabulary leaking
        // an internal constant into copy a rider reads at a doorstep.
        `A drop that is ${humanStatus(current.status)} cannot become ${humanStatus(args.to)}.`,
        'ILLEGAL_TRANSITION',
      )
    }

    const stampColumn =
      args.to === 'PICKED_UP' ? 'picked_up_at' : args.to === 'OUT_FOR_DELIVERY' ? 'out_for_delivery_at' : null

    const { rows } = await client.query<Record<string, unknown>>(
      `UPDATE "dispatches"
          SET "status" = $1,
              ${stampColumn ? `"${stampColumn}" = now(),` : ''}
              "failure_reason" = $2,
              "updated_at" = now()
        WHERE "id" = $3
      RETURNING "id"`,
      [args.to, args.failureReason ?? null, args.dispatchId],
    )
    if (!rows[0]) throw new TransitionError('That drop no longer exists.', 'NOT_FOUND', 404)

    await appendEvent(client, {
      dispatchId: args.dispatchId,
      kind: args.to,
      actorKind: args.actorKind,
      actorLabel: args.actorLabel ?? null,
      detail: args.failureReason ? { failureReason: args.failureReason } : {},
    })

    await client.query('COMMIT')

    const fresh = await getDispatch(args.dispatchId)
    return fresh!
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Close a delivery with the customer's OTP.
 *
 * THE FUNCTION THE WHOLE ANTI-FRAUD DESIGN RESTS ON. Reaching DELIVERED requires
 * a code that only the customer has, and the write is refused by the database if
 * that code was never verified — so this is not a convention any code path can
 * skip.
 *
 * The attempt counter is checked and incremented in the same locked read, which
 * is what stops a scripted caller from trying a million codes: the row is
 * locked FOR UPDATE, so concurrent attempts serialise.
 */
export async function verifyDeliveryOtp(args: {
  dispatchId: string | number
  code: string
  actorKind: ActorKind
  actorLabel?: string | null
  /** Non-null asserts the session's rider owns this drop. */
  actorRiderId?: string | number | null
  claimEvidenceKind?: ClaimEvidenceKind
  claimEvidenceNote?: string | null
}): Promise<DispatchRow> {
  const db = await getPool()
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: dispatchRows } = await client.query<Record<string, unknown>>(
      `SELECT d."id", d."status"::text AS "status",
              d."rider_id" AS "riderId",
              d."delivery_otp_hash" AS "hash", d."delivery_otp_salt" AS "salt",
              d."delivery_otp_expires_at" AS "expiresAt",
              d."delivery_otp_attempts" AS "attempts",
              o."order_code" AS "orderCode", u."phoneNumber" AS "phone"
         FROM "dispatches" d
         JOIN "orders" o ON o."id" = d."order_id"
         LEFT JOIN "user" u ON u."id" = o."customer_id"
        WHERE d."id" = $1
        FOR UPDATE OF d`,
      [args.dispatchId],
    )
    const row = dispatchRows[0]
    if (!row) throw new TransitionError('That drop no longer exists.', 'NOT_FOUND', 404)

    if (row.status === 'DELIVERED') {
      throw new TransitionError('This drop is already closed as delivered.', 'ILLEGAL_TRANSITION')
    }

    // Ownership, inside the same FOR UPDATE read that decides the outcome. See
    // `transitionStatus` for why this lives here rather than in the route.
    if (args.actorRiderId != null && Number(row.riderId) !== Number(args.actorRiderId)) {
      throw new TransitionError(
        'That drop is not on your run. Ask the dispatcher to move it to you.',
        'FORBIDDEN',
        403,
      )
    }
    if (row.status !== 'OUT_FOR_DELIVERY') {
      throw new TransitionError(
        'Mark the drop as out for delivery before closing it, so the timeline reflects the door visit.',
        'ILLEGAL_TRANSITION',
      )
    }

    /*
     * NO PHONE ON FILE — checked BEFORE the attempt counter.
     *
     * A code is hashed onto the row regardless of whether it could be delivered,
     * so an order with no customer phone presents as "the code is wrong" no
     * matter how many times the rider tries. That is a dead end: the rider cannot
     * fix it, has no way to tell the dispatcher what is actually wrong, and burns
     * all five attempts against a code nobody will ever receive.
     *
     * So the real reason is named first. This is the "errors must never reach a
     * customer" rule working in the OTHER direction — not hiding an internal
     * message, but refusing to show a misleading one.
     */
    if (!row.phone) {
      throw new TransitionError(
        'This customer has no phone number on file, so there is no delivery code to read out. Ask the dispatcher to sort it out — you cannot close this drop.',
        'NO_CUSTOMER_PHONE',
        422,
      )
    }

    const attempts = Number(row.attempts ?? 0)
    if (attempts >= MAX_OTP_ATTEMPTS) {
      throw new TransitionError(
        `Too many wrong codes on this drop (${MAX_OTP_ATTEMPTS}). Ask the dispatcher to reissue it.`,
        'OTP_ATTEMPTS_EXHAUSTED',
        429,
      )
    }
    if (!row.hash || !row.salt) {
      throw new TransitionError(
        'No delivery code was sent for this drop. Ask the dispatcher to reissue it.',
        'OTP_INVALID',
      )
    }
    if (row.expiresAt && new Date(row.expiresAt as Date).getTime() < Date.now()) {
      throw new TransitionError(
        'That delivery code has expired. Ask the dispatcher to reissue it.',
        'OTP_EXPIRED',
      )
    }

    const ok = verifyOtp(args.code, String(row.hash), String(row.salt))
    if (!ok) {
      await client.query(
        `UPDATE "dispatches" SET "delivery_otp_attempts" = "delivery_otp_attempts" + 1 WHERE "id" = $1`,
        [args.dispatchId],
      )
      await client.query('COMMIT')
      throw new TransitionError(
        'That code does not match. Ask the customer to check the SMS — a delivery cannot be closed on a guess.',
        'OTP_INVALID',
        400,
      )
    }

    const evidence = args.claimEvidenceKind ?? 'unboxing_video_requested'

    // Verified first, THEN delivered. The order matters: the trigger reads
    // `delivery_otp_verified_at`, so setting both in one statement would work,
    // but two statements make the causal chain legible in the ledger — OTP_VERIFIED
    // then DELIVERED, and anyone reading the log can see the sequence.
    await client.query(
      `UPDATE "dispatches"
          SET "delivery_otp_verified_at" = now(),
              "claim_evidence_kind" = $2,
              "claim_evidence_note" = $3,
              "claim_evidence_at" = now(),
              "updated_at" = now()
        WHERE "id" = $1`,
      [args.dispatchId, evidence, args.claimEvidenceNote ?? null],
    )
    await appendEvent(client, {
      dispatchId: args.dispatchId,
      kind: 'OTP_VERIFIED',
      actorKind: args.actorKind,
      actorLabel: args.actorLabel ?? null,
      detail: { claimEvidenceKind: evidence },
    })

    await client.query(
      `UPDATE "dispatches"
          SET "status" = 'DELIVERED', "delivered_at" = now(), "updated_at" = now()
        WHERE "id" = $1`,
      [args.dispatchId],
    )
    await appendEvent(client, {
      dispatchId: args.dispatchId,
      kind: 'DELIVERED',
      actorKind: args.actorKind,
      actorLabel: args.actorLabel ?? null,
      detail: {
        orderCode: String(row.orderCode),
        claimEvidenceKind: evidence,
        note: 'Closed on a customer-read delivery code. No penalty regime exists in this system.',
      },
    })
    await appendEvent(client, {
      dispatchId: args.dispatchId,
      kind: 'CLAIM_EVIDENCE',
      actorKind: args.actorKind,
      actorLabel: args.actorLabel ?? null,
      detail: {
        kind: evidence,
        note: args.claimEvidenceNote ?? null,
        mechanism:
          'research/concept.md §7 — uncut same-day unboxing video, stated at point of sale, yields claim evidence and fraud filtering from one artefact.',
      },
    })

    // Keep the order's own status in step. It is a denormalised copy of the
    // delivery state, but the storefront order page reads it, and a page showing
    // "out for delivery" after the plant arrived is the exact complaint this
    // whole system exists to prevent.
    await client.query(
      `UPDATE "orders" SET "status" = 'DELIVERED', "updated_at" = now()
        WHERE "id" = (SELECT "order_id" FROM "dispatches" WHERE "id" = $1)`,
      [args.dispatchId],
    )

    await client.query('COMMIT')

    return (await getDispatch(args.dispatchId))!
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Reissue a delivery code. Staff-only in practice; the route enforces that. */
export async function reissueOtp(args: {
  dispatchId: string | number
  actorLabel?: string | null
}): Promise<{ expiresAt: Date }> {
  const db = await getPool()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ orderCode: string; phone: string | null; status: string }>(
      `SELECT o."order_code" AS "orderCode", u."phoneNumber" AS "phone", d."status"::text AS "status"
         FROM "dispatches" d
         JOIN "orders" o ON o."id" = d."order_id"
         LEFT JOIN "user" u ON u."id" = o."customer_id"
        WHERE d."id" = $1
        FOR UPDATE OF d`,
      [args.dispatchId],
    )
    const row = rows[0]
    if (!row) throw new TransitionError('That drop no longer exists.', 'NOT_FOUND', 404)
    if (row.status === 'DELIVERED') {
      throw new TransitionError('This drop is already delivered; there is nothing to reissue.', 'ILLEGAL_TRANSITION')
    }
    if (!row.phone) {
      throw new TransitionError(
        'This customer has no phone number on file, so there is nowhere to send a delivery code.',
        'NO_CUSTOMER_PHONE',
        422,
      )
    }

    const code = generateOtp()
    const { hash, salt } = hashOtp(code)
    const { rows: updated } = await client.query<{ expiresAt: Date }>(
      `UPDATE "dispatches"
          SET "delivery_otp_hash" = $1, "delivery_otp_salt" = $2,
              "delivery_otp_sent_at" = now(), "delivery_otp_attempts" = 0,
              "delivery_otp_expires_at" = now() + ($3 || ' seconds')::interval
        WHERE "id" = $4
      RETURNING "delivery_otp_expires_at" AS "expiresAt"`,
      [hash, salt, String(config.auth.otpExpiresIn), args.dispatchId],
    )
    await queueOtp(client, row.phone, row.orderCode, code)
    await appendEvent(client, {
      dispatchId: args.dispatchId,
      kind: 'OTP_SENT',
      actorKind: 'staff',
      actorLabel: args.actorLabel ?? null,
      detail: { reissued: true, orderCode: row.orderCode },
    })
    await client.query('COMMIT')
    return { expiresAt: updated[0]!.expiresAt }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}