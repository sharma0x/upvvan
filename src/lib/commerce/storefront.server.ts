import 'server-only'

import { config as appConfig } from '@/lib/config'
import { loadGeo } from '@/lib/geo/loader.server'
import { loadCatalogue, toFacetable, type CatalogueItem } from '@/lib/catalogue/loader.server'
import type { Facetable } from '@/lib/catalogue/facets'
import { loadPriceBookTerms, type PriceBookTerms } from '@/lib/commerce/guarantee'

/**
 * The one storefront read.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Every customer-facing page needs the same four things: which city we are
 * selling as, the catalogue for it, the guarantee terms it sells under, and
 * artwork. `src/app/page.tsx` had all four inline, including a hand-rolled city
 * picker. When the PLP, the collection pages, the PDP and the cart were each
 * written against their own copy of that logic, the site grew four ways to
 * disagree with itself about which city it is — which is the failure mode the
 * original comment in `page.tsx` was written to prevent, reintroduced four
 * times over.
 *
 * So this is the single entry point. It also fixes the original problem
 * properly: the city is resolved by slug with an explicit ambiguity error, and
 * "no active city" is a typed result rather than an exception, so a page can
 * render an honest "we have not opened here yet" instead of crashing.
 */

/**
 * The slug we sell as.
 *
 * A constant rather than config because it is not an operational knob — it is
 * the decision "one city at launch", which is a product decision with a named
 * consequence (the nav, the coverage copy and the sitemap all hang off it).
 * Adding a second city means changing this line on purpose, in a commit whose
 * message says so, which is more than can be said for a database row that
 * someone flipped.
 */
export const DEFAULT_CITY_SLUG = 'bengaluru'

export type Storefront =
  | {
      /** No city is trading. Every page must render its not-open-yet state. */
      state: 'no-city'
    }
  | {
      state: 'ready'
      cityId: number
      cityName: string
      citySlug: string
      /** Printable state name for a delivery label — "Karnataka", not "KA". */
      stateName: string
      /** Per-city GST in basis points, falling back to the global default. */
      taxRateBp: number
      /** GSTIN for the footer and the invoice. Per city, never global. */
      gstin: string | null
      /** How many cities are flagged active. >1 is an operator mistake. */
      activeCityCount: number
      items: CatalogueItem[]
      /** `items` adapted to the facet vocabulary. One conversion, one place. */
      facets: Facetable[]
      terms: PriceBookTerms
    }

export async function loadStorefront(): Promise<Storefront> {
  const geo = await loadGeo()
  const active = geo.cities.filter((c) => c.isActive)

  /*
   * Deterministic city selection, and the ambiguity is reported rather than
   * resolved. The first implementation took `cities[0]`; the order is whatever
   * Postgres returned, so a stray test city with `is_active = true` silently
   * became the storefront and every customer saw the wrong city's catalogue.
   * A warning is not enough — an operator who does not read logs still ships it.
   */
  let city = active.find((c) => c.slug === DEFAULT_CITY_SLUG) ?? null
  if (!city && active.length === 1) city = active[0]!

  if (active.length > 1) {
    console.error(
      `[storefront] ${active.length} cities are marked active (${active
        .map((c) => c.slug)
        .join(', ')}). Showing "${city?.slug ?? 'none'}". Exactly one city may trade at a time — ` +
        'switch the others off in HQ admin, or change DEFAULT_CITY_SLUG deliberately.',
    )
  }

  if (!city) return { state: 'no-city' }

  const cityId = geo.cityIdBySlug.get(city.slug)!

  // Catalogue and terms are independent reads, so they go in parallel. Both
  // degrade to a safe answer rather than throwing: a storefront that will not
  // render because the guarantee lookup failed is worse than one that promises
  // 48 hours instead of 90.
  const [items, terms] = await Promise.all([loadCatalogue(cityId), loadPriceBookTerms(cityId)])

  return {
    state: 'ready',
    cityId,
    cityName: city.name,
    citySlug: city.slug,
    stateName: city.stateName ?? city.stateCode ?? '',
    taxRateBp: city.taxRateBp ?? appConfig.business.defaultTaxRateBp,
    gstin: city.gstin ?? null,
    activeCityCount: active.length,
    items,
    facets: items.map(toFacetable),
    terms,
  }
}

/** Narrow a loaded storefront, for pages that genuinely require a city. */
export function requireStorefront(storefront: Storefront): Extract<Storefront, { state: 'ready' }> {
  if (storefront.state === 'no-city') {
    throw new Error(
      'This page needs a trading city but none is active. Render the not-open-yet state instead of calling requireStorefront().',
    )
  }
  return storefront
}
