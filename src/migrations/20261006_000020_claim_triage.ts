import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Claim triage, and the index the account page needs.
 *
 * ── WHY `order_claims` HAD NO RESOLUTION COLUMNS ─────────────────────────────
 *
 * The table could be OPEN and could not become anything else.
 *
 * `POST /api/claims` inserted `status = 'OPEN'` and set `orders.status =
 * 'CLAIM_OPEN'`. Nothing else in the repository ever wrote `order_claims.status`,
 * and `order_claims` is a raw table — no Payload collection, so not even the admin
 * panel could see it. The CHECK allows `OPEN | ACCEPTED | REPLACEMENT_QUEUED |
 * REJECTED` and three of those four values were unreachable.
 *
 * That is worse than a stuck record, because the ORDER is stuck with it. The
 * state machine allows `CLAIM_OPEN → REPLACEMENT_QUEUED | DELIVERED` and nothing
 * else, so:
 *
 *   · the order was pinned at `CLAIM_OPEN` permanently,
 *   · a second claim returned 409 — "we already have a claim open and it is
 *     being handled" — for a claim nobody was handling,
 *   · the guarantee could not be honoured, because honouring it means queueing a
 *     replacement and nothing in the system could queue one.
 *
 * So these three columns are not a nicety. They are the difference between a claim
 * and a complaint nobody can answer.
 *
 * `resolved_by` is free text rather than an FK to Payload's `users` for the same
 * reason `dispatch_events.actor_label` is: this table is written by raw SQL, and a
 * link to a table we do not manage would be a dangling reference wearing the
 * costume of a relationship. What it must NOT be is NULL — a resolved claim with
 * no resolver is exactly the "we declined it and nobody knows why" state this
 * migration exists to make impossible going forward.
 *
 * ── WHY THE INDEX IS HERE AND NOT ON THE COLLECTION ──────────────────────────
 *
 * `listCustomerOrders` filters on `orders.customer_id` and runs on every
 * `/account` view. With 75 orders a sequential scan is invisible; with 75,000, and
 * with the account page also loading a summary and a dashboard in the same
 * render, it is the difference between a page and a spinner. `customer_id` had no
 * index — the FK constraint does not create one.
 *
 * ── EXISTING ROWS ───────────────────────────────────────────────────────────
 *
 * NOT backfilled, and deliberately. An open claim in this database is a real
 * customer who sent a real photograph, and the correct status for it is a DECISION
 * that only a person can make — accept it or reject it, with a reason. Writing
 * `REJECTED` to make a constraint happy would be the schema making a commercial
 * decision, and writing `ACCEPTED` would be inventing a promise to pay for a
 * replacement plant.
 *
 * So the migration reports them and refuses nothing. `/admin-ops/claims` is where
 * they get decided, one at a time, with the customer told either way.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "order_claims"
      ADD COLUMN IF NOT EXISTS "resolved_at"   timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "resolved_by"   text,
      ADD COLUMN IF NOT EXISTS "resolution_note" text;
  `)

  /*
   * A resolved claim MUST say who resolved it and when.
   *
   * `status <> 'OPEN'` rather than `resolved_at IS NOT NULL`, so a row cannot be
   * marked decided while claiming it has not been. The old states have NULL here
   * and are exempt — they predate the column.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_claims_resolution_is_attributable'
      ) THEN
        ALTER TABLE "order_claims"
          ADD CONSTRAINT order_claims_resolution_is_attributable
          CHECK (
            "status" = 'OPEN'
            OR ("resolved_at" IS NOT NULL AND btrim(COALESCE("resolved_by", '')) <> '')
          );
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON "orders" ("customer_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS order_claims_open_idx
      ON "order_claims" ("created_at" ASC)
      WHERE "status" = 'OPEN';
  `)

  /*
   * ── WHAT IS ALREADY STUCK, REPORTED ────────────────────────────────────────
   *
   * Read-only, and it prints rather than throws. A migration that refuses to run
   * because a customer once reported a dead plant would make the remedy — the
   * screen where you decide claims — unavailable, which is the wrong direction.
   */
  const stuck = await db.execute(sql`
    SELECT c."id", c."order_code", c."created_at"
      FROM "order_claims" c
     WHERE c."status" = 'OPEN'
     ORDER BY c."created_at" ASC
  `)
  const rows = (stuck as unknown as { rows?: Array<{ id: number; order_code: string }> }).rows
  if (rows && rows.length > 0) {
    console.warn(
      `\n[claim triage] ${rows.length} claim(s) are OPEN and now resolvable at /admin-ops/claims:` +
        `\n${rows.map((r) => `  CLM-${String(r.id).padStart(6, '0')}  ${r.order_code}`).join('\n')}` +
        `\nEach one needs a human decision (accept / replacement queued / reject + reason).` +
        `\nUntil then its order stays at CLAIM_OPEN and cannot accept a second claim.\n`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS order_claims_open_idx;`)
  await db.execute(sql`DROP INDEX IF EXISTS orders_customer_id_idx;`)
  await db.execute(sql`
    ALTER TABLE "order_claims" DROP CONSTRAINT IF EXISTS order_claims_resolution_is_attributable;
  `)
  await db.execute(sql`
    ALTER TABLE "order_claims"
      DROP COLUMN IF EXISTS "resolved_at",
      DROP COLUMN IF EXISTS "resolved_by",
      DROP COLUMN IF EXISTS "resolution_note";
  `)
}
