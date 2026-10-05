# DECISIONS — running log

Dated entries. Stack choice, auth design, rejected options, and every place the implementation deviated from the design documents.

Newest first.

---

## 2026-10-05 — Phase 0 built and verified end to end

**State.** 79 tests passing, every one seen red first. `make ci-local` green (format, lint, typecheck, test, production build). Coverage checker clicked through in a real browser (Brave, headed) against the production build.

**What the schema layer actually refuses, proven by raw SQL that bypasses all application code:**

| Attempt                                                                    | Result               |
| -------------------------------------------------------------------------- | -------------------- |
| `UPDATE delivery_bands SET pay_paise` dragging a far band below a near one | rejected by trigger  |
| Same, dragging a near band above a far one                                 | rejected             |
| Overlapping bands in one city                                              | rejected             |
| Float pay value                                                            | rejected by CHECK    |
| `cities.status = 'live'` with licence `not_filed`                          | rejected by CHECK    |
| `cities.status = 'live'` with licence `filed` (not approved)               | rejected by CHECK    |
| `city_id = NULL` on zones / pincodes                                       | rejected by NOT NULL |

Verified by dropping each constraint and re-running: the tests go red (trigger → 4 failures, licence CHECK → 9), then green again after re-migration.

**Four real bugs found by actually running it, each now regression-tested:**

1. **City gate rejected our own city.** Postgres integer PKs come back from `json_agg` as numbers; route params are strings. `127 !== "127"` meant a live, serviceable Bengaluru pincode returned `CITY_MISMATCH` — the API told a customer in our own city we don't deliver to them. 21 unit tests passed throughout, because every fixture used consistent string ids. Fixed with `sameId()` normalisation; regression tests deliberately mix types.

2. **A customer identity column named `[object Object]`.** Declaring `phoneNumber` inside `user.fields` is not a supported better-auth shape. The migration reported success and the column did not exist. `phoneNumber` is contributed by better-auth's own plugin, which also owns the `UNIQUE ("phoneNumber")` constraint that C-1 depends on. Added a test asserting no malformed column names, plus one asserting the unique index exists — both proven red by dropping the constraint.

3. **The storefront rendered completely unstyled** while typecheck, 79 tests, the production build and every DOM assertion passed. Cause: `globals.css` was imported only inside the `(payload)` route group, and Tailwind's `@theme` needs `@tailwindcss/postcss` wired into PostCSS. Without it the rule is emitted _literally_ and every `var(--color-*)` silently resolves to nothing. Found by looking at a screenshot. Fixed by adding the real root layout, the PostCSS config, and the missing `@tailwindcss/postcss` dependency.

4. **better-auth's `database` option is shape-detected, not `provider`-keyed.** `{ provider: 'pg', pool }` fails with "Failed to initialize database adapter"; the pg `Pool` itself must be passed, because that is what carries the `connect` method better-auth tests for. Cost an hour of reading better-auth's dist; recorded at the call site.

**Three of my own test bugs, fixed rather than worked around** — each was a wrong assumption, not a product defect: pay is constant _within_ a band (only transitions must rise); 12 km is the exclusive zone radius, not a band; and an UPDATE "attack" test that was updating a row to the value it already had, i.e. a no-op.

**Design.** `DESIGN.md` is now the normative design spec (tokens + rationale), with `src/app/theme.css` generated from it and imported by `globals.css`. `make design-lint` passes with **0 errors, 0 warnings**. The linter caught a genuine WCAG failure — amber warning text at 2.91:1 — and the token was darkened to `oklch(0.52 0.13 70)`, which measures `#975800`. Confirmed in the browser: rejection banners render with that exact border colour.

**Infrastructure note.** Dev services moved to the 5xxxx port range (Postgres 55432, S3 59000/59001, Mailpit 58025, Adminer 58080) so this stack can run alongside Shayga without a collision.

**Build must use webpack, not Turbopack.** Two reasons, both recorded in `next.config.ts`: Payload's admin build path is webpack-based, and Turbopack's PostCSS loader resolves plugin names from a sandboxed root and cannot see `@tailwindcss/postcss` even when installed and resolvable from Node.

**Deferred to Phase 1, deliberately.** The no-COD CHECK on `orders.payment_mode` and the `city_pnl` view both read from `orders`, which does not exist yet. They are NOT behind `IF EXISTS table` guards: a constraint added in a later migration can be silently dropped by a schema push, which is exactly the drift C-3 forbids. A constraint and the table it protects should land together. The P&L shape is unit-tested in TypeScript now.

**Open from the prompt's twelve tests, not yet built:** delivery-proof gate (Phase 3), no-refund-for-plants (Phase 1), guarantee tier (schema exists; claim engine is Phase 5), claim window, Legal Metrology completeness, batch traceability (Phase 2), refill cadence (Phase 6). Phase 0 pre-committed to rider pay banding and multi-city isolation; both are done.

---

## 2026-10-05 — Design tokens moved to DESIGN.md, Tailwind kept

**Decision.** Tailwind v4 stays. `DESIGN.md` is the normative design spec; `src/app/theme.css` is generated from it (`make design-export`) and imported by `globals.css`.

**Correction to an earlier move in this same session.** I first replaced `@theme` with a plain `:root` block on the reasoning that Phase 0 used no utility classes, so Tailwind was dead weight. That was the wrong call and it was reverted: the stack decision is not ours to unpick project-by-project, and "no utility classes yet" is an argument about today, not about the design system's direction. The real bug was a missing `@tailwindcss/postcss` dependency, not Tailwind.

**Lesson recorded at the CSS file:** `@theme` and `@import 'tailwindcss'` are directives, not plain CSS. Unprocessed, they are emitted literally and every custom property silently resolves to nothing. The symptom is a completely unstyled page that passes every automated check — so the check that catches it is looking at it.

---

## 2026-10-05 — Stack chosen: Next.js 16 + Payload 3.x + better-auth, one process

**Decision.** One Next.js 16 App Router process. Payload CMS 3.x owns the schema, the admin panel and staff auth. `better-auth`, mounted in the same process, owns customer identity outright. All business invariants are hand-written SQL inside Payload's own migration directory, so there is exactly one DDL history.

**Full reasoning:** [`STACK-DECISION.md`](./STACK-DECISION.md).

**Deciding factor.** Three business rules (delivery-proof gate, batch traceability, pincode+city gate) must be enforced in the schema layer, because `product-design.md` §7 says so and the spike spec rules application-code-only enforcement a fail. The question that decided the stack was therefore not "which CMS is nicer" but **who owns the DDL**. Payload's migration runner applies both the generated collection DDL and our triggers/CHECK constraints. Medusa's module system owns the product and order tables, so those constraints would need a second hand-rolled migration path running beside Medusa's own — in exactly the three rules the business cannot survive getting wrong. Weighted 4× per C-5, that risk is an on-call item for the life of the business, and Medusa's saving (a flexible cart) is small precisely because Part 3 deliberately keeps the commerce surface small.

**Infra cost, as required by C-5.** One process, two datastores (Postgres 18 + S3-compatible object storage), zero added services. No Redis, no queue, no worker. A domain-code cost is weighted 4× an infra cost; Medusa's +2 processes and +1 datastore did not clear that bar.

---

## 2026-10-05 — Customer identity: better-auth, with no Payload `Customers` collection

**Decision.** `better-auth` owns the `user` table outright. **No `Customers` collection exists in Payload.** Customer-referencing Payload tables (`orders`, `addresses`, `carts`, `claims`, `consents`) carry a plain-text `customer_id` with a real foreign key to `user.id`, created in our migrations. Staff identity is Payload's own `Users` collection. Riders are staff.

**Why, and where this diverges from the reference repo.** The reference repo runs three identity surfaces — `better-auth`'s user model, Payload's `Users`, and a `Customers` collection linked by `betterAuthUserId`. That is the shape C-1 warns about, and we did not copy it. A Payload `Customers` collection is a second table holding `email`, `phone` and `name`: a mirror kept in sync by a job. Mirrors are permanent operational surface, and their failure mode is two customer records — the bug C-1 exists to prevent.

A Payload `relationship` field cannot be used here, and that is the point: a relationship needs a Payload collection to point at, and pointing at a mirror is what creates the mirror. A plain column plus a real FK gives referential integrity _and_ leaves no schema location where a second customer record can be born.

**No projection, no sync job.** Where the support console needs customer context, `getCustomerContext()` reads through to better-auth on demand and stores nothing. Lagging is impossible because nothing is cached. Part 5 requires naming any projection by subject/trigger/failure-mode; the honest answer here is that there is none.

**One boundary that looks like a mirror and is not.** An order's `address` is a point-in-time fulfilment and legal record — required for Consumer Protection (E-Commerce) Rules 2020 disclosures and for claims adjudication. Transaction record, not identity record; immutable, never read as identity. Recorded so a future reader does not "tidy" it into a customer mirror.

**Customer identity primitive is phone + OTP, not email + password.** The buyer is in a rented flat in one city; support is WhatsApp-first with a <15 min SLA; DPDP consent must attach at signup. Email/password is the wrong primitive.

---

## 2026-10-05 — Guarantee is T0 = 48h at launch; the "90-day" figure in older docs is superseded

**Decision.** The guarantee tier is configuration in the price book. **T0 = 48 hours from DELIVERED at launch.** T1 (30 days) and T2 (90 days) sit behind flags that default OFF.

**Document conflict, resolved conservatively.** `concept.md` §3 and `product-design.md` §2.6 both advertise a "90-day survival guarantee". `use-cases.md` §11 — revised 4 October 2026, and therefore the later document — tiers it and explains why: the global standard is 30 days, no competitor in any researched market exceeds it, and our 5% DOA input is the least-evidenced number in the unit-economics model. Extending to 90 days while that number is a guess converts a marketing promise into an unpriced liability.

Followed the tiered rule. Part 3 rule 4 ("do not ship a 90-day promise") is unambiguous, and promotion is a data decision, never a calendar decision.

---

## 2026-10-05 — NOT inheriting the reference repo's stock pattern as described

**Decision.** Inherit the ledger shape (`StockMovements` — genuinely good, append-only, program-written only) and the pure variant arithmetic (`applyStockDecrement` / `applyStockRestore`). **Write the atomic decrement, the cart-time TTL reservation and the replay guard ourselves.**

**Finding.** The reference repo is described as having "a validated pattern at `src/lib/stock.ts`" for _cart-time reservation with TTL, atomic decrement, replay-guarded, auditable ledger_. Read in full, it does not do that. `validateCartStock` is read-then-clamp: two concurrent checkouts can both pass validation and both proceed to decrement. There is no TTL reservation, no row lock, and no idempotency or replay guard anywhere in it.

Recorded because copying it on the strength of the description would put a double-sell into production. The descriptive gap is between _variant-aware decrement arithmetic_ (what it does, correctly) and _concurrency-safe reservation_ (what we need, and what it does not do).

---

## 2026-10-05 — RustFS, not MinIO, in `infra/dev-services.yml`

**Decision.** Copy the reference repo's dev-services file with RustFS as the S3 service.

The `minio/minio` and `minio/mc` images were deleted from Docker Hub outright and cannot be fetched at all, so the file cannot be built as originally written. RustFS is S3-API-compatible and still published; the application reaches storage purely through the `S3_*` env vars and needs no change.

**Operational note carried forward:** RustFS does **not** auto-create buckets on first write — writes fail with `NoSuchBucket`. The bucket must be created once against the S3 API before any seed.

**Also carried forward:** Postgres 18 Alpine needs `PGDATA=/var/lib/postgresql/pgdata` with the volume mounted at `/var/lib/postgresql`, not `/var/lib/postgresql/data`, or Postgres restart-loops.

---

## 2026-10-05 — No cache service; in-process bounded LRU only

**Decision.** No Redis. Pincode and product lookups use an in-process bounded LRU with TTL, copied in shape from the reference repo's `pincode-cache.ts` (bounded entry count, oldest-evicted insertion-order eviction).

Phase 0 has no measured load, and C-5/C-6 make a new service a cost to name rather than hide. Revisit only with a load-test number attached — not a hunch.

---

## 2026-10-05 — Open questions carried forward, not silently answered

`use-cases.md` §13 lists eight unresolved questions. Per Part 8, these are surfaced rather than invented:

| #   | Question                                                                                                 | Status                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stock-out mid-order: what substitutes, notifies, refunds                                                 | **Open.** No fallback rule in the docs. Must be decided before Phase 1 checkout.                                                                                                                                                                                                                                                                                                   |
| 2   | Rider no-show / customer unreachable — OTP proof impossible, order has no terminal state                 | **Open.** Carried as a design constraint on Phase 3: the proof gate must not make this state unreachable by construction.                                                                                                                                                                                                                                                          |
| 3   | Address change after dispatch                                                                            | **Open.**                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | Subscription pause/skip — a refill customer in a heat window may need to skip; no mechanism exists       | **Open, and load-bearing.** This is falsifier **F1** in `STACK-DECISION.md` §6: if refill resolves into general recurring billing _and_ we need a background worker anyway, Medusa's subscription module becomes pre-paid capability rather than a purchase. The refill requirements spec is due **before Phase 5 ends**, because after that the stack decision stops being cheap. |
| 5   | Pot breakage vs plant damage — same claim path, different remedy                                         | **Open.**                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | Corporate PO path — B2B has a sales motion but no order use cases                                        | **Open.** Phase 3+ / Line 4.                                                                                                                                                                                                                                                                                                                                                       |
| 7   | Guarantee-terms versioning has no state-machine or consent artefact                                      | **Partly resolved.** The tier lives in the price book (configuration) and a per-order snapshot of the agreed terms is a row we write. The consent artefact remains open.                                                                                                                                                                                                           |
| 8   | Supplier-facing surface — batch traceability is required for compliance, but no supplier use case exists | **Open.** Blocks nothing in Phases 0–2.                                                                                                                                                                                                                                                                                                                                            |

---

## 2026-10-05 — Phase 0 scope held to geo only

**Decision.** Phase 0 builds city, pincode → zone → distance band → serviceable, city config and price book, with CSV import and an HQ admin city on/off switch. No catalogue, no cart.

**Why it matters for the stack decision:** this is the phase where a second source of truth for the product record would first appear, because catalogue work is what tempts a second system. Doing geo first means the single-backend property of C-2 is established while there is no product data to disagree about.

**Pre-committed tests for Phase 0**, to be seen red before implementation: rider pay banding (longer route pays strictly more — the core incentive fix, written early on purpose), and multi-city isolation (a new city is configuration only, and P&L queries do not leak).

---

## 2026-10-05 — The storefront picks its city by slug, never by array order

**Decision.** `src/app/page.tsx` selects `DEFAULT_CITY_SLUG = 'bengaluru'`, falls
back to the single active city if exactly one exists, and warns when more than one
city is active. It does **not** take `cities[0]`.

**Why.** The first version took `cities[0]` from the active-city list. That is
correct on a clean database and silently wrong on a real one: the order is whatever
Postgres returned first, so any stray row with `is_active = true` becomes the
storefront. It bit us immediately — leftover `lm-miss-*` test cities from earlier
schema runs were active, so the homepage served an empty catalogue and every PDP
404'd, with no error anywhere.

**The generalisable rule:** _which city is the shop?_ is an operator decision, not
something to resolve by array order. An ambiguous answer should be loud. Same
reasoning as C-2 — a silent default between two candidate sources of truth is a
defect, not a convenience.

**Also cleaned up:** those test cities had leaked out of earlier runs, which means
a test fixture could leave a row behind that the storefront then serves. Test data
that can become production data is a fixture bug, not a cosmetic one.

---

## 2026-10-05 — Money is coerced at the loader boundary, and non-integral paise throws

**Decision.** `toPaise()` in `src/lib/catalogue/loader.server.ts` converts every
`numeric` money column to integer paise and **throws** `PricingError` if the value is
not a whole number.

**Why.** `pg` returns `numeric` as a string. `formatPaise` then rejects it via
`Number.isInteger`, so prices rendered blank — the build was green, typecheck was
green, and the page was blank. Silent coercion (`Number(x)` at the point of use)
would have worked and been invisible; that is precisely the risk, because a value
that coerces today can stop coercing tomorrow and put a float in a paise column.

Asserting at the boundary keeps the non-negotiable ("money is integer paise, never
floats") true by construction rather than by discipline. A fractional paise value
that ever appears is a bug we want to hear about immediately, not round.

---

## 2026-10-05 — Adversarial stakeholder review, and what it found

Three reviewers were dispatched to attack the app as **customer**, **head of ops +
rider**, and **compliance officer + founder**. All three wrote directly to
Postgres, bypassing every hook and route handler. Findings and their disposition:

### Legal Metrology — was a live breach, now closed

| Finding | Fix |
|---|---|
| **Charging above our own declared MRP.** Seed wrote `base × 1.21`, which is the top planter's *uplift*, not its total. XS SKUs sold **1.83×** the declared MRP, MD SKUs **10.05×** — on the same PDP that declared it. r.6(1)(e), extended online by r.6(10). | `skus_mrp_covers_ladder` trigger recomputes the ladder ceiling in SQL; seed and all 12 rows corrected. This was the single most serious finding. |
| `''` accepted for all five text declarations — a published SKU rendered five of seven declarations as empty. `NOT NULL` does not stop `''`. | `skus_declarations_non_blank`, mirroring the `supplier_batches_bill_is_real` pattern that already existed here. |
| No consumer-care phone/email on the PDP (r.6(2)). | `SiteFooter` renders entity, address, customer care and grievance contacts site-wide. |

### The licence gate — a legal exposure that was one flag-flip away

`cities_live_requires_licence` only read `status`, but `serviceability.ts` gates on
`is_active`. So `UPDATE cities SET is_active = true` made unlicensed Hyderabad
serviceable, and a raw INSERT then wrote a **₹649 order into a city whose Telangana
nursery licence is only `filed`**. Two fixes: `cities_active_requires_live_licence`
(covering `is_active`) and `orders_city_may_trade` (so the order itself checks).

Also: `CityRef` in `serviceability.ts` had **no `licence_status` field at all**, so
the gate never had the value to check even in principle.

### Money — the non-negotiable that wasn't

`AGENTS.md` claimed "A DB CHECK enforces it" about integer paise. True for `skus`,
**entirely absent for `orders`**. Raw writes accepted `revenue_paise = 199.5`,
`-5000`, `orders_items.price_paise = -99999`. Added `orders_money_is_paise`,
`orders_items_price_is_paise`, and a deferred trigger reconciling revenue against
the sum of lines — otherwise `revenue_paise = 999999` on a 1-paise line is legal and
`city_pnl` reports whatever was written.

### Rider pay — the incentive fix was decorative

Monotonicity was correctly enforced, but the review found three holes and one
absurdity: **band coverage need not be contiguous** (a city with only 0–3 and 7–12
was accepted, and `bandForDistance` then threw `NO_MATCHING_BAND` for the whole
3–7km middle — a rider paid nothing); **all bands were deletable**, leaving a live
city that pays nothing; **a single flat band** trivially satisfies monotonicity and
is exactly the structure the thesis exists to reject. And `payForDistance` is called
**only from its own test file** — `loadGeo()` projects the bands and discards them.

No penalty mechanism exists anywhere in the codebase. That is a genuine pass — the
thesis is honestly held.

### What does not exist yet, stated plainly

- **No stock, reservation, TTL, atomic decrement or replay guard.** `orders_items`
  has no `quantity` column, so ordering 3 identical plants is not even expressible.
  The same physical plant can be sold to unlimited concurrent customers.
- **No rider surface**, no `orders.rider_id`, no delivery-proof columns. DELIVERED
  is reachable by a raw INSERT with zero proof — prompt test 1 is not yet satisfied.
- `contribution_paise` is `revenue × 0.25`, hardcoded, and **rider pay is not a
  cost anywhere**. So `city_pnl` is structurally incapable of showing a
  delivery-heavy city as losing — the exact instrument needed to avoid Urvann's
  nine failed launches.
- **DPDP consent architecture does not exist.** `auth.ts` carries a comment
  claiming it does, above an unrelated `accountLinking` config. The comment
  actively misleads a future reader and has been corrected.

### Customer-facing defects found and fixed

- `skuId: "not-a-number"` produced an **unhandled 500 with an empty body** — the
  price-resolution loop sat outside the try. Now validated at the boundary (400).
- An **inactive planter** was silently charged at base price while still persisting
  `planterId`: ops deactivating a pot gave it away. Now refused (409).
- **Every successful order 404'd** — `CartClient` redirected to `/order/[code]`
  and the route did not exist. Added; a customer who paid was told the order failed.
- `lines.some((l) => true)` told a soil-only cart "plants are replaced, not
  refunded". Now states the remedy that matches the cart.

### Two traps worth keeping

**`jsonb_each_text('...'::jsonb)` parses as an OPERATOR in Postgres**
(`operator does not exist: record -> text`). The resulting broken function fired on
every insert and update to `skus`, masking every *other* constraint on the table —
11 tests failed with a message that pointed nowhere near the real cause. A 4-row
lookup table does not need to be clever.

**A backtick inside a `sql\`...\`` comment terminates the template literal.** Cost
two failed migrations with `Expected ")" but found "plantPriceForTier"` pointing at
SQL that was fine.
