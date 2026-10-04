import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('super-admin', 'hq-admin', 'nursery-manager', 'support', 'rider');
  CREATE TYPE "public"."enum_cities_status" AS ENUM('pending', 'soft_launch', 'live', 'killed');
  CREATE TYPE "public"."enum_cities_licence_status" AS ENUM('not_filed', 'filed', 'approved', 'rejected');
  CREATE TYPE "public"."enum_cities_interstate_movement_clearance_status" AS ENUM('unresolved', 'not_required', 'obtained');
  CREATE TYPE "public"."enum_price_books_active_guarantee_tier" AS ENUM('T0', 'T1', 'T2');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'support' NOT NULL,
  	"city_id" integer,
  	"nursery" varchar,
  	"phone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "cities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"state" varchar NOT NULL,
  	"status" "enum_cities_status" DEFAULT 'pending' NOT NULL,
  	"is_active" boolean DEFAULT false NOT NULL,
  	"licence_status" "enum_cities_licence_status" DEFAULT 'not_filed' NOT NULL,
  	"licence_number" varchar,
  	"licence_approved_at" timestamp(3) with time zone,
  	"licence_notes" varchar,
  	"interstate_movement_clearance_status" "enum_cities_interstate_movement_clearance_status" DEFAULT 'unresolved' NOT NULL,
  	"interstate_movement_clearance_reference" varchar,
  	"interstate_movement_clearance_confirmed_at" timestamp(3) with time zone,
  	"gstin" varchar,
  	"tax_rate_bp" numeric,
  	"capacity_per_day" numeric,
  	"serviceable_pincode_count" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "zones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"city_id" integer NOT NULL,
  	"band_codes" jsonb,
  	"max_daily_drops" numeric,
  	"is_active" boolean DEFAULT true NOT NULL,
  	"serviceable_pincode_count" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "delivery_bands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"city_id" integer NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"min_km" numeric NOT NULL,
  	"max_km" numeric NOT NULL,
  	"pay_paise" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pincodes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"pincode" varchar NOT NULL,
  	"city_id" integer NOT NULL,
  	"zone_id" integer,
  	"is_serviceable" boolean DEFAULT true NOT NULL,
  	"post_office_name" varchar,
  	"serviceability_note" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "price_books" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"city_id" integer NOT NULL,
  	"active_guarantee_tier" "enum_price_books_active_guarantee_tier" DEFAULT 'T0' NOT NULL,
  	"guarantee_t1_enabled" boolean DEFAULT false,
  	"guarantee_t2_enabled" boolean DEFAULT false,
  	"heat_window_exclusion_wording" varchar,
  	"free_delivery_threshold_paise" numeric,
  	"delivery_fee_paise" numeric DEFAULT 0,
  	"planter_ladder_min_uplift_bp" numeric,
  	"planter_ladder_max_uplift_bp" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"cities_id" integer,
  	"zones_id" integer,
  	"delivery_bands_id" integer,
  	"pincodes_id" integer,
  	"price_books_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zones" ADD CONSTRAINT "zones_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "delivery_bands" ADD CONSTRAINT "delivery_bands_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pincodes" ADD CONSTRAINT "pincodes_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pincodes" ADD CONSTRAINT "pincodes_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_books" ADD CONSTRAINT "price_books_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cities_fk" FOREIGN KEY ("cities_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_zones_fk" FOREIGN KEY ("zones_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_delivery_bands_fk" FOREIGN KEY ("delivery_bands_id") REFERENCES "public"."delivery_bands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pincodes_fk" FOREIGN KEY ("pincodes_id") REFERENCES "public"."pincodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_books_fk" FOREIGN KEY ("price_books_id") REFERENCES "public"."price_books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_city_idx" ON "users" USING btree ("city_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "cities_slug_idx" ON "cities" USING btree ("slug");
  CREATE INDEX "cities_updated_at_idx" ON "cities" USING btree ("updated_at");
  CREATE INDEX "cities_created_at_idx" ON "cities" USING btree ("created_at");
  CREATE INDEX "zones_city_idx" ON "zones" USING btree ("city_id");
  CREATE INDEX "zones_updated_at_idx" ON "zones" USING btree ("updated_at");
  CREATE INDEX "zones_created_at_idx" ON "zones" USING btree ("created_at");
  CREATE INDEX "delivery_bands_city_idx" ON "delivery_bands" USING btree ("city_id");
  CREATE INDEX "delivery_bands_updated_at_idx" ON "delivery_bands" USING btree ("updated_at");
  CREATE INDEX "delivery_bands_created_at_idx" ON "delivery_bands" USING btree ("created_at");
  CREATE UNIQUE INDEX "pincodes_pincode_idx" ON "pincodes" USING btree ("pincode");
  CREATE INDEX "pincodes_city_idx" ON "pincodes" USING btree ("city_id");
  CREATE INDEX "pincodes_zone_idx" ON "pincodes" USING btree ("zone_id");
  CREATE INDEX "pincodes_updated_at_idx" ON "pincodes" USING btree ("updated_at");
  CREATE INDEX "pincodes_created_at_idx" ON "pincodes" USING btree ("created_at");
  CREATE INDEX "price_books_city_idx" ON "price_books" USING btree ("city_id");
  CREATE INDEX "price_books_updated_at_idx" ON "price_books" USING btree ("updated_at");
  CREATE INDEX "price_books_created_at_idx" ON "price_books" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_cities_id_idx" ON "payload_locked_documents_rels" USING btree ("cities_id");
  CREATE INDEX "payload_locked_documents_rels_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("zones_id");
  CREATE INDEX "payload_locked_documents_rels_delivery_bands_id_idx" ON "payload_locked_documents_rels" USING btree ("delivery_bands_id");
  CREATE INDEX "payload_locked_documents_rels_pincodes_id_idx" ON "payload_locked_documents_rels" USING btree ("pincodes_id");
  CREATE INDEX "payload_locked_documents_rels_price_books_id_idx" ON "payload_locked_documents_rels" USING btree ("price_books_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "cities" CASCADE;
  DROP TABLE "zones" CASCADE;
  DROP TABLE "delivery_bands" CASCADE;
  DROP TABLE "pincodes" CASCADE;
  DROP TABLE "price_books" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_cities_status";
  DROP TYPE "public"."enum_cities_licence_status";
  DROP TYPE "public"."enum_cities_interstate_movement_clearance_status";
  DROP TYPE "public"."enum_price_books_active_guarantee_tier";`)
}
