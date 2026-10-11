import * as migration_20261004_125952_initial_baseline from './20261004_125952_initial_baseline'
import * as migration_20261004_144824_catalogue_baseline from './20261004_144824_catalogue_baseline'
import * as migration_20261004_152258_orders_baseline from './20261004_152258_orders_baseline'
import * as migration_20261004_154452_order_items from './20261004_154452_order_items'
import * as migration_20261005_000001_phase0_geo_invariants from './20261005_000001_phase0_geo_invariants'
import * as migration_20261005_000002_catalogue_invariants from './20261005_000002_catalogue_invariants'
import * as migration_20261005_000003_dimensions_nullable from './20261005_000003_dimensions_nullable'
import * as migration_20261005_000004_traceability_and_audit_fixes from './20261005_000004_traceability_and_audit_fixes'
import * as migration_20261005_000005_order_invariants from './20261005_000005_order_invariants'
import * as migration_20261005_000006_customer_identity_fk from './20261005_000006_customer_identity_fk'
import * as migration_20261005_000007_launch_blockers from './20261005_000007_launch_blockers'
import * as migration_20261005_000008_addresses from './20261005_000008_addresses'
import * as migration_20261005_000009_dispatch from './20261005_000009_dispatch'
import * as migration_20261005_000010_checkout_loop from './20261005_000010_checkout_loop'
import * as migration_20261005_000011_storefront_collections from './20261005_000011_storefront_collections'
import * as migration_20261005_000012_storefront_invariants from './20261005_000012_storefront_invariants'
import * as migration_20261005_000013_trigger_deletes from './20261005_000013_trigger_deletes'
import * as migration_20261005_000014_contact_messages from './20261005_000014_contact_messages'
import * as migration_20261005_000015_business_settings from './20261005_000015_business_settings'
import * as migration_20261005_000016_email_log from './20261005_000016_email_log'
import * as migration_20261005_000017_payload_rels_columns from './20261005_000017_payload_rels_columns'
import * as migration_20261005_000018_email_log_updated_at from './20261005_000018_email_log_updated_at'
import * as migration_20261005_000019_dispatch_requires_paid_order from './20261005_000019_dispatch_requires_paid_order'
import * as migration_20261006_000020_claim_triage from './20261006_000020_claim_triage'
import * as migration_20261006_000021_quote_reachable_by_phone from './20261006_000021_quote_reachable_by_phone'

/**
 * The single DDL history — C-3, and the deciding factor in the stack choice
 * (see STACK-DECISION.md §3). Never `push: true`.
 *
 * ── WHY THIS FILE IS HAND-MAINTAINED AND NOT GENERATED ──────────────────────
 *
 * `payload migrate:create` REGENERATES this file from the previous snapshot, and
 * in doing so it DROPS any entry that is not backed by a `.json` snapshot. Nine
 * of the fifteen entries here are hand-written invariants with no snapshot, and
 * they have been silently removed from this list more than once — twice while
 * adding the storefront tables, which is how `make db-migrate` reported
 * "migrations applied" while applying nothing at all.
 *
 * So: after running `migrate:create`, restore this file from version control and
 * re-add any hand-written entries. The `.json` snapshot only describes what
 * Payload generates; it is not the history.
 *
 * ── ORDER IS ASSERTED, NOT ASSUMED ─────────────────────────────────────────
 *   000007 → 000011: `skus.species_id` must be nullable before a consumable can
 *                    be inserted.
 *   000011 → 000012: a constraint cannot reference a table that does not exist.
 *   000013: last, and independent — it repairs two trigger bodies rather than
 *           changing any shape, so it could run anywhere. Keeping it last means
 *           the seed scripts are fixed by the time anyone re-runs them.
 */
export const migrations = [
  {
    up: migration_20261004_125952_initial_baseline.up,
    down: migration_20261004_125952_initial_baseline.down,
    name: '20261004_125952_initial_baseline',
  },
  {
    up: migration_20261004_144824_catalogue_baseline.up,
    down: migration_20261004_144824_catalogue_baseline.down,
    name: '20261004_144824_catalogue_baseline',
  },
  {
    up: migration_20261005_000001_phase0_geo_invariants.up,
    down: migration_20261005_000001_phase0_geo_invariants.down,
    name: '20261005_000001_phase0_geo_invariants',
  },
  {
    up: migration_20261005_000002_catalogue_invariants.up,
    down: migration_20261005_000002_catalogue_invariants.down,
    name: '20261005_000002_catalogue_invariants',
  },
  {
    up: migration_20261004_152258_orders_baseline.up,
    down: migration_20261004_152258_orders_baseline.down,
    name: '20261004_152258_orders_baseline',
  },
  {
    up: migration_20261004_154452_order_items.up,
    down: migration_20261004_154452_order_items.down,
    name: '20261004_154452_order_items',
  },
  {
    up: migration_20261005_000003_dimensions_nullable.up,
    down: migration_20261005_000003_dimensions_nullable.down,
    name: '20261005_000003_dimensions_nullable',
  },
  {
    up: migration_20261005_000004_traceability_and_audit_fixes.up,
    down: migration_20261005_000004_traceability_and_audit_fixes.down,
    name: '20261005_000004_traceability_and_audit_fixes',
  },
  {
    up: migration_20261005_000005_order_invariants.up,
    down: migration_20261005_000005_order_invariants.down,
    name: '20261005_000005_order_invariants',
  },
  {
    up: migration_20261005_000006_customer_identity_fk.up,
    down: migration_20261005_000006_customer_identity_fk.down,
    name: '20261005_000006_customer_identity_fk',
  },
  {
    up: migration_20261005_000007_launch_blockers.up,
    down: migration_20261005_000007_launch_blockers.down,
    name: '20261005_000007_launch_blockers',
  },
  {
    up: migration_20261005_000008_addresses.up,
    down: migration_20261005_000008_addresses.down,
    name: '20261005_000008_addresses',
  },
  {
    up: migration_20261005_000009_dispatch.up,
    down: migration_20261005_000009_dispatch.down,
    name: '20261005_000009_dispatch',
  },
  {
    up: migration_20261005_000010_checkout_loop.up,
    down: migration_20261005_000010_checkout_loop.down,
    name: '20261005_000010_checkout_loop',
  },

  /*
   * Tables for reviews / posts / wishlists / quote_requests, plus the new species
   * and skus columns the collection pages read. Hand-written rather than generated:
   * `migrate:create` diffed against a snapshot that predates sku_stock, riders and
   * dispatches and asked to create them again, over live data. See the file header.
   */
  {
    up: migration_20261005_000011_storefront_collections.up,
    down: migration_20261005_000011_storefront_collections.down,
    name: '20261005_000011_storefront_collections',
  },

  /*
   * The business rules for those tables. Must run AFTER the DDL: a constraint that
   * references a table cannot be created before the table exists.
   */
  {
    up: migration_20261005_000012_storefront_invariants.up,
    down: migration_20261005_000012_storefront_invariants.down,
    name: '20261005_000012_storefront_invariants',
  },

  /*
   * Two trigger repairs found by re-running the seeds. A business invariant that
   * cannot be undone is a lock, not a constraint.
   */
  {
    up: migration_20261005_000013_trigger_deletes.up,
    down: migration_20261005_000013_trigger_deletes.down,
    name: '20261005_000013_trigger_deletes',
  },

  /*
   * The contact inbox. `contact_messages` exists so the response-time promise on
   * /contact is measurable rather than asserted — which is the entire strategic
   * bet of the support model.
   */
  {
    up: migration_20261005_000014_contact_messages.up,
    down: migration_20261005_000014_contact_messages.down,
    name: '20261005_000014_contact_messages',
  },

  /*
   * `business_settings` — the one row a non-technical owner edits. This is the
   * migration that makes the project rule mean what it says: "nothing
   * operational is hardcoded" is only true if the founder can change the GSTIN
   * without a developer, a commit and a redeploy.
   */
  {
    up: migration_20261005_000015_business_settings.up,
    down: migration_20261005_000015_business_settings.down,
    name: '20261005_000015_business_settings',
  },

  /*
   * `email_log` — the outbound mail ledger. Until this existed the site sent
   * exactly one message (the sign-in OTP) and had no record of it, so "did the
   * customer get their confirmation" had no answer at all.
   */
  {
    up: migration_20261005_000016_email_log.up,
    down: migration_20261005_000016_email_log.down,
    name: '20261005_000016_email_log',
  },

  /*
   * Payload document-locking columns for the collections added without them.
   *
   * Without this, every write through the admin panel for those collections 500s
   * on a missing rels column — and nothing in typecheck, lint, the unit suite or
   * the build notices, because the query is generated at runtime.
   */
  {
    up: migration_20261005_000017_payload_rels_columns.up,
    down: migration_20261005_000017_payload_rels_columns.down,
    name: '20261005_000017_payload_rels_columns',
  },
  /*
   * `email_log.updated_at`. The collection declares `timestamps: true`, so
   * Payload selects this column on every read — and its absence made the Emails
   * admin screen a 500 while every other path, test and build stayed green.
   */
  {
    up: migration_20261005_000018_email_log_updated_at.up,
    down: migration_20261005_000018_email_log_updated_at.down,
    name: '20261005_000018_email_log_updated_at',
  },

  /*
   * ── 000019 WAS WRITTEN, APPLIED, AND NEVER REGISTERED ────────────────────────
   *
   * This file did not exist while 000019 was on disk and in `payload_migrations`
   * on every database that had run it. It was applied by hand, once, to a
   * database someone was looking at — and it was never added to this list.
   *
   * The consequence is the specific failure this project's rules are about: on
   * this machine the trigger `dispatches_require_paid_order_trg` exists, so a
   * rider cannot be dispatched for unpaid goods. On a FRESH CLONE — CI, a new
   * developer, a staging environment, a rebuild — `make db-migrate` would report
   * "migrations applied" and the business invariant that refuses cash-on-delivery
   * through the back door would simply not exist.
   *
   * Nothing detects that. The trigger has no test, no type, and no import; it is
   * invisible to every check this repository runs. The only evidence it existed at
   * all was a row in `payload_migrations` on one database.
   *
   * Which is the real lesson, and it belongs here rather than in a commit
   * message: a migration file that is not in `index.ts` is a comment. This index
   * is hand-maintained precisely because `migrate:create` drops entries it cannot
   * attribute to a snapshot — and the same care has to cover entries added by hand
   * afterwards.
   */
  {
    up: migration_20261005_000019_dispatch_requires_paid_order.up,
    down: migration_20261005_000019_dispatch_requires_paid_order.down,
    name: '20261005_000019_dispatch_requires_paid_order',
  },

  /*
   * Claim triage + the account index. See the file header: without these columns
   * a claim can be opened and never closed, and the order it belongs to is pinned
   * at CLAIM_OPEN forever with no way to accept a second report.
   */
  {
    up: migration_20261006_000020_claim_triage.up,
    down: migration_20261006_000020_claim_triage.down,
    name: '20261006_000020_claim_triage',
  },

  /*
   * A corporate lead may be reachable by PHONE. See the file header: the old
   * constraint made a phone-only contact-form submission — the labelled primary
   * case — produce no lead at all, behind a `.catch()` that logged and carried on
   * while the customer was told they had been recorded.
   */
  {
    up: migration_20261006_000021_quote_reachable_by_phone.up,
    down: migration_20261006_000021_quote_reachable_by_phone.down,
    name: '20261006_000021_quote_reachable_by_phone',
  },
]
