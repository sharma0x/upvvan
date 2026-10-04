# Upvvan — Agent Instructions

An Indian D2C plant business. Own nursery, own riders, single city at launch.

**Read `STACK-DECISION.md` and `DECISIONS.md` before changing architecture.** Both
record reasoning that is expensive to re-derive, including decisions that were
reversed and why.

## Architecture

Single process, single database, one DDL history.

```
src/
├── app/
│   ├── layout.tsx                    # ROOT layout — the ONLY place globals.css may be imported
│   ├── page.tsx                      # Coverage checker (Phase 0's customer surface)
│   ├── (payload)/                    # Route group — no URL prefix
│   │   ├── layout.tsx
│   │   ├── admin/[[...segments]]/page.tsx
│   │   ├── admin/importMap.js        # MUST be plain JS at this exact path
│   │   └── api/[...slug]/route.ts    # REST + GraphQL + Local API
│   ├── api/serviceability/route.ts   # Pincode + city gate
│   ├── globals.css                   # @import 'tailwindcss' + ./theme.css
│   └── theme.css                     # GENERATED from DESIGN.md — do not hand-edit
├── collections/                      # Payload collections (Geo + staff auth)
├── components/
├── lib/
│   ├── config.ts                     # All env/config. Nothing else reads process.env
│   ├── auth.ts                       # CUSTOMER identity (better-auth) — C-1
│   └── geo/
│       ├── bands.ts                  # Rider pay. The incentive fix
│       ├── serviceability.ts         # Pure pincode + city gate
│       └── loader.server.ts          # Geo projection from Postgres
├── migrations/                       # Generated DDL + hand-written invariants
├── payload.config.ts
└── instrumentation.ts                # Fail-fast config validation at boot

DESIGN.md                             # Normative design spec (tokens + rationale)
infra/dev-services.yml               # Postgres 18 + RustFS + Mailpit + Adminer
Makefile                              # All commands
```

## Commands

```bash
make setup           # .env + install
make infra-up        # Postgres 18 :55432 · S3 :59000 · Mailpit :58025 · Adminer :58080
make db-migrate      # Payload migrations, then better-auth's
make seed-phase0     # Bengaluru (live) + Hyderabad (pending licence)
make dev             # :3100
make ci-local        # format + lint + typecheck + test + build
make design-lint     # DESIGN.md — structure, token refs, WCAG contrast
make design-export   # Regenerate src/app/theme.css from DESIGN.md
```

## Non-negotiables

- **Migrations only. Never `push: true`.** All DDL — generated tables AND our
  triggers/CHECK constraints — goes through `src/migrations/` in one runner. That
  single DDL history is the deciding factor in the stack choice.
- **Business invariants belong in the schema layer.** Application-code-only
  enforcement is a fail: it is bypassable by a direct write. See
  `src/migrations/20261005_000001_phase0_geo_invariants.ts`.
- **Money is integer paise.** Never floats, never rupees. A DB CHECK enforces it,
  and ESLint bans `parseFloat`/`parseInt`.
- **Customer identity is owned solely by `better-auth`.** There is deliberately no
  `Customers` collection. `src/lib/auth/__tests__/single-customer-identity.test.ts`
  fails if anyone adds one.
- **Nothing operational is hardcoded.** Ports, secrets, OTP lifetimes, the pincode
  pattern and seed bands all come from `src/lib/config.ts` (env) or the database
  (per-city commercial values).
- **Prepaid only.** A COD return leg is 25–30 days and the plant is unsellable on
  return — a total write-off. There is no COD affordance anywhere.
- **No mobile app.** Rider and customer surfaces are responsive web / PWA.
- **Green tests must have been seen red.** A green test never seen failing is not
  evidence.

## Gotchas that will waste hours

**Payload**

- `importMap.js` must be **plain JS** at `src/app/(payload)/admin/importMap.js`.
  Not TypeScript, not at `(payload)/importMap.js`. Regenerate with
  `make generate-importmap`.
- The admin panel returns HTTP 500 during SSR on some Payload/Next combos. The
  REST API works. Create the first staff user via
  `POST /api/users/first-register`.
- `push: false` goes **inside** `postgresAdapter({...})`, not at the top level and
  not beside it. Both other placements are type errors.
- `nodemailerAdapter` takes SMTP settings in `transportOptions`, not as
  `smtpHost`/`smtpPort` keys.
- `@payloadcms/ui` and `@next/eslint-plugin-next` must be **direct** dependencies —
  pnpm's strict mode will not resolve them transitively.
- Migrations export `up`/`down` as top-level named functions taking
  `MigrateUpArgs`/`MigrateDownArgs`. An object export silently does nothing.

**better-auth (customer identity — C-1)**

- `database` is **shape-detected, not `provider`-keyed**. Pass the pg `Pool`
  itself. `{ provider: 'pg', pool }` fails with "Failed to initialize database
  adapter", because better-auth looks for a `connect` method.
- `phoneNumber` is contributed by the `phoneNumber()` plugin, which also owns the
  `UNIQUE ("phoneNumber")` constraint. **Do not** declare it in `user.fields` —
  that shape is unsupported and produces a literal column named `[object Object]`
  while the migration reports success.
- `sendOTP` / `sendVerificationCode` are **top-level plugin options**, and the
  callback receives `{ phoneNumber, code }` — not `{ number, code }`.

**CSS / build**

- **`@theme` and `@import 'tailwindcss'` are directives, not plain CSS.** They are
  only processed when `@tailwindcss/postcss` is in `postcss.config.mjs`. Without
  it they are emitted _literally_ and every `var(--color-*)` silently resolves to
  nothing: a completely unstyled page that passes typecheck, all tests, the
  production build, and every DOM assertion. The only check that catches it is
  looking at it.
- **Build with webpack, not Turbopack** (`next build --webpack`). Turbopack's
  PostCSS loader resolves plugin names from a sandboxed root and cannot see
  `@tailwindcss/postcss`, even when it is installed and resolvable from Node.
  Payload's admin build path is webpack-based too.
- `src/app/theme.css` is **generated**. Edit `DESIGN.md`, run `make design-export`.

**Infra**

- **RustFS, not MinIO.** The `minio/minio` and `minio/mc` Docker Hub images were
  deleted outright and cannot be fetched at all — a compose file referencing them
  fails to build, not merely to start.
- Postgres 18 Alpine needs `PGDATA=/var/lib/postgresql/pgdata` with the volume at
  `/var/lib/postgresql`, **not** `/var/lib/postgresql/data`, or it restart-loops.
- RustFS does **not** auto-create buckets. `make storage-bucket`.
- Dev services are on the 5xxxx range so this stack can run alongside Shayga.

## Types that cross boundaries

Postgres integer PKs come back from `json_agg` as **numbers**; Payload
relationship values and route params are **strings**. Comparing with `===`
silently reports a mismatch — which, for the city gate, tells a customer in our own
city that we do not deliver to them. Use `sameId()` in `serviceability.ts`. There
is a regression test that mixes types on purpose; do not "simplify" its fixtures
into consistency.

## Testing

- Unit + integration: `src/**/__tests__/*.test.ts`, colocated.
- Browser click-through: `tests/e2e/`, requires `make start` running.
- DB-layer proofs attempt **illegal raw SQL** that bypasses all application code.
  If a constraint only exists in TypeScript, those writes succeed and the test
  fails. That is the point.
