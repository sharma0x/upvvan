import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Catalogue invariants — Legal Metrology completeness and batch traceability.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * Two business rules that must not be bypassable by application code:
 *
 *   RULE 11 · A SKU cannot be PUBLISHED without a traceable supplier batch.
 *     "Never list a species you can't trace to a bill" is a COMPLIANCE
 *     requirement (CITES / Wildlife (Protection) Act), not a preference. An
 *     untraceable SKU is a species we cannot defend.
 *
 *   RULE 10 · Every plant PDP carries the seven Legal Metrology declarations,
 *     including DIMENSIONS. PC Rules 2011 r.6(1) as extended to online listings
 *     by the 2017 Amendment r.6(10); only month-and-year-of-packing is exempt
 *     online. Dimensions are required "where size is relevant" — which is EVERY
 *     plant in this category, and NOT a bag of cocopeat.
 *
 * Both are enforced as CHECK constraints and a trigger, so a direct SQL write
 * cannot create a non-compliant live listing. That is the whole point: the
 * compliance surface is the one place where "the app always sets it" is not a
 * sufficient answer, because a listing carries legal weight.
 *
 * NOTE: no `deleted_at` filters here. Payload only creates that column when a
 * collection declares a `deletedAt` field, and none of these do. Getting this
 * wrong is the same mistake twice — it was made in the geo loader first.
 */

/**
 * The seven mandatory declarations, as a completeness predicate.
 *
 * Written once and reused by both the CHECK and the audit view, so the two can
 * never disagree about what "complete" means.
 */
const DECLARATIONS_COMPLETE = `
  "legal_metrology_manufacturer_name" IS NOT NULL
  AND "legal_metrology_manufacturer_address" IS NOT NULL
  AND "legal_metrology_country_of_origin" IS NOT NULL
  AND "legal_metrology_common_name_declared" IS NOT NULL
  AND "legal_metrology_net_quantity" IS NOT NULL
  AND "legal_metrology_mrp_paise" IS NOT NULL
`

/** Dimensions — required for plants, not for consumables. */
const DIMENSIONS_COMPLETE = `
  "legal_metrology_dimensions_height_cm" IS NOT NULL
  AND "legal_metrology_dimensions_pot_diameter_cm" IS NOT NULL
  AND "legal_metrology_dimensions_spread_cm" IS NOT NULL
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── RULE 11 · a SKU cannot be published without a traceable batch ─────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_publish_requires_batch'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_publish_requires_batch"
        CHECK (NOT "is_published" OR "batch_id" IS NOT NULL);
      END IF;
    END $$;`)

  // ── RULE 10a · declarations are mandatory on ANY listing ─────────────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_legal_metrology_required'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_legal_metrology_required"
        CHECK (${sql.raw(DECLARATIONS_COMPLETE)});
      END IF;
    END $$;`)

  // ── RULE 10b · dimensions required for plants, not for consumables ───────
  // The conditionality is the reason this is a CMS field group with validation
  // rather than a flat commerce attribute: a soil bag has no meaningful height.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_plant_dimensions_required'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_plant_dimensions_required"
        CHECK (
          "item_class" IS DISTINCT FROM 'plant'
          OR (${sql.raw(DIMENSIONS_COMPLETE)})
        );
      END IF;
    END $$;`)

  // ── Declared dimensions must be positive, not merely present ─────────────
  // A zero height satisfies IS NOT NULL and satisfies the rule while telling the
  // customer nothing. Bloomscape's loudest review is a palm "laughably small for
  // the container it was in" — a declaration is only useful if it is a real one.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_dimensions_positive'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_dimensions_positive"
        CHECK (
          ("legal_metrology_dimensions_height_cm" IS NULL OR "legal_metrology_dimensions_height_cm" > 0)
          AND ("legal_metrology_dimensions_pot_diameter_cm" IS NULL OR "legal_metrology_dimensions_pot_diameter_cm" > 0)
          AND ("legal_metrology_dimensions_spread_cm" IS NULL OR "legal_metrology_dimensions_spread_cm" > 0)
        );
      END IF;
    END $$;`)

  // ── MRP must be whole paise and non-negative ────────────────────────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_mrp_is_paise'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_mrp_is_paise"
        CHECK (
          "legal_metrology_mrp_paise" IS NULL
          OR ("legal_metrology_mrp_paise" >= 0
              AND "legal_metrology_mrp_paise" = FLOOR("legal_metrology_mrp_paise"))
        );
      END IF;
    END $$;`)

  // ── Price must be whole paise and non-negative ──────────────────────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'skus_price_is_paise'
      ) THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_price_is_paise"
        CHECK (
          "base_price_paise" IS NULL
          OR ("base_price_paise" >= 0 AND "base_price_paise" = FLOOR("base_price_paise"))
        );
      END IF;
    END $$;`)

  // ── The batch referenced must actually be traceable ─────────────────────
  // A foreign key to a batch row is not enough: the bill is what makes it
  // traceable, so a batch without a bill cannot satisfy RULE 11.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION upvvan_assert_batch_traceable()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW."is_published" AND NEW."batch_id" IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM "supplier_batches" b
           WHERE b."id" = NEW."batch_id"
             AND b."bill_id" IS NOT NULL
             AND b."bill_id" <> ''
        ) THEN
          RAISE EXCEPTION
            '[upvvan] Cannot publish %: batch % has no supplier bill. "Never list a species you cannot trace to a bill."',
            NEW."sku_code", NEW."batch_id" USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_batch_traceable') THEN
        CREATE TRIGGER "trg_batch_traceable"
          BEFORE INSERT OR UPDATE ON "skus"
          FOR EACH ROW EXECUTE FUNCTION upvvan_assert_batch_traceable();
      END IF;
    END $$;`)

  // ── Audit view: every listing's declaration completeness ───────────────
  // product-design.md §6.3 asks for a "Legal Metrology declaration completeness
  // audit" in HQ governance. A VIEW rather than a collection, for the same
  // reason city_pnl is one: nobody can write a row claiming a listing is
  // compliant. The audit is computed from the rows, always.
  await db.execute(sql`
    CREATE OR REPLACE VIEW "listing_compliance_audit" AS
    SELECT
      s."id"::text                                            AS "skuId",
      s."sku_code"                                            AS "skuCode",
      s."item_class"                                          AS "itemClass",
      s."is_published"                                        AS "isPublished",
      (s."batch_id" IS NOT NULL)                             AS "hasBatch",
      (${sql.raw(DECLARATIONS_COMPLETE)})                     AS "declarationsComplete",
      (
        s."item_class" IS DISTINCT FROM 'plant'
        OR (${sql.raw(DIMENSIONS_COMPLETE)})
      )                                                       AS "dimensionsComplete",
      (
        (${sql.raw(DECLARATIONS_COMPLETE)})
        AND (
          s."item_class" IS DISTINCT FROM 'plant'
          OR (${sql.raw(DIMENSIONS_COMPLETE)})
        )
        AND s."batch_id" IS NOT NULL
      )                                                       AS "compliant"
    FROM "skus" s
   ORDER BY s."sku_code";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP VIEW IF EXISTS "listing_compliance_audit";`)
  await db.execute(sql`DROP TRIGGER IF EXISTS "trg_batch_traceable" ON "skus";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS upvvan_assert_batch_traceable();`)
  await db.execute(sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_price_is_paise";`)
  await db.execute(sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_mrp_is_paise";`)
  await db.execute(
    sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_dimensions_positive";`,
  )
  await db.execute(
    sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_plant_dimensions_required";`,
  )
  await db.execute(
    sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_legal_metrology_required";`,
  )
  await db.execute(
    sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_publish_requires_batch";`,
  )
}