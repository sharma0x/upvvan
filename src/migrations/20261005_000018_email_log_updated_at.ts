import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `email_log.updated_at`.
 *
 * ── THE BUG, AND WHY ONLY THE ADMIN PANEL NOTICED ───────────────────────────
 *
 * Migration 000016 created `email_log` with `created_at` and `sent_at` but no
 * `updated_at`, while the collection declares `timestamps: true`. Payload's
 * `timestamps` means BOTH columns, so every read it issues selects
 * `updated_at`:
 *
 *     Failed query: select "id", "kind", …, "updated_at", "created_at"
 *                    from "email_log" order by "created_at" desc limit $1
 *     column "updated_at" does not exist
 *
 * That made the Emails screen a 500 — the one screen an owner opens to answer
 * "did the customer actually get it?".
 *
 * It is invisible everywhere else, and that is the part worth recording. Writing
 * mail used `INSERT INTO email_log (… specific columns …)` and `UPDATE email_log
 * SET status = …`, neither of which names `updated_at`, so every runtime path
 * worked. The admin panel's list view is the only place that does `SELECT *`
 * through Payload, and it failed on every load.
 *
 * The migration suite passed, the 390 tests passed, the production build passed
 * and the full order journey passed, because "the Emails admin screen 500s" is
 * only observable by opening the Emails admin screen. Found by driving the admin
 * panel in a real browser, which is the one thing none of the above can do.
 *
 * ── WHY A NEW MIGRATION AND NOT AN EDIT TO 000016 ────────────────────────────
 *
 * Because 000016 has already run on every database that exists, including
 * production. Editing an applied migration means the fix exists only on
 * databases created after the edit — so the bug survives precisely where it is
 * live. `ALTER TABLE … ADD COLUMN IF NOT EXISTS` also means applying this on top
 * of a fixed 000016 is harmless, so a fresh clone and an upgraded clone converge
 * on the same shape.
 *
 * 000016 itself is corrected as well, so that a fresh database never has the
 * broken shape in the first place.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "email_log"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();
  `)

  /*
   * Backfill from `created_at` rather than leaving every existing row at
   * `now()`.
   *
   * A row written last week would otherwise claim to have been modified just now,
   * which makes the log's own ordering lie about when things happened. The log
   * exists to be evidence; its timestamps should not be fiction.
   */
  await db.execute(sql`
    UPDATE "email_log"
       SET "updated_at" = "created_at"
     WHERE "updated_at" > "created_at";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /*
   * Deliberately not dropped.
   *
   * The collection declares `timestamps: true`, so removing this column returns
   * the table to a shape Payload cannot read, which makes the "down" migration
   * leave the application broken rather than reverted. A column the framework
   * requires is not optional to roll back.
   */
  await db.execute(sql`-- retained: Payload selects it on every read of this collection`)
}
