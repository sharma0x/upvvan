# Upvvan — Phase 0

A hyperlocal Indian D2C plant business: own nursery, own riders, single city at
launch. Plants are loss-leader acquisition; refill consumables are the business.

**Status: Phase 0 complete and verified.**

## What this is

| Document                                   | What it is                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| [`STACK-DECISION.md`](./STACK-DECISION.md) | The stack decision and its reasoning. Read before changing architecture. |
| [`DECISIONS.md`](./DECISIONS.md)           | Running log — dated decisions, deviations, and bugs found.               |
| [`DESIGN.md`](./DESIGN.md)                 | Normative design spec: tokens plus why each value exists.                |
| [`AGENTS.md`](./AGENTS.md)                 | Conventions and the gotchas that will waste hours.                       |

## Quick start

```bash
make setup          # .env + install  (then generate real secrets, see below)
make infra-up       # Postgres 18 :55432 · S3 :59000 · Mailpit :58025 · Adminer :58080
make db-migrate     # Payload migrations, then better-auth's
make seed-phase0    # Bengaluru (live) + Hyderabad (pending licence)
make dev            # http://localhost:3100
```

Generate real secrets before going anywhere near production:

```bash
openssl rand -hex 32   # PAYLOAD_SECRET
openssl rand -hex 32   # BETTER_AUTH_SECRET
```

## What Phase 0 delivered

Geo: city, pincode → zone → distance band → serviceable, city config, price book,
with an HQ city on/off switch. A new city costs **configuration only** — no code
change, no deploy.

Plus the customer-facing coverage checker, which is the one thing that must be
true before anything else gets built: we never promise a pincode we cannot serve.
That is the loudest, most-documented failure across every competitor in the
research.

### Verification

- **79 tests, every one seen red first.** `make ci-local` green.
- **Schema-layer invariants proven by illegal raw SQL** that bypasses every
  application hook — band monotonicity, licence gate, integer paise,
  `city_id NOT NULL`. Dropping each constraint turns the tests red.
- **Clicked through in a real browser** (Brave, headed) against the production
  build: serviceable pincode, switched-off pincode, unknown pincode, and a
  pending city absent from the dropdown.

## Architecture in one line

One Next.js 16 process. Payload CMS 3.x owns the schema, admin panel and **staff**
identity. `better-auth`, in the same process, owns **customer** identity outright.
All business invariants are hand-written SQL in Payload's own migration directory,
so there is exactly one DDL history — which is what decided the stack over Medusa.

## Non-negotiables

- Prepaid only. No COD anywhere — a COD return leg is 25–30 days and the returned
  plant is unsellable, so it is a total write-off.
- Guarantee is **T0 = 48 hours at launch**. T1 (30 days) and T2 (90 days) are
  behind flags defaulting OFF; promotion is a data decision, never a calendar one.
- Rider pay **must** increase with distance, enforced by a database trigger. This
  is the structural difference between us and an operator who needs a penalty
  clause to stop riders lying.
- Money is integer paise. Never floats.
- Nothing operational is hardcoded — see `src/lib/config.ts`.

## Not yet built

Phase 1 onward: catalogue, PDP with Legal Metrology declarations, cart and prepaid
checkout; nursery ops and the packing bench; the rider surface and the four-field
delivery proof; support console; the claim engine; refill subscriptions.

Nine of the prompt's twelve required tests remain, mapped to their phases in
`DECISIONS.md`.
