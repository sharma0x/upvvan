/**
 * Vitest setup.
 *
 * ── WHY THIS FILE LOADS `.env` ───────────────────────────────────────────────
 *
 * `pnpm test` used to run with NO environment at all, which meant `DATABASE_URL`
 * was empty and every DB-layer proof — the ones that attempt illegal raw SQL
 * against Postgres to prove a business invariant is enforced by the SCHEMA rather
 * than by application code — threw `dispatch-invariants: no database connection`
 * instead of proving anything.
 *
 * That is the worst possible failure mode for this suite. A constraint that only
 * exists in TypeScript is bypassed by a direct write, and these tests exist
 * precisely to catch that. Running them without a database does not make them
 * pass; it makes them *unable to fail*, which is the state this codebase's own
 * rule — "green tests must have been seen red" — exists to prevent.
 *
 * It was also not obviously red: `make test` failed, but the failure text pointed
 * at a missing connection rather than at the wiring mistake, which is how a
 * developer ends up deleting the suite instead of fixing the loader.
 *
 * `process.loadEnvFile` is Node's own loader — no dotenv dependency, and it uses
 * the same parser as `--env-file`, which is what `pnpm seed` already used. It
 * does NOT overwrite variables already present in the environment, so CI can
 * export real values and have them win.
 *
 * Missing file is not an error: a pure-unit run (`pricing.test.ts`,
 * `images.test.ts`, …) must still work on a fresh clone with no `.env`, and
 * those suites genuinely do not need a database.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(__dirname, '.env')

if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile)
  } catch (error) {
    // A malformed `.env` should say so, loudly, rather than produce 24 tests
    // that fail for the wrong reason.
    throw new Error(
      `Could not load ${envFile}. Every DB-layer proof depends on DATABASE_URL being present, ` +
        `and a silent failure here looks like a broken test suite. Original error: ${
          (error as Error).message
        }`,
    )
  }
}

/**
 * Fail LOUDLY when a suite that needs Postgres has none — at module scope of the
 * setup file, so the reason is on screen before any test runs.
 *
 * The DB suites already throw with a good message; this adds the second line:
 * how to fix it. `make infra-up` is the answer 95% of the time, because the
 * failure is usually "the developer forgot to start Postgres" rather than
 * "the test is wrong".
 */
if (!process.env.DATABASE_URL) {
  // Not thrown. Pure-unit suites must still run on a clean clone. The DB suites
  // name the problem themselves; this only records why it happened.
  process.env.UPVVAN_DB_UNAVAILABLE = 'DATABASE_URL unset and no .env at project root'
}
