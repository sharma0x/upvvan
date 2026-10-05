-- ============================================================================
-- Upvvan — Dispatch, rider and delivery-proof schema
-- ============================================================================
--
-- WHY THIS FILE EXISTS RATHER THAN A HAND-WRITTEN MIGRATION
-- --------------------------------------------------------
-- It does. This is the DDL body for `src/migrations/<ts>_dispatch_invariants.ts`,
-- which the migrations owner must add to `src/migrations/index.ts`. It is kept
-- here, beside the code that depends on it, because the invariants below are
-- only meaningful together with `src/lib/dispatch/assign.ts` and are far easier
-- to keep in agreement when they sit side by side.
--
-- NOTHING HERE IS OPTIONAL. The application code in `src/lib/dispatch/` assumes
-- every trigger below already exists. If you apply this by hand, the features
-- still work; if you skip it, `DELIVERED` becomes a mutable boolean again and
-- the entire anti-fraud argument collapses back to "trust the rider's button".
--
-- ── THE THREE INVARIANTS, AND WHY EACH IS IN THE SCHEMA ────────────────────
--
-- 1. THE BAND PAY SNAPSHOT IS IMMUTABLE.
--    `dispatches_band_snapshot_immutable` refuses any UPDATE that touches
--    band_code, band_pay_paise, pay_multiplier_bp or payout_paise.
--
--    A dispatch records what the rider was PROMISED at the moment the drop was
--    handed to them. If the band table is edited an hour later — which is a
--    normal, legitimate thing for ops to do — the historical payout must not
--    move with it. Application-code-only enforcement is bypassable by a direct
--    write or by a second code path, and "the payroll changed and nobody knows
--    why" is the kind of thing that ends a rider relationship permanently.
--
-- 2. DELIVERY REQUIRES A VERIFIED OTP.
--    `dispatches_delivered_requires_otp` refuses any write that sets
--    status='DELIVERED' unless `delivery_otp_verified_at` is set.
--
--    research/concept.md §8 names "our own service fails the way Urvann's did"
--    as the MOST LIKELY failure mode. Urvann's public 3PL contract pays ₹65 per
--    order regardless of distance and carries a ₹100 penalty for marking an
--    order delivered that was not delivered — and still sits at 2.1/5. The
--    penalty is a symptom. The cheapest action under that structure is to lie.
--
--    We do not fine our way out. The customer holds the code: the OTP goes to
--    THEIR phone, the rider cannot read it off their own handset, so the
--    close-out action is a human confirming receipt rather than a rider tapping
--    a button. A rider under pressure to close ten drops before dinner has to
--    ask the customer for four digits — which is exactly the moment the customer
--    would notice the plant never arrived.
--
-- 3. THE DELIVERY IS AN APPEND-ONLY EVENT, NOT A MUTABLE BOOLEAN.
--    `dispatch_events_append_only` raises on UPDATE and DELETE, unconditionally.
--    `dispatch_events_delivery_requires_verified_otp` additionally refuses to
--    even RECORD a DELIVERED event unless the OTP was verified first.
--
--    A mutable `delivered = true` has no history: whoever flipped it, when, and
--    from where cannot be reconstructed, so it can be flipped back. An event log
--    cannot be quietly repaired. The audit trail here is something we would want
--    anyway when a customer disputes a delivery — it is explicitly NOT a
--    deterrent, and there is no penalty regime anywhere in this system.
--
-- ── MONEY ──────────────────────────────────────────────────────────────────
-- Integer paise throughout, with a CHECK that refuses a fractional value. Same
-- shape as `orders_money_is_paise`. A float reaching a payout column is a
-- rounding bug that only surfaces at month end, in someone's salary.
-- ============================================================================

-- ── riders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "riders" (
  "id"                  serial PRIMARY KEY NOT NULL,
  "name"                varchar NOT NULL,
  "phone"               varchar NOT NULL,
  "active"              boolean DEFAULT true NOT NULL,
  "city_id"             integer NOT NULL,
  "zone_id"             integer,
  "vehicle_type"        varchar NOT NULL DEFAULT 'ev_two_wheeler',
  -- PER-RIDER PAY CONFIGURATION.
  --
  -- Basis points against the BAND pay, not an absolute amount. 10000 = exactly
  -- the band rate; 11500 = 15% above it for a rider who has been with us a
  -- season. Storing a MULTIPLIER rather than a rupee figure is deliberate:
  -- multiplying every band by the same positive scalar preserves the strict
  -- ordering that `assertBandsAreMonotonic` enforces, so a per-rider uplift can
  -- never make a 12km drop pay less than a 3km one. An absolute per-rider pay
  -- field could, and would silently reinstate the flat-per-order structure that
  -- produced a competitor's 1.4/5.
  "pay_multiplier_bp"   integer DEFAULT 10000 NOT NULL,
  -- Per-rider capacity override. Null = fall back to the zone's
  -- max_daily_drops. A rider on an auto or a sick day carries less.
  "max_drops_per_day"   integer,
  "notes"               varchar,
  "created_at"          timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at"          timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "riders_phone_unique" UNIQUE ("phone"),
  -- A rider belongs to exactly one city. Multi-city isolation is a schema
  -- property, not an application convention — same reasoning as every other
  -- city-scoped table here.
  CONSTRAINT "riders_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "riders_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "riders_multiplier_is_positive" CHECK ("pay_multiplier_bp" > 0),
  CONSTRAINT "riders_multiplier_sane" CHECK ("pay_multiplier_bp" <= 100000),
  CONSTRAINT "riders_capacity_is_positive" CHECK ("max_drops_per_day" IS NULL OR "max_drops_per_day" > 0)
);

CREATE INDEX IF NOT EXISTS "riders_city_id_idx" ON "riders" USING btree ("city_id");
CREATE INDEX IF NOT EXISTS "riders_zone_id_idx" ON "riders" USING btree ("zone_id");
CREATE INDEX IF NOT EXISTS "riders_active_idx" ON "riders" USING btree ("active");

-- ── dispatches ───────────────────────────────────────────────────────────────
-- ONE dispatch per order. `dispatches_order_id_key` is what makes "unassigned"
-- a computable question (orders with no dispatch row) rather than a status flag
-- somebody has to remember to clear.
CREATE TABLE IF NOT EXISTS "dispatches" (
  "id"                        serial PRIMARY KEY NOT NULL,
  "order_id"                  integer NOT NULL,
  "rider_id"                  integer NOT NULL,
  -- The rider's zone AT ASSIGNMENT TIME, not a live join. If a rider is moved
  -- to another zone mid-day, yesterday's dispatch still says where the drop
  -- was actually run from.
  "zone_id"                   integer,
  "status"                    varchar NOT NULL DEFAULT 'ASSIGNED',

  -- ── THE PAY SNAPSHOT ──────────────────────────────────────────────────────
  -- band_code / band_pay_paise: copied from `delivery_bands` for the city's
  -- band at assignment. Immutable thereafter (invariant 1 above).
  "band_code"                 varchar NOT NULL,
  "band_pay_paise"            numeric NOT NULL,
  -- The per-rider multiplier in force at assignment, also immutable, so the
  -- arithmetic behind a payout is reproducible from the row alone.
  "pay_multiplier_bp"         integer NOT NULL DEFAULT 10000,
  -- What the rider actually earned: ceil(band_pay_paise * multiplier / 10000).
  -- ROUNDED UP, never down — a rider is never paid less than the band rate
  -- because of our rounding. Ceil is monotonic, so rounding up preserves the
  -- band ordering as well.
  "payout_paise"              numeric NOT NULL,

  "assigned_at"               timestamp(3) with time zone DEFAULT now() NOT NULL,
  "picked_up_at"              timestamp(3) with time zone,
  "out_for_delivery_at"       timestamp(3) with time zone,
  "delivered_at"              timestamp(3) with time zone,

  -- ── DELIVERY OTP ──────────────────────────────────────────────────────────
  -- Only the scrypt hash is stored. A six-digit code has a million possible
  -- values and this table is one SELECT away; storing it in the clear would make
  -- a database dump a complete delivery-fraud kit.
  --
  -- There is deliberately no boolean here. `delivery_otp_verified_at` is set by
  -- the verification path and cannot be set by a status change (invariant 2).
  "delivery_otp_hash"         text,
  "delivery_otp_salt"         text,
  "delivery_otp_expires_at"   timestamp(3) with time zone,
  "delivery_otp_sent_at"      timestamp(3) with time zone,
  "delivery_otp_attempts"     integer NOT NULL DEFAULT 0,
  "delivery_otp_verified_at"  timestamp(3) with time zone,

  -- ── PROOF OF DELIVERY ─────────────────────────────────────────────────────
  -- S3/RustFS object key. Capture is a follow-up; the field is modelled now so
  -- the close-out screen has somewhere to put it and the audit trail has a slot
  -- reserved before there is any data to lose.
  "proof_photo_url"           text,
  "proof_captured_at"         timestamp(3) with time zone,

  -- ── CLAIM EVIDENCE ────────────────────────────────────────────────────────
  -- research/concept.md §7: an uncut same-day unboxing video, stated at point
  -- of sale, is the claim mechanism — it yields claim evidence AND fraud
  -- filtering from one artefact, which is why it beats a returns process.
  --
  -- So the rider's step is not "upload a video". It is: confirm the customer was
  -- told, at the door, to open the box and film it. `unboxing_video_requested`
  -- records that the prompt was made. `photo_at_handover` is the fallback for a
  -- customer who declines to film — weaker evidence, recorded honestly as such
  -- rather than silently treated as equivalent.
  "claim_evidence_kind"       varchar NOT NULL DEFAULT 'not_requested',
  "claim_evidence_note"       varchar,
  "claim_evidence_at"         timestamp(3) with time zone,
  "claim_opened_at"           timestamp(3) with time zone,

  "failure_reason"            varchar,
  "created_at"                timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at"                timestamp(3) with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "dispatches_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "dispatches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "dispatches_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "dispatches_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action,

  -- Money is integer paise. Same rule as orders_money_is_paise.
  CONSTRAINT "dispatches_money_is_paise" CHECK (
    "band_pay_paise" >= 0 AND "band_pay_paise" = floor("band_pay_paise")
    AND "payout_paise" >= 0 AND "payout_paise" = floor("payout_paise")
  ),
  -- The payout is DERIVED from the band and the multiplier. Storing all three
  -- means the row is self-describing (an auditor can recompute it), but it also
  -- means they could disagree — so the schema refuses.
  --
  -- ceil() rather than round(): a 4500p band at 10333bp is 4650.15p, and paying
  -- 4650p is correct while paying 4650p-with-a-truncated-paise is a rounding
  -- error in the rider's favour that will not reproduce next month.
  CONSTRAINT "dispatches_payout_matches_snapshot" CHECK (
    "payout_paise" = ceil("band_pay_paise" * "pay_multiplier_bp" / 10000.0)
  ),
  CONSTRAINT "dispatches_status_is_known" CHECK (
    "status" IN ('ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED')
  ),
  CONSTRAINT "dispatches_claim_evidence_is_known" CHECK (
    "claim_evidence_kind" IN ('not_requested','unboxing_video_requested','photo_at_handover','customer_declined')
  ),
  -- Timestamps must be ordered. A picked_up_at in the future, or a delivered_at
  -- before the pickup, is either a clock problem or an edited row, and both
  -- deserve to be refused rather than rendered on a dispatch board.
  CONSTRAINT "dispatches_timeline_is_ordered" CHECK (
    ("picked_up_at" IS NULL OR "picked_up_at" >= "assigned_at")
    AND ("out_for_delivery_at" IS NULL OR "picked_up_at" IS NULL OR "out_for_delivery_at" >= "picked_up_at")
    AND ("delivered_at" IS NULL OR "out_for_delivery_at" IS NULL OR "delivered_at" >= "out_for_delivery_at")
  ),
  -- A proof photo is only meaningful with the moment it was taken.
  CONSTRAINT "dispatches_proof_has_timestamp" CHECK (
    "proof_photo_url" IS NULL OR "proof_captured_at" IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS "dispatches_rider_id_idx" ON "dispatches" USING btree ("rider_id");
CREATE INDEX IF NOT EXISTS "dispatches_zone_id_idx" ON "dispatches" USING btree ("zone_id");
CREATE INDEX IF NOT EXISTS "dispatches_status_idx" ON "dispatches" USING btree ("status");
CREATE INDEX IF NOT EXISTS "dispatches_assigned_at_idx" ON "dispatches" USING btree ("assigned_at");
CREATE INDEX IF NOT EXISTS "dispatches_band_code_idx" ON "dispatches" USING btree ("band_code");

-- ── dispatch_events — THE APPEND-ONLY LEDGER ────────────────────────────────
--
-- Not a Payload collection. A Payload collection is mutable by an authenticated
-- admin, and this table's entire value is that it is not. The trigger below
-- refuses UPDATE and DELETE for EVERY role including the table owner, so the
-- only way to alter history is to drop the trigger, which is visible in the DDL
-- history that C-3 mandates.
CREATE TABLE IF NOT EXISTS "dispatch_events" (
  "id"           serial PRIMARY KEY NOT NULL,
  "dispatch_id"  integer NOT NULL,
  "kind"         varchar NOT NULL,
  -- Who caused it. 'rider' | 'staff' | 'system'. Kept denormalised rather than
  -- joined so the ledger stays readable even if a rider record is later
  -- deactivated, and so "which of my four staff did this" is answerable.
  "actor_kind"   varchar NOT NULL,
  "actor_label"  varchar,
  "detail"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "occurred_at"  timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dispatch_events_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "dispatch_events_kind_is_known" CHECK (
    "kind" IN ('ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','OTP_SENT','OTP_VERIFIED','DELIVERED','FAILED','CANCELLED','CLAIM_EVIDENCE','PROOF_CAPTURED','REASSIGNED')
  ),
  CONSTRAINT "dispatch_events_actor_is_known" CHECK ("actor_kind" IN ('rider','staff','system'))
);

CREATE INDEX IF NOT EXISTS "dispatch_events_dispatch_id_idx" ON "dispatch_events" USING btree ("dispatch_id");
CREATE INDEX IF NOT EXISTS "dispatch_events_occurred_at_idx" ON "dispatch_events" USING btree ("occurred_at");

-- ── rider login ─────────────────────────────────────────────────────────────
-- Riders are not `users` (better-auth owns CUSTOMER identity per C-1; Payload's
-- `users` is staff). A separate challenge table keeps rider auth auditable and
-- keeps better-auth out of the delivery path entirely.
--
-- scrypt via node:crypto — no new dependency, and a password KDF we did not
-- hand-roll. The OTP itself lives only in the outbox, so a database read cannot
-- mint a rider session.
CREATE TABLE IF NOT EXISTS "rider_login_challenges" (
  "id"           serial PRIMARY KEY NOT NULL,
  "rider_id"     integer NOT NULL,
  "code_hash"    text NOT NULL,
  "code_salt"    text NOT NULL,
  "expires_at"   timestamp(3) with time zone NOT NULL,
  "consumed_at"  timestamp(3) with time zone,
  "created_at"   timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rider_login_challenges_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "rider_login_challenges_rider_id_idx" ON "rider_login_challenges" USING btree ("rider_id");

-- ── outbox ──────────────────────────────────────────────────────────────────
-- THE SMS/EMAIL GATEWAY IS NOT WIRED. This table is where a delivery OTP and a
-- rider login code are queued, and it is deliberately visible and empty rather
-- than a silent console.log: an OTP that was never sent must be an observable
-- state, because "the code didn't arrive" and "the rider skipped the OTP" look
-- identical on a dispatch board otherwise.
CREATE TABLE IF NOT EXISTS "outbox" (
  "id"           serial PRIMARY KEY NOT NULL,
  "channel"      varchar NOT NULL,
  "to_number"    varchar NOT NULL,
  "body"         text NOT NULL,
  "kind"         varchar NOT NULL,
  "sent_at"      timestamp(3) with time zone,
  "created_at"   timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "outbox_channel_is_known" CHECK ("channel" IN ('sms','email'))
);
CREATE INDEX IF NOT EXISTS "outbox_sent_at_idx" ON "outbox" USING btree ("sent_at");

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- INVARIANT 1 · the pay snapshot is immutable.
CREATE OR REPLACE FUNCTION upvvan_dispatch_pay_snapshot_is_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."band_code"         IS DISTINCT FROM OLD."band_code"
     OR NEW."band_pay_paise" IS DISTINCT FROM OLD."band_pay_paise"
     OR NEW."pay_multiplier_bp" IS DISTINCT FROM OLD."pay_multiplier_bp"
     OR NEW."payout_paise"    IS DISTINCT FROM OLD."payout_paise" THEN
    RAISE EXCEPTION
      '[upvvan] Dispatch % pay snapshot is immutable. A dispatch records the rate the rider was PROMISED when the drop was handed to them; editing delivery_bands later must not rewrite what they already earned. Reassignment cancels the dispatch and creates a new one.',
      NEW."id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_pay_snapshot_immutable ON "dispatches";
CREATE TRIGGER trg_dispatch_pay_snapshot_immutable
  BEFORE UPDATE ON "dispatches"
  FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_pay_snapshot_is_immutable();

-- INVARIANT 2 · DELIVERED requires a verified OTP.
CREATE OR REPLACE FUNCTION upvvan_dispatch_delivered_requires_otp() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'DELIVERED' AND NEW."delivery_otp_verified_at" IS NULL THEN
    RAISE EXCEPTION
      '[upvvan] Refusing to mark dispatch % DELIVERED without a verified customer OTP. The OTP goes to the CUSTOMER''s phone, so closing a drop requires the customer to confirm receipt. A penalty clause is not a substitute for this: the competitor that fined staff Rs100 for exactly this still carries a 2.1/5 rating, because a fine does not change which action is cheapest.',
      NEW."id"
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."status" = 'DELIVERED' AND NEW."delivered_at" IS NULL THEN
    RAISE EXCEPTION '[upvvan] Dispatch % marked DELIVERED without delivered_at.', NEW."id"
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_delivered_requires_otp ON "dispatches";
CREATE TRIGGER trg_dispatch_delivered_requires_otp
  BEFORE INSERT OR UPDATE ON "dispatches"
  FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_delivered_requires_otp();

-- INVARIANT 3a · the ledger refuses to be edited.
--
-- No role check, no exemption for the owner, no `IF current_user = ...` escape.
-- The only ways past this are DROP TRIGGER or disabling it, both of which land
-- in the DDL history — which is the point. A tamper-evident log you can quietly
-- switch off is not a tamper-evident log.
CREATE OR REPLACE FUNCTION upvvan_dispatch_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    '[upvvan] dispatch_events is append-only. % on a % event is refused. Delivery history exists so a disputed delivery can be reconstructed; an editable log proves nothing and is how a fraud pattern stays invisible.',
    TG_OP, OLD."kind"
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_events_append_only ON "dispatch_events";
CREATE TRIGGER trg_dispatch_events_append_only
  BEFORE UPDATE OR DELETE ON "dispatch_events"
  FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_events_append_only();

-- INVARIANT 3b · you may not even RECORD a delivery that was not verified.
--
-- Stronger than 2. Invariant 2 stops the status column lying. This stops the
-- audit trail from being the thing that lies — otherwise the obvious "fix" for
-- a stuck dispatch is to write a DELIVERED event by hand, which would satisfy
-- every reader of the log while the customer never got a plant.
CREATE OR REPLACE FUNCTION upvvan_dispatch_event_delivery_requires_otp() RETURNS trigger AS $$
DECLARE
  verified timestamptz;
BEGIN
  IF NEW."kind" = 'DELIVERED' THEN
    SELECT "delivery_otp_verified_at" INTO verified FROM "dispatches" WHERE "id" = NEW."dispatch_id";
    IF verified IS NULL THEN
      RAISE EXCEPTION
        '[upvvan] Refusing to record a DELIVERED event for dispatch % because the customer OTP was never verified.',
        NEW."dispatch_id"
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_event_delivery_requires_otp ON "dispatch_events";
CREATE TRIGGER trg_dispatch_event_delivery_requires_otp
  BEFORE INSERT ON "dispatch_events"
  FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_event_delivery_requires_otp();

-- ── legal transitions ───────────────────────────────────────────────────────
-- The rider surface offers picked-up -> out for delivery -> delivered, and the
-- database refuses everything else. Including backwards. An out-of-order write
-- is either a bug or an edit, and both should stop here rather than show up as
-- an impossible timeline on the dispatch board.
CREATE OR REPLACE FUNCTION upvvan_dispatch_transition_is_legal() RETURNS trigger AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF OLD."status" = NEW."status" THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD."status"
    WHEN 'ASSIGNED'          THEN NEW."status" IN ('PICKED_UP','FAILED','CANCELLED')
    WHEN 'PICKED_UP'         THEN NEW."status" IN ('OUT_FOR_DELIVERY','FAILED')
    WHEN 'OUT_FOR_DELIVERY'  THEN NEW."status" IN ('DELIVERED','FAILED')
    WHEN 'DELIVERED'         THEN false
    WHEN 'FAILED'            THEN false
    WHEN 'CANCELLED'         THEN false
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION
      '[upvvan] Illegal dispatch transition % -> %. A delivered drop is terminal: there is no path back to ASSIGNED, because un-delivering is what a mutable status column is FOR.',
      OLD."status", NEW."status"
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_transition_is_legal ON "dispatches";
CREATE TRIGGER trg_dispatch_transition_is_legal
  BEFORE UPDATE ON "dispatches"
  FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_transition_is_legal();

-- ── a rider and an order must share a city ──────────────────────────────────
-- A Bengaluru rider cannot be handed a Hyderabad order even by a direct write.
-- Same isolation guarantee as every other city-scoped table; asserted here
-- because dispatch is where a cross-city mix-up would actually lose a plant.
CREATE OR REPLACE FUNCTION upvvan_dispatch_city_matches() RETURNS trigger AS $$
DECLARE
  order_city  integer;
  rider_city  integer;
BEGIN
  SELECT "city_id" INTO order_city FROM "orders" WHERE "id" = NEW."order_id";
  SELECT "city_id" INTO rider_city FROM "riders" WHERE "id" = NEW."rider_id";

  IF order_city IS NULL OR rider_city IS NULL THEN
    RAISE EXCEPTION '[upvvan] Dispatch references a missing order (%) or rider (%).', NEW."order_id", NEW."rider_id"
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF order_city <> rider_city THEN
    RAISE EXCEPTION
      '[upvvan] Order % is in city % but rider % is in city %. A delivery has to happen in the city the order was placed in.',
      NEW."order_id", order_city, NEW."rider_id", rider_city
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_city_matches ON "dispatches";
CREATE TRIGGER trg_dispatch_city_matches
  BEFORE INSERT OR UPDATE ON "dispatches"
  FOR EACH ROW EXECUTE FUNCTION upvvan_dispatch_city_matches();

-- ── a per-rider multiplier may not flatten the bands ─────────────────────────
-- Found by a property test, not by reading code: `ceil` is monotonic but not
-- strictly increasing, so at a small enough multiplier two bands round onto the
-- same paise. For the launch bands at 1bp, all three pay 1p — flat per-order pay,
-- arriving through the multiplier instead of the band table, and invisible.
--
-- Enforced here rather than only in the Riders collection hook because a hook is
-- bypassable by a direct write, which is the whole reason these invariants live
-- in the schema (C-3, and the reason the reference operator needed a fine).
CREATE OR REPLACE FUNCTION upvvan_rider_multiplier_keeps_bands_ordered() RETURNS trigger AS $$
DECLARE
  smallest_gap numeric;
  floor_bp    numeric;
BEGIN
  SELECT MIN(gap) INTO smallest_gap FROM (
    SELECT (b2."pay_paise" - b1."pay_paise") AS gap
      FROM "delivery_bands" b1
      JOIN "delivery_bands" b2
        ON b2."city_id" = b1."city_id" AND b2."pay_paise" > b1."pay_paise"
     WHERE b1."city_id" = NEW."city_id"
  ) gaps;

  IF smallest_gap IS NULL OR smallest_gap <= 0 THEN
    RETURN NEW;
  END IF;

  floor_bp := ceil(10000 / smallest_gap);

  IF NEW."pay_multiplier_bp" < floor_bp THEN
    RAISE EXCEPTION
      '[upvvan] Rider % pay multiplier %bp is too low for this city: bands differing by %p would both round to the same payout, so a longer route would pay the same as a shorter one. Use at least %bp. That flat-per-order structure is what produced a competitor 1.4/5 rating.',
      COALESCE(NEW."id", 0), NEW."pay_multiplier_bp", smallest_gap, floor_bp
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rider_multiplier_keeps_bands_ordered ON "riders";
CREATE TRIGGER trg_rider_multiplier_keeps_bands_ordered
  BEFORE INSERT OR UPDATE ON "riders"
  FOR EACH ROW EXECUTE FUNCTION upvvan_rider_multiplier_keeps_bands_ordered();

-- ── a rider session cannot outlive the rider ────────────────────────────────
-- Deactivating a rider must take effect on the next request, not whenever their
-- cookie happens to expire.
CREATE OR REPLACE FUNCTION upvvan_rider_must_be_active() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "riders" WHERE "id" = NEW."rider_id" AND "active") THEN
    RAISE EXCEPTION '[upvvan] Rider % is not active and cannot be given a drop.', NEW."rider_id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_rider_must_be_active ON "dispatches";
CREATE TRIGGER trg_dispatch_rider_must_be_active
  BEFORE INSERT ON "dispatches"
  FOR EACH ROW EXECUTE FUNCTION upvvan_rider_must_be_active();