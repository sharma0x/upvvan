import 'server-only'

import type { CatalogueItem } from '@/lib/catalogue/loader.server'
import {
  filterItems,
  parseFacetSelection,
  searchItems,
  sortItems,
  type Facetable,
  type SortKey,
} from '@/lib/catalogue/facets'
import { findCollection } from '@/lib/catalogue/collections'
import { findOccasion } from '@/lib/commerce/gifting'

/**
 * "Which catalogue rows does this request want?" — in ONE place.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * "Show more" is a second request. The page renders batch one from its own filter
 * logic; batch two comes from an API route that has to make the *identical*
 * decision, from the same input, or the two disagree and the shopper gets a page
 * that mixes two orderings — or worse, the same plants twice.
 *
 * That risk is not theoretical here. Six grid routes each had their own pipeline:
 *
 *   /plants                     filterItems + sortItems
 *   /search                     searchItems
 *   /collections/[handle]       def.match + sortItems('featured')
 *   /gifting/[occasion]         def.match + sortItems('featured')
 *
 * and `readSort` — the thing that decides an unknown `?sort=` falls back to
 * `featured` instead of throwing — was a PRIVATE function inside
 * `/plants/page.tsx`. So the API could not reuse it without copying it, and a copy
 * would immediately begin to drift.
 *
 * Everything below is now here: the sort whitelist, the facet parse, the search,
 * the collection and occasion predicates, and the facet→row join. Pages call
 * `rowsFor`; so does the API. There is no second answer to drift away from.
 *
 * ── WHY THE FILTERING IS STILL IN JAVASCRIPT ─────────────────────────────────
 *
 * Every one of these predicates is a JavaScript function over a `Facetable`
 * (`def.match(i) => PLANT_ONLY(i) && i.light === 'low'`). Pushing them into SQL
 * would mean reimplementing each one twice and keeping the two in step — a much
 * larger change with a much larger blast radius, for a catalogue that is a few
 * hundred rows and already fully loaded on every page.
 *
 * So the win here is payload and time-to-first-cards, not database work: the
 * server renders the first batch, and each later batch is eight rows over the wire
 * instead of the whole catalogue.
 */

/** The `featured` ordering, and the only one an unrecognised value may become. */
const SORT_KEYS: readonly SortKey[] = [
  'featured',
  'price-asc',
  'price-desc',
  'name-asc',
  'easiest',
  'biggest',
]

/**
 * Read `?sort=`, falling back to `featured`.
 *
 * An unknown value is a hand-edited URL, a stale bookmark, or a crawler probing.
 * Throwing would 500 a page over a query parameter, which is both a terrible
 * experience and a bad signal for the URL.
 */
export function readSort(value: string | null | undefined): SortKey {
  return value && SORT_KEYS.includes(value as SortKey) ? (value as SortKey) : 'featured'
}

/** Which curated set a request is browsing, if any. */
export type BrowseSet =
  | { kind: 'catalogue' }
  | { kind: 'collection'; handle: string }
  | { kind: 'occasion'; handle: string }
  | { kind: 'home-plants' }
  | { kind: 'home-consumables' }

/**
 * Read `?set=` — `collection:<handle>` or `occasion:<handle>`.
 *
 * An unknown handle resolves to `catalogue` rather than to "nothing", because an
 * API that 404s on a stale link makes a broken bookmark look like a broken server.
 * The PAGE for a genuinely unknown handle still calls `notFound()`, which is the
 * place that judgement belongs: it has the copy to explain itself.
 */
export function readBrowseSet(value: string | null | undefined): BrowseSet {
  if (!value) return { kind: 'catalogue' }

  const [kind, handle] = value.split(':', 2)
  if (!handle) return { kind: 'catalogue' }

  if (kind === 'collection') {
    return findCollection(handle) ? { kind: 'collection', handle } : { kind: 'catalogue' }
  }
  if (kind === 'occasion') {
    return findOccasion(handle) ? { kind: 'occasion', handle } : { kind: 'catalogue' }
  }
  if (kind === 'home') {
    return handle === 'plants'
      ? { kind: 'home-plants' }
      : handle === 'consumables'
        ? { kind: 'home-consumables' }
        : { kind: 'catalogue' }
  }

  return { kind: 'catalogue' }
}

/** The storefront slice every grid needs. Avoids importing the whole union. */
export interface StorefrontReady {
  items: CatalogueItem[]
  facets: Facetable[]
}

/**
 * The rows a request matches, in the order it wants them.
 *
 * `params` is the page's query string, minus this module's own controls (`q`,
 * `sort`, `set`). Facet params are read by `parseFacetSelection` exactly as the
 * facet panel writes them.
 */
export function rowsFor(storefront: StorefrontReady, params: URLSearchParams): CatalogueItem[] {
  const query = (params.get('q') ?? '').trim().slice(0, 120)
  const set = readBrowseSet(params.get('set'))

  const filtered = ((): Facetable[] => {
    // A curated set is a stronger statement than a facet filter: "pet safe" is not
    // a checkbox the shopper ticked, it is the page they asked for. Facets still
    // apply within it, so "pet safe + low light" is reachable.
    if (set.kind === 'collection') {
      const def = findCollection(set.handle)!
      const inSet = storefront.facets.filter((f) => def.match(f))
      return sortItems(
        filterItems(inSet, parseFacetSelection(params)),
        readSort(params.get('sort')),
      )
    }

    if (set.kind === 'occasion') {
      const def = findOccasion(set.handle)!
      const inSet = storefront.facets.filter((f) => def.match(f))
      return sortItems(
        filterItems(inSet, parseFacetSelection(params)),
        readSort(params.get('sort')),
      )
    }

    /*
     * The homepage's two grids.
     *
     * These get explicit sets rather than falling through to the PLP, because the
     * PLP returns PLANTS AND CONSUMABLES together. Without a set, pressing "Show
     * more" under the homepage plant grid would append a bag of cocopeat to a list
     * of plants — a set mismatch that is invisible in both batches individually.
     */
    if (set.kind === 'home-plants') {
      const inSet = storefront.facets.filter((f) => f.itemClass === 'plant')
      return sortItems(inSet, readSort(params.get('sort')))
    }
    if (set.kind === 'home-consumables') {
      const inSet = storefront.facets.filter((f) => f.itemClass !== 'plant')
      return sortItems(inSet, readSort(params.get('sort')))
    }

    // Search is its own pipeline: a query is a different intent from a filter, and
    // combining "matches these words" with "matches this checkbox" ranked worse
    // than either alone.
    if (query) return searchItems(storefront.facets, query)

    return sortItems(
      filterItems(storefront.facets, parseFacetSelection(params)),
      readSort(params.get('sort')),
    )
  })()

  /*
   * Facet rows are keyed by slug while catalogue rows are keyed by SKU — two size
   * tiers of one species are two rows but one plant to a shopper. So the join goes
   * through the id the facets were adapted from, which is the mapping every grid on
   * this site already used.
   */
  const byId = new Map(storefront.items.map((item) => [item.skuId, item]))
  return filtered.map((f) => byId.get(f.id)!).filter(Boolean)
}

/**
 * The controls this module owns, so a caller can forward the rest verbatim.
 *
 * `offset` and `limit` are here too, not just the filter controls, and that is the
 * whole point of this function: they are the paging controls. Leaving them in meant
 * a page's own `?offset=8` was forwarded to the API, which would then skip eight
 * MORE rows on top of the batch's own offset — so the grid quietly lost the middle
 * of the shop and no test noticed, because every individual request was valid.
 */
export const OWN_PARAMS = ['q', 'sort', 'set', 'offset', 'limit'] as const

/**
 * Strip this module's controls from a query string.
 *
 * Used when forwarding a page's params to the API: the API must not inherit the
 * page's `offset`, or every batch after the first would skip further and further
 * down the catalogue.
 */
export function withoutOwnParams(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams()
  for (const [key, value] of params) {
    if (!(OWN_PARAMS as readonly string[]).includes(key)) out.append(key, value)
  }
  return out
}
