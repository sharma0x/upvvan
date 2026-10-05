import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two corrections the catalogue test suite forced, both real gaps rather than
 * test bugs.
 *
 * ── 1 · AN EMPTY BILL IS NOT TRACEABILITY ───────────────────────────────────
 *
 * `supplier_batches.bill_id` is NOT NULL, so `NULL` cannot get in. But `''` can,
 * and an empty string is the LIKELIER accident — a form that submits a blank
 * field, an import that maps a missing column to empty. "Never list a species
 * you cannot trace to a bill" is a compliance rule, and a batch whose bill is
 * blank is not traceable to anything.
 *
 * The Payload field validator already rejects it in the application layer. This
 * constraint makes it true in the SCHEMA, which is the only layer a direct write
 * cannot route around. Same reasoning as the delivery-proof gate: application-code
 * enforcement is bypassable, and this is a compliance surface.
 *
 * ── 2 · THE AUDIT VIEW WAS WRONG ABOUT DRAFTS ──────────────────────────────
 *
 * `compliant` was computed as `NOT is_published OR (...)`, which meant a draft
 * with no batch reported `compliant = true`. That is backwards for an AUDIT view:
 * the whole point of a compliance audit is to surface the gap BEFORE a listing
 * goes live. A draft that could not be published tomorrow should say so today.
 *
 * `is_published` is still reported as its own column, so the view still answers
 * "what is live" as well as "what is ready to be live".
 */

/** The seven mandatory declarations. Must stay in sync with migration 000002. */
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
  // ── 1 · a bill must be a real reference, not merely present ──────────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supplier_batches_bill_is_real'
      ) THEN
        ALTER TABLE "supplier_batches"
          ADD CONSTRAINT "supplier_batches_bill_is_real"
          CHECK (btrim("bill_id") <> '' AND length(btrim("bill_id")) >= 4);
      END IF;
    END $$;`)

  // ── 2 · the audit view must not call an unready draft compliant ───────────
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
  // Restore the previous (wrong) view so the rollback is a true inverse.
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
        NOT s."is_published"
        OR (
          (${sql.raw(DECLARATIONS_COMPLETE)})
          AND (
            s."item_class" IS DISTINCT FROM 'plant'
            OR (${sql.raw(DIMENSIONS_COMPLETE)})
          )
          AND s."batch_id" IS NOT NULL
        )
      )                                                       AS "compliant"
    FROM "skus" s
    ORDER BY s."sku_code";`)

  await db.execute(
    sql`ALTER TABLE "supplier_batches" DROP CONSTRAINT IF EXISTS "supplier_batches_bill_is_real";`,
  )
}