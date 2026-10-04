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
    const zoneIds: number[] = []
    for (const zone of ZONES) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO zones (name, city_id, band_codes, max_daily_drops, is_active,
                            updated_at, created_at)
         VALUES ($1, $2, $3::jsonb, 60, true, now(), now())
         RETURNING id`,
        [zone.name, blrId, JSON.stringify(zone.bandCodes)],
      )
      zoneIds.push(res.rows[0]!.id)
    }

    // ── Delivery bands ───────────────────────────────────────────────────────
    // Inserted in ascending distance order. The trigger validates each insert
    // against its siblings, so a non-monotonic set would be refused here — the
    // seed cannot smuggle in a bad configuration.
    for (const band of BANDS) {
      await client.query(
        `INSERT INTO delivery_bands (code, label, min_km, max_km, pay_paise, city_id,
                                     updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         ON CONFLICT DO NOTHING`,
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
                                updated_at, created_at)
       VALUES ('Hyderabad (pending)', $1, 'T0', false, false, now(), now())`,
      [hydId],
    )

    await client.query('COMMIT')

    console.log('✓ Seed complete')
    console.log(`  Bengaluru (live, licence approved) — city id ${blrId}`)
    console.log(`  Hyderabad (pending, licence filed) — city id ${hydId}`)
    console.log(
      `  ${ZONES.length} zones, ${BANDS.length} delivery bands, ${PINCODES.length} pincodes`,
    )
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
