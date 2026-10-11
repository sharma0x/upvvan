.PHONY: help setup install dev build start lint format format-check typecheck \
        test test-watch test-e2e test-e2e-install test-all \
        ci-local design-lint design-export \
        infra-up infra-down infra-logs infra-reset storage-bucket \
        db-migrate db-migrate-create db-migrate-status \
        seed seed-phase0 generate-types generate-importmap \
        clean clean-all

help: ## Show available commands
	@echo "Upvvan — Available Commands"
	@echo "============================="
	@echo ""
	@echo "Setup:"
	@echo "  make setup           Copy .env.example -> .env, install deps"
	@echo "  make infra-up        Start Postgres 18 + RustFS + Mailpit + Adminer"
	@echo "  make db-migrate      Run Payload migrations, then better-auth's"
	@echo "  make seed-phase0     Seed Bengaluru + pending Hyderabad"
	@echo "  make seed-catalogue  Seed species, planters, SKUs and stock"
	@echo "  make seed-content    Seed articles + the symptom library"
	@echo "  make dev             Start the dev server on :\$$PORT"
	@echo ""
	@echo "Build & run:"
	@echo "  make build           Production build (webpack — required by Payload)"
	@echo "  make start           Run the production server"
	@echo ""
	@echo "Quality:"
	@echo "  make ci-local        guard + format + lint + typecheck + test + build"
	@echo "  make test            Unit + integration tests (Vitest)"
	@echo "  make test:sim        THE BUSINESS SIMULATION — 5 stakeholders, production paths, injected faults"
	@echo "  make test-e2e        Browser click-through (Playwright, needs a running server)"
	@echo "  make design-lint     Lint DESIGN.md (tokens + WCAG contrast)"
	@echo "  make design-export   Regenerate src/app/theme.css from DESIGN.md"
	@echo "  make seed-content    Articles + the symptom library (problem pages)"
	@echo ""
	@echo "Dev services: Postgres :55432 · S3 :59000/:59001 · Mailpit :58025 · Adminer :58080"

# ── Setup ───────────────────────────────────────────────────────────────────

setup: ## First-time setup
	@command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required: https://pnpm.io"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "docker is required: https://docker.com/"; exit 1; }
	@[ -f .env ] || cp .env.example .env
	@echo ""
	@echo "✓ .env ready. Generate real secrets before anything else:"
	@echo "    PAYLOAD_SECRET=$$(openssl rand -hex 32)"
	@echo "    BETTER_AUTH_SECRET=$$(openssl rand -hex 32)"
	@echo ""
	@echo "Then:  make infra-up && make db-migrate && make seed-phase0 && make dev"

install: ## Install dependencies
	pnpm install

# ── Dev ─────────────────────────────────────────────────────────────────────

dev: ## Start the dev server
	pnpm dev

build: ## Production build
	pnpm build

start: ## Run the production server
	pnpm start

# ── Quality ─────────────────────────────────────────────────────────────────

lint: ## ESLint
	pnpm lint

format: ## Prettier write
	pnpm format

format-check: ## Prettier check
	pnpm format:check

typecheck: ## TypeScript
	pnpm typecheck

test: ## Vitest (unit + DB-layer proofs)
	pnpm test

test-journey: ## Full customer -> admin -> rider journey against a running server
	@$(MAKE) --no-print-directory _server-ensure
	@STAFF_EMAIL="$${STAFF_EMAIL:-ops@upvvan.test}" \
	 STAFF_PASSWORD="$${STAFF_PASSWORD:-$${STAFF_SEED_PASSWORD:-}}" \
	 RIDER_PHONE="$${RIDER_PHONE:-}" \
	 pnpm test:journey

test-sim: ## The whole business, five stakeholders, production paths and injected faults
	@echo "→ booting a production build, warming it, then running the simulation"
	@SIM_STAFF_EMAIL="$${SIM_STAFF_EMAIL:-$${STAFF_EMAIL:-ops@upvvan.test}}" \
	 SIM_STAFF_PASSWORD="$${SIM_STAFF_PASSWORD:-$${STAFF_PASSWORD:-$${STAFF_SEED_PASSWORD:-}}}" \
	 pnpm start:sim
	@$(MAKE) --no-print-directory _server-stop

test-sim-dev: ## The same simulation against the dev server (slower; per-route compilation)
	@SIM_STAFF_EMAIL="$${SIM_STAFF_EMAIL:-$${STAFF_EMAIL:-ops@upvvan.test}}" \
	 SIM_STAFF_PASSWORD="$${SIM_STAFF_PASSWORD:-$${STAFF_PASSWORD:-$${STAFF_SEED_PASSWORD:-}}}" \
	 pnpm start:sim -- --dev

test-links: ## Dead links + the rider sign-out form path (boots a server if needed)
	@$(MAKE) --no-print-directory _server-ensure
	@pnpm test:server || ( $(MAKE) --no-print-directory _server-stop; exit 1 )
	@$(MAKE) --no-print-directory _server-stop

# ── Server lifecycle ─────────────────────────────────────────────────────────
#
# Both helpers record the PID of a server they started, and only that PID. That
# distinction is the whole reason this file has two helpers instead of one: a
# target must never kill a server a human started with `make dev`.

_server-ensure: ## Internal: start a dev server only if 3100 is not answering
	@if curl -sf -o /dev/null http://localhost:$${PORT:-3100}/; then \
	  echo "server already running — not touching it"; \
	else \
	  echo "booting dev server for the link crawl…"; \
	  PORT=$${PORT:-3100} nohup pnpm dev > /tmp/uvv-links.log 2>&1 < /dev/null & \
	  echo $$! > /tmp/uvv-links.pid; \
	  for i in $$(seq 1 40); do \
	    curl -sf -o /dev/null http://localhost:$${PORT:-3100}/ && break; \
	    sleep 2; \
	  done; \
	  curl -sf -o /dev/null http://localhost:$${PORT:-3100}/ || \
	    { echo "dev server never came up; see /tmp/uvv-links.log"; \
	      $(MAKE) --no-print-directory _server-stop; exit 1; }; \
	fi

_prod-ensure: ## Internal: start the PRODUCTION server (needs a prior build)
	@if curl -sf -o /dev/null http://localhost:$${PORT:-3100}/; then \
	  echo "server already running — not touching it"; \
	else \
	  echo "booting production server…"; \
	  PORT=$${PORT:-3100} nohup pnpm start > /tmp/uvv-prod-ci.log 2>&1 < /dev/null & \
	  echo $$! > /tmp/uvv-links.pid; \
	  for i in $$(seq 1 40); do \
	    curl -sf -o /dev/null http://localhost:$${PORT:-3100}/ && break; \
	    sleep 2; \
	  done; \
	  curl -sf -o /dev/null http://localhost:$${PORT:-3100}/ || \
	    { echo "production server never came up; see /tmp/uvv-prod-ci.log"; \
	      $(MAKE) --no-print-directory _server-stop; exit 1; }; \
	fi

_server-stop: ## Internal: stop a server this target started, and only that one
	@if [ -f /tmp/uvv-links.pid ]; then \
	  pid=$$(cat /tmp/uvv-links.pid); \
	  kill $$pid 2>/dev/null || true; \
	  rm -f /tmp/uvv-links.pid; \
	  for i in $$(seq 1 20); do \
	    curl -sf -o /dev/null http://localhost:$${PORT:-3100}/ || break; \
	    sleep 1; \
	  done; \
	  echo "stopped server $$pid"; \
	fi

test-server-prod: ## Server-dependent tests against a PRODUCTION build
	@$(MAKE) --no-print-directory _prod-ensure
	@pnpm test:server && \
	 STAFF_EMAIL="$${STAFF_EMAIL:-ops@upvvan.test}" \
	 STAFF_PASSWORD="$${STAFF_PASSWORD:-$${STAFF_SEED_PASSWORD:-}}" \
	 RIDER_PHONE="$${RIDER_PHONE:-}" \
	 pnpm test:journey || ( $(MAKE) --no-print-directory _server-stop; exit 1 )
	@$(MAKE) --no-print-directory _server-stop

test-watch: ## Vitest in watch mode
	pnpm test:watch

test-e2e: ## Playwright click-through (requires `make start` running)
	pnpm exec playwright test || node tests/e2e/phase0-coverage.spec.mjs

test-e2e-install: ## Install Playwright browsers (one-time)
	pnpm exec playwright install chromium

test-all: ## Unit + prod server tests + journey + the business simulation
	@echo "=== [1/4] Unit ===" && pnpm test
	@echo "=== [2/4] Build ===" && pnpm build
	@echo "=== [3/4] Server tests + journey ===" && $(MAKE) --no-print-directory test-server-prod
	@echo "=== [4/4] Simulation ===" && $(MAKE) --no-print-directory test-sim

# ── Fixtures ─────────────────────────────────────────────────────────────────
#
# `ci-local` cannot invent a staff password, and it should not try.
#
# `scripts/seed-staff.ts` refuses a default password on purpose: a literal one here
# would sit in the shell history, the process table, and this file. So the
# verification suite demands a real provisioned staff login.
#
# This check exists so the failure arrives IMMEDIATELY with the fix, rather than
# forty seconds and a production build later at [7/8], where it looks like a test
# failure instead of a missing fixture.
_ci-fixtures:
	@if [ -z "$${STAFF_PASSWORD:-$${STAFF_SEED_PASSWORD:-}}" ]; then \
	  echo ""; \
	  echo "  x ci-local needs a provisioned staff login."; \
	  echo ""; \
	  echo "    STAFF_SEED_PASSWORD=... pnpm seed:staff -- ops@upvvan.test Ops hq-admin"; \
	  echo ""; \
	  echo "    Then run the whole suite with those credentials:"; \
	  echo "      STAFF_EMAIL=ops@upvvan.test STAFF_PASSWORD=... RIDER_PHONE=9812345678 make ci-local"; \
	  echo ""; \
	  echo "    Or run the simulation alone, which provisions its own staff:"; \
	  echo "      SIM_STAFF_PASSWORD=... make test-sim"; \
	  echo ""; \
	  exit 1; \
	fi

ci-local: ## Full CI: guard, format, lint, types, tests, build, prod tests, simulation
	@echo "=== [0/8] Fixtures ===" && $(MAKE) --no-print-directory _ci-fixtures
	@echo "=== [1/8] Guard ==="    && node scripts/check-silent-failures.mjs
	@echo "=== [2/8] Format ==="   && pnpm format:check
	@echo "=== [3/8] Lint ==="     && pnpm lint
	@echo "=== [4/8] Types ==="    && pnpm typecheck
	@echo "=== [5/8] Tests ==="    && pnpm test
	@echo "=== [6/8] Build ==="    && pnpm build
	@echo "=== [7/8] Prod tests ===" && $(MAKE) --no-print-directory test-server-prod
	@echo "=== [8/8] Simulation ===" && $(MAKE) --no-print-directory test-sim
	@echo ""
	@echo "✓ CI passed"
	@echo ""
	@echo "Note: [8] boots its own production server, so [7] must release :3100 first."
	@echo "That ordering is deliberate — the dev server caught a class of bug the"
	@echo "production build hides, and a link crawl against 'next dev' proves less."

# ── Design tokens ───────────────────────────────────────────────────────────
#
# DESIGN.md is the normative design spec. src/app/theme.css is GENERATED from it
# and imported by globals.css — never hand-edit the generated file.

design-lint: ## Lint DESIGN.md (structure, token refs, WCAG contrast)
	npx -y @google/design.md lint DESIGN.md

design-export: ## Regenerate src/app/theme.css from DESIGN.md
	npx -y @google/design.md export --format css-tailwind DESIGN.md > src/app/theme.css
	@echo "✓ src/app/theme.css regenerated from DESIGN.md"

# ── Infrastructure ──────────────────────────────────────────────────────────

infra-up: ## Start dev services
	docker compose -f infra/dev-services.yml up -d

infra-down: ## Stop dev services
	docker compose -f infra/dev-services.yml down

infra-logs: ## Tail dev service logs
	docker compose -f infra/dev-services.yml logs -f

infra-reset: ## Destroy dev service volumes (fresh DB)
	docker compose -f infra/dev-services.yml down -v

storage-bucket: ## Create the S3 bucket (RustFS does NOT auto-create buckets)
	@echo "Creating bucket via the S3 API — RustFS will not do this for us."
	docker run --rm --network host \
		-e AWS_ACCESS_KEY_ID=minioadmin -e AWS_SECRET_ACCESS_KEY=minioadmin \
		amazon/aws-cli s3api create-bucket --endpoint-url http://localhost:59000 \
		--bucket upvvan-media 2>&1 | tail -2 || true

# ── Database ────────────────────────────────────────────────────────────────

db-migrate: ## Run Payload migrations, then better-auth's
	@echo "→ Payload migrations"
	pnpm payload migrate
	@echo "→ better-auth (customer identity — C-1)"
	pnpm exec better-auth migrate --config src/lib/auth.ts -y
	@echo "✓ migrations applied"

db-migrate-create: ## Create a migration. Usage: make db-migrate-create MSG='...'
	@test -n "$(MSG)" || { echo "Usage: make db-migrate-create MSG='add orders table'"; exit 1; }
	@echo "Regenerate the baseline schema first if the collection shape changed:"
	@echo "  pnpm payload generate:db-schema"
	pnpm payload migrate:create "$(MSG)"

db-migrate-status: ## Show applied migrations
	@PGPASSWORD=$${PGPASSWORD:-upvvan_dev} psql -h localhost -p 55432 -U $${PGUSER:-upvvan} -d upvvan \
		-c "SELECT name, batch FROM payload_migrations ORDER BY id;" 2>/dev/null || \
		echo "(psql not available — check the DB directly)"

seed-content: ## Seed the blog, the symptom library and the care cross-links
	node --env-file=.env --import tsx/esm scripts/seed-content.ts

seed: ## Seed Phase 0 data (Bengaluru live, Hyderabad pending licence)
	pnpm exec tsx scripts/seed-phase0.ts

seed-phase0: seed ## Alias

generate-types: ## Regenerate Payload types
	pnpm payload generate:types

generate-importmap: ## Regenerate the Payload import map
	pnpm payload generate:importmap

# ── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf .next .turbo node_modules/.cache tsconfig.tsbuildinfo

clean-all: clean ## Remove node_modules and dev service volumes
	rm -rf node_modules
	docker compose -f infra/dev-services.yml down -v 2>/dev/null || true