import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The contact inbox — the table behind the `/contact` form.
 *
 * ── WHY THIS TABLE IS THE WHOLE POINT OF `/contact` ──────────────────────────
 *
 * The contact page promises "under 4 working hours on e-mail, under 15 minutes
 * on WhatsApp". A `mailto:` cannot make that promise measurable: there is no
 * `received_at`, so there is no denominator, so the number on the page is a claim
 * in the same way "we aim to respond quickly" is a claim — which is precisely
 * what every competitor in the audit says, and the reason their support is rated
 * 1.4 to 2.1.
 *
 * So the form writes a row with `received_at`, and a person fills in
 * `first_response_at` when they actually reply. The difference between those two
 * columns is the whole strategic bet of the business's support model.
 *
 * Hand-written rather than generated for the same reason as
 * `20261005_000011_storefront_collections.ts`: `migrate:create` diffs against a
 * snapshot that predates several tables and asks to recreate them. This is the
 * additive form and it carries the invariant that matters below.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_contact_messages_status') THEN
        CREATE TYPE "public"."enum_contact_messages_status"
          AS ENUM('new', 'answered', 'escalated', 'resolved', 'spam');
      END IF;
    END $$;`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "contact_messages" (
      "id" serial PRIMARY KEY NOT NULL,
      "topic" varchar NOT NULL,
      "name" varchar NOT NULL,
      "contact_detail" varchar NOT NULL,
      "order_code" varchar,
      "message" varchar NOT NULL,
      "opt_in" boolean DEFAULT false NOT NULL,
      "ip" varchar,
      "status" "enum_contact_messages_status" DEFAULT 'new' NOT NULL,
      "received_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "first_response_at" timestamp(3) with time zone,
      "reply_note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "contact_messages_topic_idx" ON "contact_messages" ("topic");
    CREATE INDEX IF NOT EXISTS "contact_messages_order_code_idx" ON "contact_messages" ("order_code");
    CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages" ("status");
    CREATE INDEX IF NOT EXISTS "contact_messages_received_at_idx" ON "contact_messages" ("received_at");
    CREATE INDEX IF NOT EXISTS "contact_messages_first_response_at_idx" ON "contact_messages" ("first_response_at");
    CREATE INDEX IF NOT EXISTS "contact_messages_updated_at_idx" ON "contact_messages" ("updated_at");
    CREATE INDEX IF NOT EXISTS "contact_messages_created_at_idx" ON "contact_messages" ("created_at");`)

  /**
   * The invariant that makes the published SLA honest.
   *
   * A response cannot be recorded BEFORE the message arrived. Without this, an
   * honest mistake — backfilling `first_response_at` while migrating a spreadsheet
   * into the panel — writes a negative interval, and `avg(first_response_at -
   * received_at)` silently drops those rows, which is how a support metric starts
   * reporting better numbers than the truth.
   *
   * NULL is allowed on both: an unanswered message has no response time yet, and
   * `first_response_at` being null IS the "we have not got to it" state the SLA
   * is measured against.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_response_after_receipt') THEN
        ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_response_after_receipt"
        CHECK ("first_response_at" IS NULL OR "first_response_at" >= "received_at");
      END IF;
    END $$;`)

  /**
   * A response requires an answer.
   *
   * The second version of the publishable metric — and the one that is actually
   * falsifiable — is "no message is left as `new` with a `first_response_at` set".
   * Setting the timestamp without changing the status means the row looks
   * answered in the SLA report and unanswered in the queue, and the two disagree
   * exactly where it matters.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_response_implies_status') THEN
        ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_response_implies_status"
        CHECK (
          "first_response_at" IS NULL
          OR "status" IN ('answered', 'escalated', 'resolved')
        );
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_topic_known'
      ) THEN
        ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_topic_known"
        CHECK ("topic" IN ('plant', 'order', 'coverage', 'stock', 'corporate', 'care', 'other'));
      END IF;
    END $$;`)

  /**
   * The reason for the table: nothing arrives without something we can reply to.
   *
   * A message with no name and no contact detail is unreachable, and an
   * unreachable message is precisely the failure this whole page exists to stop.
   * So it cannot be written, rather than being written and then quietly never
   * answered.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_is_reachable'
      ) THEN
        ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_is_reachable"
        CHECK (btrim("name") <> '' AND btrim("contact_detail") <> '' AND length(btrim("message")) >= 10);
      END IF;
    END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "contact_messages";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_contact_messages_status";`)
}
