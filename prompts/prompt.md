# Prompt — build the plant commerce platform

> **How to use this:** paste everything inside the fenced block below into a coding agent (Claude Code, Codex, OpenCode). It is written to be self-contained. Where it points at files, it points at **real files in a real repo** so the agent can read them rather than guess.

---

## THE PROMPT

```markdown
# Task

Build the end-to-end website for a new Indian D2C plant business. We have a
completed business/strategy design, a competitive research corpus, a product
design, and 10 use-case diagrams. Your job is to scaffold the project from a
known-good boilerplate, then implement the product test-first.

This is NOT a demo or a prototype. It is production-intended code.

---

## 1. Read the design documents FIRST — before writing any code

These are the source of truth. Read all of them in full before you begin.

| Path                                                                                            | What it gives you                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/Users/princesharma74/Documents/Development/upvvan/research/business-model.md`                 | The business model: revenue lines, unit economics, rider incentive design                         |
| `/Users/princesharma74/Documents/Development/upvvan/research/concept.md`                        | Positioning, phasing, feature set, refusals                                                       |
| `/Users/princesharma74/Documents/Development/upvvan/research/founder-documents-checklist.md`    | Legal obligations (Legal Metrology, FSSAI, state nursery acts) and the 4 pre-launch kill-switches |
| `/Users/princesharma74/Documents/Development/upvvan/research/india-compliance-and-licensing.md` | Statute-level compliance requirements                                                             |
| `/Users/princesharma74/Documents/Development/upvvan/product/product-design.md`                  | Screen-by-screen spec for 5 surfaces + data model + build order                                   |
| `/Users/princesharma74/Documents/Development/upvvan/product/use-cases.md`                       | 10 Mermaid use-case diagrams, order state machine, guarantee tiering, 8 open questions            |

**Non-negotiable business rules, extracted for you:**

1. **No COD anywhere.** Prepaid only. There is no refund path for plants.
   This is structural — a COD return is 25-30 days and the plant is unsellable.
   Do not build a COD affordance "for later".
2. **Plants: replacement only, never cash refund.** The marginal cost is a
   plant already grown. Pots, soil, fertiliser DO get refunded in money within
   24h — they have no mortality risk.
3. **Plants are loss-leader acquisition. Refill subscriptions are the business.**
4. **The guarantee window is tiered and configuration-driven, never a hardcoded constant:**
   - T0 = 48 hours from DELIVERED (live at launch)
   - T1 = 30 days (only after ~500 delivered orders AND a measured DOA rate)
   - T2 = 90 days (only if measured data supports the cost)

   `use-cases.md` §11 explains why. **Do not ship a 90-day promise.**

5. **March–June is a lethal window (40-46°C).** Substitute hardy SKUs, never
   pause. Before promoting to T1, heat-window deliveries need exclusion wording.
6. **No plant subscription.** Four mature competitors have zero working ones.
   Only refill/consumable subscriptions.
7. **No care app.** Symptom-first content + WhatsApp, never a mobile app.
8. **Rider pay is per-drop with distance bands** (Band A 0-3km, B 3-7km,
   C 7-12km). Flat per-order pay is what produced the competitor's 1.4/5 rating.
9. **Delivery cannot reach DELIVERED without 4 proof fields:** customer OTP,
   photo against order ID, plant condition check, GPS ping at handover.
   No auto-complete on proximity. Enforce this in the schema/DB layer.
10. **Every product listing must carry Legal Metrology declarations** —
    manufacturer/packer address, country of origin, common name, net quantity,
    MRP inclusive of taxes, and **dimensions where size is relevant**
    (i.e. every plant PDP). This is a template constraint, not a per-listing task.
11. **A SKU cannot be published without a traceable supplier batch.** Enforce
    this structurally, not by convention.
12. **An order cannot exist for a pincode outside the serviceable set.**
13. **No FSSAI licence** — ornamental plants fail the §2(d) "intended for
    human consumption" test. But DO implement DPDP consent architecture
    (substantial provisions effective 13 May 2027) and the Consumer Protection
    (E-Commerce) Rules 2020 platform disclosures incl. a grievance officer.

---

## 2. Scaffold from the Shagya boilerplate

Use `/Users/princesharma74/Documents/Freelancing/Shagya/shagya-website` as the
reference repo. **Read its `AGENTS.md` and `.impeccable.md` in full first** —
they contain non-obvious constraints that will waste hours if discovered later.

Copy the boilerplate structure, NOT the brand. Specifically carry over:

**Stack (already validated — do not substitute):**

- Next.js 16 App Router + React 19 + TypeScript strict
- Payload CMS 3.86 (`@payloadcms/next`, `db-postgres`, `storage-s3`,
  `plugin-seo`, `plugin-search`, `plugin-form-builder`, `richtext-lexical`)
- PostgreSQL 18 + Drizzle migrations
- Tailwind v4 (CSS-based `@theme`, NOT `tailwind.config.ts`)
- shadcn/ui + Radix + lucide-react + CVA + tailwind-merge
- Vitest (jsdom) + Playwright + @testing-library
- better-auth, husky, commitlint, semantic-release
- pnpm only (`pnpm@10.1.0`), Node >= 20.9.0

**Carry over these infrastructure files essentially verbatim, renaming brand → our brand:**

- `Makefile` — the full target set (`setup`, `infra-up`, `infra-down`, `dev`,
  `build`, `lint`, `format`, `typecheck`, `test`, `test-e2e`, `ci-local`,
  `db-migrate`, `db-generate-types`, `seed-local`, docker targets, deploy targets)
- `infra/dev-services.yml` — **must keep RustFS, not MinIO.** MinIO's community
  images were deleted from Docker Hub; RustFS is S3-API-compatible and still
  published. Also Mailpit (SMTP 1025 / UI 8025), Adminer (8080), Postgres 18
  with the `PGDATA=/var/lib/postgresql/pgdata` volume-at-`/var/lib/postgresql`
  gotcha.
- `vitest.config.ts`, `vitest.setup.ts`, `vitest.server-only-stub.ts` (coverage
  thresholds at 60%)
- `playwright.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
  `tsconfig.json`, `commitlint.config.cjs`, `release.config.cjs`,
  `.husky/`, `components.json`, `.prettierrc`, `.env.production.example`
- `src/app/(payload)/admin/importMap.js` must stay **pure JS at that exact path**
- `next.config.ts` must wrap with `withPayload()`
- `@payloadcms/ui` must be a **direct** dependency (pnpm strict mode)

**Copy these as REFERENCE, then adapt (do not copy blindly):**

- `src/lib/stock.ts` + the `StockMovements` collection — the synchronous,
  atomic, idempotent decrement/restore ledger pattern is industry-grade and
  worth reusing. But note **we have no order cancellation after dispatch**, so
  the `stockRestored` path is narrower than theirs.
- `src/lib/pincode-cache.ts` + `src/app/api/pincode/` — pincode verify and
  city search. Extend for city zones and distance bands.
- `src/lib/cod-eligibility.ts` — read it to understand the failure mode we are
  avoiding. **Do not reuse the logic**; we are prepaid-only.
- `src/lib/razorpay-verify-signature.ts`, `razorpay-webhook-signature.ts` —
  webhook signature verification. Reuse directly.
- `src/collections/Orders.ts` — inventory-in-`afterChange` pattern, order status
  email dispatch. Reuse the structure.
- `src/lib/access-control.ts` — RBAC helper. Extend with a `city` dimension.
- `src/globals/SiteSettings.ts` + its colocated test — the global-settings pattern.

**Do NOT carry over:** the Shayga brand (`.impeccable.md` colours/fonts — read it
for the _rules_ like OKLCH-only and the banned-font list, then design our own
brand), Shopify sync, Delhivery courier integration (we use own riders),
`Occasions`/`Weaves`/`Brands` collections (textile-domain, irrelevant).

---

## 3. Test-driven development is mandatory

**Every feature: write the failing test first, watch it fail, then implement.**

The user's standing requirement: a green test that was never seen failing is
treated as **no evidence at all**. Never report a feature as done on
typecheck/lint alone. If you claim a fix works, you must have shown the test
red before the fix and green after.

**Test conventions (match the reference repo):**

- Unit + component tests colocated: `src/**/__tests__/*.test.ts`
- E2E in `tests/e2e/*.spec.ts`
- `make ci-local` runs format, lint, typecheck, test, build

**Tests that must exist and must be seen red first:**

1. **Pincode serviceability gate** — an order for a pincode outside the
   serviceable set is REJECTED. Also: a serviceable pincode in a _different
   city_ must be rejected too (this is the multi-city invariant).
2. **Order state machine** — `PLACED → ROUTED → PACKING → PACKED → DISPATCHED →
DELIVERED → RESOLVED`, plus `CLAIM_OPEN/CLAIM_REJECTED/REPLACEMENT_QUEUED`.
   Assert the **illegal** transitions are impossible.
3. **Delivery proof gate** — an order CANNOT reach `DELIVERED` with fewer than
   4 proof fields. Assert the DB/service layer refuses.
4. **No-refund-for-plants** — asserting the refund path for a plant order item
   does not exist and returns a typed error. Mixed cart: soil refundable in money.
5. **Guarantee tier** — T0 computes a 48h window; T1/T2 are gated behind a flag
   that defaults OFF. Assert the default is 48h.
6. **Claim window** — 24–48h from DELIVERED, rejection codes required.
7. **Legal Metrology completeness** — a PDP missing any mandatory declaration
   fails validation. Dimensions required for plants.
8. **Batch traceability** — a SKU with no traceable batch cannot be published.
9. **Rider pay banding** — pay is a function of distance band; assert that a
   longer route pays strictly more. This is the test that encodes our core
   incentive fix, so write it early.
10. **Multi-city isolation** — a new city row changes no code; city P&L queries
    cannot leak across cities.
11. **Refill subscription cadence** — 45-day rhythm, plant optional.

---

## 4. Build order — do not reorder

Phase 0 first because everything depends on geo, and it is cheapest to get right
before there is any data.

| Phase | Deliverable                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | `city`, `pincode_zone` (pin → zone → distance band → serviceable), `city_config`, price book. CSV pincode import. HQ admin city on/off switch. |
| **1** | Customer catalogue, PDP with Legal Metrology declarations, cart, prepaid checkout (Razorpay). Plant-finder quiz.                               |
| **2** | Nursery ops console + packing bench with mandatory bench photo. Stock ledger.                                                                  |
| **3** | Rider app + 4-field delivery proof. **Not optional, not parallel to phase 2.**                                                                 |
| **4** | Support console, WhatsApp-first, <15 min SLA. Care engine with symptom-first content.                                                          |
| **5** | Guarantee claim engine, reason codes, DOA feedback loop. DPDP + grievance officer.                                                             |
| **6** | Refill subscriptions.                                                                                                                          |

---

## 5. Payload collections to model

Global: `SiteSettings`, `GuaranteePolicy` (tier config), `DeliveryBands`, `CareProfileSchema`.

Collections: `Users`, `Customers`, `Species` (global care data), `Products` (SKU =
species × size tier), `Planter`, `Color`, `Variants`, `Categories` (with
`seasonalAvailability` matrix per city), `Nurseries`, `NurseryStock`, `SupplierBatches`
(traceability), `Zones`, `Pincodes`, `Cities`, `PriceBooks`, `Carts`, `Orders`,
`OrderItems`, `Addresses`, `RefillSubscriptions`, `Riders`, `Shifts`,
`DeliveryRuns`, `DeliveryProofs`, `Claims`, `ClaimEvidence`, `StockMovements`,
`Reviews`, `Wishlist`, `CareGuides`, `SymptomPages`, `Media`, `Coupons`,
`Consents` (DPDP), `Grievances`.

Required access control: role × city. A nursery manager sees only their nursery;
a rider sees only their assigned run; support sees the care profile.

---

## 6. Non-negotiable Payload constraints (from the reference repo's AGENTS.md)

- `payload.config.ts` is the single central config.
- Schema push is **disabled** (`push: false`). **Always use migrations**:
  `pnpm payload generate:db-schema` → `pnpm payload migrate:create` → `make db-migrate`
  → `make db-generate-types`. **Never hand-craft SQL tables.**
- `sharp` field must be the imported module, not an options object.
- `secret` is required at the top level.
- `@payload-config` resolves to `./src/payload.config.ts`.
- `payload-types.ts` is generated — regenerate after schema changes.
- Known: the admin panel can 500 during SSR on Payload 3.85+ Next 16. REST works.
  Create the first admin via `POST /api/users/first-register`.
- Postgres 18 Alpine volume gotcha is already handled in the copied compose file.

---

## 7. Five surfaces

1. **Customer** — web + app. Quiz, catalogue, planter-variant PDP, cart, prepaid
   checkout, order tracking, unboxing-video upload, claims, refill subscribe.
2. **Rider** — PWA, offline-capable. Shift/batch view, per-drop pay shown
   upfront, the 4-field delivery proof, earnings + batch-fill bonus.
3. **Nursery ops** — tablet console. Today/wave view, stock, the packing bench
   with mandatory photo, seasonal advisory (Mar–Jun lethal window).
4. **Support** — WhatsApp-first unified inbox, care diagnosis, claim triage at a
   published adjudication gate with reason codes. **Settle in money for
   non-plant items; no wallet-credit deflection.**
5. **HQ admin** — city lifecycle, cross-city P&L, density index, Legal Metrology
   audit, compliance dashboards, pincode management.

---

## 8. Working style

- **pnpm only.** Never npm/yarn.
- Always use `make` targets.
- Conventional Commits; never commit to `main`/`develop` directly.
- Do not add a library the reference repo already solves.
- Do not create a mobile app. The rider and customer surfaces are responsive web/PWA.
- When something in the design docs is ambiguous or the docs contradict
  themselves, **say so and pick the more conservative option**, then note it in
  your summary. `use-cases.md` §13 lists 8 known-open questions — surface any you
  hit rather than silently inventing an answer.

## 9. Definition of done for a phase

A phase is done only when:

- its tests exist, were seen failing before implementation, and now pass
- `make ci-local` is green
- the app builds (`make build`) and the feature was clicked through in a real browser
- you report what was built, which tests were seen red, and what you left open

Start with Phase 0. Show me the scaffolded project and the Phase 0 tests (seen
red) before you go further.
```

---

## Notes for you (not part of the prompt)

**Why I pointed it at Shagya rather than scaffolding fresh:** your repo already solves four things this business needs, and each one took real debugging:

| File                                                | Why it matters here                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/pincode-cache.ts` + `src/app/api/pincode/` | You already have pincode verify + city search. The multi-city zone/distance-band logic is an extension, not a rewrite |
| `src/lib/stock.ts` + `StockMovements`               | Synchronous, atomic, idempotent inventory with a ledger. Worth reusing nearly as-is                                   |
| `src/lib/razorpay-*-signature.ts`                   | Webhook signature verification done properly                                                                          |
| `infra/dev-services.yml`                            | The RustFS-not-MinIO comment is a scar from a real outage. Keeping it saves you the same afternoon                    |

**Two things to check before you paste this:**

1. **`make infra-up` may still be broken.** My notes say MinIO images are gone from Docker Hub and the documented workaround is starting Postgres alone. The compose file already uses RustFS so it should be fine — but verify with `docker compose -f infra/dev-services.yml config` first.

2. **RustFS does not auto-create buckets.** The compose file has an explicit comment that the bucket must be created once against the S3 API before seeding. The agent will hit this on its first media upload. Consider pre-creating the bucket so it doesn't stall.

**One deliberate omission:** I did not include Medusa. You asked for it, but Shagya uses Payload as the backend and Payload already covers catalogue, orders, media, auth and admin. Running Medusa alongside would mean two sources of truth for products and orders — which is precisely the schema-drift problem your own AGENTS.md warns about. If you want Medusa for something specific (promotions, cart recovery, subscriptions), tell me which part and I'll scope just that.
