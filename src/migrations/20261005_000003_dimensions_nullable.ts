import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Relax the Legal Metrology dimension columns from NOT NULL to nullable.
 *
 * ── WHY A SEPARATE, NON-DESTRUCTIVE MIGRATION ──────────────────────────────
 *
 * The `catalogue_baseline` migration generated these three columns as NOT NULL,
 * because `Skus.ts` originally declared the dimension fields `required: true`.
 * That is wrong: "dimensions where size is relevant" (PC Rules 2011 r.6(1))
 * applies to every PLANT and to nothing else. A column-level NOT NULL made a
 * bag of cocopeat impossible to list — the conditionality had been pushed into
 * the wrong layer.
 *
 * The conditionality now lives where it can actually be expressed: the
 * `skus_plant_dimensions_required` CHECK, which requires dimensions only when
 * `item_class = 'plant'`.
 *
 * This is a DROP NOT NULL, not a table rebuild. The alternative — dropping and
 * recreating `skus` and replaying the baseline — would have been destructive for
 * no benefit, and `skus` is not empty in a real deployment.
 */

/** The three columns whose nullability must follow `item_class`. */
const DIMENSION_COLUMNS = [
  'legal_metrology_dimensions_height_cm',
  'legal_metrology_dimensions_pot_diameter_cm',
  'legal_metrology_dimensions_spread_cm',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const column of DIMENSION_COLUMNS) {
    await db.execute(sql.raw(`ALTER TABLE "skus" ALTER COLUMN "${column}" DROP NOT NULL;`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-applying NOT NULL fails if any existing row has a NULL dimension — which
  // is exactly right: the rollback must not silently invent dimensions for a
  // consumable listing.
  for (const column of DIMENSION_COLUMNS) {
    await db.execute(sql.raw(`ALTER TABLE "skus" ALTER COLUMN "${column}" SET NOT NULL;`))
  }
}
