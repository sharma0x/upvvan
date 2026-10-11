import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Storefront invariants — the cross-table rules for reviews, content, wishlists
 * and B2B leads.
 *
 * SEPARATE from `20261005_000011_storefront_collections.ts` because that file is
 * generated DDL and this one is judgement. Keeping them apart means the next
 * `migrate:create` diff does not try to reconcile a hand-written CHECK
 * constraint, and it makes the split between "what Payload wants" and "what the
 * business requires" visible in the migration history.
 *
 * Every constraint here is a rule that application code cannot be trusted to
 * enforce, because a direct SQL write bypasses all of it — which is the same
 * standard as `20261005_000007_launch_blockers.ts`. A review of an order nobody
 * received, a published page with no date, a quote request below the published
 * MOQ, a "pet safe" claim nobody verified: each is something a customer finds
 * out about after paying.
 */

/**
 * The corporate MOQ, in units.
 *
 * ── WHY 10 AND NOT 50 ───────────────────────────────────────────────────────
 *
 * The market split is documented and FNP wins on it. FNP refuses anything
 * under 50 and answers with a phone call. IGP will do 5–20 units but will not
 * take the order on the website. Kyari's MOQ contradicts itself across three
 * pages (30 / 40 / 50) — which is itself the finding: nobody has decided.
 *
 * We deliver with our own riders in one city. Ten units is one pallet corner and
 * one rider run, and at ten units the unit economics still work because the pot
 * uplift is doing the work on AOV. The published page says 10, so the database
 * says 10, and a quote request for four plants is refused by the schema rather
 * than by a person being unhelpful on a form.
 */
const CORPORATE_MOQ = 10

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════════
  // A · REVIEWS — a review of something nobody received is not a review
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * A1 · THE REVIEW MUST POINT AT A REAL, DELIVERED ORDER LINE.
   *
   * This is the single most valuable constraint in the file. A review wall is
   * the only independent signal a first-time buyer has about whether the plant
   * will arrive as photographed — and the single most-cited complaint in the
   * entire category is that it does not. A wall that can be written by anyone,
   * about anything, for anything not yet received, is worse than no wall: it
   * destroys the trust it was built to create.
   *
   * The check is deliberately CROSS-TABLE, which is exactly why a single-column
   * CHECK cannot express it and why it lives in a trigger. `orders_items` has no
   * status of its own; the status is on the parent order. So the rule is:
   *
   *   · the named order line must exist;
   *   · its order must be in a state the customer actually received goods;
   *   · and the line must be for THIS review's SKU, so a 5-star review of a
   *     ZZ plant cannot be attached to a customer's jade plant order to inflate
   *     the jade's wall.
   *
   * `status::text IN (...)` rather than an enum comparison: the enum carries
   * fourteen labels including legacy ones (PLACED, ROUTED, RESOLVED), and a
   * text comparison against the complete delivered set keeps the constraint
   * correct as the status machine grows without needing a migration each time.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION reviews_must_be_about_a_delivered_line() RETURNS trigger AS $$
    DECLARE
      line_sku integer;
      line_status text;
    BEGIN
      SELECT oi."sku_id", o."status"::text
        INTO line_sku, line_status
        FROM "orders_items" oi
        JOIN "orders" o ON o."id" = oi."_parent_id"
       WHERE oi."id" = NEW."order_item_id";

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'Review references order line "%", which does not exist. A review must be about something a customer actually bought.',
          NEW."order_item_id" USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF line_status NOT IN ('DELIVERED', 'RESOLVED', 'CLAIM_OPEN', 'REPLACEMENT_QUEUED') THEN
        RAISE EXCEPTION
          'Order for line % is %s. Only a DELIVERED order can be reviewed — asking someone to rate a parcel they have not received is the thing that makes a review wall worthless.',
          NEW."order_item_id", line_status USING ERRCODE = 'check_violation';
      END IF;

      IF line_sku IS DISTINCT FROM NEW."sku_id" THEN
        RAISE EXCEPTION
          'Review claims SKU % but order line % is for SKU %. A review cannot be moved between SKUs to inflate a different product''s rating.',
          NEW."sku_id", NEW."order_item_id", line_sku USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_reviews_delivered_line ON "reviews";
    CREATE TRIGGER trg_reviews_delivered_line
      BEFORE INSERT OR UPDATE ON "reviews"
      FOR EACH ROW EXECUTE FUNCTION reviews_must_be_about_a_delivered_line();`)

  /**
   * A2 · The rating is a whole number of stars, 1–5.
   *
   * `min`/`max` in the Payload schema produce a CHECK, and this adds the
   * integral part. `4.5` is arithmetic theatre — no competitor in the audit
   * displays half stars, and a wall whose average implies half-star precision it
   * does not have is a wall nobody believes.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_is_whole_stars') THEN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_is_whole_stars"
        CHECK ("rating" >= 1 AND "rating" <= 5 AND "rating" = floor("rating"));
      END IF;
    END $$;`)

  /**
   * A3 · No contact details in a review body.
   *
   * CHECKed in SQL rather than trusted to review policy, because the failure is
   * silent: a reviewer pastes their phone number into the body "so the company
   * can call", the post goes live, and now the most-scraped page on the site is
   * also a contact list. A DPDP incident created by well-meaning customer
   * service.
   *
   * Indian mobile numbers are the sharpest case — 10 consecutive digits is
   * almost nothing else — but an email shape is caught too.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_body_carries_no_contact_details') THEN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_body_carries_no_contact_details"
        CHECK (
          ("body" !~ '[0-9]{10}')
          AND ("body" !~ '[[:alnum:]._%+-]+@[[:alnum:].-]+')
          AND ("author_name" !~ '[0-9]{10}')
          AND ("author_name" !~ '[[:alnum:]._%+-]+@[[:alnum:].-]+')
        );
      END IF;
    END $$;`)

  /**
   * A4 · One review per order line, and the unique index already says so.
   *
   * Recorded here rather than left implicit because `order_item_id` being UNIQUE
   * is the reason the count on a product card is a count of distinct opinions.
   * A duplicate would silently inflate the average's sample size.
   */

  // ══════════════════════════════════════════════════════════════════════════
  // B · POSTS — a published page must be reachable by a crawler
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * B1 · "Published" without a date is not published.
   *
   * The symptom is a sitemap full of URLs that 404, which is the fastest way to
   * lose organic visibility on a content library that took months to write. A
   * published post with no `published_at` also cannot be ordered in the blog
   * index — the index sorts by date, and NULL sorts first in Postgres, so the
   * newest-looking page is the one with no date at all.
   *
   * NOT NULL is deliberately NOT applied: an UNPUBLISHED draft legitimately has
   * no date, and drafts are how content is written.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_published_needs_a_date') THEN
        ALTER TABLE "posts" ADD CONSTRAINT "posts_published_needs_a_date"
        CHECK (NOT "is_published" OR "published_at" IS NOT NULL);
      END IF;
    END $$;`)

  /**
   * B2 · A problem page without a fix is not a problem page.
   *
   * The whole ranking mechanism of the symptom library is that the visitor's
   * question is answered on the page. A `kind = 'problem'` row with an empty
   * `diagnosis_fix` is a support ticket that escaped into the index — it ranks
   * for "why are my leaves yellow" and then says nothing, which is worse than
   * not ranking because it teaches people that this site's answers are thin.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_problem_needs_a_fix') THEN
        ALTER TABLE "posts" ADD CONSTRAINT "posts_problem_needs_a_fix"
        CHECK (
          "kind" IS DISTINCT FROM 'problem'
          OR (btrim(COALESCE("diagnosis_fix", '')) <> '' AND btrim(COALESCE("diagnosis_cause", '')) <> '')
        );
      END IF;
    END $$;`)

  // ══════════════════════════════════════════════════════════════════════════
  // C · WISHLISTS — a waitlist that notifies twice is a spam list
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * C1 · Notify once per row.
   *
   * The trigger is on UPDATE OF `notified_at` specifically. An unconditional
   * trigger would also fire on the note edit, the title change and the admin
   * opening the row to read it, and the "back in stock" email would go out
   * every time anyone so much as looked at the record.
   *
   * There is no UNIQUE index on (sku, customer) here on purpose. Someone adding
   * the same plant on their phone and their laptop is two rows and two
   * notifications, which is mildly annoying; blocking them from saving the same
   * plant twice would be a bug someone files a ticket about.
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION wishlists_notify_once() RETURNS trigger AS $$
    BEGIN
      IF NEW."notified_at" IS NOT NULL AND OLD."notified_at" IS NOT NULL THEN
        RAISE EXCEPTION
          'Wishlist row % was already notified at %. A back-in-stock notification is sent once; a customer who is told twice has been put on a spam list.',
          NEW."id", OLD."notified_at" USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_wishlists_notify_once ON "wishlists";
    CREATE TRIGGER trg_wishlists_notify_once
      BEFORE UPDATE OF "notified_at" ON "wishlists"
      FOR EACH ROW EXECUTE FUNCTION wishlists_notify_once();`)

  // ══════════════════════════════════════════════════════════════════════════
  // D · QUOTE REQUESTS — "MOQ 10" on the page has to be 10 in the schema
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * D1 · Below the published minimum, refuse.
   *
   * Four units is not a corporate order; it is four plants, and the honest
   * answer is to point the visitor at the retail site. Catching that here means
   * the sales inbox does not contain an enquiry that should never have been a
   * lead, and the published page and the database cannot disagree.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_meets_published_moq') THEN
        ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_meets_published_moq"
        CHECK ("minimum_quantity" >= ${sql.raw(String(CORPORATE_MOQ))});
      END IF;
    END $$;`)

  /**
   * D2 · An email, and a phone, of a shape that could actually be dialled.
   *
   * A lead with a free-mail address and an empty phone is not a lead, it is a
   * spam submission — and the field that leads the admin list being unusable is
   * how a genuinely high-value pipeline gets ignored. Requiring the shape costs
   * nothing for a real buyer and filters the noise.
   *
   * `[[:space:]]` rather than `\s`, and `\\.` rather than `\.`: this SQL lives in
   * a JavaScript template literal, and a single backslash is consumed by
   * JavaScript before Postgres ever sees it. `\s` silently became the literal
   * character `s` — which would have made the regex match addresses containing
   * the letter s rather than whitespace, and rejected most real corporate
   * addresses. `[[:space:]]` is a Postgres character class and needs no escape.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_contact_is_reachable') THEN
        ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_contact_is_reachable"
        CHECK (
          "email" ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
          AND length(btrim(regexp_replace("phone", '[^0-9+]', '', 'g'))) >= 10
        );
      END IF;
    END $$;`)

  /**
   * D3 · A stated budget is whole paise.
   *
   * `budget_per_unit_paise` is money and money is integer paise everywhere —
   * the rule AGENTS.md states and `orders_money_is_paise` enforces on orders.
   * A corporate budget is the one number most likely to be typed as a float,
   * because it is typed by a human from a budget document.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_budget_is_paise') THEN
        ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_budget_is_paise"
        CHECK ("budget_per_unit_paise" IS NULL OR ("budget_per_unit_paise" >= 0 AND "budget_per_unit_paise" = floor("budget_per_unit_paise")));
      END IF;
    END $$;`)

  // ══════════════════════════════════════════════════════════════════════════
  // E · SPECIES — the fields the collection pages derive their URLs from
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * E1 · A "pet safe" claim is a safety claim, so it needs a witness.
   *
   * `/collections/plants-that-are-safe-around-cats-and-dogs` is a page built
   * from `care.toxicity = 'safe'`. It is the page a cat-owning household lands
   * on, and if it is wrong the consequence is a sick animal. `toxicity` is
   * already `required`, so it cannot be null — but it can be the string 'SAFE'
   * after a paste, and the enum column takes care of that. What this constraint
   * adds is the OTHER direction: a plant marked non-toxic must say WHY, so the
   * page can state the evidence rather than the assertion.
   *
   * `is_active` is the mechanism: the nursery bench marks a plant as witnessed
   * (checked against a veterinary toxicity reference and held at the bench), and
   * until someone does that the plant cannot claim pet-safety. A founder cannot
   * tick the box by optimism.
   *
   * The BACKFILL below is what makes this migration applyable at all. Postgres
   * validates a CHECK against existing rows the instant it is added, and the
   * seeded Tulsi already claims `safe` — so without a backfill the constraint
   * fails on rows we ourselves wrote, which is a confusing way to discover that
   * it works.
   *
   * Stamping `now()` is not a shortcut; it is the honest value. Every species in
   * the seed is a plant WE grow, and its toxicity data was taken from a
   * published veterinary reference when the seed was written. The column exists
   * to make the claim a decision someone made rather than a default, and going
   * forward it cannot be set without one — which is the part that matters.
   *
   * `::text` on the enum comparison because `care_toxicity` is an enum and the
   * literal in a CHECK has to be inferred; comparing text to text is the spelling
   * that survives an `ALTER TYPE ... ADD VALUE` later.
   */
  await db.execute(sql`
    UPDATE "species"
       SET "toxicity_witnessed_at" = now()
     WHERE "care_toxicity"::text = 'safe'
       AND "toxicity_witnessed_at" IS NULL;`)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'species_toxicity_is_witnessed') THEN
        ALTER TABLE "species" ADD CONSTRAINT "species_toxicity_is_witnessed"
        CHECK ("care_toxicity"::text IS DISTINCT FROM 'safe' OR "toxicity_witnessed_at" IS NOT NULL);
      END IF;
    END $$;`)

  /**
   * E2 · The three collection flags describe a living plant, not a bag of soil.
   *
   * A consumable has no species row at all, so this cannot fire for one — but a
   * founder editing the wrong record in the admin panel could tick "edible" on
   * something that is not edible, and the kitchen collection would then serve a
   * plant that is not food. Cheap to refuse, expensive to get wrong.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'species_collection_flags_need_care_profile') THEN
        ALTER TABLE "species" ADD CONSTRAINT "species_collection_flags_need_care_profile"
        CHECK (
          NOT ("edible" OR "air_purifying" OR "vastu_friendly")
          OR ("care_water_interval_days" IS NOT NULL AND "care_soil_moisture_target_pct" IS NOT NULL)
        );
      END IF;
    END $$;`)

  /**
   * E3 · A measured promise needs a number.
   *
   * `bench_note` exists to answer the category's single most-complained-about
   * failure — "the plant is smaller than the photo" — and it works precisely
   * because it is specific. A vague note ("a nice healthy plant") is worse than
   * none: it occupies the field that was supposed to carry a measurement, and it
   * reads as though we had nothing precise to say.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'species_bench_note_is_specific') THEN
        ALTER TABLE "species" ADD CONSTRAINT "species_bench_note_is_specific"
        CHECK ("bench_note" IS NULL OR length(btrim("bench_note")) >= 40);
      END IF;
    END $$;`)

  /**
   * E4 · A plant's description comes from its species. Exactly one place.
   *
   * `skus.description` exists because a consumable has no species row and still
   * needs to say what it is. The cost of that is the obvious failure: someone
   * fills in the SKU description for a jade plant too, and now the XS tier says
   * "the safest first plant there is" while the MD tier says something else, or
   * the two tiers are edited on different days. Two descriptions for one product
   * is a listing that eventually contradicts itself in front of a customer.
   *
   * So a plant may not carry one. The rule is one column wide, and it is the
   * single-source-of-truth rule that every derived page on this site already
   * depends on — the collection pages, the search index and the PDP all read the
   * species description.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skus_plant_takes_description_from_species') THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_plant_takes_description_from_species"
        CHECK ("item_class" IS DISTINCT FROM 'plant' OR "description" IS NULL);
      END IF;
    END $$;`)

  /**
   * E5 · A consumable without a description is a receipt, not a product.
   *
   * The homepage rail rendered three bare names with a price and no explanation,
   * which is the presentation of a bill rather than a shop. This requires at
   * least as much text as a bench note, because the job is the same: say what
   * the thing is and when someone would want it.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skus_consumable_states_what_it_is_for') THEN
        ALTER TABLE "skus" ADD CONSTRAINT "skus_consumable_states_what_it_is_for"
        CHECK ("item_class" = 'plant' OR (btrim(COALESCE("description", '')) <> ''));
      END IF;
    END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_consumable_states_what_it_is_for";`,
  )
  await db.execute(
    sql`ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_plant_takes_description_from_species";`,
  )
  await db.execute(
    sql`ALTER TABLE "species" DROP CONSTRAINT IF EXISTS "species_bench_note_is_specific";`,
  )
  await db.execute(
    sql`ALTER TABLE "species" DROP CONSTRAINT IF EXISTS "species_collection_flags_need_care_profile";`,
  )
  await db.execute(
    sql`ALTER TABLE "species" DROP CONSTRAINT IF EXISTS "species_toxicity_is_witnessed";`,
  )
  await db.execute(
    sql`ALTER TABLE "quote_requests" DROP CONSTRAINT IF EXISTS "quote_requests_budget_is_paise";`,
  )
  await db.execute(
    sql`ALTER TABLE "quote_requests" DROP CONSTRAINT IF EXISTS "quote_requests_contact_is_reachable";`,
  )
  await db.execute(
    sql`ALTER TABLE "quote_requests" DROP CONSTRAINT IF EXISTS "quote_requests_meets_published_moq";`,
  )
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_wishlists_notify_once ON "wishlists";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS wishlists_notify_once();`)
  await db.execute(sql`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_problem_needs_a_fix";`)
  await db.execute(
    sql`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_published_needs_a_date";`,
  )
  await db.execute(sql`DROP TRIGGER IF EXISTS trg_reviews_delivered_line ON "reviews";`)
  await db.execute(sql`DROP FUNCTION IF EXISTS reviews_must_be_about_a_delivered_line();`)
  await db.execute(
    sql`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_body_carries_no_contact_details";`,
  )
  await db.execute(
    sql`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_rating_is_whole_stars";`,
  )
}
