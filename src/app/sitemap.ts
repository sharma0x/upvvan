import type { MetadataRoute } from 'next'

import { config } from '@/lib/config'
import { loadGeo } from '@/lib/geo/loader.server'
import { loadCatalogue } from '@/lib/catalogue/loader.server'

/**
 * sitemap.xml — generated from the LIVE catalogue, not a static list.
 *
 * ── WHY THIS IS DYNAMIC AND WHY THAT MATTERS HERE SPECIFICALLY ────────────────
 * This shop's catalogue rotates with the season: March–June is 40–46°C in
 * Bengaluru and tender species are pulled out of the window entirely, replaced
 * by hardy stock. A hand-maintained sitemap would go stale within weeks and
 * would keep advertising listings that no longer exist — the exact "dead page"
 * failure that erodes trust in a catalogue business.
 *
 * So it is generated per request from `loadCatalogue`, which already applies the
 * seasonal filter. A species out of season simply is not in the sitemap, because
 * it is not in the shop.
 *
 * ── WHY EACH PAGE IS EXCLUDED ────────────────────────────────────────────────
 * Cart, checkout, order and claim URLs are per-customer and transactional —
 * never indexed. `/admin`, `/admin-ops` and `/rider` are internal. Only the
 * storefront, the live plant PDPs, and the legal pages a customer may need to
 * cite are listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.server.url

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: base,
      changeFrequency: 'daily',
      // The catalogue itself changes daily, so the storefront's importance is
      // genuinely high-frequency.
      priority: 1,
    },
    {
      url: `${base}/policies`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${base}/grievance`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  /*
   * Guarded deliberately. A sitemap that throws returns a 500 to every crawler,
   * which is worse than a sitemap with only the three static entries — crawlers
   * treat a failed sitemap as "site is unhealthy" and deprioritise it. The
   * storefront must never go dark in search because the catalogue query failed.
   */
  try {
    const geo = await loadGeo()
    const city = geo.cities.find((c) => c.isActive)
    if (!city) return staticEntries

    const items = await loadCatalogue(geo.cityIdBySlug.get(city.slug)!)
    const seen = new Set<string>()

    const productEntries: MetadataRoute.Sitemap = []
    for (const item of items) {
      // One entry per SPECIES, not per SKU. The size tiers are query parameters
      // on the same URL (`?tier=MD`), and listing all of them would emit
      // near-duplicate URLs for one plant.
      if (seen.has(item.slug)) continue
      seen.add(item.slug)

      productEntries.push({
        url: `${base}/plant/${item.slug}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }

    return [...staticEntries, ...productEntries]
  } catch (err) {
    console.error('[sitemap] catalogue unavailable, serving static entries only', err)
    return staticEntries
  }
}
