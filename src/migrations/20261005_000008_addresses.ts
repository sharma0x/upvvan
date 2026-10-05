import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The customer address book.
 *
 * ── WHY THIS IS A HAND-WRITTEN MIGRATION, NOT A PAYLOAD COLLECTION ──────────
 *
 * Every other business table here is a Payload collection, and the obvious
 * move is to add `src/collections/Addresses.ts` and let Payload generate the
 * DDL. That would be wrong, for a reason worth recording.
 *
 * `customer_id` points at better-auth's `user` table — a table better-auth
 * owns, creates through its own migration runner, and that Payload knows
 * nothing about. A Payload `relationship` field can only reference a collection
 * Payload manages, so the FK would have to be faked with a plain `text` field.
 * A plain text field is exactly the "dangling reference wearing the costume of
 * a relationship" that `20261005_000006_customer_identity_fk.ts` was written to
 * eliminate: `orders.customer_id` got a real FK to `user(id)` for that reason,
 * and an address book is no different. It can hold a customer id that does not
 * exist, and nothing in the schema would object.
 *
 * So the table is written by hand, in the one DDL history, with a real FK — the
 * same decision, applied consistently.
 *
 * ── WHY pincode IS TEXT ─────────────────────────────────────────────────────
 *
 * Indian pincodes are 6 digits and leading zeros are legal: "012345" is a real
 * pincode. Stored as an integer it loses the zero and resolves the wrong
 * district. Same reasoning as `pincodes.pincode` and `orders.pincode`.
 *
 * ── WHY THE PINCODE FK IS DELIBERATELY ABSENT ───────────────────────────────
 *
 * `orders` references `pincodes` and `zones` with real FKs. This table does NOT,
 * and that is a considered omission rather than an oversight.
 *
 * An address book is customer-entered and long-lived; `pincodes` is our
 * operational coverage list. A FK here would mean that retiring a pincode from
 * coverage — which we do, per city, as a routine capacity decision — either
 * deletes a customer's saved addresses or blocks the coverage change itself.
 * Both are unacceptable: the second turns a coverage decision into a data
 * migration, and the first destroys data a customer gave us.
 *
 * Coverage is enforced where it is actually meaningful — at checkout, by the
 * same serviceability gate that refuses the order. An address that has fallen
 * out of coverage is still a true fact about where someone lives.
 */

/**
 * better-auth's customer table is `"user"` (singular). Payload's STAFF
 * collection is `users` (plural), which is a different subject entirely.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'user'
    ) AS exists;
  `)

  const userTableExists = (rows as unknown as Array<{ exists: boolean }>)[0]?.exists
  if (!userTableExists) {
    console.warn(
      '[addresses] better-auth table "user" not found — skipping. ' +
        'Run `pnpm exec better-auth migrate --config src/lib/auth.ts -y` then re-apply.',
    )
    return
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS addresses (
      "id"          VARCHAR PRIMARY KEY,
      "customer_id" VARCHAR NOT NULL,
      "label"       VARCHAR(40)  NOT NULL,
      "full_name"   VARCHAR(80)  NOT NULL,
      "line1"       VARCHAR(160) NOT NULL,
      "line2"       VARCHAR(160),
      "city"        VARCHAR(80)  NOT NULL,
      "pincode"     VARCHAR(6)   NOT NULL,
      "zone"        VARCHAR(60),
      "is_default"  BOOLEAN      NOT NULL DEFAULT FALSE,
      "marketing_consent"   BOOLEAN NOT NULL DEFAULT FALSE,
      "delivery_consent"    BOOLEAN NOT NULL DEFAULT TRUE,
      "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

      -- ON DELETE CASCADE, deliberately, and this is the reason the address
      -- table is safe to attach to identity at all.
      --
      -- better-auth deletes a user row when a customer asks for erasure — a DPDP
      -- obligation, not an edge case. With CASCADE, that request cannot
      -- half-succeed: the addresses go with the identity. With RESTRICT (which
      -- orders_customer_id_fk uses), erasure would FAIL while saved addresses
      -- exist, and a customer exercising a statutory right would hit an error.
      --
      -- orders keeps SET NULL on purpose and for the opposite reason: order
      -- history is a financial record and must outlive the account.
      CONSTRAINT "addresses_customer_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "user"("id") ON DELETE CASCADE
    );
  `)

  // Listing a customer's addresses is the only read this table ever serves.
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "addresses_customer_idx" ON "addresses" ("customer_id");`,
  )

  /*
   * ONE default address per customer — in the schema, not in application code.
   *
   * A partial unique index is the only thing that makes this hold under
   * concurrency. Two simultaneous "make this my default" requests both read
   * "no default yet", both write, and an application-level check cannot see the
   * other transaction's uncommitted row. Two defaults means checkout cannot
   * decide where to deliver, and that is a real order going to the wrong place.
   */
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "addresses_one_default_idx"
      ON "addresses" ("customer_id")
      WHERE "is_default" = TRUE;
  `)

  /*
   * Enforce the pincode rule at the schema layer, matching
   * `business.pincodePattern`. Application-code-only enforcement is a fail by
   * this project's rules — it is bypassable by a direct write.
   *
   * The pattern is duplicated here rather than imported because a CHECK
   * constraint is DDL: it is frozen into the database at migration time and
   * cannot call into application code. The comment is here so a change to the
   * pattern in config.ts is consciously mirrored rather than silently diverging.
   */
  /*
   * Guarded, unlike a bare `ALTER TABLE ... ADD CONSTRAINT`.
   *
   * `ADD CONSTRAINT` has no `IF NOT EXISTS` in Postgres, so a bare call fails
   * with `constraint ... already exists` the moment the statement runs twice —
   * and it DID run twice here, because the `addresses` table was created
   * outside this runner before the migration was registered in
   * `src/migrations/index.ts`.
   *
   * Every other statement in this migration is `IF NOT EXISTS`, so this one was
   * the only thing standing between a partially-applied schema and a red build.
   * The `pg_constraint` guard is the same pattern
   * `20261005_000007_launch_blockers.ts` uses for its CHECK constraints, and it
   * is the only way to make DDL of this shape safely re-runnable.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'addresses_pincode_is_6_digits'
      ) THEN
        ALTER TABLE "addresses"
          ADD CONSTRAINT "addresses_pincode_is_6_digits"
          CHECK ("pincode" ~ '^[0-9]{6}$');
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "addresses";`)
}