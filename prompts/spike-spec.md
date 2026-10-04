# Architecture Spike — decide Payload vs Medusa with data

**Date:** 4 Oct 2026
**Type:** half-day throwaway spike (tests `spike` skill discipline: build it to throw it away)
**Question it answers:** is Medusa meaningfully less code than Payload for _our specific_ hard problems, once infra is counted?

---

## 0. Why this exists

The `prompt.md` recommended Payload without Medusa, on the argument that Medusa adds Redis + a separate worker process + a second source of truth for products. That is a _reasoned opinion_, not a measurement. This spike measures it.

**Decision deadline: before Phase 2 of the main build.** Phases 0–1 (geo, catalogue, PDP, cart) are common to both stacks and useful regardless of the outcome.

---

## 1. The spike question, stated precisely

Not "which is better." That is unanswerable. Instead:

> For our four hardest domain problems, how many lines of **custom domain code** does each stack require, once Redis, a worker process, and a second service boundary are counted as cost?

The four problems, in priority order:

| #     | Problem                                                                                                                 | Why it's hard                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A** | **Delivery proof gate** — order cannot reach DELIVERED without 4 fields (OTP, photo vs order ID, plant condition, GPS)  | Core anti-fraud invariant. Must be enforced in DB/schema, not app code |
| **B** | **Planter ladder pricing** — species × size tier × planter × colour, uplift +29% to +121%, largest at small end         | Our primary AOV lever                                                  |
| **C** | **Per-city seasonal availability** — global catalogue × per-city matrix, climate bands differ                           | The multi-city scaling primitive                                       |
| **D** | **Legal Metrology completeness** — manufacturer address, origin, common name, net qty, MRP, dimensions on every listing | Legal requirement, template-level                                      |

**A and D are pure custom domain logic. Neither stack ships them.** They are included anyway because they measure _how much ceremony each stack adds around custom logic_ — which is the actual question.

---

## 2. Pre-verdict you should hold, so the spike is honest

The spike runs against a prior. Stating it in advance prevents post-hoc rationalisation.

**My prior: Payload wins for THIS business, and the reason is not "Medusa is worse."**

| Factor                          | Payload                                 | Medusa v2                                                         |
| ------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| Processes                       | 1 (Next.js)                             | 3 (Next.js + Medusa server + Medusa worker)                       |
| Infra deps                      | Postgres, S3                            | Postgres, **Redis**, S3                                           |
| Product ownership               | Owns products/orders natively           | Owns products/orders; second source of truth if Payload also does |
| Our product record shape        | Native — content fields are first-class | Commerce-shaped; care/compliance/batch fields become custom       |
| Already validated in your stack | ✅ Shagga ships it                      | ❌ new surface                                                    |

The last row is the one that matters most and the one least likely to change in half a day: **Shagya already runs Better Auth with its own user model, Firebase, passkeys, 2FA, email OTP, and phone identity — alongside Payload's `Users` collection and a separate `Customers` collection linked by `betterAuthUserId`.** That is already three identity surfaces. See §5.

**What would change the prior:** if Medusa's cart/promotion/order machinery cuts total custom code by >40% _including_ the infra it demands, take Medusa for the commerce core and keep Payload purely as a content/CMS for care content — a well-supported split, not a muddle.

---

## 3. What to build

**Build the same four slices twice. No shared abstractions. No premature harmonisation.**

Work in a throwaway directory. Do not touch `upvvan/` main build or Shagya.

```
spike/
├── payload-spike/     # copy Shagya boilerplate, strip to essentials
└── medusa-spike/      # npx create-medusa-app, then Next storefront
```

### Slice A — Delivery proof gate

```ts
// The invariant: DELIVERED is unreachable without all 4 fields.
// Must be enforced by DB constraint / schema validation, NOT app code.

// Payload: access-control + a beforeChange hook that THROWS on illegal transition
// Medusa:  an order workflow step that validates, plus a DB-level CHECK
```

**Pass condition:** attempt the illegal transition and observe the failure. Record whether the refusal came from the database, the schema, or only application code. **Application-code-only enforcement is a fail** — it is bypassable by a direct DB write or a bug in a different code path.

### Slice B — Planter ladder pricing

- One species, 2 size tiers, 4 planters, 3 colours = 24 variants
- Price derived from a ladder rule, not per-variant manual entry
- Assert: identical plant, ₹199 and ₹1,099 equivalent achievable (Ugaoo's 5.5×)

**Pass condition:** how many lines to express "base price + planter multiplier + colour modifier"? If Medusa's price lists do this declaratively and Payload needs a resolver, note the line count honestly.

### Slice C — Per-city seasonal availability

- 1 global species catalogue, 2 cities, different seasonal availability per city
- Assert city B's assortment query never returns city A's out-of-season SKUs

**Pass condition:** which model handles this natively? Record whether you needed a custom join table in each.

### Slice D — Legal Metrology validation

- Product record requiring: manufacturer/packer address, country of origin, common name, net quantity, MRP inclusive of taxes, **dimensions (H × pot ⌀ × spread)**
- A plant cannot be published without dimensions; a non-plant SKU does not need them

**Pass condition:** conditional-field ergonomics. Both should manage this; note the friction.

### Spike E — Infra reality check (do this LAST, it gates everything)

Attempt to run each stack **cold** following only its own getting-started docs:

- Medusa: Postgres + Redis + server + worker. Time to first successful boot. Does `infra/dev-services.yml` need a Redis service added? How many new deploy targets?
- Payload: already solved in Shagya. Time to first successful boot.

Record: new infra services, new processes, new failure modes, time-to-boot, and lines of config added.

---

## 4. How to measure

For each slice, record:

| Metric                                  | Notes                                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| **Lines of custom domain code**         | The headline number. Exclude generated files.              |
| **Lines of config/wiring**              | Includes infra additions                                   |
| **New infra services**                  | Redis counts. Worker counts.                               |
| **New long-running processes**          | Each is a deployment and an on-call item                   |
| **Enforcement layer**                   | DB / schema / app-only — for Slice A especially            |
| **Time to cold boot from docs alone**   | Fresh clone, follow getting-started, no prior knowledge    |
| **Where the product record fights you** | Free-text note, this is where content-heavy commerce hurts |

**Then the decision rule:**

```
custom_code_medusa + (infra_cost_medusa × 4)  <  custom_code_payload  ?
```

The ×4 weight on infra is deliberate and stated in advance: **infra is the thing you carry for the life of the business; domain code gets refactored.** This is the single most important line in the spike and it should not be adjusted after seeing results.

---

## 5. Auth: the thing that is genuinely getting mixed

**Flagging this because you asked me to.**

Shagya's current auth surface:

| Layer                          | What it is                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `better-auth`                  | Own user model, own tables — email OTP, passkeys, 2FA, phone identity, optional Firebase |
| `src/collections/Users.ts`     | Payload's own admin auth collection                                                      |
| `src/collections/Customers.ts` | Separate PII store, linked via `betterAuthUserId`                                        |

Three identity surfaces, deliberately, with an explicit foreign key between them. It works. It is not simple.

**Adding Medusa adds a fourth: Medusa's own `user` table and its own auth**, which you cannot make Better Auth own — Medusa's admin and API auth are internal to Medusa.

### The complexity cliff

If we ever add Medusa, we will be tempted to unify. **Don't, early.** The correct medium-term shape is:

```
Better Auth  = the ONLY customer identity
     ├── profile mirror → Payload (Customers.betterAuthUserId)
     └── profile mirror → Medusa (customer_group / metadata)

Medusa's internal user table = its admin/staff auth ONLY. Never customer login.
```

That is a deliberate, documented tax: an identity-projection job from Better Auth into Medusa, on every signup. Until we need Medusa, **do not build it** — and note that Better Auth has a **Firebase plugin** that can own an external identity provider outright if we ever want to delete the mirror jobs.

**Spike F (cheap, add it):** in the Medusa spike, prove you can disable Medusa's customer-facing auth entirely and pass a verified Better Auth JWT to Medusa's API. If that is hard, Medusa's total cost just went up.

---

## 6. Deliverable

Write to `spike/FINDINGS.md`:

1. **The measurement table** — every metric, both stacks, all six slices
2. **The decision**, applying the pre-stated rule. If the rule says Medusa, say Medusa
3. **The infra diff** — exactly what `infra/dev-services.yml` and the deploy pipeline gain or lose
4. **The auth answer** from Spike F, plainly
5. **Anything that surprised you**, especially if it contradicts §2's prior

**Hard rule: delete the spike code after writing findings.** The only artefact is `FINDINGS.md`. A spike that leaves code behind becomes code nobody maintains.

---

## 7. Definition of done

- Both spikes build and boot from docs alone, on a clean machine
- All six slices measured, not estimated
- Findings written **before** any preference is expressed
- Spike code deleted
- One sentence at the top of `FINDINGS.md` stating the chosen stack and the deciding metric

**If the measurement is ambiguous, the answer is Payload** — one process is the safer default when two stacks tie, and the prior in §2 already said so.
