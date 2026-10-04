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
	@echo "  make dev             Start the dev server on :\$$PORT"
	@echo ""
	@echo "Build & run:"
	@echo "  make build           Production build (webpack — required by Payload)"
	@echo "  make start           Run the production server"
	@echo ""
	@echo "Quality:"
	@echo "  make ci-local        format-check + lint + typecheck + test + build"
	@echo "  make test            Unit + integration tests (Vitest)"
	@echo "  make test-e2e        Browser click-through (Playwright, needs a running server)"
	@echo "  make design-lint     Lint DESIGN.md (tokens + WCAG contrast)"
	@echo "  make design-export   Regenerate src/app/theme.css from DESIGN.md"
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

test: ## Vitest
	pnpm test

test-watch: ## Vitest in watch mode
	pnpm test:watch

test-e2e: ## Playwright click-through (requires `make start` running)
	pnpm exec playwright test || node tests/e2e/phase0-coverage.spec.mjs

test-e2e-install: ## Install Playwright browsers (one-time)
	pnpm exec playwright install chromium

test-all: ## Unit + E2E
	pnpm test && pnpm test:all

ci-local: ## Full CI: format, lint, typecheck, test, build
	@echo "=== [1/5] Format ==="   && pnpm format:check
	@echo "=== [2/5] Lint ==="     && pnpm lint
	@echo "=== [3/5] Types ==="    && pnpm typecheck
	@echo "=== [4/5] Tests ==="    && pnpm test
	@echo "=== [5/5] Build ==="    && pnpm build
	@echo ""
	@echo "✓ CI passed"

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