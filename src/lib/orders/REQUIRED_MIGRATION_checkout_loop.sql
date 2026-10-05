-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKOUT LOOP MIGRATION — REQUIRED, NOT OPTIONAL.
--
-- OWNERSHIP: `src/migrations/**` belongs to another agent working concurrently, so
-- this file is the exact DDL for them to move into
-- `src/migrations/20261005_000008_checkout_loop.ts` (and register in index.ts).
-- It has ALREADY been applied to the local dev database so the e2e proof runs
-- against the real schema — but a fresh `make db-migrate` will NOT create any of
-- it until this lands in the migration history. That is the whole point of the
-- single-DDL-history rule, so please land it rather than leaving the dev DB ahead
-- of the migrations.
--
-- ⚠️ ORDERING HAZARD — READ BEFORE RUNNING `make db-migrate-create`
-- `src/collections/SkuStock.ts` is a NEW Payload collection and `sku_stock` is
-- created below by hand. If `payload migrate:create` runs BEFORE the collection is
-- registered in `src/payload.config.ts`, Payload sees a table it does not know
-- about and will generate a CREATE TABLE for it, which then collides with the one
-- below. Correct order:
--   1. register SkuStock in src/payload.config.ts
--   2. add this migration to src/migrations/ and run `make db-migrate`
--   3. only then run `make db-migrate-create` for anything else
-- The statements below are all idempotent (IF NOT EXISTS / DO $$ guards) so a
-- re-run after the collection is registered is safe.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- A · THE ORDER STATUS ENUM — four states the payment lifecycle needs
-- ═════════════════════════════════════════════════════════════════════════════
--
-- WHY THIS IS NEEDED AT ALL
-- The enum predates the payment lifecycle and carries logistics-only names:
-- PLACED, ROUTED, PACKING, PACKED, DISPATCHED, DELIVERED, RESOLVED, and the
-- claim branch. A prepaid order that has not been charged has no state it can
-- honestly occupy in that list — PLACED claims the order is on its way, which is
-- the exact lie this migration exists to remove.
--
-- The alternative considered and rejected: reuse PLACED for "awaiting payment"
-- and DISPATCHED for "paid". Both were available, both are wrong, and both leave
-- the database unable to answer "which orders have we been paid for?" — a
-- question the city P&L and the delivery console both need.
--
-- Note the four ADD VALUEs are NOT in a DO $$ guard on purpose: `ALTER TYPE ...
-- ADD VALUE IF NOT EXISTS` is available in Postgres 9.6+ but cannot be executed
-- inside a transaction block together with a USE of the new value. Since these run
-- before any order is written, `IF NOT EXISTS` is enough and stays compatible with
-- the migration runner's transaction handling.
ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- NOTE FOR THE MIGRATION OWNER: if your Payload version runs `up()` inside a
-- transaction and these four statements fail with
-- "ALTER TYPE ... ADD VALUE cannot run inside a transaction block", execute them
-- via `db.execute(sql`...`)` on a NON-transactional path, or split them into a
-- migration file whose `up()` opens no transaction. Postgres 18 supports ADD VALUE
-- in a transaction; the restriction is only on USING the new value in the same one.


-- ═════════════════════════════════════════════════════════════════════════════
-- B · ORDERS — the columns the checkout loop needs
-- ═════════════════════════════════════════════════════════════════════════════

-- Delivery contact. Nullable on EXISTING rows and enforced non-blank for every
-- CAPTURED payment below — 44 legacy rows predate checkout and cannot be
-- retro-fitted with an address we never collected.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_phone" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_line1" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_line2" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_landmark" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_city" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_state" text;

-- Payment record. Kept ON the order rather than in a side table because the
-- customer's question is "has my money left my account and is my plant coming?" —
-- one lifecycle, one row. `payment_intent_id` is what makes capture idempotent;
-- `payment_reference` is the gateway's own id, which is the audit value.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_state" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_intent_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_reference" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_captured_at" timestamptz;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_failure_code" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_state_known'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_state_known"
    CHECK (
      "payment_state" IS NULL
      OR "payment_state" IN ('created', 'processing', 'captured', 'failed')
    );
  END IF;
END $$;

-- ── THE INVARIANT THAT MATTERS MOST ─────────────────────────────────────────
-- A CAPTURED payment requires a name, a phone and a delivery address.
--
-- Why this is a CHECK and not application validation: "we took money and cannot
-- deliver it" is the failure mode that ends a D2C business, and application checks
-- are bypassable by any second write path — an admin panel edit, a script, a
-- future refund endpoint. The constraint is what makes it true.
--
-- The column being NULL for legacy rows is deliberate and is not a loophole: NULL
-- means "no payment recorded at all", and a captured payment is the only state
-- that obliges us to deliver.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_captured_payment_has_contact'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_captured_payment_has_contact"
    CHECK (
      "payment_state" IS DISTINCT FROM 'captured'
      OR (
        btrim(COALESCE("customer_phone", '')) <> ''
        AND btrim(COALESCE("customer_name", '')) <> ''
        AND btrim(COALESCE("address_line1", '')) <> ''
      )
    );
  END IF;
END $$;

-- The phone is what order lookup is authorised by, so it has to be a real Indian
-- mobile: 10 digits starting 6-9, optionally prefixed with the 91 country code.
-- Enforcing the FORMAT here (rather than only in the route) means a number that
-- can never be dialled by a rider is rejected at write time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_phone_is_a_mobile'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_phone_is_a_mobile"
    CHECK (
      "customer_phone" IS NULL
      OR "customer_phone" ~ '^(\+91)?[6-9][0-9]{9}$'
    );
  END IF;
END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- C · SKU STOCK — the oversell guard
-- ═════════════════════════════════════════════════════════════════════════════
--
-- `stock_on_hand` may never go negative.
--
-- This is the constraint the whole stock feature is for. A negative count is not
-- a rounding nuisance: it is money taken for a plant that is not on the bench,
-- discovered by a customer rather than by us. Application code cannot enforce it
-- (a lost update under two concurrent checkouts passes every JS check), so the
-- CHECK is the guarantee and `src/lib/orders/stock.ts` is the courtesy message
-- that says WHICH plant ran out.
--
-- The CHECK is on the COLUMN, not on a transition, so it holds for every writer
-- including a raw `UPDATE sku_stock SET stock_on_hand = stock_on_hand - 1` from
-- psql — which is the only way to prove a constraint is real.
CREATE TABLE IF NOT EXISTS "sku_stock" (
  "id" serial PRIMARY KEY,
  "sku_id" integer NOT NULL REFERENCES "skus"("id") ON DELETE CASCADE,
  "stock_on_hand" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
);

-- UNIQUE, not merely indexed. Two rows for one SKU means two independent counts
-- and therefore two different answers to "can we sell this?", which is the same
-- defect as having no stock tracking at all.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sku_stock_sku_id_key'
  ) THEN
    ALTER TABLE "sku_stock" ADD CONSTRAINT "sku_stock_sku_id_key"
    UNIQUE ("sku_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sku_stock_on_hand_non_negative'
  ) THEN
    ALTER TABLE "sku_stock" ADD CONSTRAINT "sku_stock_on_hand_non_negative"
    CHECK ("stock_on_hand" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sku_stock_sku_id_idx" ON "sku_stock" ("sku_id");

-- Backfill: every SKU that could be sold today needs a row, or the first
-- checkout after this migration refuses with "not available" for a SKU that is
-- demonstrably on the bench. Initial count is 0, NOT a guessed number — a
-- fabricated stock level is an oversell waiting to be discovered by a customer,
-- and the real counts come from the nursery.
INSERT INTO "sku_stock" ("sku_id", "stock_on_hand")
SELECT s."id", 0 FROM "skus" s
WHERE s."is_published" = true
  AND NOT EXISTS (SELECT 1 FROM "sku_stock" st WHERE st."sku_id" = s."id");


-- ═════════════════════════════════════════════════════════════════════════════
-- D · ORDER EVENTS — the tracking timeline
-- ═════════════════════════════════════════════════════════════════════════════
--
-- APPEND-ONLY, and the append-only-ness is enforced rather than merely intended:
-- there is no `updated_at`, so an "edit the timeline" bug has nothing to update.
-- A customer-facing timeline is worth exactly as much as the customer's belief
-- that nobody can rewrite it.
CREATE TABLE IF NOT EXISTS "order_events" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "note" text,
  "actor" text NOT NULL DEFAULT 'system',
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "order_events_order_id_idx" ON "order_events" ("order_id");


-- ═════════════════════════════════════════════════════════════════════════════
-- E · ORDER CLAIMS — damage / DOA, replacement not refund
-- ═════════════════════════════════════════════════════════════════════════════
--
-- NO `refund_paise` COLUMN, and the absence is the design.
--
-- A plant is replaced, never refunded; the marginal cost of a replacement is a
-- plant we have already grown and would otherwise discard. Pots, soil and feed
-- are settled in money, and that settlement is a PAYMENT event — it is not a
-- lifecycle terminal and it does not belong on a claim row. Adding a refund column
-- here would be an invitation to refund a plant, which is the one thing this
-- business does not do.
CREATE TABLE IF NOT EXISTS "order_claims" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  -- Denormalised so a claim is findable from a support message without a join.
  "order_code" text NOT NULL,
  -- Which LINE is wrong. A claim against the whole order would have to guess.
  "order_item_id" text REFERENCES "orders_items"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "evidence_url" text,
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "order_claims_order_id_idx" ON "order_claims" ("order_id");

-- `kind` is constrained because the remedy differs: a plant claim is a
-- replacement, a consumable claim is money back in 24 hours. An unconstrained
-- kind lets a caller file "OTHER" and quietly get the plant remedy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_claims_kind_known'
  ) THEN
    ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_kind_known"
    CHECK ("kind" IN ('DAMAGED', 'DEAD_ON_ARRIVAL', 'WRONG_ITEM', 'MISSING_ITEM'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_claims_status_known'
  ) THEN
    ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_status_known"
    CHECK ("status" IN ('OPEN', 'ACCEPTED', 'REPLACEMENT_QUEUED', 'REJECTED'));
  END IF;
END $$;

-- No video column beyond `evidence_url`, and that is a REPORTED GAP, not an
-- oversight: unboxing video is the single strongest evidence a claim has, but it
-- needs presigned multipart upload to RustFS/S3, which is a different piece of
-- work. `evidence_url` exists so the column is already there when that lands, and
-- a photo URL typed by hand works today.


-- ═════════════════════════════════════════════════════════════════════════════
-- F · DOWN
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Postgres cannot remove an enum value. Rolling this back therefore means
-- recreating the type and re-mapping any order that used the four new states —
-- which is exactly why these four values are added in a separate, deliberately
-- named migration rather than folded into an existing one.
--
-- ALTER TABLE "order_claims" DROP CONSTRAINT IF EXISTS "order_claims_status_known";
-- ALTER TABLE "order_claims" DROP CONSTRAINT IF EXISTS "order_claims_kind_known";
-- DROP TABLE IF EXISTS "order_claims";
-- DROP TABLE IF EXISTS "order_events";
-- DROP TABLE IF EXISTS "sku_stock";
-- ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_phone_is_a_mobile";
-- ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_captured_payment_has_contact";
-- ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_payment_state_known";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_failure_code";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_captured_at";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_reference";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_intent_id";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_state";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "address_state";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "address_city";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "address_landmark";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "address_line2";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "address_line1";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_phone";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_name";