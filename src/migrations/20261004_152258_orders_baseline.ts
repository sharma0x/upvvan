import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_status" AS ENUM('PLACED', 'ROUTED', 'PACKING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'RESOLVED', 'CLAIM_OPEN', 'CLAIM_REJECTED', 'REPLACEMENT_QUEUED');
  CREATE TYPE "public"."enum_orders_payment_mode" AS ENUM('prepaid');
  CREATE TYPE "public"."enum_orders_guarantee_tier" AS ENUM('T0', 'T1', 'T2');
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_code" varchar NOT NULL,
  	"city_id" integer NOT NULL,
  	"status" "enum_orders_status" DEFAULT 'PLACED' NOT NULL,
  	"payment_mode" "enum_orders_payment_mode" DEFAULT 'prepaid' NOT NULL,
  	"pincode" varchar NOT NULL,
  	"zone_id" integer,
  	"revenue_paise" numeric NOT NULL,
  	"contribution_paise" numeric NOT NULL,
  	"customer_id" varchar,
  	"guarantee_tier" "enum_orders_guarantee_tier" DEFAULT 'T0' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "skus" ALTER COLUMN "legal_metrology_dimensions_height_cm" DROP NOT NULL;
  ALTER TABLE "skus" ALTER COLUMN "legal_metrology_dimensions_pot_diameter_cm" DROP NOT NULL;
  ALTER TABLE "skus" ALTER COLUMN "legal_metrology_dimensions_spread_cm" DROP NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "orders_order_code_idx" ON "orders" USING btree ("order_code");
  CREATE INDEX "orders_city_idx" ON "orders" USING btree ("city_id");
  CREATE INDEX "orders_zone_idx" ON "orders" USING btree ("zone_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  ALTER TABLE "skus" ALTER COLUMN "legal_metrology_dimensions_height_cm" SET NOT NULL;
  ALTER TABLE "skus" ALTER COLUMN "legal_metrology_dimensions_pot_diameter_cm" SET NOT NULL;
  ALTER TABLE "skus" ALTER COLUMN "legal_metrology_dimensions_spread_cm" SET NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_payment_mode";
  DROP TYPE "public"."enum_orders_guarantee_tier";`)
}
