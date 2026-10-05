import type { MetadataRoute } from 'next'

import { config } from '@/lib/config'

/**
 * robots.txt
 *
 * ── WHY THESE EXACT DISALLOW RULES ───────────────────────────────────────────
 * Three surfaces must never be indexed, and each for a specific reason rather
 * than as a blanket "private app" guess:
 *
 *  1. `/admin` and `/api/*` — Payload's CMS and our REST/GraphQL surface.
 *     Indexing either leaks catalogue internals and authenticated endpoints into
 *     search results. They are also already auth-gated, so a crawler only ever
 *     sees a login page — which actively hurts by advertising the panel.
 *
 *  2. `/admin-ops` and `/rider` — the dispatch console and the rider surface.
 *     Both are internal operations tooling. Not secret (they are auth-gated) but
 *     not for search either.
 *
 *  3. `/cart`, `/order/`, `/claim/` — transactional and per-customer. An
 *     indexed cart or an indexed order-confirmation URL is a privacy leak and
 *     looks broken in results.
 *
 * `Disallow: /` would be wrong. We WANT the catalogue indexed — organic long-tail
 * is how a single-city shop gets customers who never see an ad.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/admin-ops',
          '/rider',
          '/api/',
          '/cart',
          '/order/',
          '/claim/',
          '/policies/', // legal pages: readable, not indexed as landing pages
        ],
      },
    ],
    sitemap: `${config.server.url}/sitemap.xml`,
    host: config.server.url,
  }
}