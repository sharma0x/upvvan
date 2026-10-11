import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { migrations } from '@/migrations'

/**
 * The single DDL history has to be COMPLETE.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * `20261005_000019_dispatch_requires_paid_order.ts` was written, applied by hand to
 * one database, and never added to `src/migrations/index.ts`.
 *
 * On that machine the trigger exists, so a rider cannot be dispatched for unpaid
 * goods. On a fresh clone — CI, a new developer, staging, a rebuild — `make
 * db-migrate` reports "migrations applied" and that invariant simply is not there.
 *
 * Nothing detects it. The trigger has no type, no import and no test. The only
 * evidence it had ever existed was a row in `payload_migrations` on one machine,
 * which is not a thing anybody checks.
 *
 * And the mechanism is not obscure: `src/migrations/index.ts` is HAND-MAINTAINED,
 * because `payload migrate:create` regenerates it from `.json` snapshots and drops
 * every hand-written entry it cannot attribute. It has been silently trimmed twice
 * before. An entry added by hand afterwards can be forgotten in exactly the same
 * way, and the consequence is a business rule that exists on one developer's laptop.
 *
 * So: every `.ts` migration file on disk must appear in the list. That is a cheap
 * check, and it is the only one that catches this.
 */
const MIGRATIONS_DIR = resolve(__dirname, '..')

function migrationFilesOnDisk(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{8}_\d{6}_[a-z0-9_]+\.ts$/.test(name))
    .map((name) => name.replace(/\.ts$/, ''))
    .sort()
}

describe('the migration history', () => {
  it('lists every migration file that exists on disk', () => {
    const onDisk = migrationFilesOnDisk()
    const registered = new Set(migrations.map((m) => m.name))

    const missing = onDisk.filter((name) => !registered.has(name))

    expect(
      missing,
      `These migration files exist but are NOT in src/migrations/index.ts.\n` +
        `  ${missing.join('\n  ')}\n` +
        `\n` +
        `A migration that is not registered never runs on a fresh database — so a\n` +
        `business invariant written in it exists on one developer's machine and\n` +
        `nowhere else, and "make db-migrate" reports success either way.\n` +
        `\n` +
        `This index is hand-maintained because payload migrate:create drops entries\n` +
        `it cannot attribute to a snapshot. Add the entry by hand.`,
    ).toEqual([])
  })

  it('registers nothing that does not exist on disk', () => {
    const onDisk = new Set(migrationFilesOnDisk())
    const ghosts = migrations.map((m) => m.name).filter((name) => !onDisk.has(name))

    expect(
      ghosts,
      `These migrations are registered but the file is missing:\n  ${ghosts.join('\n  ')}\n` +
        `A migration runner that lists an entry with no file either throws at boot or\n` +
        `silently skips it, and the second is much worse than the first.`,
    ).toEqual([])
  })

  it('keeps the ordering its dependencies require', () => {
    /*
     * NOT "in filename order" — that was the first version of this test and it
     * failed on the history as it stands, for an instructive reason.
     *
     * The filename prefix is the date a file was WRITTEN, not the position it must
     * run in. `orders_baseline` is stamped 152258 and `catalogue_baseline` 144824,
     * yet the list runs orders_baseline AFTER two migrations stamped a day later:
     *
     *     initial_baseline
     *     catalogue_baseline
     *     phase0_geo_invariants      ← 000001, next day
     *     catalogue_invariants       ← 000002, next day
     *     orders_baseline            ← stamped earlier, deliberately later
     *
     * So lexicographic order is not the invariant, and asserting it would have been
     * asserting something false — which is worse than asserting nothing, because it
     * invites a "fix" that reorders working history.
     *
     * What IS load-bearing is the dependency order, and the header of index.ts names
     * two of them explicitly:
     *
     *   · 000007 → 000011, or `skus.species_id` is not yet nullable and a consumable
     *     cannot be inserted.
     *   · 000011 → 000012, or a constraint references a table that does not exist.
     *
     * Those are asserted here, so a reordering fails at `pnpm test` rather than
     * halfway through somebody's deploy.
     */
    const names = migrations.map((m) => m.name)
    const at = (needle: string): number => {
      const index = names.findIndex((n) => n.startsWith(needle))
      expect(index, `migration ${needle}… is not registered at all`).toBeGreaterThan(-1)
      return index
    }

    expect(at('20261005_000011'), '000011 must run before 000012').toBeLessThan(
      at('20261005_000012'),
    )
    expect(at('20261005_000007'), '000007 must run before 000011').toBeLessThan(
      at('20261005_000011'),
    )
    expect(
      at('20261005_000011'),
      '000011 must run before 000012, and 000012 references the tables 000011 creates',
    ).toBeLessThan(at('20261005_000012'))
  })

  it('has no duplicate entries', () => {
    const names = migrations.map((m) => m.name)
    const dupes = names.filter((name, i) => names.indexOf(name) !== i)
    expect(dupes, `Duplicate migration names: ${dupes.join(', ')}`).toEqual([])
  })

  it('exports a named up and down, not an object', () => {
    /*
     * Payload wants `up` / `down` as top-level NAMED functions taking MigrateUpArgs
     * / MigrateDownArgs.
     *
     * An object export compiles, typechecks, lints and does nothing — which is the
     * most expensive silent failure a migration layer can have, and the reason this
     * is asserted from the source rather than trusted to a reviewer.
     */
    const offenders: string[] = []

    for (const name of migrationFilesOnDisk()) {
      const source = readFileSync(resolve(MIGRATIONS_DIR, `${name}.ts`), 'utf8')
      if (/export\s*default\s/.test(source)) offenders.push(`${name}: has a default export`)
      if (!/export\s+(async\s+)?function\s+up\b/.test(source)) {
        offenders.push(`${name}: no top-level "function up"`)
      }
      if (!/export\s+(async\s+)?function\s+down\b/.test(source)) {
        offenders.push(`${name}: no top-level "function down"`)
      }
    }

    expect(
      offenders,
      `Migrations must export up/down as top-level named functions:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
