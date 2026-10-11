import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `payload_locked_documents_rels` entries for collections added without them.
 *
 * ── WHAT THIS TABLE IS AND WHY IT IS EASY TO FORGET ─────────────────────────
 *
 * Payload's document locking uses one table for every collection: a row per
 * locked document, and a RELS row that says which collection it belongs to. The
 * second table is a wide sparse table with one nullable `<slug>_id` column per
 * collection, plus a matching foreign key.
 *
 * So adding a collection is a THREE-part change — the collection's own table, the
 * rels column, and the rels foreign key — and the third is invisible until
 * something queries a lock. Every write through the admin panel opens one, which
 * is why the failure appears on save rather than on create.
 *
 * ── THE FAILURE, VERBATIM ───────────────────────────────────────────────────
 *
 *   select distinct "payload_locked_documents"."id" …
 *     left join "payload_locked_documents_rels" … on (…)
 *    where (…"users_id" = $2 or … or "quote_requests_id" = $18
 *               or "contact_messages_id" = $19 …)
 *
 *   Failed query: … column "contact_messages_id" does not exist
 *
 * SIX collections had been added to `payload.config.ts` without the rels
 * column: `contact_messages` (a working inbox whose admin panel 500s on every
 * save), `business_settings`, `email_log`, `riders`, `dispatches` and `sku_stock`.
 * Nothing
 * catches this — typecheck, lint, the unit suite and the production build are all
 * perfectly happy, because the query is generated at runtime from the config and
 * only executed against a database that lacks the column.
 *
 * It surfaced as `pnpm seed:staff` crashing before it could do anything, with a
 * message about document locking rather than about the missing column. `riders`
 * and `dispatches` are the ones that matter most: the whole rider surface hangs
 * off those two collections, so this was a single missing column between the
 * business and its own delivery network.
 *
 * ── WHY A HAND-WRITTEN MIGRATION AND NOT `migrate:create` ───────────────────
 *
 * Because `migrate:create` diffs against its own snapshot, and the snapshot
 * predates several tables — it asks to recreate them. This project keeps its DDL
 * history in `src/migrations/index.ts` by hand for exactly that reason; see the
 * header of that file. Nine of its entries are invariants with no snapshot at
 * all, and they have been silently dropped from the list more than once.
 *
 * The statements below are idempotent, so this is safe to run on a database that
 * already has some of the columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  /*
   * Written out longhand, one statement per column, with every identifier quoted.
   *
   * A loop with `sql.raw(column)` was the first attempt and it does not work: a
   * `DO $$ … $$` block is parsed by Postgres BEFORE the migration runner's
   * templating is relevant to it, and `sql.raw` injects the identifier text
   * unquoted, so `WHERE conname = payload_locked_documents_rels_contact_messages_id`
   * becomes a reference to a column that does not exist rather than a string
   * literal. The whole migration then fails on its first statement.
   *
   * So: five explicit blocks. Verbose, yes — and that is the correct trade for
   * DDL, because a migration that has to be read line by line at 3am is worth
   * three more lines, and a loop that generates subtly different SQL per
   * iteration is exactly how `contact_messages` ended up missing in the first
   * place.
   */
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "contact_messages_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "business_settings_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "email_log_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "riders_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "dispatches_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "sku_stock_id" integer;
  `)

  /*
   * `NOT VALID` then `VALIDATE CONSTRAINT` would be the zero-lockage route on a
   * large table. This one holds one row per concurrent editor — a handful — so a
   * brief ACCESS EXCLUSIVE lock is cheaper than the extra statement, and this is
   * the one table every single admin write touches, which is the wrong place to
   * be clever.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'payload_locked_documents_rels_contact_messages_id') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_contact_messages_id"
          FOREIGN KEY ("contact_messages_id") REFERENCES "contact_messages"("id") ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'payload_locked_documents_rels_business_settings_id') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_business_settings_id"
          FOREIGN KEY ("business_settings_id") REFERENCES "business_settings"("id") ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'payload_locked_documents_rels_email_log_id') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_email_log_id"
          FOREIGN KEY ("email_log_id") REFERENCES "email_log"("id") ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'payload_locked_documents_rels_riders_id') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_riders_id"
          FOREIGN KEY ("riders_id") REFERENCES "riders"("id") ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'payload_locked_documents_rels_dispatches_id') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_dispatches_id"
          FOREIGN KEY ("dispatches_id") REFERENCES "dispatches"("id") ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'payload_locked_documents_rels_sku_stock_id') THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_sku_stock_id"
          FOREIGN KEY ("sku_stock_id") REFERENCES "sku_stock"("id") ON DELETE CASCADE;
      END IF;
    END $$;`)

  /*
   * Payload indexes every rels column. Without these a lock check — which runs on
   * every admin write — degrades to a sequential scan of the table.
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_contact_messages_id_idx"
      ON "payload_locked_documents_rels" ("contact_messages_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_business_settings_id_idx"
      ON "payload_locked_documents_rels" ("business_settings_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_email_log_id_idx"
      ON "payload_locked_documents_rels" ("email_log_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_riders_id_idx"
      ON "payload_locked_documents_rels" ("riders_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_dispatches_id_idx"
      ON "payload_locked_documents_rels" ("dispatches_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sku_stock_id_idx"
      ON "payload_locked_documents_rels" ("sku_stock_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /*
   * Drops in reverse dependency order, and the constraints first — a foreign key
   * cannot be removed while its index still claims to describe it, and the
   * clearer error is worth the extra statement.
   */
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_dispatches_id";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_riders_id";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_email_log_id";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_business_settings_id";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_contact_messages_id";
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_dispatches_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_riders_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_email_log_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_business_settings_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_contact_messages_id_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "dispatches_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "riders_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "email_log_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "business_settings_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "contact_messages_id";

    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sku_stock_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_sku_stock_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sku_stock_id";
  `)
}
