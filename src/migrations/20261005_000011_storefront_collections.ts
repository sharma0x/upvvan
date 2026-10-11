import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Storefront tables — reviews, content, wishlists and B2B leads.
 *
 * ── WHY THIS FILE IS HAND-WRITTEN RATHER THAN GENERATED ─────────────────────
 *
 * `payload migrate:create storefront_collections` produced a file that began
 * with:
 *
 *     CREATE TYPE "public"."enum_riders_vehicle_type" AS ENUM(…);
 *     CREATE TABLE "sku_stock" (…);
 *     CREATE TABLE "riders" (…);
 *     CREATE TABLE "dispatches" (…);
 *     CREATE TABLE "reviews" (…);
 *
 * The first four already exist. `riders` and `dispatches` were created by
 * hand-written migrations (`20261005_000009_dispatch.ts`) that were never
 * followed by a schema snapshot, so the snapshot this diff was taken against
 * genuinely did not know about them, and drizzle asked to create them again —
 * over a live `sku_stock` table with a week of stock movements in it.
 *
 * There is a second problem with the generated output that makes it unusable as
 * written: `ADD CONSTRAINT IF NOT EXISTS` is not valid Postgres. Only
 * `CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX` and `ADD COLUMN` accept the
 * clause, so every foreign key has to be wrapped in a `DO $$ … pg_constraint
 * … $$` guard by hand. Once you are editing the generated statements anyway,
 * the honest thing is to write the migration.
 *
 * The DDL below is exactly what drizzle generated, minus the four pre-existing
 * objects, with guards throughout so a re-run cannot half-apply — the runner
 * wraps a migration in a transaction, and a `CREATE TYPE` that succeeds followed
 * by a `CREATE TABLE` that fails leaves an enum behind that then blocks every
 * subsequent attempt.
 *
 * The business INVARIANTS for these tables are a separate migration
 * (`20261005_000012_storefront_invariants.ts`), because a constraint that
 * references a table cannot be created before the table exists, and because
 * "what Payload wants" and "what the business requires" should be readable as
 * two things.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════════
  // A · ENUMS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // The `riders` and `dispatches` enums are deliberately absent: they exist,
  // created by 000009_dispatch. Adding a VALUE to an existing enum cannot run
  // inside a transaction block at all, which is why that file exists separately.

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_posts_kind') THEN
        CREATE TYPE "public"."enum_posts_kind" AS ENUM('article', 'problem');
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_quote_requests_occasion') THEN
        CREATE TYPE "public"."enum_quote_requests_occasion"
          AS ENUM('onboarding', 'employee_occasion', 'client', 'festive', 'office_refresh', 'event', 'other');
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_quote_requests_status') THEN
        CREATE TYPE "public"."enum_quote_requests_status"
          AS ENUM('new', 'quoted', 'accepted', 'declined');
      END IF;
    END $$;`)

  // ══════════════════════════════════════════════════════════════════════════
  // B · REVIEWS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // `order_item_id` is UNIQUE, and that is the reason a product card can say
  // "4.7 from 128" and mean it: one order line yields one review, so the sample
  // size is a count of distinct opinions rather than a count of writes.

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "reviews" (
      "id" serial PRIMARY KEY NOT NULL,
      "sku_id" integer NOT NULL,
      "order_item_id" varchar NOT NULL,
      "rating" numeric NOT NULL,
      "title" varchar NOT NULL,
      "body" varchar NOT NULL,
      "author_name" varchar NOT NULL,
      "is_published" boolean DEFAULT false NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`)

  // ══════════════════════════════════════════════════════════════════════════
  // C · POSTS — articles and the symptom-first problem library
  // ══════════════════════════════════════════════════════════════════════════
  //
  // `body` is jsonb because it is Payload's lexical rich text. `diagnosis_*` are
  // flat columns rather than a nested block because they are what the
  // symptom-first library is BUILT on: a symptom, a cause and a fix, one row
  // each, indexable and cross-linkable.

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "posts" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" "enum_posts_kind" DEFAULT 'article' NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "excerpt" varchar NOT NULL,
      "diagnosis_symptom" varchar,
      "diagnosis_cause" varchar,
      "diagnosis_fix" varchar,
      "body" jsonb NOT NULL,
      "cover_image_url" varchar,
      "is_published" boolean DEFAULT false NOT NULL,
      "published_at" timestamp(3) with time zone,
      "seo_title" varchar,
      "seo_description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`)

  // The hasMany relationship table. Payload generates these with `path` and
  // `_order`; both are required columns with no defaults, so the INSERT from the
  // Local API must supply them and a raw-SQL seed must too.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "posts_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "species_id" integer
    );`)

  // ══════════════════════════════════════════════════════════════════════════
  // D · WISHLISTS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // No column can hold a phone number. `better_auth_user_id` REFERENCES
  // better-auth's own `user` table — not a table of ours — because C-1 means
  // there is deliberately no `Customers` collection.

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "wishlists" (
      "id" serial PRIMARY KEY NOT NULL,
      "sku_id" integer NOT NULL,
      "better_auth_user_id" varchar,
      "customer_email" varchar,
      "notified_at" timestamp(3) with time zone,
      "note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`)

  // ══════════════════════════════════════════════════════════════════════════
  // E · QUOTE REQUESTS — the corporate funnel, self-serve
  // ══════════════════════════════════════════════════════════════════════════

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "quote_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "organisation" varchar NOT NULL,
      "contact_name" varchar NOT NULL,
      "email" varchar NOT NULL,
      "phone" varchar NOT NULL,
      "minimum_quantity" numeric NOT NULL,
      "occasion" "enum_quote_requests_occasion" NOT NULL,
      "budget_per_unit_paise" numeric,
      "delivery_date" timestamp(3) with time zone,
      "personalisation" varchar,
      "notes" varchar,
      "status" "enum_quote_requests_status" DEFAULT 'new' NOT NULL,
      "quote_sent_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`)

  // Split delivery. `id` is a varchar PRIMARY KEY with no default — Payload
  // generates it in application code, so a raw INSERT must supply one. Three
  // surprises documented in AGENTS.md, all of them paid for in a 500 once.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "quote_requests_delivery_addresses" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "recipient_name" varchar NOT NULL,
      "address_line1" varchar NOT NULL,
      "address_line2" varchar,
      "city" varchar NOT NULL,
      "pincode" varchar NOT NULL,
      "is_office" boolean DEFAULT false NOT NULL
    );`)

  // ══════════════════════════════════════════════════════════════════════════
  // F · SPECIES AND SKUS COLUMNS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // `summary` and `bench_note` are what the eleven collection pages and the PDP
  // are built from; `edible` / `air_purifying` / `vastu_friendly` are the three
  // flags a collection URL is derived from; `care_guide_*` is the seven-field
  // long-form guide; `toxicity_witnessed_at` is the evidence a "safe" claim
  // needs before a database CHECK will accept it.
  //
  // `skus.description` exists because a consumable has no species row and still
  // has to say what it is.

  await db.execute(sql`
    ALTER TABLE "species"
      ADD COLUMN IF NOT EXISTS "summary" varchar,
      ADD COLUMN IF NOT EXISTS "bench_note" varchar,
      ADD COLUMN IF NOT EXISTS "edible" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "air_purifying" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "vastu_friendly" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "care_guide_light" varchar,
      ADD COLUMN IF NOT EXISTS "care_guide_water" varchar,
      ADD COLUMN IF NOT EXISTS "care_guide_humidity" varchar,
      ADD COLUMN IF NOT EXISTS "care_guide_temperature" varchar,
      ADD COLUMN IF NOT EXISTS "care_guide_feeding" varchar,
      ADD COLUMN IF NOT EXISTS "care_guide_additional" varchar,
      ADD COLUMN IF NOT EXISTS "toxicity_witnessed_at" timestamp(3) with time zone;`)

  await db.execute(sql`
    ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "description" varchar;`)

  // Idempotent re-application of 000007 A3.
  await db.execute(sql`ALTER TABLE "skus" ALTER COLUMN "species_id" DROP NOT NULL;`)

  // ══════════════════════════════════════════════════════════════════════════
  // G · FOREIGN KEYS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ON DELETE SET NULL, not CASCADE, for the sales-facing relationships. A
  // published review outliving the SKU it describes is a broken product page;
  // deleting the review because an internal SKU row was removed would silently
  // reduce a customer-visible average. The row stays, the average excludes it.

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_sku_id_skus_id_fk') THEN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_sku_id_skus_id_fk"
          FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlists_sku_id_skus_id_fk') THEN
        ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_sku_id_skus_id_fk"
          FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_rels_parent_fk') THEN
        ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_rels_species_fk') THEN
        ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_species_fk"
          FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_delivery_addresses_parent_id_fk') THEN
        ALTER TABLE "quote_requests_delivery_addresses" ADD CONSTRAINT "quote_requests_delivery_addresses_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;`)

  // ══════════════════════════════════════════════════════════════════════════
  // H · INDEXES
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Every column the storefront filters, sorts or looks up by gets an index.
  // This catalogue is read on every page render and the site is deliberately a
  // single process against a single database, so a sequential scan here is a
  // sequential scan on the critical path of every visitor.

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "reviews_order_item_id_idx" ON "reviews" ("order_item_id");
    CREATE INDEX IF NOT EXISTS "reviews_sku_idx" ON "reviews" ("sku_id");
    CREATE INDEX IF NOT EXISTS "reviews_updated_at_idx" ON "reviews" ("updated_at");
    CREATE INDEX IF NOT EXISTS "reviews_created_at_idx" ON "reviews" ("created_at");

    CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" ("slug");
    CREATE INDEX IF NOT EXISTS "posts_kind_idx" ON "posts" ("kind");
    CREATE INDEX IF NOT EXISTS "posts_is_published_idx" ON "posts" ("is_published");
    CREATE INDEX IF NOT EXISTS "posts_published_at_idx" ON "posts" ("published_at");
    CREATE INDEX IF NOT EXISTS "posts_updated_at_idx" ON "posts" ("updated_at");
    CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" ("created_at");

    CREATE INDEX IF NOT EXISTS "posts_rels_order_idx" ON "posts_rels" ("order");
    CREATE INDEX IF NOT EXISTS "posts_rels_parent_idx" ON "posts_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "posts_rels_path_idx" ON "posts_rels" ("path");
    CREATE INDEX IF NOT EXISTS "posts_rels_species_id_idx" ON "posts_rels" ("species_id");

    CREATE INDEX IF NOT EXISTS "wishlists_sku_idx" ON "wishlists" ("sku_id");
    CREATE INDEX IF NOT EXISTS "wishlists_better_auth_user_id_idx" ON "wishlists" ("better_auth_user_id");
    CREATE INDEX IF NOT EXISTS "wishlists_updated_at_idx" ON "wishlists" ("updated_at");
    CREATE INDEX IF NOT EXISTS "wishlists_created_at_idx" ON "wishlists" ("created_at");

    CREATE INDEX IF NOT EXISTS "quote_requests_organisation_idx" ON "quote_requests" ("organisation");
    CREATE INDEX IF NOT EXISTS "quote_requests_occasion_idx" ON "quote_requests" ("occasion");
    CREATE INDEX IF NOT EXISTS "quote_requests_status_idx" ON "quote_requests" ("status");
    CREATE INDEX IF NOT EXISTS "quote_requests_updated_at_idx" ON "quote_requests" ("updated_at");
    CREATE INDEX IF NOT EXISTS "quote_requests_created_at_idx" ON "quote_requests" ("created_at");

    CREATE INDEX IF NOT EXISTS "quote_requests_delivery_addresses_order_idx" ON "quote_requests_delivery_addresses" ("_order");
    CREATE INDEX IF NOT EXISTS "quote_requests_delivery_addresses_parent_id_idx" ON "quote_requests_delivery_addresses" ("_parent_id");`)

  // ══════════════════════════════════════════════════════════════════════════
  // I · PAYLOAD'S RELATIONSHIP TABLES
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Payload tracks many-to-many in its own lock and preference tables. Missing
  // these columns does not break writes, but it does mean optimistic-locking and
  // admin list views silently degrade — and it is the kind of omission that
  // shows up months later as "why is this field not locking?".

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "reviews_id" integer,
      ADD COLUMN IF NOT EXISTS "posts_id" integer,
      ADD COLUMN IF NOT EXISTS "wishlists_id" integer,
      ADD COLUMN IF NOT EXISTS "quote_requests_id" integer;`)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_reviews_fk') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk"
          FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_posts_fk') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk"
          FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_wishlists_fk') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wishlists_fk"
          FOREIGN KEY ("wishlists_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_quote_requests_fk') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quote_requests_fk"
          FOREIGN KEY ("quote_requests_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;`)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" ("reviews_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" ("posts_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_wishlists_id_idx" ON "payload_locked_documents_rels" ("wishlists_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_quote_requests_id_idx" ON "payload_locked_documents_rels" ("quote_requests_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "quote_requests_delivery_addresses";`)
  await db.execute(sql`DROP TABLE IF EXISTS "quote_requests";`)
  await db.execute(sql`DROP TABLE IF EXISTS "wishlists";`)
  await db.execute(sql`DROP TABLE IF EXISTS "posts_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "posts";`)
  await db.execute(sql`DROP TABLE IF EXISTS "reviews";`)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "reviews_id",
      DROP COLUMN IF EXISTS "posts_id",
      DROP COLUMN IF EXISTS "wishlists_id",
      DROP COLUMN IF EXISTS "quote_requests_id";`)

  await db.execute(sql`ALTER TABLE "skus" DROP COLUMN IF EXISTS "description";`)

  await db.execute(sql`
    ALTER TABLE "species"
      DROP COLUMN IF EXISTS "toxicity_witnessed_at",
      DROP COLUMN IF EXISTS "care_guide_additional",
      DROP COLUMN IF EXISTS "care_guide_feeding",
      DROP COLUMN IF EXISTS "care_guide_temperature",
      DROP COLUMN IF EXISTS "care_guide_humidity",
      DROP COLUMN IF EXISTS "care_guide_water",
      DROP COLUMN IF EXISTS "care_guide_light",
      DROP COLUMN IF EXISTS "vastu_friendly",
      DROP COLUMN IF EXISTS "air_purifying",
      DROP COLUMN IF EXISTS "edible",
      DROP COLUMN IF EXISTS "bench_note",
      DROP COLUMN IF EXISTS "summary";`)

  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_quote_requests_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_quote_requests_occasion";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_posts_kind";`)
}
