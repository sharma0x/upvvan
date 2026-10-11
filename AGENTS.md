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

**Payload array fields (raw SQL into them)**

An `array` field on a collection generates a **separate table with three surprises**,
all of which cost a round trip and a 500 to find:

- **The table is named after the PARENT slug pluralised, not the field name.** An
  `items` array on `Orders` becomes **`orders_items`**, not `order_items`.
- **There are no `updated_at` / `created_at` columns.** `timestamps` applies to the
  parent collection only. Inserting them fails with `column "updated_at" ... does
not exist`.
- **`id` is a `varchar` PRIMARY KEY with no default.** Payload generates it in
  application code, so a raw `INSERT` must supply one or it fails with
  `null value in column "id" ... violates not-null constraint`.

Declare the field on the collection and let Payload own the table. The reason to
reach for raw SQL here at all is that we want a single transaction spanning the
order and its lines — but that does not mean guessing the schema.

**An HTML entity inside a JS string renders as the entity**

- `&amp;` is correct in JSX text and wrong in a template literal, where there is no
  decoder. The PLP heading read "soil, feed &amp; tools" to customers, and a
  `PlantCard` fallback string had the same fault. Both are fixed;
  `src/lib/catalogue/__tests__/jsx-entities.test.ts` scans for the pattern.
- It survived because every test asserted structure rather than prose.

**Copy must not promise behaviour the code does not implement**

- Help text is a claim about the system, and an untrue one is a bug with a
  friendly face. The profile form said "We send your confirmation, your delivery
  code and your invoice here", and the code deliberately does not: every customer
  message goes to the **phone-derived** mailbox (`src/lib/email/address.ts`), so
  the OTP and the receipt are one channel. `contactEmail` is unverified, and a
  receipt carries a name, an address and a phone — mailing it to an address anyone
  can type is a privacy leak, not a convenience.
- So the phone stays the only delivery channel **by design**, and the copy has to
  say what the address is for instead: a copy on request.
- `src/lib/accounts/__tests__/contact-email-copy.test.ts` audits the interface's
  claims. This cannot be a runtime test — the truth is a claim about what the code
  deliberately will _not_ do, so there is no event to assert on.

**Errors must never reach a customer**

Returning `err.message` from a route handler leaks Postgres internals to the
storefront. This actually happened: a missing array table surfaced to a customer
as `relation "order_items" does not exist`. Catch business-rule violations by
matching their own wording (those messages _are_ the customer-facing copy), log
everything else with `console.error`, and return a generic message plus a 500.
An error-message allowlist is a real control, not a nicety.

**A client component that imports a server module may pass every check**

- `@/lib/config` throws **at module load** in a production bundle, because
  `secret('PAYLOAD_SECRET')` runs inside the object literal and a browser has no
  `PAYLOAD_SECRET`. A `'use client'` module importing it compiles fine, typechecks
  fine, passes every HTTP test — and shows the error boundary to every visitor.
- The check that finds it is a real browser against a production build. Curl
  returns 200 with correct HTML because the failure is in the client bundle.
- **Do not assert `document.cookie` equals a given value as proof of signed-in
  state.** `HttpOnly` cookies are invisible to script by design; the read returns
  the wrong thing and the test asserts nothing. Sign in through the real form.
- Chromium and Playwright profiles are separate: an `HttpOnly` session cookie set
  in one does not satisfy `document.cookie` in the other. The observable symptom is
  identical to a broken page, which is how the real bug above was nearly dismissed.
- **An HTTP route sweep is not a substitute for a browser either.** The simulation
  warm-up now visits `/sign-in` and `/order/checkout` alongside every other route,
  and that catches a 500 or an SSR throw — but the sign-in bug above still returns
  **200 with correct HTML**, so the sweep saw nothing wrong. Do not let a green
  sweep stand in for proof that a page works. What actually guards this class is
  `client-boundary.test.ts` in `pnpm test`; what found the original was clicking
  the button in a real browser.

**Progressive catalogue loading**

- "Show more" is a second request, so the page and `/api/catalogue` must reach the
  **same** answer about which rows match. All of it lives in
  `src/lib/catalogue/query.server.ts` (`rowsFor`, `readSort`, `readBrowseSet`).
  Before that, six routes each had their own filter pipeline and `readSort` was a
  private function inside `page.tsx` — so the API could not reuse it without
  copying it, and a copy starts drifting the same week. A drifted second filter is
  the worst kind of bug: each batch is internally valid, so the page just quietly
  repeats and reorders plants.
- **A rejected promise passed to `use()` has no error boundary.** It takes the
  whole route down, not one batch. `fetchBatch` therefore never rejects — HTTP,
  network and JSON failures all resolve to a value with an `error` field.
- **`PlantCard` is a client component** because a client component cannot render a
  server one. Do not "fix" that by making a second card: the single-card rule is
  written into the file for a reason — the PLP and homepage cards drifted once
  already.
- The art (`leadImagesForExcluding`) resolves server-side per batch, with the
  indexes already on the page sent up as `taken`. Re-resolving on the client breaks
  the "no two adjacent cards share a photograph" invariant the moment batch two
  appears.
- `BATCH_SIZE` lives in `src/lib/catalogue/paging.ts` and is used by the page, the
  API and the skeleton. It was inline in two places first, and they disagreed by
  one.
- **A batch must divide the grid.** It is 9 because the grid is 3 columns and 8 is
  not: 8 lays out as 3 + 3 + 2 and the empty cell reads as a card that failed to
  load — the exact opposite of what a "show more" control should imply. A shopper
  does not think "end of this batch", they think "something broke". `GRID_COLUMNS`
  lives beside `BATCH_SIZE` and a test asserts the division, plus that the constant
  still matches the `lg:grid-cols-` in the markup.
- The grid is responsive (3 / 2 / 1), so 9 is perfect at 3 and at 1 and leaves one
  cell at the 2-column tablet width. Only 6 or 12 — common multiples of 2 and 3 —
  would fix all three, and both are worse: 6 is too small a step to feel like
  progress, 12 is too much catalogue before the shopper has seen anything. Chosen
  knowingly, and pinned by a test so the decision is revisited deliberately.

**A `<select>` with no options still returns 200**

- The homepage rendered `<Hero cities={[]} … />` — a hardcoded empty array where
  the city list belonged. The coverage checker's city dropdown shipped with ZERO
  options, directly above a correctly-disabled "Check coverage" button, so the form
  looked deliberate rather than broken.
- Both cities were in `cities` the whole time. Nothing read them. An empty
  `<select>` is valid HTML, the page returned 200, the element had an `id`, a `name`
  and a matching `<label>`, and **no assertion in the repository required a
  `<select>` to have options.**
- `loadCityRefs` (`src/lib/geo/cities.server.ts`) now reads it, and
  `src/lib/geo/__tests__/city-dropdown.db.test.ts` fails if the homepage passes an
  empty array again.
- **Unopened cities are listed, not hidden.** Hyderabad is a city people live in
  and type into that form. With a single option the dropdown defaults to Bengaluru
  and answers about the wrong city — the failure the city gate exists to prevent.
  It shows as "Hyderabad — not open here yet".

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

**The client bundle is a different environment**

- **A `'use client'` module must never import `@/lib/config`.** `config.ts` calls
  `secret()` inside the object literal, so it **throws at module load** in
  production — and `process.env.PAYLOAD_SECRET` is `undefined` in a browser
  because Next inlines only `NEXT_PUBLIC_*`. Result: a page that renders
  perfectly to curl, throws on hydration, and shows the error boundary. This is
  not hypothetical — it is how `/sign-in`, the one page every returning customer
  must pass through, was unusable in production while dev, the build, typecheck,
  404 unit tests, the journey and a 76-check business simulation were all green.
  Use `@/lib/public-config` (one export, the origin) or add a server route.
  `src/lib/accounts/__tests__/client-boundary.test.ts` fails if a client module
  reaches the server config.
- **HTTP checks cannot see a client-bundle failure.** curl only reads
  server-rendered HTML; a hydration throw is invisible to it, to every
  `test:server` assertion, and to any test that drives the API directly. The only
  check that finds it is a real browser against a production build.

**Infra**

- **RustFS, not MinIO.** The `minio/minio` and `minio/mc` Docker Hub images were
  deleted outright and cannot be fetched at all — a compose file referencing them
  fails to build, not merely to start.
- Postgres 18 Alpine needs `PGDATA=/var/lib/postgresql/pgdata` with the volume at
  `/var/lib/postgresql`, **not** `/var/lib/postgresql/data`, or it restart-loops.
- RustFS does **not** auto-create buckets. `make storage-bucket`.
- Dev services are on the 5xxxx range so this stack can run alongside Shayga.

## Types that cross boundaries

Postgres `numeric` columns come back from the `pg` driver as **strings**, not
numbers — the driver is being faithful to the column type. This bites money
specifically: `base_price_paise: 19900` arrives as `'19900'`, and `formatPaise`
then does `Number.isInteger(n)` on a string and returns `false`, so the price
renders blank. Coerce at the loader boundary with an assertion that refuses
non-integral values, rather than letting a string coerce silently somewhere
deeper — that silent coercion is how a float eventually reaches a paise column.

Payload relationship values and route params are **strings** while `json_agg`
returns **numbers**. Comparing with `===`
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
