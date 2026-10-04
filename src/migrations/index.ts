import * as migration_20261004_125952_initial_baseline from './20261004_125952_initial_baseline'
import * as migration_20261005_000001_phase0_geo_invariants from './20261005_000001_phase0_geo_invariants'

export const migrations = [
  {
    up: migration_20261004_125952_initial_baseline.up,
    down: migration_20261004_125952_initial_baseline.down,
    name: '20261004_125952_initial_baseline',
  },
  {
    up: migration_20261005_000001_phase0_geo_invariants.up,
    down: migration_20261005_000001_phase0_geo_invariants.down,
    name: '20261005_000001_phase0_geo_invariants',
  },
]
