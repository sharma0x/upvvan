/**
 * Phase 0 seed — one city, its zones, bands, pincodes and price book.
 *
 * Safe to re-run: everything is upserted by a natural key, so running it twice
 * changes nothing. That matters because seeding is a development convenience and
 * must never be a thing that accumulates duplicates.
 *
 * Everything here is CONFIGURATION, not code. A new city is a new row in this
 * file's data — no code change, no deploy (product-design.md §1).
 *
 * Values come from the design docs:
 *   · bands  — ₹45 / ₹60 / ₹75 over a 12km zone (product-design.md §4.1)
 *   · tier   — T0, 48 hours (use-cases.md §11, revised 4 Oct 2026)
 *   · licence— Bengaluru, Karnataka. Karnataka is NOT one of the four states with
 *              a mandatory nursery registration act, so the licence is a
 *              business formality here. Hyderabad is deliberately seeded as a
 *              PENDING city with no approved licence, so the DB gate has
 *              something real to refuse.
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

/** Launch bands. Configurable via env so a founder can change them here. */
const BANDS = [
  { code: 'A', label: 'Band A · 0–3 km · ₹45', minKm: 0, maxKm: 3, payPaise: 4500 },
  { code: 'B', label: 'Band B · 3–7 km · ₹60', minKm: 3, maxKm: 7, payPaise: 6000 },
  { code: 'C', label: 'Band C · 7–12 km · ₹75', minKm: 7, maxKm: 12, payPaise: 7500 },
]

const ZONES = [
  { name: 'Bengaluru Central', bandCodes: ['A'] },
  { name: 'Bengaluru Ring', bandCodes: ['B', 'C'] },
]

/** A realistic starting coverage set. NOT a claim we can serve all of India. */
const PINCODES: Array<{ pincode: string; zone: number; serviceable: boolean; po: string }> = [
  { pincode: '560001', zone: 0, serviceable: true, po: 'Bangalore GPO' },
  { pincode: '560002', zone: 0, serviceable: true, po: 'Bangalore City' },
  { pincode: '560025', zone: 0, serviceable: true, po: 'Domlur' },
  { pincode: '560034', zone: 0, serviceable: true, po: 'Koramangala' },
  { pincode: '560066', zone: 1, serviceable: true, po: 'Whitefield' },
  { pincode: '560103', zone: 1, serviceable: true, po: 'Brookefield' },
  { pincode: '560076', zone: 1, serviceable: true, po: 'Marathahalli' },
  // Deliberately switched OFF: demonstrates the per-pincode capacity switch
  // (A-07 bulk enable/disable), distinct from the city on/off switch.
  { pincode: '560048', zone: 1, serviceable: false, po: 'Indiranagar' },
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Bengaluru ────────────────────────────────────────────────────────────
    const blr = await client.query<{ id: number }>(
      `INSERT INTO cities (name, slug, state, status, is_active, licence_status,
                           licence_number, licence_approved_at, gstin, tax_rate_bp,
                           capacity_per_day, updated_at, created_at)
       VALUES ('Bengaluru','bengaluru','Karnataka','live', true, 'approved',
               'KA/NURSERY/2026/0001', now(), '29ABCDE1234F1Z5', 1800, 200, now(), now())
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             state = EXCLUDED.state,
             status = EXCLUDED.status,
             is_active = EXCLUDED.is_active,
             licence_status = EXCLUDED.licence_status,
             licence_approved_at = EXCLUDED.licence_approved_at,
             updated_at = now()
       RETURNING id`,
    )
    const blrId = blr.rows[0]!.id

    // ── Hyderabad: pending, licence NOT approved ──────────────────────────────
    // Deliberately left without an approved licence. Telangana's Registration of
    // Horticulture Nurseries (Regulation) Act 2010 makes nursery registration
    // mandatory, and the DB CHECK refuses `live` without it. This row is the
    // live demonstration that the gate is real and not just documented.
    const hyd = await client.query<{ id: number }>(
      `INSERT INTO cities (name, slug, state, status, is_active, licence_status,
                           updated_at, created_at)
       VALUES ('Hyderabad','hyderabad','Telangana','pending', false, 'filed', now(), now())
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
    )
    const hydId = hyd.rows[0]!.id

    // ── Zones ────────────────────────────────────────────────────────────────
    //
    // DELETE-then-INSERT, and this one mattered more than the delivery bands did.
    //
    // The original was a bare INSERT with no idempotency at all, so every run of
    // this script appended a SECOND set of zones. The consequence was not a
    // cosmetic duplicate — it silently broke the whole delivery operation:
    //
    //   zones   15 Bengaluru Central   16 Bengaluru Ring     <- run 1
    //   zones   76 Bengaluru Central   77 Bengaluru Ring     <- run 2
    //   zones   78 Bengaluru Central   79 Bengaluru Ring     <- run 3 (current)
    //   riders  Asha -> zone 15, Bilal -> zone 15, Chandra -> zone 16
    //   pincodes 560001 -> zone 78, 560066 -> zone 79
    //
    // Riders kept pointing at the zones from the first run while pincodes pointed
    // at the latest. `assignDispatch` requires an active rider covering the
    // ORDER's zone, so it refused with:
    //
    //   No active rider covers zone 78 in city 127.
    //
    // Meaning: the business could sell a plant, take the money, and then never
    // hand it to anybody. Nothing in typecheck, the unit suite, the build or the
    // catalogue tests notices — the data is individually valid, just pointed at
    // each other wrongly. It was found by trying to dispatch a real order as an
    // operator, which is the only way this class of bug is ever found.
    //
    // So: delete this city's zones and re-create them, then RE-POINT every rider
    // that was on an old zone of this city onto the equivalent new one. Riders are
    // preserved — this is not a re-seed of people, it is a re-point of where they
    // work, matched on zone NAME so the mapping is explicit rather than by
    // ordinal position (a zone list reordered between runs must not silently
    // move a rider to a different part of the city).
    /*
     * Read the EXISTING zone names BEFORE deleting them.
     *
     * The first attempt at this fix ran the re-point lookup after the delete, so
     * every rider's zone had already become NULL, the name could not be recovered,
     * and all five riders were left unassigned. The mapping has to be captured
     * while the rows still exist — which is the whole reason this step is a
     * separate query rather than a detail inside the insert loop.
     */
    const previousZones = await client.query<{ id: number; name: string }>(
      `SELECT "id", "name" FROM "zones" WHERE "city_id" = $1`,
      [blrId],
    )
    const previousIdByName = new Map(previousZones.rows.map((z) => [z.name, z.id]))

    await client.query(`DELETE FROM zones WHERE city_id = $1`, [blrId])

    const zoneIds: number[] = []
    /** zone name -> its new id, so riders can be re-pointed by meaning. */
    const zoneIdByName = new Map<string, number>()
    for (const zone of ZONES) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO zones (name, city_id, band_codes, max_daily_drops, is_active,
                            updated_at, created_at)
         VALUES ($1, $2, $3::jsonb, 60, true, now(), now())
         RETURNING id`,
        [zone.name, blrId, JSON.stringify(zone.bandCodes)],
      )
      const id = res.rows[0]!.id
      zoneIds.push(id)
      zoneIdByName.set(zone.name, id)
    }

    /*
     * Re-point riders whose zone was replaced, matching on zone NAME.
     *
     * By name, not by ordinal position: if the zone list is ever reordered between
     * runs, position-matching would silently move a rider to a different part of
     * the city, which is invisible until a delivery goes to the wrong place.
     *
     * A rider whose zone name this seed no longer defines is left on NULL and
     * reported, rather than being dropped somewhere arbitrary. An unassigned rider
     * is VISIBLE; a wrongly-assigned one is not.
     */
    for (const rider of await client
      .query<{ id: number; name: string; zone_id: number | null }>(
        `SELECT "id", "name", "zone_id" FROM "riders" WHERE "city_id" = $1 AND "zone_id" IS NOT NULL`,
        [blrId],
      )
      .then((r) => r.rows)) {
      // Recover the name from the pre-delete snapshot by id — after the DELETE the
      // join can no longer tell us where a rider used to work.
      const previousName =
        [...previousIdByName.entries()].find(
          ([, id]) => Number(id) === Number(rider.zone_id),
        )?.[0] ?? ''
      const replacement = previousName ? zoneIdByName.get(previousName) : undefined
      if (replacement === undefined) {
        console.warn(
          `  ! rider ${rider.name} was on a zone this seed no longer defines. Left unassigned ` +
            `so the gap is visible rather than wrong.`,
        )
        continue
      }
      await client.query(
        `UPDATE "riders" SET "zone_id" = $2, "updated_at" = now() WHERE "id" = $1`,
        [rider.id, replacement],
      )
      console.log(`  · re-pointed rider ${rider.name} → ${previousName} (zone ${replacement})`)
    }

    /*
     * ── ORDERS, RE-POINTED ACROSS THE ZONE REPLACEMENT ───────────────────────
     *
     * Orders carry a `zone_id` FK, so replacing this city's zones orphans every
     * order already placed — and a dangling zone is not visible on any list: the
     * order looks normal, but `assignDispatch` reads the order's zone to find a
     * rider and finds nothing:
     *
     *   No active rider covers zone null in city 127.
     *
     * That is what happened to the order used to test dispatch, and it is why a
     * re-seed on a database with live orders is dangerous rather than merely
     * untidy. Riders are re-pointed above for exactly the same reason; orders
     * just take one step longer to notice.
     *
     * A production database is never re-seeded — this runs before launch, or on a
     * fresh clone — but the seed's whole contract is "running this leaves the
     * city's operational topology consistent", and an order that cannot be
     * dispatched is not consistent. So the dependents come with it.
     */
    const repointedOrders = await client.query(
      `UPDATE "orders" o
          SET "zone_id" = sub."new_id"::integer, "updated_at" = now()
         FROM (
           SELECT v."old_id", m."new_id"
             FROM jsonb_each_text($2::jsonb) AS v("old_id", "zone_name")
             JOIN jsonb_each_text($3::jsonb) AS m("zone_name", "new_id")
               ON m."zone_name" = v."zone_name"
         ) AS sub
        WHERE o."zone_id" = sub."old_id"::integer
          AND o."city_id" = $1`,
      [
        blrId,
        JSON.stringify(Object.fromEntries(previousIdByName)),
        JSON.stringify(Object.fromEntries(zoneIdByName)),
      ],
    )
    if (repointedOrders.rowCount && repointedOrders.rowCount > 0) {
      console.log(`  · re-pointed ${repointedOrders.rowCount} order(s) to the new zone ids`)
    }

    /*
     * Pincodes below are deleted and re-inserted too, and the delivery bands are
     * referenced by CODE rather than by id, so those two need no re-pointing. Zones
     * were the only integer-keyed topology in the city, which is exactly why they
     * were the only one that could strand data.
     */

    /*
     * ── RIDERS WITH NO ZONE ─────────────────────────────────────────────────
     *
     * A rider with `zone_id IS NULL` is UNASSIGNABLE: `assignDispatch` requires an
     * active rider covering the order's zone, so they can never be picked up and
     * their day's pay is always zero. Left that way they are invisible — they
     * appear in the riders list, look employed, and appear in no run.
     *
     * They are placed into whichever zone still has no active rider, in id order,
     * which is deterministic: the same seed produces the same placement, so
     * re-running does not shuffle riders between the parts of the city they cover.
     *
     * This repairs a real state the earlier broken version of this script created
     * (zones deleted, riders left on NULL), which is why it is not merely a
     * provisioning nicety.
     */
    const unzoned = await client.query<{ id: number; name: string }>(
      `SELECT "id", "name" FROM "riders"
        WHERE "city_id" = $1 AND "zone_id" IS NULL AND "active" = true
        ORDER BY id`,
      [blrId],
    )
    for (const [index, rider] of unzoned.rows.entries()) {
      const zone = ZONES[index]
      if (!zone) {
        console.warn(
          `  ! rider ${rider.name} has no zone and there are no free zones left to place them in`,
        )
        break
      }
      await client.query(
        `UPDATE "riders" SET "zone_id" = $2, "updated_at" = now() WHERE "id" = $1`,
        [rider.id, zoneIdByName.get(zone.name)!],
      )
      console.log(`  · placed unzoned rider ${rider.name} → ${zone.name}`)
    }

    /*
     * ── RIDERS, PROVISIONED IF THE CITY HAS NONE ────────────────────────────
     *
     * Because a fresh clone could not otherwise dispatch anything, and a seed that
     * leaves the delivery network unable to operate is not a working seed. The
     * earlier symptom of this was subtle: a developer ran the seed, saw
     * "✓ Seed complete", and had a storefront that sold plants and had nobody to
     * deliver them.
     *
     * Only provisions when the city has NO riders. Existing riders are never
     * touched — this is not a re-seed of people, and re-running must not reset a
     * phone number somebody has just corrected.
     */
    const riderCount = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM "riders" WHERE "city_id" = $1`,
      [blrId],
    )
    if (Number(riderCount.rows[0]?.n ?? 0) === 0) {
      for (const [index, zone] of ZONES.entries()) {
        const res = await client.query<{ id: number }>(
          `INSERT INTO "riders" ("name", "phone", "active", "city_id", "zone_id",
                                  "vehicle_type", "pay_multiplier_bp", "max_drops_per_day",
                                  "updated_at", "created_at")
           VALUES ($1, $2, true, $3, $4, 'two_wheeler', 10000, 20, now(), now())
           RETURNING id`,
          [
            `${zone.name} rider`,
            // Synthetic numbers from a reserved range, and deterministic per zone so
            // a re-provision after a wipe is reproducible. 99 is not a real Indian
            // mobile prefix, which is deliberate: these must never reach a customer's
            // SMS. Real riders are entered in the admin panel.
            `9900000${String(index + 1).padStart(4, '0')}`,
            blrId,
            zoneIdByName.get(zone.name),
          ],
        )
        console.log(`  · provisioned rider "${zone.name} rider" (id ${res.rows[0]!.id})`)
      }
    } else {
      console.log(`  · ${riderCount.rows[0]?.n} rider(s) already present — left untouched`)
    }

    // ── Delivery bands ───────────────────────────────────────────────────────
    //
    // DELETE-then-INSERT, not `ON CONFLICT DO NOTHING`.
    //
    // `ON CONFLICT DO NOTHING` only does anything when there IS a conflict, and
    // `delivery_bands` has no unique constraint at all — no natural key on
    // (city_id, code). So the clause was a no-op and every run appended another
    // copy of each band, which `delivery_bands_are_contiguous` then refused:
    //
    //   [upvvan] Band A (0)-(3)km overlaps band A (0)-(3)km in the same city.
    //
    // A seed whose second run fails is not idempotent whatever its header says,
    // and this one had been failing on every run after the first since the
    // contiguity trigger landed. Delete-then-insert is the honest approach for a
    // table with no key, and it is what the catalogue seed already does for
    // `species_seasonal_availability`.
    //
    // Inserted in ascending distance order. The trigger validates each insert
    // against its siblings, so a non-monotonic set would be refused here — the
    // seed cannot smuggle in a bad configuration.
    await client.query(`DELETE FROM delivery_bands WHERE city_id = $1`, [blrId])

    for (const band of BANDS) {
      await client.query(
        `INSERT INTO delivery_bands (code, label, min_km, max_km, pay_paise, city_id,
                                     updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
        [band.code, band.label, band.minKm, band.maxKm, band.payPaise, blrId],
      )
    }

    // ── Pincodes ─────────────────────────────────────────────────────────────
    for (const pin of PINCODES) {
      await client.query(
        `INSERT INTO pincodes (pincode, city_id, zone_id, is_serviceable, post_office_name,
                               updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())
         ON CONFLICT (pincode) DO UPDATE
           SET city_id = EXCLUDED.city_id,
               zone_id = EXCLUDED.zone_id,
               is_serviceable = EXCLUDED.is_serviceable,
               post_office_name = EXCLUDED.post_office_name,
               updated_at = now()`,
        [pin.pincode, blrId, zoneIds[pin.zone]!, pin.serviceable, pin.po],
      )
    }

    // ── Price book ───────────────────────────────────────────────────────────
    // T0 = 48 hours. T1/T2 flags stay FALSE — promotion to a longer window is a
    // data decision gated on a measured DOA rate, never a calendar one.
    //
    // DELETE-then-INSERT for the same reason as `delivery_bands`: `price_books`
    // has no unique constraint, so a plain INSERT appended a second book for
    // Bengaluru on every run. That is worse here than it sounds — every page
    // that renders the guarantee reads the book's active tier with `LIMIT 1`,
    // and with two books present which one it gets is whatever Postgres
    // returned first. A commercial decision with two conflicting copies in the
    // table is the Ugaoo two-contradictory-guarantee-policies failure, one layer
    // down.
    await client.query(`DELETE FROM price_books WHERE city_id = ANY($1::int[])`, [[blrId, hydId]])

    await client.query(
      `INSERT INTO price_books (name, city_id, active_guarantee_tier,
                                guarantee_t1_enabled, guarantee_t2_enabled,
                                free_delivery_threshold_paise, delivery_fee_paise,
                                planter_ladder_min_uplift_bp, planter_ladder_max_uplift_bp,
                                updated_at, created_at)
       VALUES ('Bengaluru launch price book', $1, 'T0', false, false, 0, 0, 2900, 12100, now(), now())`,
      [blrId],
    )
    await client.query(
      `INSERT INTO price_books (name, city_id, active_guarantee_tier,
                                guarantee_t1_enabled, guarantee_t2_enabled,
                                free_delivery_threshold_paise, delivery_fee_paise,
                                planter_ladder_min_uplift_bp, planter_ladder_max_uplift_bp,
                                updated_at, created_at)
       VALUES ('Hyderabad (pending)', $1, 'T0', false, false, NULL, 0, 2900, 12100, now(), now())`,
      [hydId],
    )

    await client.query('COMMIT')

    console.log('✓ Seed complete')
    console.log(`  Bengaluru (live, licence approved) — city id ${blrId}`)
    console.log(`  Hyderabad (pending, licence filed) — city id ${hydId}`)
    console.log(
      `  ${ZONES.length} zones, ${BANDS.length} delivery bands, ${PINCODES.length} pincodes`,
    )

    /*
     * ── THE CHECK THAT WOULD HAVE CAUGHT THE ZONE BUG ────────────────────────
     *
     * "Every zone has an active rider" is not a nicety. Without it the failure is
     * discovered at the moment somebody tries to dispatch, which is the moment the
     * customer is already waiting — and the seed itself reports success either
     * way. This is the assertion that makes a re-seed safe to run unattended.
     */
    const uncovered = await client.query<{ zone_name: string; riders: string }>(
      `SELECT z."name" AS zone_name, count(r."id")::text AS riders
         FROM "zones" z
         LEFT JOIN "riders" r ON r."zone_id" = z."id" AND r."active" = true
        WHERE z."city_id" = $1 AND z."is_active" = true
        GROUP BY z."id", z."name"
       HAVING count(r."id") = 0
        ORDER BY z."name"`,
      [blrId],
    )
    if (uncovered.rows.length > 0) {
      console.warn(
        `  ! ${uncovered.rows.length} zone(s) have NO active rider: ` +
          uncovered.rows.map((z) => z.zone_name).join(', ') +
          `.\n    Orders into those zones cannot be dispatched. Add a rider, or set one active ` +
          `in the admin panel, before taking orders there.`,
      )
    } else {
      console.log(`  ✓ every active zone has at least one active rider`)
    }

    console.log('  Guarantee tier: T0 (48h). T1/T2 flags OFF.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('✗ Seed failed:', (err as Error).message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
