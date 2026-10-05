import * as migration_20261004_125952_initial_baseline from './20261004_125952_initial_baseline';
import * as migration_20261004_144824_catalogue_baseline from './20261004_144824_catalogue_baseline';
import * as migration_20261004_152258_orders_baseline from './20261004_152258_orders_baseline';
import * as migration_20261004_154452_order_items from './20261004_154452_order_items';
import * as migration_20261005_000001_phase0_geo_invariants from './20261005_000001_phase0_geo_invariants';
import * as migration_20261005_000002_catalogue_invariants from './20261005_000002_catalogue_invariants';
import * as migration_20261005_000003_dimensions_nullable from './20261005_000003_dimensions_nullable';
import * as migration_20261005_000004_traceability_and_audit_fixes from './20261005_000004_traceability_and_audit_fixes';
import * as migration_20261005_000005_order_invariants from './20261005_000005_order_invariants';
import * as migration_20261005_000009_dispatch from './20261005_000009_dispatch';
import * as migration_20261005_000010_checkout_loop from './20261005_000010_checkout_loop';
import * as migration_20261005_000008_addresses from './20261005_000008_addresses';
import * as migration_20261005_000007_launch_blockers from './20261005_000007_launch_blockers';
import * as migration_20261005_000006_customer_identity_fk from './20261005_000006_customer_identity_fk';

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
  {
    up: migration_20261005_000005_order_invariants.up,
    down: migration_20261005_000005_order_invariants.down,
    name: '20261005_000005_order_invariants'
  },
];
