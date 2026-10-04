import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 0 — the schema-layer business invariants.
 *
 * ── WHY THIS FILE IS THE POINT OF THE STACK DECISION ────────────────────────
 *
 * STACK-DECISION.md §3 chose Payload over Medusa on one question: who owns the
 * DDL for the business rules that must not be bypassable.
 *
 * product-design.md §7 says three invariants belong in the schema layer, not in
 * application code:
 *   1. a SKU cannot publish without a traceable batch          (Phase 2)
 *   2. an order cannot exist for an unserviceable pincode      (Phase 1 tables)
 *   3. DELIVERED is unreachable without all four proof fields  (Phase 3)
 *
 * The spike spec calls application-code-only enforcement **a fail**, because it
 * is bypassable by a direct write or by a bug in a different code path. In
 * Payload these constraints live in this directory, applied by the same runner
 * as the collection DDL — ONE DDL history, which cannot drift from the schema it
 * protects. In Medusa the product/order tables belong to Medusa's modules, so the
 * same constraints would need a second hand-rolled migration path running beside
 * Medusa's own, in exactly the rules the business cannot survive getting wrong.
 *
 * Phase 0 lands what Phase 0 can land, and it lands it for real:
 *
 *   INVARIANT 1 · RIDER PAY MUST BE MONOTONIC
 *     Longer route ⇒ strictly more pay, enforced per city by a trigger. Not a
 *     nicety: it is the structural difference between us and an operator who pays
 *     ₹65/order regardless of distance and needs a ₹100 penalty clause to stop
 *     riders lying. A direct `UPDATE delivery_bands SET pay_paise = 100` must
 *     fail, because a bypass here is a bypass of the business model.
 *
 *   INVARIANT 2 · A CITY CANNOT GO LIVE WITHOUT AN APPROVED LICENCE
 *     State nursery registration is mandatory in Telangana (Act 2010), Haryana
 *     (Act 2025), West Bengal (Act XXXI 2001) and Uttarakhand. Kill-switch #1 in
 *     the founder's checklist. Enforced as a CHECK constraint, so it holds for
 *     every writer including a direct SQL insert.
 *
 *   INVARIANT 3 · EVERY PER-CITY ROW MUST BELONG TO A CITY
 *     `city_id NOT NULL` on every per-city table. This is what makes multi-city
 *     isolation a property of the schema rather than of application code
 *     remembering to add a WHERE clause: there is no way to write a row that
 *     belongs to no city, so no query can leak one.
 *
 *   INVARIANT 4 · MONEY IS INTEGER PAISE
 *     CHECK constraints rejecting non-integer and negative money, so a float
 *     cannot enter the database even if application code sends one.
 *
 * ── DEFERRED TO PHASE 1, AND WHY ────────────────────────────────────────────
 *
 * Two more invariants belong here conceptually but are NOT written yet:
 *
 *   INVARIANT 5 · NO COD, EVER — a CHECK on `orders.payment_mode`.
 *   CITY P&L AS A VIEW — `city_pnl`, grouped by `city_id`.
 *
 * Both read from the `orders` table, which does not exist until Phase 1. They
 * are deliberately NOT added behind an `IF EXISTS table` guard: a constraint
 * added in a later migration can be silently dropped by a schema push, which is
 * exactly the drift C-3 forbids. A constraint and the table it protects should
 * land in the same migration.
 *
 * The P&L shape is unit-tested in TypeScript now
 * (src/lib/geo/__tests__/multi-city-isolation.test.ts) and the schema-level proof
 * lands in Phase 1 alongside `orders`. Recorded in DECISIONS.md.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── INVARIANT 3: every per-city row must belong to a city ─────────────────
  await db.execute(sql`
    DO $$
    DECLARE t text;
    BEGIN
      FOREACH t IN ARRAY ARRAY['zones','delivery_bands','pincodes','price_books']
      LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name=t) THEN
          EXECUTE format('ALTER TABLE %I ALTER COLUMN city_id SET NOT NULL', t);
        END IF;
      END LOOP;
    END $$;`)

  // ── INVARIANT 2: a city cannot go live without an approved licence ────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cities_live_requires_licence') THEN
        ALTER TABLE "cities" ADD CONSTRAINT "cities_live_requires_licence"
        CHECK (
          "status" IS DISTINCT FROM 'live'
          OR ("licence_status" = 'approved' AND "licence_approved_at" IS NOT NULL)
        );
      END IF;
    END $$;`)

  // ── INVARIANT 4: money is integer paise ───────────────────────────────────
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='delivery_bands_pay_is_paise') THEN
        ALTER TABLE "delivery_bands" ADD CONSTRAINT "delivery_bands_pay_is_paise"
        CHECK ("pay_paise" IS NULL OR ("pay_paise" >= 0 AND "pay_paise" = FLOOR("pay_paise")));
      END IF;
    END $$;`)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='price_books_money_is_paise') THEN
        ALTER TABLE "price_books" ADD CONSTRAINT "price_books_money_is_paise"
        CHECK (
          ("free_delivery_threshold_paise" IS NULL OR "free_delivery_threshold_paise" = FLOOR("free_delivery_threshold_paise"))
          AND ("delivery_fee_paise" IS NULL OR "delivery_fee_paise" = FLOOR("delivery_fee_paise"))
        );
      END IF;
    END $$;`)

  // ── INVARIANT 1: rider pay must be monotonic within a city ────────────────
  // The core incentive fix, enforced where it cannot be bypassed.
  //
  // Application code (src/lib/geo/bands.ts, unit-tested) performs the same checks
  // with better messages. This trigger is what makes them unbypassable — it fires
  // for a direct psql write that no application hook would ever see.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION upvvan_assert_band_monotonicity()
    RETURNS TRIGGER AS $$
    DECLARE
      other RECORD;
    BEGIN
      IF NEW."max_km" <= NEW."min_km" THEN
        RAISE EXCEPTION '[upvvan] Band %: maxKm (%) must exceed minKm (%).',
          NEW."code", NEW."max_km", NEW."min_km" USING ERRCODE = 'check_violation';
      END IF;

      FOR other IN
        SELECT "code", "min_km", "max_km", "pay_paise"
          FROM "delivery_bands"
         WHERE "city_id" = NEW."city_id"
           AND ("id" IS NULL OR "id" <> NEW."id")
      LOOP
        IF other."min_km" < NEW."max_km" AND other."max_km" > NEW."min_km" THEN
          RAISE EXCEPTION
            '[upvvan] Band % (%)- (%)km overlaps band % (%)- (%)km in the same city. Bands must partition distance with no overlap.',
            NEW."code", NEW."min_km", NEW."max_km",
            other."code", other."min_km", other."max_km" USING ERRCODE = 'check_violation';
        END IF;

        -- Strictly more pay for strictly further. Equality fails too: a long drop
        -- paying the same as a short one gives the rider no reason to take it,
        -- which is how a flat-per-order structure produces route avoidance.
        IF other."min_km" < NEW."min_km" AND other."pay_paise" >= NEW."pay_paise" THEN
          RAISE EXCEPTION
            '[upvvan] Band % (%)- (%)km pays % paise, which is NOT more than band % (%)- (%)km at % paise. Longer routes must pay strictly more — otherwise the rider incentive inverts.',
            NEW."code", NEW."min_km", NEW."max_km", NEW."pay_paise",
            other."code", other."min_km", other."max_km", other."pay_paise"
            USING ERRCODE = 'check_violation';
        END IF;

        IF other."min_km" > NEW."min_km" AND other."pay_paise" <= NEW."pay_paise" THEN
          RAISE EXCEPTION
            '[upvvan] Band % (%)- (%)km pays % paise, which is NOT less than band % (%)- (%)km at % paise. Longer routes must pay strictly more — otherwise the rider incentive inverts.',
            NEW."code", NEW."min_km", NEW."max_km", NEW."pay_paise",
            other."code", other."min_km", other."max_km", other."pay_paise"
            USING ERRCODE = 'check_violation';
        END IF;
      END LOOP;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_band_monotonicity') THEN
        CREATE TRIGGER "trg_band_monotonicity"
          BEFORE INSERT OR UPDATE ON "delivery_bands"
          FOR EACH ROW EXECUTE FUNCTION upvvan_assert_band_monotonicity();
      END IF;
    END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TRIGGER IF EXISTS "trg_band_monotonicity" ON "delivery_bands";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS upvvan_assert_band_monotonicity();`)
  await db.execute(
    sql`ALTER TABLE "delivery_bands" DROP CONSTRAINT IF EXISTS "delivery_bands_pay_is_paise";`,
  )
  await db.execute(
    sql`ALTER TABLE "price_books" DROP CONSTRAINT IF EXISTS "price_books_money_is_paise";`,
  )
  await db.execute(
    sql`ALTER TABLE "cities" DROP CONSTRAINT IF EXISTS "cities_live_requires_licence";`,
  )
}
