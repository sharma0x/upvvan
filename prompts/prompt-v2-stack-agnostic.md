# Prompt — build the plant commerce platform (stack-agnostic)

> **How to use:** paste the block below into a coding agent (Claude Code, Codex, OpenCode).
> **Supersedes `prompt.md` (v1).** v1 mandated Payload. This version hands over the requirements, constraints, evidence and reference repo — then makes **the stack decision the agent's first deliverable, with written reasoning, before any code.**

---

## THE PROMPT

```markdown
# Task

Build the end-to-end website for a new Indian D2C plant business.

We have completed business design, competitive research, a product design, and 10
use-case diagrams. **You will choose the technology stack.** We are not telling
you what to use.

This is NOT a demo. It is production-intended code.

---

## PART 1 — Read the design documents before anything else

These are the source of truth for the _product_. Read all in full.

| Path                                                                                            | What it gives you                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/Users/princesharma74/Documents/Development/upvvan/research/business-model.md`                 | Revenue lines, unit economics, rider incentive design                    |
| `/Users/princesharma74/Documents/Development/upvvan/research/concept.md`                        | Positioning, phasing, what we refuse to build                            |
| `/Users/princesharma74/Documents/Development/upvvan/research/founder-documents-checklist.md`    | Legal obligations + 4 pre-launch kill-switches                           |
| `/Users/princesharma74/Documents/Development/upvvan/research/india-compliance-and-licensing.md` | Statute-level compliance requirements                                    |
| `/Users/princesharma74/Documents/Development/upvvan/research/india-plant-shipping-and-ops.md`   | Freight economics, COD/RTO, unit-economics model                         |
| `/Users/princesharma74/Documents/Development/upvvan/product/product-design.md`                  | 5-surface screen spec, data model, build order                           |
| `/Users/princesharma74/Documents/Development/upvvan/product/use-cases.md`                       | 10 use-case diagrams, state machine, guarantee tiering, 8 open questions |
| `/Users/princesharma74/Documents/Development/upvvan/spike-spec.md`                              | An open question about stack choice — you are resolving it               |

---

## PART 2 — Choose the stack, and justify it in writing FIRST

### Your first deliverable is a stack decision document

Write `STACK-DECISION.md` before any code. It must contain:

1. **The requirements you're optimising for**, derived from Part 1 — not a generic checklist
2. **At least three candidate stacks**, with what each costs and buys
3. **Your recommendation, with the reasoning that decided it**
4. **What you explicitly rejected and why** — a rejected option with no stated reason is not a decision
5. **What would change your mind** — the signal that would flip the choice
6. **The auth architecture**, explicitly. Read Part 5 before writing this section.

### Non-negotiable constraints

**C-1 · Customer identity must be owned by exactly ONE system.**
See Part 5. This is the constraint most likely to be violated by accident.

**C-2 · No second source of truth for the product record.**
If two systems can both own products or orders, you must justify the reconciliation
or remove one. Silent dual ownership is a defect, not a design.

**C-3 · Schema changes go through migrations.** Never hand-crafted DDL, never
`push: true` if the CMS offers migrations.

**C-4 · Postgres 18 is the production target.** Do not design around a
different primary datastore.

**C-5 · Minimize long-running processes and new infra services.** Each is a
deployment target and an on-call item for the life of the business. Infra cost
is weighted 4× a domain-code cost when you compare stacks — state this in your
decision doc and apply it.

**C-6 · Must run locally with Docker Compose** using the dev services already
in `infra/dev-services.yml` (Postgres 18, RustFS/S3, Mailpit, Adminer). Adding
Redis or another service is a cost you must name, not hide.

**C-7 · One Next.js 16 App Router process is preferred** for the storefront, on
performance and operational-simplicity grounds. If you depart from this, justify
it.

### Candidate stacks to actually evaluate

Evaluate these — and others if you find better ones:

- **A. Next.js 16 + Payload CMS 3.x** — one process; content-native product record
- **B. Next.js 16 + Medusa 2.x** — commerce-native; requires Postgres + Redis + server + worker
- **C. Payload for CMS/content + Medusa for commerce** — supported by an official
  integration guide, but two backends; needs an explicit split so C-2 holds
- **D. Something else** — if you have a genuinely better fit, propose it and defend it

### Known trade-offs to reason about, not recite

**Product record shape.** Our product is `species × size tier × planter × colour`
with: care profile (light, water, toxicity, difficulty), **Legal Metrology
declarations** (manufacturer address, origin, common name, net quantity, MRP
inclusive of taxes, **dimensions**), a **per-city seasonal availability matrix**,
and a **traceable supplier batch**. That is a content-and-compliance-heavy record.
Weigh which stack models it natively vs which makes it custom.

**Inventory semantics.** Cart-time reservation with TTL, atomic decrement,
replay-guarded, auditable ledger. Shagya has a validated pattern at
`src/lib/stock.ts` + the `StockMovements` collection.

**Multi-city from day one is required** — a new city must be configuration
(no code change), and city P&Ls must be isolatable.

**Complexity budget.** One founder, one city at launch, seasonal scarcity. If a
stack's operational overhead is the thing most likely to fail, weight it heavily.

### Reference repo

`/Users/princesharma74/Documents/Freelancing/Shagya/shagya-website`

**Read `AGENTS.md` and `.impeccable.md` in full first** — they contain
non-obvious constraints (Payload importMap location, Postgres 18 volume gotcha,
admin-panel SSR issue, the MinIO→RustFS outage scar) that will waste hours.

Treat it as a **library of solved problems, not a mandate.** Copy what solves
something here; ignore what doesn't. Notably reusable:

| Path                                                                    | Why                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `infra/dev-services.yml`                                                | RustFS (MinIO images deleted from Docker Hub), Mailpit, Adminer, PG18  |
| `Makefile`                                                              | Full target set — `infra-up`, `ci-local`, `db-migrate`, deploy targets |
| `src/lib/stock.ts` + `StockMovements`                                   | Atomic, idempotent, auditable inventory ledger                         |
| `src/lib/pincode-cache.ts` + `src/app/api/pincode/`                     | Pincode verify + city search                                           |
| `src/lib/razorpay-verify-signature.ts`, `razorpay-webhook-signature.ts` | Webhook signature verification                                         |
| `src/collections/Orders.ts`                                             | Inventory hooks in `afterChange`, order status emails                  |
| `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`         | Test + lint harness                                                    |
| `docs/local-storage.md`, `docs/ci-cd.md`                                | Operational runbooks                                                   |

Do NOT inherit: the Shayga brand, Shopify sync, Delhivery courier integration
(we use our own riders), textile-domain collections (`Weaves`, `Occasions`,
`Brands`).

---

## PART 3 — The business rules (non-negotiable)

1. **No COD anywhere.** Prepaid only. A COD return leg is 25–30 days and the
   plant is unsellable — a total write-off. Don't build a COD affordance "for later".
2. **Plants: replacement only, never cash refund.** Marginal cost is a plant
   already grown. Pots/soil/fertiliser DO get refunded in money within 24h —
   no mortality risk.
3. **Plants are loss-leader acquisition. Refill subscriptions are the business.**
4. **Guarantee window is tiered and configuration-driven — never a hardcoded constant:**
   T0 = 48h from DELIVERED (live at launch); T1 = 30 days (only after ~500
   delivered orders AND a measured DOA rate); T2 = 90 days (only if data supports
   the cost). `use-cases.md` §11 explains why. **Do not ship a 90-day promise.**
5. **March–June is lethal (40–46°C).** Substitute hardy SKUs, never pause.
   Before T1, heat-window deliveries need explicit exclusion wording.
6. **No plant subscription.** Four mature competitors have zero working ones.
   Only refill/consumable subscriptions.
7. **No care app.** Symptom-first content + WhatsApp. Never a mobile app.
8. **Rider pay is per-drop with distance bands** (A 0–3km, B 3–7km, C 7–12km).
   Flat per-order pay is what produced a competitor's 1.4/5 rating.
9. **DELIVERED is unreachable without 4 proof fields:** customer OTP, photo vs
   order ID, plant condition, GPS ping. No auto-complete on proximity.
   **Enforce in the database/schema layer, not application code.**
10. **Every listing carries Legal Metrology declarations, including dimensions
    where size is relevant** — i.e. every plant PDP. Template-level constraint.
11. **A SKU cannot be published without a traceable supplier batch.**
    Enforce structurally.
12. **An order cannot exist for a pincode outside the serviceable set** — and a
    serviceable pincode in a _different city_ must also be rejected.
13. **No FSSAI licence** — ornamentals fail the §2(d) "intended for human
    consumption" test. But **do** implement DPDP consent architecture (substantial
    provisions effective 13 May 2027) and Consumer Protection (E-Commerce)
    Rules 2020 disclosures incl. a named grievance officer.

---

## PART 4 — TDD is mandatory, and "green" is not evidence

**Write the failing test first, watch it fail, then implement.**

A green test that was never seen failing is treated as **no evidence at all**.
Never report a feature as done on typecheck/lint alone. If you claim something
works, show it red before and green after.

Match Shagya conventions: colocated `src/**/__tests__/*.test.ts`, E2E in
`tests/e2e/*.spec.ts`, `make ci-local` for format+lint+typecheck+test+build.

### Tests that must exist and must be seen red first

1. **Delivery proof gate** — DELIVERED unreachable with <4 proof fields.
   **Must fail at the DB/schema layer**, not only in app code. Prove it by
   attempting a direct write.
2. **Order state machine** — legal transitions work; **illegal transitions are
   impossible**.
3. **No-refund-for-plants** — the refund path for a plant item does not exist and
   returns a typed error. Mixed cart: soil refundable in money.
4. **Pincode + city gate** — unserviceable pincode rejected; serviceable pincode
   in another city rejected.
5. **Guarantee tier** — T0 = 48h default; T1/T2 behind a flag defaulting OFF.
6. **Claim window** — 24–48h from DELIVERED; rejection requires a reason code.
7. **Legal Metrology completeness** — PDP missing any mandatory declaration fails;
   dimensions required for plants.
8. **Batch traceability** — SKU with no traceable batch cannot publish.
9. **Rider pay banding** — longer route pays strictly more. **Write this early**;
   it encodes the core incentive fix.
10. **Multi-city isolation** — new city = config only; P&L queries don't leak.
11. **Refill cadence** — 45-day rhythm, plant optional.
12. **Auth single-owner (C-1)** — exactly one system owns customer identity;
    assert no path creates a second customer record.

---

## PART 5 — Auth: the constraint most likely to be violated by accident

**Customer identity is owned by exactly ONE system.** Everything else is a
projection. This is C-1, and it's the one place where complexity compounds
silently.

Reference: Shagya already runs **three** identity surfaces — `better-auth`
(own user model + tables, with email OTP, passkeys, 2FA, phone identity,
optional Firebase), Payload's own `Users` admin collection, and a separate
`Customers` collection linked by `betterAuthUserId`. That works but it is not
simple.

**The question you must answer in `STACK-DECISION.md`:**

> Where does the single customer identity live, and how do admin/staff identities
> differ from customer identities?

Rules:

- **Customer and staff/admin identity are separate concerns.** Staff should be
  able to use their employer's IdP or local credentials without granting
  customers any path into the admin surface.
- **One `customer_id` concept, one owner.** Other systems store a reference to
  it, never a parallel copy of the user's identity fields.
- **Staff admin auth is allowed to be framework-internal** if that framework
  owns it. That is not a second _customer_ identity source.
- **If any projection or sync job is required, name it explicitly** — subject,
  trigger, failure mode, and what happens if it lags.
- **Prefer one system owning customer identity outright** (an external-IdP plugin
  or a single first-party auth) over a first-party auth plus mirrors, because
  mirrors are permanent operational surface.

State your auth design before building it. Then write the C-1 test that proves
exactly one customer record can exist.

---

## PART 6 — Build order

Phase 0 first — everything depends on geo and it's cheapest before there's data.

| Phase | Deliverable                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| **0** | City, pincode (→ zone → distance band → serviceable), city config, price book. CSV import. HQ admin city on/off switch. |
| **1** | Catalogue, PDP with Legal Metrology declarations, cart, prepaid checkout. Plant-finder quiz.                            |
| **2** | Nursery ops console + packing bench with mandatory bench photo. Stock ledger.                                           |
| **3** | Rider surface + 4-field delivery proof. **Not optional, not parallel to 2.**                                            |
| **4** | Support console, WhatsApp-first, <15 min SLA. Care engine, symptom-first content.                                       |
| **5** | Claim engine, reason codes, DOA feedback loop. DPDP + grievance officer.                                                |
| **6** | Refill subscriptions.                                                                                                   |

---

## PART 7 — Domain model (shape, not exact names)

**Global:** species (care data), planter library, colour, care-profile schema,
care guides, symptom pages, guarantee-policy config (tiers), delivery bands.

**Per-city:** city (state, licence, GSTIN, tax, capacity), nurseries,
nursery stock, supplier batches (traceability), zones, pincodes, price books,
refill subscriptions, riders, shifts, delivery runs.

**Per-order:** cart, orders, order items, addresses, delivery proofs, claims,
claim evidence, stock movements, reviews, wishlist, consents (DPDP), grievances.

**Access control:** role × city. A nursery manager sees only their nursery; a
rider sees only their assigned run; support sees the care profile.

**Multi-tenant discipline:** every per-city entity carries `city`, every query
is city-scoped, and the isolation test proves no leak.

---

## PART 8 — Working style

- **Do not add a dependency the chosen stack already solves.** If you add one,
  justify it.
- **No mobile app.** Rider and customer surfaces are responsive web / PWA.
- **Follow the chosen stack's conventions**, not Shagya's, except where we copy
  Shagya files deliberately.
- **When the design docs are ambiguous or contradict each other, say so and pick
  the more conservative option**, then note it. `use-cases.md` §13 lists 8 known-open
  questions — surface them rather than silently inventing answers.
- **Keep a running `DECISIONS.md`** — dated entries for stack choice, auth design,
  any rejected option, any place you deviated from the docs.

## PART 9 — Definition of done

A phase is done only when:

- its tests exist, **were seen failing before implementation**, and now pass
- full CI is green
- it builds for production
- the flow was clicked through in a real browser
- you report what was built, which tests were seen red, and what you left open

## PART 10 — Start here

1. Read Part 1 documents in full.
2. Write `STACK-DECISION.md` per Part 2, including the Part 5 auth answer.
3. Scaffold and get a running local environment.
4. Build Phase 0 with tests seen red first.

**Stop and show me `STACK-DECISION.md` and the Phase 0 scaffold before building
Phase 1.** I want to review the reasoning and the auth design while the decision
is still cheap to change.
```

---

## Notes for you (not part of the prompt)

**What changed from v1 and why it's better:** v1 said "Payload, here are the files." That was me picking a stack on reasoning alone and asking the agent to execute my guess. This version inverts it — the agent evaluates the options, and because the prompt now supplies the _evidence_ (freight economics, product-record shape, the auth constraint, the infra weighting), a competent agent should reach a similar conclusion **for stated reasons rather than by obedience.**

**Three things I deliberately did _not_ do:**

1. **Didn't pre-write a recommendation.** Had I left in "I think Payload," the agent would anchor on it and produce justification rather than analysis. Constraints C-1 and C-5 do the same work as a recommendation, but as _rules_ rather than a _conclusion_.

2. **Didn't hide the MinIO scar or the admin-panel SSR bug.** Those live in the reference repo's `AGENTS.md` and compose comments. If the agent reuses those files it inherits the knowledge; if it doesn't, it re-learns the expensive way.

3. **Didn't let it skip Part 5.** The auth constraint is the one that fails _silently_. A dual-identity bug won't break a build — it'll show up as two customer records in month three. Hence test #12.

**If it comes back with Medusa:** that's a legitimate outcome, not a failure. The question is whether it named Redis and the worker process as costs and still found the commerce machinery worth it. If so, take it — and make sure the C-1 auth design is airtight, because that's where a Medusa choice actually bites.

**If it comes back with "Payload, same as the reference":** check §4 of the decision doc. It should say why _our_ product record shape favoured content-native over commerce-native, not just "the reference repo used it." If that's thin, send it back.
