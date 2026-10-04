# Stack Decision — Plant Commerce Platform

**Date:** 5 October 2026
**Status:** decided. Binding for all subsequent phases.
**Supersedes:** the stack opinion in `prompt.md` (v1), which asserted Payload without measurement. This document re-derives the conclusion from evidence and records where it would fail.

---

## 1. What we are optimising for

These are the requirements that came out of `research/` and `product/`. They are ordered by how much they actually decide, not by how easy they are to state.

| #      | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                              | Where it comes from                                                                       | Why it constrains the stack                                                                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **The product record is content-and-compliance-shaped, not commerce-shaped.** A SKU is `species × size tier × planter × colour`, plus a care profile (light, water interval, soil-moisture %, toxicity, difficulty), plus seven Legal Metrology declarations including **dimensions**, plus a **per-city seasonal availability matrix**, plus a **traceable supplier batch**. Alongside it: 117 care guides and 175 symptom-first pages. | `product-design.md` §2.4, §3.2; `use-cases.md` §8; `india-compliance-and-licensing.md` §3 | A commerce engine models variant/price/inventory well and treats care profile, symptom graph, declaration block, seasonal matrix and batch traceability as bolted-on custom fields with poor admin ergonomics. A content engine inverts that.                                                                     |
| **R2** | **Four of the five surfaces are internal tools.** Customer web, nursery ops console, rider PWA, support console, HQ admin.                                                                                                                                                                                                                                                                                                               | `product-design.md` §3–§6                                                                 | **Narrowed after re-derivation — see the correction below.** The honest claim is that a CMS admin panel covers _HQ governance and catalogue authoring_ (compliance-heavy CRUD), and does **not** cover the packing bench or the rider surface, which need purpose-built UI regardless.                            |
| **R3** | **Three business rules must be enforced in the schema/DB layer, not application code** — delivery proof gate (4 fields before DELIVERED), batch traceability before publish, pincode+city gate. `product-design.md` §7 states this explicitly; the spike spec calls application-code-only enforcement **a fail**.                                                                                                                        | Part 3 rules 9, 11, 12                                                                    | The question is not "can we write a trigger" but **"who owns the DDL"**. If the framework's migration system owns the schema _and_ our constraints, there is one DDL history that cannot drift. If the framework owns the tables and we own the constraints, there are two migration runners and they will drift. |
| **R4** | **Operational budget is one founder, one city at launch, seasonal scarcity.** Infra cost is weighted **4× a domain-code cost** when comparing stacks (stated in `spike-spec.md` §4 and required by C-5).                                                                                                                                                                                                                                 | Part 2 C-5; `business-model.md` §8                                                        | Any additional long-running process or datastore must save 4× its carrying cost in domain code.                                                                                                                                                                                                                   |
| **R5** | **Multi-city from day one, configuration-only, with isolatable city P&L.** A new city must cost zero code changes.                                                                                                                                                                                                                                                                                                                       | `product-design.md` §1; `use-cases.md` §6 (A-16/A-17, nine failed Urvann launches)        | Needs `city` on every per-city entity, city-scoped queries, and an admin surface to switch a city on/off. Favours stacks with a first-class admin and a boring relational store.                                                                                                                                  |
| **R6** | **Customer identity is owned by exactly ONE system (C-1).** And it must be **separate from staff identity**.                                                                                                                                                                                                                                                                                                                             | Part 5                                                                                    | See §5. This is the constraint most likely to be violated by accident, and it is decided _here_, before any auth code exists.                                                                                                                                                                                     |
| **R7** | **The customer identity primitive is phone + OTP, not email + password.** Support is WhatsApp-first with a <15 min SLA; the buyer is a rented flat in one city; DPDP consent must be captured at signup.                                                                                                                                                                                                                                 | `product-design.md` §5; `founder-documents-checklist.md` §3.3.4                           | Phone-number identity is a first-class capability in some auth libraries and an afterthought in others. Picking a stack whose admin auth is email/password and bolting OTP on later is a real cost.                                                                                                               |
| **R8** | **No COD, free delivery, no minimum order, prepaid-only, no coupons at launch.** The commerce surface is unusually small.                                                                                                                                                                                                                                                                                                                | Part 3 rule 1; `concept.md` §3                                                            | The main thing a mature commerce engine sells is a large, flexible cart/checkout/promotion surface. We need a small one, correctly built.                                                                                                                                                                         |
| **R9** | **Postgres 18 is the production target. Schema changes go through migrations. Never `push: true`.**                                                                                                                                                                                                                                                                                                                                      | C-3, C-4                                                                                  | Narrows the field to stacks with a first-class Postgres migration story.                                                                                                                                                                                                                                          |

### What is _not_ on this list, deliberately

- **Time-to-market in days.** The business has a 12–18 month density ramp (`business-model.md` §9). There is no prize for being first to a broken invariant.
- **Multi-region, multi-currency, tax nexus, B2B catalogue, marketplace channel sync.** All real eventually, none load-bearing at launch. A stack is not disqualified for handling them badly later.
- **"Best-in-class commerce".** R8 says we do not want best-in-class commerce. We want correct small commerce.

---

## 2. Candidates evaluated

### A. Next.js 16 + Payload CMS 3.x

One process. Postgres 18 + S3-compatible object storage. Payload owns the schema, the admin panel, the REST/GraphQL API, and staff auth.

- **Buys:** native content-shaped product record (R1); a real admin panel covering nursery ops, HQ catalogue governance, compliance audit and city on/off (R2, R5); Payload's migration system owning _both_ collection DDL and our hand-written triggers/CHECKs, so **one DDL history** (R3); no extra process or datastore (R4).
- **Costs:** cart, checkout and order lifecycle are ours to build (mitigated by R8 — the surface is small); the admin panel is generic-CRUD, so the _tablet_ ergonomics the packing bench needs (`product-design.md` §3.3: large targets, one item per card, mandatory bench photo before "packed") need custom pages inside the same app; no native phone-OTP auth (we add better-auth — see §5).

### B. Next.js 16 + Medusa 2.x

Three processes (storefront, Medusa server, Medusa worker) plus Redis, Postgres and S3.

- **Buys:** genuinely strong cart, promotion engine, order state machine, inventory/reservation module, region-aware pricing; a subscription module.
- **Costs, in order of weight:**
  1. **+2 long-running processes and +1 datastore** (R4). Redis must be operated, secured, backed up and paid for, for the life of the business. Under the ×4 weighting this must be repaid 4× in domain code.
  2. **It cannot repay it, because R8 says our cart is small.** Free delivery, no minimum, no COD, prepaid-only, no coupons at launch. The promotion engine and flexible-cart machinery is precisely what we are not buying.
  3. **R3 breaks in the worst place.** Medusa's module system owns the product and order tables. Business rules 9/11/12 must be DB-level. So the constraints live in a second migration runner we maintain, alongside Medusa's. That is the drift risk C-5 exists to prevent, introduced on day one, in the three rules the business cannot survive getting wrong.
  4. **R1 inverts.** Medusa's Product/Variant model is optimised for variant/price/inventory. The care profile, symptom graph, seven-field declaration block, per-city seasonal matrix and supplier batch become custom fields — and conditional-required ergonomics ("dimensions required for plants, not for planters") are poor, which is rule 10's whole point.
  5. **Its strongest pull lands in Phase 6 and does not fit.** The subscription module is the best argument for Medusa. But our refill cadence is ~45 days, **plant-optional, skippable, with heat-window (Mar–Jun, 40–46°C) skips** — `use-cases.md` §13 item 4 records that no pause/skip mechanism is specified at all. That is a bespoke scheduling problem, not a fixed-interval recurring-billing problem.

### C. Payload for CMS/content + Medusa for commerce

An officially supported split.

- **Rejected under C-2, and the reasoning is not "it's more work".** With Payload owning care content and Medusa owning products/orders, the split is defensible _only_ if exactly one of them owns the product record. The moment both can write a product, we own a permanent reconciliation surface — and the sync's failure mode is two divergent SKUs, one of which is on a live PDP carrying a Legal Metrology declaration. That is a compliance defect, not a data annoyance.
- The narrow version — Payload owns catalogue + orders, Medusa owns _only_ cart/checkout — is a solution to a problem we do not have, because our cart is one plant plus one planter variant (R8).

### D. Alternatives I looked for and did not find a better fit in

- **D1 · Next.js + Drizzle/Prisma + Postgres, no CMS.** One process, minimal infra, total control. Rejected on **R2**: four internal surfaces must then be hand-built CRUD with hand-built role scoping, and we would rebuild — worse — the admin panel Payload gives away. Honest framing: this is the cheapest to _start_ and the most expensive in founder-hours across the 12–18 month density ramp. For a one-founder team that trade is bad.
- **D2 · Saleor.** Separate Python process + Redis + worker. Strictly worse on R4, and no better on R1.
- **D3 · Shopify / Medusa-as-a-service / any hosted commerce.** Fails R3 outright — we cannot enforce business rules 9/11/12 in the schema of a platform we do not control, and rule 9's "no auto-complete, ever" is the anti-fraud core.

---

## 3. Recommendation

> **A, extended: Next.js 16 App Router + Payload CMS 3.x, with all business invariants expressed as hand-written SQL inside Payload's own migration directory, and better-auth mounted in the same Next process as the sole owner of customer identity.**

One process. One database. One DDL history. Two auth systems with **disjoint subjects** (staff vs customer) and no projection between them.

### The reasoning that decided it

Not "Payload is better than Medusa" — that is not the argument, and §4 has to carry the weight.

The deciding argument is **R3 combined with R4**:

1. Three of our rules must be enforced by the database, because a rule enforced only in application code is bypassable by a direct write, a second code path, or a bug — and the spike spec already ruled that a fail.
2. The rule that decides DELIVERED (four proof fields) is _the_ anti-fraud invariant. Urvann's publicly-filed 3PL agreement pays ₹65/order regardless of distance and penalises fake delivery marking at ₹100 — the penalty exists because the pay structure makes lying rational. Our entire differentiation is that we removed the incentive and keep the audit trail anyway. **We are going to spend the credibility of the whole business on that one invariant being real.**
3. So the enforcement layer must be owned by whoever owns the schema. In Payload, `src/migrations/` holds both the generated collection DDL and our triggers/CHECK constraints, applied by one runner, tracked in one table. In Medusa, the product and order tables belong to Medusa's modules, so our constraints need a second, hand-rolled migration path running beside Medusa's own — for the three rules we cannot afford to get wrong, in the one framework whose module upgrades touch those exact tables.
4. That risk is not priced by "how many lines is a trigger". It is priced by R4: it is an on-call item and an upgrade hazard **for the life of the business**, which is exactly what the ×4 weighting exists to capture.

R2 (the admin panel) is the second reason and it is close behind: with one founder and three internal surfaces to staff, an admin panel that already handles role scoping, relationship browsing and city-scoped collections is worth more than a mature cart we are forbidden to using.

---

## 3a. Two corrections to this document, made on independent re-derivation

This decision was first drafted by reading the reference repo and reasoning
outward from it. Re-derived from the business itself — without the reference repo
as a starting point — two claims did not survive. Both corrections are recorded
here rather than quietly edited in, because the first draft's reasoning is the
evidence for why the conclusion still holds.

### Correction 1 — R2 was overstated, and the stack conclusion survives anyway

The first draft claimed the admin panel was worth more than a mature cart
"because four internal surfaces are internal tools". **That is wrong in a way
that matters.** Re-reading `product-design.md` §3.3 and §4.2 as design work
rather than as a feature list:

- The **packing bench** (§3.3) is a single-item, large-target, wet-hands,
  mandatory-photo-before-enable flow on a tablet. A generic CRUD list cannot
  express "one tap → next item" or a button that is _disabled_ until a photo
  exists. This is custom UI in any stack.
- The **delivery confirmation screen** (§4.2) is the anti-fraud core: four proof
  fields, no auto-complete, offline queue. It is not an admin panel at all — it
  is a purpose-built PWA that happens to write to the database.

So a CMS admin panel covers **HQ governance and catalogue authoring** — which
_is_ substantial (Legal Metrology declaration audit, city lifecycle gates, the
per-city seasonal matrix, the price book), and genuinely is compliance-heavy
CRUD — but it covers **none** of the two highest-stakes internal surfaces. Both
are custom regardless of stack.

**What this changes:** R2 is a real but _smaller_ reason than the first draft
claimed. A CMS admin panel is worth having for governance and authoring; it is
not a substitute for the ops tooling, and no stack should be chosen on the
promise that it is.

**Why the conclusion survives:** R2 was never load-bearing. R3 — who owns the
DDL for the three schema-layer invariants — decided this on its own, and R4
(pricing infra at 4×) independently confirms it. If R2 were deleted entirely,
Payload still wins. That is worth stating plainly, because a decision that
depends on its second reason is not a decision.

### Correction 2 — the reference repo was a liability, and this document is better for discarding it

The first draft leaned on the reference repo for: dev-services, Makefile shape,
stock pattern, pincode cache, the Payload/Next integration gotchas, and — most
damagingly — as tacit evidence that Payload "must be right if a competent team
chose it here too". That last move is exactly the anchoring the prompt's author
was trying to avoid when they wrote v2.

Discarded and re-derived from this business's own constraints, several things
changed:

| Re-derived conclusion                                                                                                                                                                                                                                                                                     | Reference repo would have said                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The ops domain is not a CMS concern at all.** Packing bench, delivery runs, wave assignment and the proof gate are a _dispatch_ domain with its own invariants (TTL reservations, atomic decrement, per-drop pay, offline sync). It deserves a domain layer with real unit tests, not collection hooks. | Put it all in Payload collections with hooks — which is what Shayga does, and which is precisely why Shayga's stock code is read-then-clamp and not atomic.          |
| **Rider pay banding is a first-class invariant, not a price-book field.** It gets its own module, its own tests, and a DB-level guard, because it is the structural difference between us and a 2.1/5 operator.                                                                                           | A price field.                                                                                                                                                       |
| **Zones are derived from bands, not the reverse.** A pincode's band determines its zone; the zone is a _label_ for the band plus capacity, not the primitive.                                                                                                                                             | Pincode → zone → band, as an admin-authored chain. That ordering makes the operator assign a band by picking a zone name, which is how a mis-banded pincode happens. |
| **Money is integer paise everywhere.** No floats, no rupees-as-decimal.                                                                                                                                                                                                                                   | Same, but reached by copying rather than by deciding.                                                                                                                |
| **The city P&L must be isolatable to kill a city** (Urvann's nine failed launches). That means city-scoped _every_ table plus a DB view, not an app-level filter that someone can forget.                                                                                                                 | `city_pnl` as a collection.                                                                                                                                          |

The last one is the clearest example of the pattern: a collection called
`city_pnl` invites someone to write a row. A **view** over city-scoped orders
cannot be written to by accident, so killing a city is a `status` change rather
than an act of bookkeeping discipline.

**Net effect:** the recommendation is unchanged — Next.js + Payload + better-auth,
one process — but it is now argued from our constraints, with the reference repo
demoted to a **source of solved infrastructure problems only** (§8), never as
evidence for the architecture.

### Why not simply "Payload, same as the reference repo"

The reference repo (`shayga-website`) uses Payload. That is not a reason — it is a coincidence of a similar founder. The two independent reasons it is right here are **R1** (our record is content-and-compliance-shaped; theirs is textile-catalogued with a care/compliance overlay, and even there Payload was the right call for the same R1 reason) and **R3** (one migration runner). If Payload were commerce-shaped and constraint-hostile, R1+R3 would point at Medusa instead.

### Applying the ×4 infra weighting explicitly

Per C-5, infra cost is weighted 4× a domain-code cost. Applied:

|                          | Payload plan | Medusa plan                                                                                             | Delta  |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------- | ------ |
| Long-running processes   | 1            | 3                                                                                                       | **+2** |
| Datastores               | Postgres, S3 | Postgres, **Redis**, S3                                                                                 | **+1** |
| Migration runners        | 1            | 2                                                                                                       | **+1** |
| Domain code Medusa saves | —            | cart + promotions + order admin: a few hundred lines, against a surface (R8) we deliberately kept small | —      |

Weighted, Medusa's extra surface is ~9 infra-weighted units against a few hundred lines of saved domain code. **It does not clear the bar, and the margin is not close.** Medusa's saving is real but small _because_ we designed the commerce surface to be small.

---

## 4. What was explicitly rejected, and why

| Rejected                              | Reason                                                                                                                                                                                                                  | Would we revisit?                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Medusa 2.x (B)**                    | +2 processes, +Redis, +2 migration runners; cannot repay under ×4 weighting given a deliberately small cart (R8); constraint enforcement lands in a second migration path (R3); product record is the wrong shape (R1). | Only if the refill cadence (Phase 6) resolves into general recurring billing _and_ we find we need a second process anyway. |
| **Payload + Medusa split (C)**        | Violates C-2 — two systems able to write the product record, with a compliance-bearing divergence failure mode.                                                                                                         | Only if Medusa owned cart only and Payload owned catalogue+orders. Not needed at R8.                                        |
| **No-CMS (D1)**                       | Four internal surfaces become hand-built CRUD. Cheapest to start, most expensive over the density ramp.                                                                                                                 | If the founder hires a dedicated ops team and the internal surfaces become genuinely custom software.                       |
| **Saleor (D2)**                       | Separate Python process + Redis + worker; no product-record advantage.                                                                                                                                                  | No.                                                                                                                         |
| **Hosted commerce (D3)**              | Cannot enforce rules 9/11/12 in a schema we do not own.                                                                                                                                                                 | No.                                                                                                                         |
| **Redis for cart sessions / caching** | C-5 and C-6. Phase 0 needs no cache; `pincode-cache.ts`'s bounded in-process LRU is the right size for it.                                                                                                              | When a measured load test says so, with the number attached.                                                                |
| **A dedicated queue/worker**          | C-5. Nothing in Phases 0–3 is long-running. Cart-time reservation TTL is swept by a query, not a cron.                                                                                                                  | Phase 4 (WhatsApp webhooks) or Phase 6 (subscription scheduling) — named, not pre-built.                                    |
| **Mobile app**                        | Part 3 rule 7. Rider and customer surfaces are responsive web / PWA.                                                                                                                                                    | Never.                                                                                                                      |

---

## 5. Auth architecture (Part 5 / C-1 / R6 / R7)

> **Question answered: where does the single customer identity live, and how do admin/staff identities differ from customer identities?**

### The design in one line

**Customer identity is owned outright by `better-auth`, in its own tables, with no projection into Payload. Staff identity is owned outright by Payload's own auth collection. Neither system stores a copy of the other's identity fields, and no sync job exists between them.**

```
CUSTOMER SIDE                        STAFF SIDE
─────────────                        ───────────
better-auth                          Payload `Users` collection
  user  (id, phone, name)              (id, email, passwordHash, role)
  session / account / verification     Payload-owned session cookie
        ▲                                      ▲
        │  FK: orders.customer_id            │  Payload access control
        │  → user.id (TEXT)                   │  on every collection
   ┌────┴──────────────┐                     │
   │ orders            │◄────────────────────┘
   │ addresses (snapshot)│   admin reads orders directly
   │ carts              │   read-through for customer context
   │ claims             │
   │ consents (DPDP)    │──▶ support console (Next.js, not Payload admin)
   └───────────────────┘
```

### Where each identity lives, and why

| Concern                                                                        | Owner                                                                          | Why this owner                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer identity (phone, name, verified OTP)                                  | **better-auth**, tables `user` / `session` / `account` / `verification`        | R7: phone + OTP is the correct primitive for a WhatsApp-first, rented-flat, one-city buyer. Email/password is the wrong primitive and DPDP consent has to attach at signup. Also lets us add passkeys/2FA later for corporate-buyer accounts without a second customer store. |
| Customer profile attributes we own (quiz answers, care profile, pet/kid flags) | **Payload**, on `customer_profiles`, keyed `customer_id`                       | These are _product_ facts about a plant-buying household, not identity. They are not email/phone/name and cannot be used to log in. Deliberately: this is the only table besides better-auth's that references a customer, and it holds no credential and no contact field.   |
| Staff/admin identity                                                           | **Payload `Users`**, its own auth collection                                   | Explicitly permitted: framework-internal staff auth is not a second _customer_ identity source. Riders are staff (own fleet) and live here too, with a `rider` role scoped to their assigned run.                                                                             |
| Staff sign-in method                                                           | Local credentials now; Payload's auth strategy is swappable for OIDC/SSO later | One founder means no employer IdP today. Because the two subjects are already separate systems, swapping staff auth later cannot touch customer identity.                                                                                                                     |

### Why there is no `Customers` collection (the deliberate divergence from Shayga)

Shayga runs three identity surfaces: `better-auth`'s user model, Payload's `Users`, and a `Customers` collection linked by `betterAuthUserId`. **That is the shape C-1 warns about, and we are not copying it.** A Payload `Customers` collection would be a second table holding `email`, `phone` and `name` — a mirror of identity fields, kept in sync by a job. Mirrors are permanent operational surface (Part 5), and the sync's failure mode is two customer records, which is the exact bug C-1 exists to prevent.

Instead:

- **No Payload collection declares a customer contact field.** There is no place in the schema for a second customer record to be born.
- Customer-referencing Payload tables store `customer_id` as a **plain text column with a real foreign key** to `better-auth`'s `user.id`, created in our migrations. Not a Payload `relationship` — a relationship needs a Payload collection to point at, and pointing at a mirror is what creates the mirror.
- **One DDL history still holds.** The FK is created in `src/migrations/`, the same runner that applies collection DDL. C-2 and C-1 are both enforced by schema, not by convention.

### The projection question, answered explicitly (Part 5 requires naming it)

**There is no projection and no sync job.** Stating the absence precisely, because Part 5 asks for subject/trigger/failure-mode where one exists:

- **No identity projection exists.** better-auth is the only writer of `user`.
- **What exists instead is a read-through**, not a copy: a server-side helper `getCustomerContext(customerId)` that reads from better-auth on demand for the support console and order screens. It stores nothing. If it fails, the order screen still renders (the order carries its own address snapshot); only the optional context panel degrades. **Lagging is impossible because nothing is cached.**
- **One boundary that looks like a mirror and is not:** an order's `address` is a point-in-time fulfilment and legal record of where goods were delivered (required for Consumer Protection (E-Commerce) Rules 2020 disclosures and for claims adjudication). It is a transaction record, not an identity record. It is immutable and never read as identity. Flagged here so a future reader does not "tidy" it into a customer mirror.

### The C-1 test (Part 4 test #12)

Proves exactly one customer record can exist. Asserts, against the live Postgres 18 schema and the running app:

1. **Exactly one table in the database carries customer identity columns** (`phone`, `email`, `name` as identity). Discovered by querying `information_schema.columns` for the identity-bearing column set — not by a hardcoded table name, so adding a second one fails the test.
2. **`orders.customer_id` has a real FK** to that table's `id`, confirmed in `information_schema` — not merely a convention in application code.
3. **No Payload collection schema declares a customer contact field.** Asserted over the generated Payload types/collection configs.
4. **better-auth's own uniqueness holds**: a duplicate verified phone cannot create a second `user` row.
5. **No application code path inserts into the customer table** except better-auth's signup. Asserted by attempting signup twice with one phone and observing one row.

Test 1 is the important one — it is the assertion that fails in month three if anyone adds a `Customers` collection "just for the support console".

---

## 6. What would change my mind

Stated in advance so this decision can be falsified rather than defended.

| #      | Signal                                                                                                                                                                                                                                                                                                       | Why it flips the decision                                                                                                                                                | How we would detect it                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **F1** | **The refill subscription (Phase 6) resolves into general recurring billing** — proration, dunning, failed-mandate recovery, per-city tax — _and_ we conclude we need a background worker anyway for it.                                                                                                     | At that point a worker process and Redis are already paid for, Medusa's ×4 debt is pre-paid, and its subscription module becomes free capability rather than a purchase. | Written refill requirements spec, reviewed **before Phase 5 ends**. Not a vibe check in Phase 6.                         |
| **F2** | **The catalogue becomes supplies-first.** If we follow the TrustBasket/Paudhewale path — plants as marketing, planters/soil/fertiliser as the business — the record shifts toward variant/price/inventory and away from care content, symptom pages and per-species compliance. Content-native stops paying. | Annual revenue split shows supplies > 60% of revenue.                                                                                                                    | Already instrumented: the city P&L dashboard (Phase 0) splits revenue by item class.                                     |
| **F3** | **Payload's admin stops covering the internal surfaces** — if the rider PWA and support console become the _only_ internal tools and HQ catalogue governance is dropped, R2's admin-panel advantage largely evaporates.                                                                                      | R2 is the second-largest reason; losing it makes the Medusa comparison much closer.                                                                                      | If a build phase ends with us hand-writing an admin screen that Payload could plausibly have hosted, that is the signal. |
| **F4** | **Payload 3.x + Next 16 stops being one deployable process** — e.g. Payload's admin moves to a separate service, or Next requires a dedicated worker for our routes.                                                                                                                                         | C-7 and R4 both break. The whole recommendation rests on one process.                                                                                                    | Watch the Payload release notes at each upgrade; the deploy is one container and this is checkable in CI.                |
| **F5** | **We hire a dedicated ops team.**                                                                                                                                                                                                                                                                            | The admin panel's founder-hour saving matters much less; a mature commerce engine's role-based workflows start to pay.                                                   | Headcount.                                                                                                               |
| **F6** | **Measured: Medusa cuts total custom domain code by >40% _including_ the infra it demands**, per the spike's pre-stated rule.                                                                                                                                                                                | The spike's own decision rule would then say Medusa. We have not run the spike; this is the one condition under which it should be run.                                  | Run `spike-spec.md` as written. Its §7 tie-break already defaults to Payload.                                            |

**F1 and F2 are the two that will actually fire.** F1 has a hard deadline — the refill spec must be written before Phase 5 ends, because after that the decision stops being cheap.

---

## 7. Constraints: how each is satisfied

| Constraint                                                | How                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C-1** one customer identity owner                       | better-auth owns `user`; no Payload collection has a contact field; FK from `orders.customer_id`; §5 test suite. No projection, no sync job.                           |
| **C-2** no second source of truth for the product record  | Single backend. Payload owns species, SKU, price book, orders, stock, claims. Nothing else may write them.                                                             |
| **C-3** migrations only                                   | `push: false`. All DDL — generated _and_ hand-written triggers/CHECKs — lives in `src/migrations/`, one runner.                                                        |
| **C-4** Postgres 18                                       | `infra/dev-services.yml` uses `postgres:18-alpine`, matching production.                                                                                               |
| **C-5** minimise long-running processes and new services  | **One process, two datastores (Postgres + S3), zero extra services.** Redis: no. Queue/worker: no. Cache: in-process bounded LRU. Infra weighted 4× in §3 as required. |
| **C-6** local Docker Compose on the existing dev services | Copy `infra/dev-services.yml` from the reference repo verbatim (RustFS, not MinIO — see §8), retarget names and credentials. **No new service added.**                 |
| **C-7** one Next.js 16 App Router process                 | Next + Payload + better-auth in one process. No departure to justify.                                                                                                  |

---

## 8. Inherited from the reference repo — and one place we do _not_ inherit it

Read `AGENTS.md` and `.impeccable.md` in full first, as instructed. Both contain constraints that cost hours to rediscover.

**Inherited:**

| What                                                                                                    | Why                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `infra/dev-services.yml` — **RustFS, not MinIO**                                                        | The `minio/minio` and `minio/mc` Docker Hub repos were **deleted outright**; the old image cannot be fetched at all and `make infra-up` fails. RustFS is S3-API-compatible and still published. **Note: RustFS does not auto-create buckets** — the bucket must be created once against the S3 API before seeding. |
| Postgres 18 Alpine volume gotcha                                                                        | `PGDATA=/var/lib/postgresql/pgdata` with the volume at `/var/lib/postgresql`, **not** `/var/lib/postgresql/data`. Otherwise PG restart-loops.                                                                                                                                                                      |
| `importMap.js` must be pure JS at `src/app/(payload)/admin/importMap.js`                                | Not at `(payload)/importMap.js`, and not TypeScript.                                                                                                                                                                                                                                                               |
| Admin panel SSR returns HTTP 500                                                                        | Known Payload 3.85 + Next 16 edge case; REST API is fine. Create the first admin user via `POST /api/users/first-register`.                                                                                                                                                                                        |
| `push: false`, always migrations; `@payloadcms/ui` must be a direct dependency                          | pnpm strict mode will not resolve it transitively.                                                                                                                                                                                                                                                                 |
| Makefile target shape, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `make ci-local` | Test + lint harness, already tuned.                                                                                                                                                                                                                                                                                |
| `next dev --webpack` (not Turbopack)                                                                    | Payload's admin build path.                                                                                                                                                                                                                                                                                        |
| Razorpay signature verification files, pincode cache, order-status emails                               | Directly reusable — we use the same gateway and the same prepaid-only flow.                                                                                                                                                                                                                                        |

**Deliberately NOT inherited:**

| Not inherited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The stock pattern as-is.** The reference is described as "a validated pattern" for _cart-time reservation with TTL, atomic decrement, replay-guarded, auditable ledger_. **Read it, it does not do that.** `src/lib/stock.ts` exports `applyStockDecrement`/`applyStockRestore` (pure variant arithmetic, correct and worth copying) and `validateCartStock` — which is **read-then-clamp, so it is not atomic**: two concurrent checkouts can both pass validation and both proceed. `StockMovements` is a genuinely good append-only ledger. There is **no TTL reservation, no row lock, no idempotency or replay guard.** We inherit the ledger shape and the pure arithmetic, and we **write the atomic decrement, the TTL reservation and the replay guard ourselves.** Flagged because copying it believing the description would put a double-sell in production. |
| The Shayga brand (`.impeccable.md` — sarees, Sabyasachi minimalism, amber/saffron)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Wrong business entirely. Our design context gets written fresh when we have brand direction. The _structural_ conventions worth keeping: OKLCH tokens via Tailwind v4 `@theme` blocks (not `tailwind.config.ts`), no `border-left` > 1px accent stripes, no gradient text, 4pt spacing scale. |
| Shopify sync, Delhivery courier integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | We use our own riders — own fleet is the entire freight thesis (`concept.md` §2.1).                                                                                                                                                                                                           |
| Textile collections (`Weaves`, `Occasions`, `Brands`, `FabricTypes`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Wrong domain.                                                                                                                                                                                                                                                                                 |
| Better Auth's Firebase plugin + passkeys + 2FA config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Available if we later want an external customer IdP (which would let us delete even the read-through). Not configured at launch — one dependency the stack already solves is one dependency we don't add.                                                                                     |

---

## 9. Open questions carried into the build

`use-cases.md` §13 lists eight unresolved questions. Phase 0 touches two of them; both are recorded here rather than silently answered.

| #   | Question                                                                                 | Phase 0 handling                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stock-out mid-order — what substitutes, notifies, refunds                                | **Deferred.** No fallback rule specified in the docs; inventing one silently would violate Part 8. Must be decided before Phase 1 checkout.                                                                                      |
| 2   | Rider no-show / customer unreachable — OTP proof impossible, order has no terminal state | **Deferred**, but Phase 3's proof gate must not make this unreachable-by-construction. Design constraint noted now.                                                                                                              |
| 7   | Guarantee-terms versioning has no state-machine or consent artefact                      | **Partially resolved by this decision:** the guarantee tier lives in the price book (configuration, `use-cases.md` §11), and a per-order snapshot of the agreed terms is a row we will write. The consent artefact remains open. |

Per Part 8, where the design docs are ambiguous we take the more conservative option and say so. The one place that bites in Phase 0: **`concept.md` §3 and `product-design.md` §2.6 both still advertise a "90-day survival guarantee", while `use-cases.md` §11 (revision of 4 Oct 2026) tiers it to T0 = 48h at launch.** We follow the **tiered** rule — T0 = 48h, T1/T2 behind flags defaulting OFF — and treat the 90-day figure in the older documents as superseded. Part 3 rule 4 and the "do not ship a 90-day promise" instruction are unambiguous.

---

_Decision made 5 October 2026, before any application code. Falsifiers in §6 are the review agenda at the Phase 5 checkpoint; F1 has a hard deadline there._
