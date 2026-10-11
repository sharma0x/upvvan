import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Launch blockers found by adversarial stakeholder review — 2026-10-05.
 *
 * Every one of these is a CROSS-FIELD or CROSS-TABLE invariant, which is exactly
 * why single-column CHECK constraints could not express them. They live in the
 * schema because that is the only layer a direct SQL write cannot bypass.
 *
 * Grouped by the review that found them.
 */

/**
 * The planter ladder's ceiling, in SQL.
 *
 * The tier multipliers below duplicate SIZE_TIER_MULTIPLIER, and MAX_UPLIFT_BP
 * duplicates the same-named constant, from src/lib/catalogue/pricing.ts. That duplication is deliberate and is the
 * lesser evil: the alternative is enforcing MRP >= top of ladder in
 * application code only, where a direct INSERT bypasses it — and that is the
 * exact violation this constraint exists to prevent.
 *
 * If you change a multiplier in pricing.ts, change it here. The seed test
 * declared-mrp-covers-the-ladder.test.ts fails loudly if the two drift,
 * because it recomputes the ladder from the TypeScript module and compares.
 */
const MAX_UPLIFT_BP = 12_100

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════════
  // A · LEGAL METROLOGY — three findings from the compliance review
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * A1 · NOT NULL does not stop ''.
   *
   * All five text declarations accepted a blank string on a PUBLISHED sku, which
   * renders on the PDP as an empty <dd> — a listing published with five of
   * seven mandatory declarations visibly missing. supplier_batches already had
   * the right pattern (supplier_batches_bill_is_real); it was not applied here.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_declarations_non_blank'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_declarations_non_blank"
        CHECK (
          btrim("legal_metrology_manufacturer_name"::text) <> ''
          AND btrim("legal_metrology_manufacturer_address"::text) <> ''
          AND btrim("legal_metrology_country_of_origin"::text) <> ''
          AND btrim("legal_metrology_common_name_declared"::text) <> ''
          AND btrim("legal_metrology_net_quantity"::text) <> ''
        );
      END IF;
    END $$;`)

  /**
   * A2 · THE MRP VIOLATION — charging above our own declared MRP.
   *
   * Legal Metrology (Packaged Commodities) Rules 2011 r.6(1)(e) requires the
   * retail sale price inclusive of all taxes, and r.6(10) puts it on the online
   * listing. An MRP is the MAXIMUM price at which the commodity may be sold.
   *
   * The seed computed MRP as base * 1.21 — which is neither tax-inclusive nor
   * the top of the ladder. It is the *uplift value* of the top planter
   * (ceil(19900 × 12100/10000) = 24079), not the total any configuration costs
   * (43979). Measured across the live catalogue: XS configs charge 1.83× the
   * declared MRP, MD configs 10.05×. The PDP rendered a declared MRP of ₹240.79
   * beside a selectable ₹439.79 pot on the same screen.
   *
   * Enforced here by recomputing the ladder ceiling in SQL and refusing any MRP
   * below it. Note the ceiling is derived per SKU row from that row's own base
   * price and size tier, so this works for XS and MD without special-casing.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION skus_mrp_covers_ladder() RETURNS trigger AS $$
    DECLARE
      size_bp integer := 0;
      entry_paise numeric;
      ladder_top numeric;
    BEGIN
      -- A plain CASE, not a JSON lookup. jsonb_each_text(...) parses as an
      -- OPERATOR in Postgres (operator does not exist: record -> text) and the
      -- broken function then fired on EVERY insert and update to skus, masking
      -- every other constraint on the table. A 4-row lookup table does not need
      -- to be clever.
      CASE NEW."size_tier"::text
        WHEN 'MD' THEN size_bp := 45000;
        WHEN 'LG' THEN size_bp := 120000;
        WHEN 'XL' THEN size_bp := 260000;
        ELSE size_bp := 0;
      END CASE;

      IF NEW."legal_metrology_mrp_paise" IS NULL THEN
        RETURN NEW;
      END IF;

      -- Round UP, matching pricing.ts plantPriceForTier and applyPlanter.
      entry_paise := ceil(NEW."base_price_paise" * (10000 + size_bp) / 10000);
      ladder_top := entry_paise + ceil(entry_paise * ${sql.raw(String(MAX_UPLIFT_BP))} / 10000);

      IF NEW."legal_metrology_mrp_paise" < ladder_top THEN
        RAISE EXCEPTION
          'MRP (%) is below the top of the planter ladder (%). An MRP is the MAXIMUM price at which the commodity may be sold, and this listing is selectable above it — Legal Metrology Rules 2011 r.6(1)(e), extended online by r.6(10).',
          NEW."legal_metrology_mrp_paise", ladder_top
          USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_sku_mrp_covers_ladder ON "skus";
    CREATE TRIGGER trg_sku_mrp_covers_ladder
      BEFORE INSERT OR UPDATE ON "skus"
      FOR EACH ROW EXECUTE FUNCTION skus_mrp_covers_ladder();`)

  /**
   * A3 · A plant must name its species; a consumable must not be forced to.
   *
   * Skus.ts relaxed species to nullable so cocopeat and fertiliser could be
   * listed at all — a bag of soil is not a variety of plant. The comment there
   * claimed the database would enforce "plants name their species". It did not.
   * Making the claim true rather than deleting it.
   */
  // Payload's generated baseline declared species_id NOT NULL before the
  // collection was relaxed, so relaxing the collection alone changed nothing —
  // the seed failed with `null value in column "species_id"`. Drop the column
  // constraint and replace it with the conditional one.
  await db.execute(sql`ALTER TABLE "skus" ALTER COLUMN "species_id" DROP NOT NULL;`)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_plant_requires_species'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_plant_requires_species"
        CHECK ("item_class" IS DISTINCT FROM 'plant' OR "species_id" IS NOT NULL);
      END IF;
    END $$;`)

  // ══════════════════════════════════════════════════════════════════════════
  // B · MONEY INTEGRALITY ON ORDERS — the customer review
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * B1 · AGENTS.md claims "A DB CHECK enforces it" about integer paise. True
   * for skus, entirely absent for orders. Raw writes accepted
   * revenue_paise = 199.5 (a float), -5000, and orders_items.price_paise =
   * -99999. The non-negotiable has to hold where the money actually is.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_money_is_paise') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_money_is_paise"
        CHECK (
          ("revenue_paise" IS NULL OR ("revenue_paise" >= 0 AND "revenue_paise" = floor("revenue_paise")))
          AND ("contribution_paise" IS NULL OR ("contribution_paise" >= 0 AND "contribution_paise" = floor("contribution_paise")))
        );
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_items_price_is_paise') THEN
        ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_price_is_paise"
        CHECK ("price_paise" >= 0 AND "price_paise" = floor("price_paise"));
      END IF;
    END $$;`)

  /**
   * B2 · Revenue must equal the sum of its lines.
   *
   * Otherwise revenue_paise = 999999 with one line at 1 paise is a legal row,
   * and the city P&L — the instrument we would use to decide whether to keep a
   * city — reports whatever was written. DEFERRABLE so the transaction can
   * insert the order before its lines exist.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION orders_revenue_matches_lines() RETURNS trigger AS $$
    DECLARE
      target integer;
      actual numeric;
    BEGIN
      -- Fires on both orders and orders_items. The parent id lives in
      -- _parent_id on the child and in id on the parent.
      IF TG_TABLE_NAME = 'orders' THEN
        target := NEW."id";
      ELSE
        target := NEW."_parent_id";
      END IF;

      IF target IS NULL THEN
        RETURN NULL;
      END IF;

      SELECT COALESCE(sum("price_paise"), 0) INTO actual
        FROM "orders_items" WHERE "_parent_id" = target;

      IF actual <> (SELECT "revenue_paise" FROM "orders" WHERE "id" = target) THEN
        RAISE EXCEPTION
          'Order % declares revenue_paise % but its lines sum to %. Revenue is not a stored opinion — it is the sum of what was sold.',
          target, (SELECT "revenue_paise" FROM "orders" WHERE "id" = target), actual
          USING ERRCODE = 'check_violation';
      END IF;

      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;`)

  // On `orders_items` alone this was escapable: inserting an order with
  // revenue_paise = 999999 and no lines yet fired nothing, because the trigger
  // is on the child table. Attach it to BOTH sides.
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_orders_revenue_matches_lines ON "orders_items";
    CREATE CONSTRAINT TRIGGER trg_orders_revenue_matches_lines
      AFTER INSERT OR UPDATE OR DELETE ON "orders_items"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION orders_revenue_matches_lines();`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_order_revenue_matches_own_lines ON "orders";
    CREATE CONSTRAINT TRIGGER trg_order_revenue_matches_own_lines
      AFTER INSERT OR UPDATE ON "orders"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION orders_revenue_matches_lines();`)

  /**
   * B3 · The guarantee tier is not a free choice.
   *
   * INSERT ... guarantee_tier='T2' succeeded, so "T1/T2 are behind flags
   * defaulting OFF" was true only in application code. The flags live in
   * price_books, so this is a cross-table check done in a trigger. Not
   * customer-reachable today (it needs a staff session or a DB write), which is
   * exactly why it needed a test rather than a UI review.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION orders_guarantee_tier_is_enabled() RETURNS trigger AS $$
    DECLARE
      book record;
    BEGIN
      IF NEW."guarantee_tier" = 'T0' THEN
        RETURN NEW;
      END IF;

      SELECT * INTO book FROM "price_books" WHERE "city_id" = NEW."city_id" LIMIT 1;

      IF book IS NULL THEN
        RAISE EXCEPTION
          'City % has no price book, so no guarantee tier is configured. T0 is the only tier that can be sold without one.',
          NEW."city_id" USING ERRCODE = 'check_violation';
      END IF;

      IF NEW."guarantee_tier" = 'T1' AND NOT COALESCE(book."guarantee_t1_enabled", false) THEN
        RAISE EXCEPTION
          'T1 (30 days) is disabled for city %. It unlocks only after ~500 delivered orders AND a measured DOA rate — see use-cases.md §11. Shipping a 30-day promise we cannot price is the thing this flag prevents.',
          NEW."city_id" USING ERRCODE = 'check_violation';
      END IF;

      IF NEW."guarantee_tier" = 'T2' AND NOT COALESCE(book."guarantee_t2_enabled", false) THEN
        RAISE EXCEPTION
          'T2 (90 days) is disabled for city %. Do not ship a 90-day promise.',
          NEW."city_id" USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_order_guarantee_tier_enabled ON "orders";
    CREATE TRIGGER trg_order_guarantee_tier_enabled
      BEFORE INSERT OR UPDATE ON "orders"
      FOR EACH ROW EXECUTE FUNCTION orders_guarantee_tier_is_enabled();`)

  // ══════════════════════════════════════════════════════════════════════════
  // C · THE LICENCE GATE — the ops review. Blocks launch.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * C1 · is_active = true bypassed the licence gate entirely.
   *
   * cities_live_requires_licence only reads status. But serviceability.ts
   * gates on is_active — so one admin flag flip made unlicensed Hyderabad
   * serviceable, and a raw INSERT then wrote a ₹649 order into a city whose
   * Telangana nursery licence is merely filed. That is the exact legal exposure
   * the licence exists to prevent.
   *
   * The review also found CityRef has no licence_status field, so the gate
   * never even had the value to check.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cities_active_requires_live_licence'
      ) THEN
        ALTER TABLE "cities" ADD CONSTRAINT "cities_active_requires_live_licence"
        CHECK (
          NOT "is_active"
          OR ("status" = 'live' AND "licence_status" = 'approved')
        );
      END IF;
    END $$;`)

  /**
   * C2 · An order must land in a city that may actually trade.
   *
   * Belt and braces over C1: C1 stops the flag being set, this stops an order
   * existing for a city whose licence lapsed or which was switched off between
   * the customer's cart and the write.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION orders_city_may_trade() RETURNS trigger AS $$
    DECLARE
      c record;
    BEGIN
      SELECT * INTO c FROM "cities" WHERE "id" = NEW."city_id";

      IF c IS NULL THEN
        RAISE EXCEPTION 'Order references unknown city %', NEW."city_id"
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF NOT c."is_active" OR c."status" <> 'live' OR c."licence_status" <> 'approved' THEN
        RAISE EXCEPTION
          'City % is not trading (status=%, active=%, licence=%). An order cannot be created for a city we are not licensed to sell plants in.',
          c."slug", c."status", c."is_active", c."licence_status"
          USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_order_city_may_trade ON "orders";
    CREATE TRIGGER trg_order_city_may_trade
      BEFORE INSERT OR UPDATE ON "orders"
      FOR EACH ROW EXECUTE FUNCTION orders_city_may_trade();`)

  // ══════════════════════════════════════════════════════════════════════════
  // D · DELIVERY BANDS — the incentive fix, currently decorative
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * D1 · Band coverage must be CONTIGUOUS, not merely non-overlapping.
   *
   * The existing trigger checked overlap and pay order, never contiguity. A city
   * configured with only A (0–3) and D (7–12) was accepted, and then
   * bandForDistance threw NO_MATCHING_BAND for the entire 3–7km middle of the
   * city — a rider paid nothing, or dispatch crashed.
   *
   * bands.ts implements GAP_IN_RANGES in TypeScript, which is bypassable by a
   * direct write. This is the same rule in the layer that cannot be bypassed.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION delivery_bands_are_contiguous() RETURNS trigger AS $$
    DECLARE
      gaps integer;
      lo integer;
    BEGIN
      -- Coverage must run from 0 with no hole, up to the furthest band.
      WITH ordered AS (
        SELECT "min_km", "max_km",
               lag("max_km") OVER (ORDER BY "min_km") AS prev_max
          FROM "delivery_bands" WHERE "city_id" = NEW."city_id"
      )
      SELECT count(*) INTO gaps
        FROM ordered
       WHERE prev_max IS NULL AND "min_km" <> 0
          OR prev_max IS NOT NULL AND "min_km" <> prev_max;

      IF gaps > 0 THEN
        RAISE EXCEPTION
          'Delivery bands for city % leave a gap: a drop at some distance would match NO band, so the rider is paid nothing and dispatch cannot assign it. Bands must run from 0km with no holes.',
          NEW."city_id" USING ERRCODE = 'check_violation';
      END IF;

      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_bands_contiguous ON "delivery_bands";
    CREATE CONSTRAINT TRIGGER trg_bands_contiguous
      AFTER INSERT OR UPDATE OR DELETE ON "delivery_bands"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION delivery_bands_are_contiguous();`)

  /**
   * D2 · All three bands are deletable, leaving a LIVE city that pays nothing.
   *
   * DELETE FROM delivery_bands WHERE city_id = <bengaluru> succeeded and the
   * city stayed live. Also guards the pathological single-band case the review
   * found: one flat 0–1000km band trivially satisfies monotonicity, which is the
   * precise structure — a flat per-order payment — that this whole design
   * exists to reject.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION delivery_bands_need_three_tiers() RETURNS trigger AS $$
    DECLARE
      band_count integer;
      city_slug text;
    BEGIN
      SELECT count(*) INTO band_count FROM "delivery_bands" WHERE "city_id" = NEW."city_id";
      SELECT "slug" INTO city_slug FROM "cities" WHERE "id" = NEW."city_id";

      IF band_count < 2 THEN
        RAISE EXCEPTION
          'City % would have % delivery band(s). Rider pay must RISE with distance — a single flat band is exactly the per-order payment that produced a competitor 1.4/5 rating, and it satisfies monotonicity only vacuously.',
          city_slug, band_count USING ERRCODE = 'check_violation';
      END IF;

      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_bands_need_tiers ON "delivery_bands";
    CREATE CONSTRAINT TRIGGER trg_bands_need_tiers
      AFTER INSERT OR UPDATE OR DELETE ON "delivery_bands"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION delivery_bands_need_three_tiers();`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_bands_need_tiers ON "delivery_bands";`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_bands_contiguous ON "delivery_bands";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS delivery_bands_need_three_tiers();`)
  await db.execute(sql`DROP FUNCTION IF EXISTS delivery_bands_are_contiguous();`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_order_city_may_trade ON "orders";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS orders_city_may_trade();`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_order_guarantee_tier_enabled ON "orders";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS orders_guarantee_tier_is_enabled();`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_order_revenue_matches_own_lines ON "orders";`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_orders_revenue_matches_lines ON "orders_items";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS orders_revenue_matches_lines();`)
  await db.execute(
    sql`ALTER TABLE "orders_items" DROP CONSTRAINT IF EXISTS "orders_items_price_is_paise";`,
  )
  await db.execute(sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_money_is_paise";`)
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_sku_mrp_covers_ladder ON "skus";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS skus_mrp_covers_ladder();`)
  await db.execute(sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_declarations_non_blank";`)
  await db.execute(sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_plant_requires_species";`)
  await db.execute(
    sql`ALTER TABLE "cities" DROP CONSTRAINT IF EXISTS "cities_active_requires_live_licence";`,
  )
}
