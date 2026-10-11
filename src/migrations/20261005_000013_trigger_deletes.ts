import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two trigger defects, both found by running the seeds for a second time.
 *
 * ── WHY A SEED IS A TRIGGER TEST ────────────────────────────────────────────
 *
 * The seed scripts claim to be idempotent and are tested for it. They were not,
 * and the reason they were not is that two triggers in
 * `20261005_000007_launch_blockers.ts` crash on `DELETE` — so the only way to
 * re-seed a city was to append duplicate rows until the contiguity trigger
 * refused them:
 *
 *   [upvvan] Band A (0)-(3)km overlaps band A (0)-(3)km in the same city.
 *
 * That is the tell. A business invariant that cannot be undone is not a
 * constraint, it is a lock. Both rules below are still correct; both are just
 * written so that the operation a seed needs is the one operation the database
 * refuses.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════════
  // A · delivery_bands_need_three_tiers reads NEW on a DELETE
  // ══════════════════════════════════════════════════════════════════════════
  //
  // The function opens with:
  //
  //   SELECT count(*) INTO band_count FROM "delivery_bands" WHERE "city_id" = NEW."city_id";
  //   SELECT "slug"     INTO city_slug FROM "cities"          WHERE "id"  = NEW."city_id";
  //
  // and the trigger fires `AFTER INSERT OR UPDATE OR DELETE`. On a DELETE, NEW is
  // NULL, so `city_id` is NULL, the count is 0, and the function raises with
  // city_slug printing as `<NULL>`.
  //
  // Two consequences beyond "the seed cannot re-run":
  //
  //   · You cannot retire a band. Configuring Bengaluru from three tiers to two
  //     means a migration that drops the row, and DELETE is the only way to drop
  //     it.
  //
  //   · `DELETE FROM delivery_bands` — an operator cleaning up after a bad
  //     configuration — fails with a message that blames the city for having no
  //     bands when the city has six.
  //
  // Fix: read the city from whichever row version exists. A DEFERRABLE INITIALLY
  // DEFERRED trigger fires at commit, so on a DELETE the remaining rows are
  // already gone and the count reflects the state being committed — which is
  // what we want to validate.

  await db.execute(sql`
    CREATE OR REPLACE FUNCTION delivery_bands_need_three_tiers() RETURNS trigger AS $$
    DECLARE
      band_count integer;
      city_slug text;
      target_city integer;
    BEGIN
      -- NEW is NULL on DELETE. The COALESCE is not cosmetic: without it the
      -- function reasons about a city of NULL and reports zero bands for a city
      -- that has six.
      target_city := COALESCE(NEW."city_id", OLD."city_id");

      SELECT count(*) INTO band_count
        FROM "delivery_bands" WHERE "city_id" = target_city;

      SELECT "slug" INTO city_slug FROM "cities" WHERE "id" = target_city;

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

  // ══════════════════════════════════════════════════════════════════════════
  // B · skus_mrp_covers_ladder applies the planter ladder to a bag of soil
  // ══════════════════════════════════════════════════════════════════════════
  //
  // The function recomputes the dearest selectable configuration as:
  //
  //   entry_paise := ceil(base * (10000 + size_bp) / 10000)
  //   ladder_top  := entry_paise + ceil(entry_paise * 12100 / 10000)
  //
  // with no regard for `item_class`. So the 5kg bag of cocopeat had to declare an
  // MRP of ₹550.29 — a terracotta pot it cannot be sold in and that no one has
  // ever selected — or be rejected:
  //
  //   MRP (24900) is below the top of the planter ladder (55029).
  //
  // The constraint is right about plants and nonsense about consumables. A
  // planter is a variant of a PLANT; there is no such thing as a planter
  // variant of a bag of cocopeat, and the PDP for a consumable renders no pot
  // picker at all. Requiring an MRP above an unreachable configuration forces a
  // false declaration onto every non-plant SKU.
  //
  // The Legal Metrology point r.6(1)(e) and r.6(10) is making is real and is
  // preserved for both: an MRP is the MAXIMUM price at which what you offer may
  // be sold, so it must cover everything selectable. For a consumable that is its
  // single price.

  await db.execute(sql`
    CREATE OR REPLACE FUNCTION skus_mrp_covers_ladder() RETURNS trigger AS $$
    DECLARE
      size_bp integer := 0;
      entry_paise numeric;
      ladder_top numeric;
    BEGIN
      IF NEW."legal_metrology_mrp_paise" IS NULL THEN
        RETURN NEW;
      END IF;

      -- A non-plant has no pot ladder, so its MRP only has to cover its own
      -- price. This is the branch that lets cocopeat be listed at all.
      IF NEW."item_class" IS DISTINCT FROM 'plant' THEN
        IF NEW."legal_metrology_mrp_paise" < NEW."base_price_paise" THEN
          RAISE EXCEPTION
            'SKU % declares MRP % but is offered at %. An MRP is the maximum price at which the commodity may be sold, so it cannot be below the price charged.',
            NEW."sku_code", NEW."legal_metrology_mrp_paise", NEW."base_price_paise"
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END IF;

      CASE NEW."size_tier"::text
        WHEN 'MD' THEN size_bp := 45000;
        WHEN 'LG' THEN size_bp := 120000;
        WHEN 'XL' THEN size_bp := 260000;
        ELSE size_bp := 0;
      END CASE;

      -- Round UP, matching pricing.ts plantPriceForTier and applyPlanter.
      entry_paise := ceil(NEW."base_price_paise" * (10000 + size_bp) / 10000);
      ladder_top := entry_paise + ceil(entry_paise * 12100 / 10000);

      IF NEW."legal_metrology_mrp_paise" < ladder_top THEN
        RAISE EXCEPTION
          'MRP (%) is below the top of the planter ladder (%). An MRP is the MAXIMUM price at which the commodity may be sold, and this listing is selectable above it — Legal Metrology Rules 2011 r.6(1)(e), extended online by r.6(10).',
          NEW."legal_metrology_mrp_paise", ladder_top USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_sku_mrp_covers_ladder ON "skus";
    CREATE TRIGGER trg_sku_mrp_covers_ladder
      BEFORE INSERT OR UPDATE ON "skus"
      FOR EACH ROW EXECUTE FUNCTION skus_mrp_covers_ladder();`)

  /*
   * Backfill. A non-plant whose declared MRP is below its own price is corrected
   * upward rather than dropped.
   *
   * A row in this state can only have been written by something that disabled the
   * trigger — a hand-written INSERT with `session_replication_role = replica`,
   * or a restore. Leaving it would mean the storefront charges above a declared
   * MRP, which is the exact violation this whole mechanism exists to prevent, so
   * a migration that finds one repairs it rather than assuming there are none.
   */
  await db.execute(sql`
    UPDATE "skus"
       SET "legal_metrology_mrp_paise" = "base_price_paise"
     WHERE "item_class" IS DISTINCT FROM 'plant'
       AND "legal_metrology_mrp_paise" < "base_price_paise";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /*
   * Both originals are restored verbatim, bugs included. A down-migration returns
   * the schema to what it was, and reintroducing the consumable MRP defect and
   * the DELETE crash is the accurate thing to do — a down-migration that "fixed"
   * them would be lying about what version 000013 was.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION skus_mrp_covers_ladder() RETURNS trigger AS $$
    DECLARE
      size_bp integer := 0;
      entry_paise numeric;
      ladder_top numeric;
    BEGIN
      CASE NEW."size_tier"::text
        WHEN 'MD' THEN size_bp := 45000;
        WHEN 'LG' THEN size_bp := 120000;
        WHEN 'XL' THEN size_bp := 260000;
        ELSE size_bp := 0;
      END CASE;
      IF NEW."legal_metrology_mrp_paise" IS NULL THEN RETURN NEW; END IF;
      entry_paise := ceil(NEW."base_price_paise" * (10000 + size_bp) / 10000);
      ladder_top := entry_paise + ceil(entry_paise * 12100 / 10000);
      IF NEW."legal_metrology_mrp_paise" < ladder_top THEN
        RAISE EXCEPTION
          'MRP (%) is below the top of the planter ladder (%).',
          NEW."legal_metrology_mrp_paise", ladder_top USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

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
          'City % would have % delivery band(s).',
          city_slug, band_count USING ERRCODE = 'check_violation';
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;`)
}
