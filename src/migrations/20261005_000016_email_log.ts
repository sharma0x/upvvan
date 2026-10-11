import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `email_log` — one row per outbound message attempt.
 *
 * ── WHY THIS TABLE IS THE POINT ─────────────────────────────────────────────
 *
 * Every competitor in the audit is rated on support, and every one of them runs
 * on "the mail probably went out". That is not knowable from inside a request:
 * nodemailer returns as soon as the SMTP server ACCEPTS the message, and an
 * accepting server will still bounce it, throttle it, or drop it on the floor an
 * hour later.
 *
 * So there is no way to know whether a customer received their order confirmation
 * unless the business writes down that it tried. That is the whole table: an
 * attempt, its outcome, and enough of the message to re-send it by hand.
 *
 * It is the mail equivalent of `contact_messages.first_response_at` — a promise
 * with a row behind it, so "we answer quickly" is a measurement rather than an
 * aspiration.
 *
 * ── WHY `status` IS NOT AN ENUM ─────────────────────────────────────────────
 *
 * A CHECK rather than an enum, for one reason: an unknown status should be a
 * rejected value, not a migration. Adding a status to an enum means DDL on the
 * one table that must never block a deploy; adding one to a CHECK that is
 * currently satisfied does not. The set of states is small and closed either way.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "email_log" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" varchar NOT NULL,
      "recipient" varchar NOT NULL,
      "recipient_name" varchar,
      "subject" varchar NOT NULL,
      "from_address" varchar NOT NULL,
      "body_text" text NOT NULL,
      "internal_only" boolean NOT NULL DEFAULT false,
      "status" varchar NOT NULL DEFAULT 'queued',
      "provider_message_id" varchar,
      "error" text,
      "sent_at" timestamp with time zone,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      -- The collection declares timestamps, which means BOTH columns. Omitting
      -- this one made every admin-panel list view of email_log fail with
      -- 'column updated_at does not exist', because it is the only reader that
      -- selects every column through Payload. Corrected here for fresh databases
      -- and by migration 000018 for every database that already ran this file.
      --
      -- (No backticks in this comment: it lives inside a JS template literal,
      -- where one silently ends the string.)
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_email_log_status') THEN
        CREATE TYPE "public"."enum_email_log_status"
          AS ENUM('queued', 'sent', 'failed');
      END IF;
    END $$;`)

  /*
   * `sent_at` is set only by the transport's success path, never by a caller.
   *
   * That distinction is the table's entire value: "we tried" and "it went" are
   * different claims, and conflating them is how a support promise becomes
   * unfalsifiable. `sent_at IS NOT NULL` therefore implies `status = 'sent'`.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_log_sent_implies_sent') THEN
        ALTER TABLE "email_log" ADD CONSTRAINT "email_log_sent_implies_sent"
          CHECK ("sent_at" IS NULL OR "status" = 'sent');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_log_status_is_known') THEN
        ALTER TABLE "email_log" ADD CONSTRAINT "email_log_status_is_known"
          CHECK ("status" IN ('queued', 'sent', 'failed'));
      END IF;
    END $$;`)

  /*
   * Index the recipient, because the question a support inbox actually asks is
   * "what did this person receive?" and without this it is a sequential scan of
   * every message the business has ever sent.
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_log_recipient_idx ON "email_log" ("recipient");`)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_log_kind_created_idx ON "email_log" ("kind", "created_at" DESC);`)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_log_failed_idx ON "email_log" ("created_at" DESC)
      WHERE "status" = 'failed';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "email_log";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_email_log_status";`)
}
