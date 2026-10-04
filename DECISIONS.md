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
