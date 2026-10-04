import type { Metadata } from 'next'

import { loadGeo } from '@/lib/geo/loader.server'
import ServiceabilityChecker from '@/components/geo/ServiceabilityChecker'

export const metadata: Metadata = {
  title: 'Upvvan — coverage check',
  description: 'Delivery coverage by pincode.',
}

/**
 * This page reads live coverage data, so it must never be prerendered at build
 * time — a build has no business depending on which pincodes exist, and a static
 * snapshot of coverage is exactly the over-promising failure mode this screen
 * exists to prevent.
 *
 * `dynamic` is set explicitly rather than inferred, because the failure mode is
 * silent: without it, a build-time query either crashes the build (loud, fine)
 * or freezes coverage at build time (quiet — and a customer is told we deliver to
 * a pincode we have since stopped serving).
 */
export const dynamic = 'force-dynamic'

/**
 * Phase 0's customer-facing surface: the coverage check.
 *
 * Why this screen and not a homepage. Phase 0 is GEO, and the one thing that must
 * be true before anything else gets built is that we never promise a pincode we
 * cannot serve. That is the loudest, most-documented failure across every
 * competitor in the research — the customer told "not in your city yet" does not
 * try again, and the one told yes and given no rider is worse.
 *
 * So the first thing this app can do is tell the truth about a pincode.
 */
export default async function Home() {
  const geo = await loadGeo()
  const cities = geo.cities.filter((c) => c.isActive)

  return (
    <main className="px-base py-2xl mx-auto max-w-[640px]">
      <p className="text-label-caps text-primary m-0">Coverage</p>

      <h1 className="my-sm">Do we deliver to your pincode?</h1>

      <p className="text-ink-muted mt-0">
        We only take orders we can actually deliver. Telling you early is kinder than a cancelled
        order later.
      </p>

      {cities.length === 0 ? (
        <p className="mt-lg border-warning bg-surface px-base py-base rounded-sm border">
          We have not opened delivery in any city yet. A city appears here once its state
          horticulture licence is approved and its serviceable pincodes are imported — both are
          enforced by the database, not by convention.
        </p>
      ) : (
        <ServiceabilityChecker cities={cities} />
      )}

      <footer className="mt-3xl border-border pt-base text-ink-muted border-t text-sm">
        Prepaid only. No cash on delivery — a returned plant is unsellable, so we do not create the
        return leg.
      </footer>
    </main>
  )
}
