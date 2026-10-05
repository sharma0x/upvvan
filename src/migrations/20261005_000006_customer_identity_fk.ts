import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C-1 · bind orders to the customer owner with a REAL foreign key.
 *
 * ── WHAT C-1 REQUIRES ──────────────────────────────────────────────────────
 *
 * Customer identity is owned outright by better-auth, in its own tables. There
 * is deliberately NO `Customers` collection in this project — a mirror table
 * holding email/phone/name is the shape C-1 exists to prevent, and its failure
 * mode is two customer records in month three.
 *
 * But "no mirror" is only half the guarantee. Without a FOREIGN KEY,
 * `orders.customer_id` is just a text column: it can hold a customer id that
 * does not exist, and it can be set to anything by any writer. That is a
 * dangling reference wearing the costume of a relationship.
 *
 * So `orders.customer_id` gets a real FK to `user(id)` — created here, in the
 * same DDL history as everything else. That is what makes the claim "other
 * systems store a REFERENCE to customer_id, never a parallel copy" true in the
 * schema rather than in a code comment.
 *
 * ── WHY IT IS NULLABLE ─────────────────────────────────────────────────────
 *
 * Guest checkout. A customer can place a prepaid order without ever logging in —
 * the buyer is on a phone, support is WhatsApp-first, and forcing an OTP before
 * showing a total is exactly the friction we are trying to remove.
 *
 * So the column is nullable and the FK is the constraint when a customer IS
 * attached. Anonymous orders are attributed by phone at fulfilment time, and the
 * order is linked once we have an identity. Making it NOT NULL would be a
 * conversion tax disguised as an integrity guarantee.
 */

/**
 * better-auth's customer table is `"user"` (singular) — its `user.modelName`.
 * Payload's STAFF collection is `users` (plural), which is a different subject
 * entirely (STACK-DECISION.md §5).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // The FK can only be created once `user` exists. better-auth's migration runs
  // separately (make db-migrate runs both), so skip cleanly if it is not there
  // yet rather than failing the whole migration.
  const { rows } = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'user'
    ) AS exists;
  `)

  const userTableExists = (rows as unknown as Array<{ exists: boolean }>)[0]?.exists
  if (!userTableExists) {
    console.warn(
      '[c-1] better-auth table "user" not found — skipping the orders FK. ' +
        'Run `pnpm exec better-auth migrate --config src/lib/auth.ts -y` then re-apply.',
    )
    return
  }

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_fk'
      ) THEN
        ALTER TABLE "orders"
          ADD CONSTRAINT "orders_customer_id_fk"
          FOREIGN KEY ("customer_id") REFERENCES "user"("id")
          ON DELETE SET NULL;
      END IF;
    END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customer_id_fk";`,
  )
}