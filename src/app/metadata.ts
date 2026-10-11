import type { Metadata } from 'next'

import { config } from '@/lib/config'

/**
 * Root metadata.
 *
 * ── WHY THIS WAS MISSING AND WHY IT MATTERS MORE THAN IT LOOKS ───────────────
 * Before this file the entire storefront emitted NO `<title>`, no meta
 * description, no canonical, and no Open Graph tags. That is not a cosmetic
 * miss. A D2C plant catalogue depends on organic search for the exact long tail
 * its buyers type — "jade plant care india", "low light indoor plants bangalore",
 * "plants that survive ac flat" — and none of that traffic can land without
 * titles and descriptions. It also means every WhatsApp/Instagram share of a
 * product link rendered as a bare URL.
 *
 * `metadataBase` is REQUIRED for `alternates.canonical` and every OG image URL
 * to resolve to an absolute URL. Without it Next emits relative paths, which
 * every social crawler rejects.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────────
 * No `keywords` meta. It has had no effect in search since 2009 and including it
 * only signals an outdated site to a crawler. No `google-site-verification` here
 * — that belongs in env, and is reported as a config addition.
 */
const titleTemplate = '%s · Upvvan'

export const metadata: Metadata = {
  metadataBase: new URL(config.server.url),

  title: {
    default: 'Upvvan — live plants grown and delivered in Bengaluru',
    template: titleTemplate,
  },

  description:
    'Live plants grown on our own two-acre nursery in Bengaluru and delivered by our own riders the same evening. Free delivery, no minimum order, prepaid only, 48-hour arrival guarantee.',

  applicationName: 'Upvvan',
  generator: 'Next.js',
  referrer: 'same-origin',
  formatDetection: {
    // A phone number rendered as a link is useful; a date auto-linked to a
    // calendar is noise. Explicit beats browser default.
    telephone: true,
    date: false,
    address: false,
    email: false,
  },

  // Single-city by design, so the storefront is not `alternates`-ed by city —
  // there is only ever one canonical storefront. This is deliberate: the
  // research is explicit that claiming geographies we cannot serve is the single
  // most-complained-about failure in this category.
  alternates: { canonical: '/' },

  openGraph: {
    type: 'website',
    siteName: 'Upvvan',
    locale: 'en_IN',
    url: '/',
    title: 'Upvvan — live plants grown and delivered in Bengaluru',
    description:
      'Grown on our own nursery, delivered by our own riders. Free delivery, no minimum, prepaid only.',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Upvvan — live plants grown and delivered in Bengaluru',
    description:
      'Grown on our own nursery, delivered by our own riders. Free delivery, no minimum, prepaid only.',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Image previews in results, at the two sizes WhatsApp/Google actually use.
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  other: {
    // The `.test` TLD means no favicon request 404s during local development,
    // which was the one console error on the storefront.
    'geo.region': 'IN-KA',
    'geo.placename': 'Bengaluru',
  },
}

/** Shared per-page metadata factory, so every route declares a real title+description. */
export function pageMetadata(title: string, description: string, path = '/'): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · Upvvan`, description, url: path, type: 'website' },
    twitter: { card: 'summary_large_image', title: `${title} · Upvvan`, description },
  }
}
