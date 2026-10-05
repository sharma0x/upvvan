import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Orders — the two invariants that make an order trustworthy, plus the P&L view.
 *
 * These were DEFERRED to Phase 1 during Phase 0, and deliberately so.
 * `orders_no_cod` and `city_pnl` both read from the `orders` table, and they are
 * created here — in the same migration as the table — rather than behind an
 * `IF EXISTS table` guard in Phase 0. A constraint added in a later migration can
 * be silently dropped by a schema push, which is exactly the drift C-3 forbids.
 *
 * ── INVARIANT 5 · NO COD, EVER ─────────────────────────────────────────────
 *
 * No COD path exists anywhere in this system. Rather than trust that nobody adds
 * one, the schema refuses the value outright.
 *
 * A COD return leg is 25–30 days — the forward leg is 3–4 days — and the plant
 * needs a further 1–2 months to restore before it could be resold. Returned
 * plants are non-saleable in every competitor policy we examined (Ugaoo refuses
 * returns outright; Paudhewale disposes of them "at the customer's end"). So a COD
 * bounce is a TOTAL WRITE-OFF, not returned inventory.
 *
 * Published RTO bands: COD ~26%, festive peak ~58%, prepaid <2% (Shipway) vs
 * 10–15% (Shiprocket). The model in the research puts a festive COD spike at
 * −₹60 contribution per order, worse than any lever we have.
 *
 * The absence is the business model, so it is enforced in the layer that cannot
 * be routed around.
 *
 * ── INVARIANT 12 · AN ORDER CANNOT EXIST FOR AN UNSERVICEABLE PINCODE ──────
 *
 * A CHECK cannot reference another table, so this is a trigger: before an order
 * row is written, the pincode must exist in `pincodes` AND be serviceable AND
 * belong to the order's city. That last clause is the subtle one — a pincode
 * live in Hyderabad must not satisfy an order placed in Bengaluru, which is
 * exactly the bug the CITY_MISMATCH code was written to surface.
 *
 * ── CITY P&L AS A VIEW, NOT A COLLECTION ───────────────────────────────────
 *
 * Urvann has a documented history of NINE failed city launches. The cost of a
 * failing city is only bounded if you can see its P&L in isolation AND kill it
 * without touching the others. A collection named `city_pnl` invites someone to
 * write a row, and then the numbers are whatever was last computed — which is
 * bookkeeping discipline failing under exactly the pressure it matters.
 *
 * A VIEW over city-scoped orders cannot be written to by accident, so killing a
 * city is a `status` change and never an act of manual accounting.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── INVARIANT 5 · no COD ──────────────────────────────────────────────────
  //
  // Stronger than a CHECK, and worth being precise about: `payment_mode` is a
  // Postgres ENUM whose only value is 'prepaid'. 'cod' is not merely rejected —
  // it cannot be represented, so the error is `invalid input value for enum`
  // rather than a constraint violation.
  //
  // The CHECK below is therefore belt-and-braces. It is kept because it states
  // the RULE rather than relying on a reader inferring it from the enum, and
  // because if someone ever widens the enum the CHECK is what still holds.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_no_cod') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_no_cod"
        CHECK ("payment_mode"::text IS DISTINCT FROM 'cod');
      END IF;
    END $$;`)

  // Only 'prepaid' is a legal value. Belt and braces: the CHECK above refuses
  // the specific known-bad value, and this enum-shaped CHECK refuses anything
  // that is not prepaid.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_prepaid_only') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_prepaid_only"
        CHECK ("payment_mode"::text = 'prepaid');
      END IF;
    END $$;`)

  // ── INVARIANT 12 · the pincode + city gate ──────────────────────────────
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION upvvan_assert_order_serviceable()
    RETURNS TRIGGER AS $$
    DECLARE
      pin_city_id integer;
      pin_zone_id integer;
    BEGIN
      SELECT "city_id", "zone_id" INTO pin_city_id, pin_zone_id
        FROM "pincodes"
       WHERE "pincode" = NEW."pincode"
         AND "is_serviceable" = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          '[upvvan] Cannot create an order for pincode %: it is not in the serviceable set.',
          NEW."pincode" USING ERRCODE = 'check_violation';
      END IF;

      -- The subtle clause. A pincode that is live in ANOTHER city must not
      -- satisfy an order placed in this one, or the order routes to the wrong
      -- nursery. This is the same defect the CITY_MISMATCH rejection code exists
      -- to surface in the UI.
      IF pin_city_id <> NEW."city_id" THEN
        RAISE EXCEPTION
          '[upvvan] Cannot create an order for pincode % in city %: that pincode belongs to city %.',
          NEW."pincode", NEW."city_id", pin_city_id USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_order_serviceable') THEN
        CREATE TRIGGER "trg_order_serviceable"
          BEFORE INSERT OR UPDATE ON "orders"
          FOR EACH ROW EXECUTE FUNCTION upvvan_assert_order_serviceable();
      END IF;
    END $$;`)

  // ── City P&L and coverage, as VIEWS ──────────────────────────────────────
  await db.execute(sql`
    CREATE OR REPLACE VIEW "city_pnl" AS
    SELECT
      o."city_id"                                       AS "cityId",
      COUNT(*)::int                                     AS "orders",
      COALESCE(SUM(o."revenue_paise"), 0)::bigint       AS "revenuePaise",
      COALESCE(SUM(o."contribution_paise"), 0)::bigint AS "contributionPaise"
    FROM "orders" o
    GROUP BY o."city_id"
    ORDER BY o."city_id";`)

  await db.execute(sql`
    CREATE OR REPLACE VIEW "city_coverage" AS
    SELECT
      c."id"::text                                         AS "cityId",
      c."slug"                                             AS "slug",
      c."name"                                             AS "name",
      c."status"                                           AS "status",
      c."is_active"                                        AS "isActive",
      c."licence_status"                                   AS "licenceStatus",
      COUNT(p."id") FILTER (WHERE p."is_serviceable")::int AS "serviceablePincodeCount",
      COALESCE(pnl."orders", 0)::int                       AS "orders",
      COALESCE(pnl."revenuePaise", 0)::bigint              AS "revenuePaise",
      COALESCE(pnl."contributionPaise", 0)::bigint        AS "contributionPaise"
    FROM "cities" c
    LEFT JOIN "pincodes" p ON p."city_id" = c."id"
    LEFT JOIN "city_pnl" pnl ON pnl."cityId" = c."id"
    GROUP BY c."id", c."slug", c."name", c."status", c."is_active", c."licence_status",
             pnl."orders", pnl."revenuePaise", pnl."contributionPaise"
    ORDER BY c."slug";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP VIEW IF EXISTS "city_coverage";`)
  await db.execute(sql`DROP VIEW IF EXISTS "city_pnl";`)
  await db.execute(sql`DROP TRIGGER IF EXISTS "trg_order_serviceable" ON "orders";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS upvvan_assert_order_serviceable();`)
  await db.execute(sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_prepaid_only";`)
  await db.execute(sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_no_cod";`)
}