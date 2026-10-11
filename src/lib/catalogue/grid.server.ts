import { leadImagesForItems, type PlantImage } from '@/lib/catalogue/images'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'
import type { ArtMap } from '@/components/catalogue/ItemGrid'
import { batchOf } from '@/lib/catalogue/paging'
import type { WireItem } from '@/components/catalogue/PagedItemGrid'

/**
 * Build the server half of a paged grid: the first batch, with its art.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `ItemGrid` takes a resolved `Map` of artwork. `PagedItemGrid` is a client
 * component, so it cannot be handed one — a `Map` does not survive serialisation.
 *
 * There were three ways to bridge that, and two of them are traps:
 *
 *   1. A module-level `Map` in the client module, populated by the server render.
 *      Two simultaneous visitors would overwrite each other's art, and the second
 *      render would leak the first visitor's photographs. This was written and
 *      deleted for that reason.
 *   2. Re-resolving art on the client per batch. Breaks the invariant that no two
 *      adjacent cards show the same photograph — the whole reason `ItemGrid`
 *      resolves art once for the set.
 *   3. Convert to an array of `{ item, art }` before crossing the boundary, and
 *      have the server resolve each subsequent batch against the indexes already
 *      displayed. Correct, and what this does.
 *
 * It also picks the art ONCE for the whole set and then slices, so batch one has
 * exactly the photographs it would have had with no pagination at all. Resolving
 * per batch would shift every image the moment somebody pressed "Show more".
 */

/** Pair each item with the artwork the page resolved for it. */
export function withArt(
  rows: readonly CatalogueItem[],
  art: ArtMap,
  offset: number,
  limit: number,
): { first: WireItem[]; total: number } {
  const batch = batchOf(rows, offset, limit)

  const first: WireItem[] = batch.items.map((item) => ({
    ...item,
    art: art.get(item.skuId) ?? null,
  }))

  return { first, total: batch.total }
}

/**
 * Resolve art for a whole set and return only its first batch.
 *
 * The common case, and the one worth not getting subtly wrong: `rows` is the full
 * filtered list, `art` is resolved for ALL of it (so de-duplication is global), and
 * the caller keeps the `Map` for any other grid on the same page.
 */
export function firstBatch(
  rows: readonly CatalogueItem[],
  art: ArtMap,
  limit: number,
): { first: WireItem[]; total: number } {
  return withArt(rows, art, 0, limit)
}

/** Re-export so route files do not need two imports for one job. */
export { leadImagesForItems }
export type { PlantImage }
