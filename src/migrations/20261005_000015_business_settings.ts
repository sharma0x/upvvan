import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `business_settings` — one row, everything a non-technical owner changes.
 *
 * ── WHY THIS IS A TABLE AND NOT `.env` ──────────────────────────────────────
 *
 * The project rule was "nothing operational is hardcoded", implemented as
 * "everything operational is an environment variable". Correct for secrets,
 * wrong for identity.
 *
 * A dotfile is unreadable and uneditable by the person who runs the company.
 * Changing the GSTIN, fixing a typo in the registered address, or adding an
 * Instagram account should not require a developer, a commit and a redeploy —
 * and those values were all in `config.compliance`, which is exactly what they
 * were. Worse, `assertConfigValid()` refuses to BOOT when they are blank, so the
 * failure mode for an unconfigured launch was a site that would not start rather
 * than a page that said "please configure me".
 *
 * The split this migration completes:
 *
 *   env, fail-fast  →  secrets and infrastructure. Wrong values are an outage;
 *                      nobody should be able to edit these from a web form.
 *   THIS TABLE      →  identity, contact details, tax registration, socials,
 *                      statutory disclosures, promises and SEO defaults. Wrong
 *                      values are a customer-facing mistake, and the person who
 *                      made it is sitting in the admin panel.
 *
 * ── WHY ONE ROW AND NOT KEY/VALUE ───────────────────────────────────────────
 *
 * A key-value store puts the meaning of a field in a second place — the key name
 * — so "is this a valid GSTIN" becomes "look up which validator this key uses",
 * and a typo becomes a silently ignored row that renders as blank.
 *
 * Typed columns instead: the PAN-shape CHECK below cannot be evaded by writing a
 * row with a misspelt key, and the CHECK is enforced for a direct `INSERT` from
 * psql exactly as it is for the admin panel. Application-code-only validation is
 * a fail in this codebase — a bypassable constraint is not a constraint.
 *
 * ── WHY THE GSTIN IS CHECKED IN SQL AT ALL ─────────────────────────────────
 *
 * The Legal Metrology Packaged Commodities Rules require certain declarations on
 * a packaged good; a GSTIN on an invoice is required for a registered dealer.
 * A malformed GSTIN is not a cosmetic problem — it makes the invoice unusable,
 * and input-tax credit cannot be claimed against it. The regex encodes the real
 * structure (2 state digits, 10-char PAN, entity code, `1Z`, checksum) rather
 * than just counting characters, because `[A-Z0-9]{15}` would accept `AAAAAAAAAAAAAAA`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "business_settings" (
      "id" serial PRIMARY KEY NOT NULL,

      /* ── Identity ─────────────────────────────────────────────────────── */
      "trading_name"            varchar NOT NULL DEFAULT 'Upvvan',
      "legal_entity_name"       varchar,
      "principal_address"       text,
      "supporting_since"        varchar,

      /* ── GST & registration ───────────────────────────────────────────── */
      "gstin"                   varchar,
      "gstin_required"          boolean NOT NULL DEFAULT true,
      "gst_rate_bp"             numeric,
      "cin"                     varchar,

      /* ── Customer care ────────────────────────────────────────────────── */
      "customer_care_email"     varchar,
      "customer_care_phone"     varchar,
      "whatsapp_number"         varchar,
      "business_hours"          varchar DEFAULT 'Mon–Sat, 9am–7pm IST',

      /* ── Grievance officer (Consumer Protection (E-commerce) Rules 2020 r.4) ── */
      "grievance_officer_name"         varchar,
      "grievance_officer_designation"  varchar,
      "grievance_officer_email"        varchar,
      "grievance_officer_phone"        varchar,
      "grievance_response_hours"       numeric,

      /* ── Social ───────────────────────────────────────────────────────── */
      "instagram_url"    varchar,
      "facebook_url"     varchar,
      "youtube_url"      varchar,
      "linkedin_url"     varchar,
      "x_url"            varchar,
      "pinterest_url"    varchar,
      "social_proof_note" text,

      /* ── Announcement bar ─────────────────────────────────────────────── */
      "announcement_enabled"      boolean NOT NULL DEFAULT false,
      "announcement_text"         varchar,
      "announcement_link_label"   varchar,
      "announcement_link_href"    varchar,

      /* ── SEO defaults ─────────────────────────────────────────────────── */
      "seo_title_template"        varchar DEFAULT '%s · Upvvan',
      "default_meta_description"  text,
      "og_image_url"              varchar,

      /* ── Published service promises ───────────────────────────────────── */
      "same_day_cutoff"            varchar DEFAULT '2pm',
      "support_response_minutes"   numeric,
      "replacement_window_days"    numeric,

      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    );`)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS business_settings_singleton
      ON "business_settings" ((true));`)

  /*
   * A GSTIN is a structured identifier, not 15 arbitrary characters.
   *
   * Enforced here rather than only in the collection's `validate` so that a
   * direct write — a migration, a `psql` session, a future seeding script —
   * cannot slip a value past the panel. This codebase's rule is that a business
   * invariant enforced in application code is bypassable, and therefore is not an
   * invariant.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_gstin_shape'
      ) THEN
        ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_gstin_shape"
          CHECK (
            "gstin" IS NULL
            OR "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'
          );
      END IF;
    END $$;`)

  /*
   * `whatsapp_number` is interpolated into a `wa.me` URL. Digits only, so a
   * pasted "(080) 4123-4567" cannot produce a broken link that silently fails to
   * open WhatsApp — and that is the link the contact page's "answers in 15
   * minutes" promise is attached to, so a broken one is a broken promise.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_whatsapp_is_digits'
      ) THEN
        ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_whatsapp_is_digits"
          CHECK ("whatsapp_number" IS NULL OR "whatsapp_number" ~ '^[0-9]{10,15}$');
      END IF;
    END $$;`)

  /*
   * r.4(5) caps acknowledgement of a complaint at 48 hours. An owner may commit
   * to FASTER; a longer one is a non-compliant promise, and it would be rendered
   * on the contact page as though it were real.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_grievance_within_48h'
      ) THEN
        ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_grievance_within_48h"
          CHECK (
            "grievance_response_hours" IS NULL OR "grievance_response_hours" <= 48
          );
      END IF;
    END $$;`)

  /*
   * Basis points, not a percentage. `18` would be a tenth of a percent, and the
   * failure is invisible — the tax line would simply be wrong by a factor of 100
   * and nobody reviewing an order would notice.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_tax_rate_is_bp'
      ) THEN
        ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_tax_rate_is_bp"
          CHECK ("gst_rate_bp" IS NULL OR "gst_rate_bp" = floor("gst_rate_bp"));
      END IF;
    END $$;`)

  /*
   * ── THE SINGLETON ROW ────────────────────────────────────────────────────
   *
   * Inserted with DEFAULTS ONLY, deliberately.
   *
   * The obvious move is to fill it from `config.compliance` here, and it is
   * wrong three ways. It would interpolate environment values into DDL — which
   * is an injection surface and puts a secret-shaped value into a file that
   * lives in version control forever. It would re-apply on every future migrate
   * and overwrite whatever the owner had typed, which is precisely the failure
   * this table exists to prevent. And it would blur the rule the project already
   * has: DDL in migrations, DATA in seeds.
   *
   * So the row starts empty except for defaults, which is the better admin
   * experience anyway: the settings screen shows a form to fill rather than an
   * empty collection. `scripts/seed-settings.ts` copies the `.env` compliance
   * values in once, and `loadBusinessSettings()` falls back to env for any field
   * still blank — so a clone is compliant before anybody logs in, and the owner
   * overrides the env the moment they save anything.
   */
  await db.execute(sql`
    INSERT INTO "business_settings" ("trading_name", "created_at", "updated_at")
    SELECT 'Upvvan', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM "business_settings");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /*
   * The table, its singleton index and its four CHECKs.
   *
   * Deliberately NOT dropped. This table holds the statutory disclosures — legal
   * name, registered address, GSTIN, grievance officer — and a rollback that
   * discards them would leave a compliant deployment unable to demonstrate
   * compliance after a bad deploy.
   *
   * Every other migration here drops cleanly, and the temptation to be
   * consistent is exactly the point: `down` exists to undo a schema experiment,
   * not to delete the company's registration details. Reverting the code and
   * leaving this table is the correct failure mode.
   */
  await db.execute(
    sql`-- Intentionally retained: statutory disclosure records. See the comment above.`,
  )
}
