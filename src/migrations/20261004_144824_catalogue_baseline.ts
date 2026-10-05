import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_species_seasonal_availability_seasons" AS ENUM('summer', 'monsoon', 'perennial');
  CREATE TYPE "public"."enum_species_care_light" AS ENUM('low', 'bright_indirect', 'direct');
  CREATE TYPE "public"."enum_species_care_difficulty" AS ENUM('easy', 'moderate', 'fussy');
  CREATE TYPE "public"."enum_species_care_toxicity" AS ENUM('pets', 'children', 'safe');
  CREATE TYPE "public"."enum_skus_size_tier" AS ENUM('XS', 'MD', 'LG', 'XL');
  CREATE TYPE "public"."enum_skus_item_class" AS ENUM('plant', 'planter', 'consumable');
  CREATE TABLE "species_seasonal_availability_seasons" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_species_seasonal_availability_seasons",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "species_seasonal_availability" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"city_id" integer NOT NULL,
  	"hardy" boolean DEFAULT false
  );
  
  CREATE TABLE "species" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"common_name" varchar NOT NULL,
  	"botanical_name" varchar,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"care_light" "enum_species_care_light" NOT NULL,
  	"care_water_interval_days" numeric NOT NULL,
  	"care_soil_moisture_target_pct" numeric NOT NULL,
  	"care_difficulty" "enum_species_care_difficulty" NOT NULL,
  	"care_toxicity" "enum_species_care_toxicity" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "planters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"uplift_bp" numeric NOT NULL,
  	"cost_paise" numeric NOT NULL,
  	"material" varchar,
  	"colour" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "supplier_batches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"batch_code" varchar NOT NULL,
  	"supplier_name" varchar NOT NULL,
  	"bill_id" varchar NOT NULL,
  	"supplier_gstin" varchar,
  	"nursery_location" varchar,
  	"date_received" timestamp(3) with time zone NOT NULL,
  	"quantity_received" numeric NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "skus" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku_code" varchar NOT NULL,
  	"species_id" integer NOT NULL,
  	"city_id" integer NOT NULL,
  	"nursery_id" integer,
  	"size_tier" "enum_skus_size_tier" NOT NULL,
  	"item_class" "enum_skus_item_class" DEFAULT 'plant' NOT NULL,
  	"base_price_paise" numeric NOT NULL,
  	"legal_metrology_manufacturer_name" varchar NOT NULL,
  	"legal_metrology_manufacturer_address" varchar NOT NULL,
  	"legal_metrology_country_of_origin" varchar DEFAULT 'India' NOT NULL,
  	"legal_metrology_common_name_declared" varchar NOT NULL,
  	"legal_metrology_net_quantity" varchar NOT NULL,
  	"legal_metrology_mrp_paise" numeric NOT NULL,
  	"legal_metrology_best_before" varchar,
  	"legal_metrology_packed_month_year" varchar,
  	"legal_metrology_dimensions_height_cm" numeric NOT NULL,
  	"legal_metrology_dimensions_pot_diameter_cm" numeric NOT NULL,
  	"legal_metrology_dimensions_spread_cm" numeric NOT NULL,
  	"batch_id" integer,
  	"bench_photo_url" varchar,
  	"is_published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "species_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "planters_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "supplier_batches_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "skus_id" integer;
  ALTER TABLE "species_seasonal_availability_seasons" ADD CONSTRAINT "species_seasonal_availability_seasons_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."species_seasonal_availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "species_seasonal_availability" ADD CONSTRAINT "species_seasonal_availability_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "species_seasonal_availability" ADD CONSTRAINT "species_seasonal_availability_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_nursery_id_zones_id_fk" FOREIGN KEY ("nursery_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_batch_id_supplier_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."supplier_batches"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "species_seasonal_availability_seasons_order_idx" ON "species_seasonal_availability_seasons" USING btree ("order");
  CREATE INDEX "species_seasonal_availability_seasons_parent_idx" ON "species_seasonal_availability_seasons" USING btree ("parent_id");
  CREATE INDEX "species_seasonal_availability_order_idx" ON "species_seasonal_availability" USING btree ("_order");
  CREATE INDEX "species_seasonal_availability_parent_id_idx" ON "species_seasonal_availability" USING btree ("_parent_id");
  CREATE INDEX "species_seasonal_availability_city_idx" ON "species_seasonal_availability" USING btree ("city_id");
  CREATE UNIQUE INDEX "species_slug_idx" ON "species" USING btree ("slug");
  CREATE INDEX "species_updated_at_idx" ON "species" USING btree ("updated_at");
  CREATE INDEX "species_created_at_idx" ON "species" USING btree ("created_at");
  CREATE INDEX "planters_updated_at_idx" ON "planters" USING btree ("updated_at");
  CREATE INDEX "planters_created_at_idx" ON "planters" USING btree ("created_at");
  CREATE UNIQUE INDEX "supplier_batches_batch_code_idx" ON "supplier_batches" USING btree ("batch_code");
  CREATE INDEX "supplier_batches_updated_at_idx" ON "supplier_batches" USING btree ("updated_at");
  CREATE INDEX "supplier_batches_created_at_idx" ON "supplier_batches" USING btree ("created_at");
  CREATE UNIQUE INDEX "skus_sku_code_idx" ON "skus" USING btree ("sku_code");
  CREATE INDEX "skus_species_idx" ON "skus" USING btree ("species_id");
  CREATE INDEX "skus_city_idx" ON "skus" USING btree ("city_id");
  CREATE INDEX "skus_nursery_idx" ON "skus" USING btree ("nursery_id");
  CREATE INDEX "skus_batch_idx" ON "skus" USING btree ("batch_id");
  CREATE INDEX "skus_updated_at_idx" ON "skus" USING btree ("updated_at");
  CREATE INDEX "skus_created_at_idx" ON "skus" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_species_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_planters_fk" FOREIGN KEY ("planters_id") REFERENCES "public"."planters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_supplier_batches_fk" FOREIGN KEY ("supplier_batches_id") REFERENCES "public"."supplier_batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_skus_fk" FOREIGN KEY ("skus_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_species_id_idx" ON "payload_locked_documents_rels" USING btree ("species_id");
  CREATE INDEX "payload_locked_documents_rels_planters_id_idx" ON "payload_locked_documents_rels" USING btree ("planters_id");
  CREATE INDEX "payload_locked_documents_rels_supplier_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("supplier_batches_id");
  CREATE INDEX "payload_locked_documents_rels_skus_id_idx" ON "payload_locked_documents_rels" USING btree ("skus_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "species_seasonal_availability_seasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "species_seasonal_availability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "species" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "planters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_batches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "skus" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "species_seasonal_availability_seasons" CASCADE;
  DROP TABLE "species_seasonal_availability" CASCADE;
  DROP TABLE "species" CASCADE;
  DROP TABLE "planters" CASCADE;
  DROP TABLE "supplier_batches" CASCADE;
  DROP TABLE "skus" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_species_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_planters_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_supplier_batches_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_skus_fk";
  
  DROP INDEX "payload_locked_documents_rels_species_id_idx";
  DROP INDEX "payload_locked_documents_rels_planters_id_idx";
  DROP INDEX "payload_locked_documents_rels_supplier_batches_id_idx";
  DROP INDEX "payload_locked_documents_rels_skus_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "species_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "planters_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "supplier_batches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "skus_id";
  DROP TYPE "public"."enum_species_seasonal_availability_seasons";
  DROP TYPE "public"."enum_species_care_light";
  DROP TYPE "public"."enum_species_care_difficulty";
  DROP TYPE "public"."enum_species_care_toxicity";
  DROP TYPE "public"."enum_skus_size_tier";
  DROP TYPE "public"."enum_skus_item_class";`)
}
