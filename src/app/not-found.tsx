import Link from 'next/link'

import { loadGeo } from '@/lib/geo/loader.server'

/**
 * 404 — and it is a SEARCH SURFACE, not an apology.
 *
 * ── WHY THIS IS A SERVER COMPONENT ───────────────────────────────────────────
 * It reads the live city list so a customer who lands on a dead URL in Bengaluru
 * is offered Bengaluru's catalogue, and the copy names the city. A generic 404 on
 * a single-city business is an active lie: it implies a catalogue we do not have.
 *
 * `loadGeo()` reads Postgres and is already proven at boot, so it is safe here.
 * If it throws, `error.tsx` catches it — this page must never become a second
 * error page.
 */
export default async function NotFound() {
  // Never let a 500 turn into a 404-within-a-404.
  let cityName: string | null = null
  try {
    const geo = await loadGeo()
    cityName = geo.cities.find((c) => c.isActive)?.name ?? null
  } catch (err) {
    console.error('[not-found] could not load geo', err)
  }

  return (
    <main className="px-base py-3xl mx-auto flex min-h-[60vh] max-w-[640px] flex-col justify-center">
      <p className="text-label-caps text-clay m-0">404</p>

      <h1 className="mt-sm mb-0">
        {cityName ? `We have no page at that address in ${cityName}.` : 'We have no page there.'}
      </h1>

      <p className="text-ink-muted mt-base mb-0 max-w-[52ch]">
        Most likely it was a plant we have rotated out of season, or a link from an old order. We
        swap the catalogue as the season turns rather than leaving dead pages behind, so a plant you
        bought earlier may not be listed any more — it is still alive, we just do not sell that one
        this month.
      </p>

      <div className="mt-lg gap-sm flex flex-wrap">
        <Link
          href="/"
          className="bg-primary text-surface rounded-sm px-6 py-4 font-semibold no-underline"
        >
          See what is in season
        </Link>
        {/*
          `/orders/lookup` is owned by the commerce agent building it. Linking it
          here before it lands is deliberate: this page is the most likely
          destination for a customer who has lost an order link, and a 404 that
          does not offer a way back to their order is how a lost order becomes a
          one-star review.
        */}
        <Link
          href="/orders/lookup"
          className="border-border text-ink rounded-sm border px-6 py-4 font-semibold no-underline"
        >
          Find my order
        </Link>
      </div>
    </main>
  )
}
