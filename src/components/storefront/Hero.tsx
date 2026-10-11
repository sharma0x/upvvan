import Link from 'next/link'

import ServiceabilityChecker from '@/components/geo/ServiceabilityChecker'
import type { CityRef } from '@/lib/geo/serviceability'

/**
 * The hero — split layout, coverage question above the fold.
 *
 * ── WHY THE COVERAGE CHECKER IS IN THE HERO, NOT BELOW THE CATALOGUE ─────────
 * Seven of the seven competitors audited open with a product carousel and put
 * "do we deliver to you" in the nav or nowhere at all. For our customer — a
 * first-time plant buyer in a rented Bengaluru flat — that is the wrong order.
 * They do not yet trust us, so they cannot want a plant; they need to know the
 * single fact that decides whether this is worth their attention.
 *
 * Over-promising geography is the single most-complained-about failure in this
 * category, and Urvann grew revenue 54% while rating 2.1/5. The honest coverage
 * answer is a competitive weapon, so it gets the highest-contrast position on
 * the page: the right-hand column of the hero, above the fold, at the same
 * weight as the headline.
 *
 * ── WHY THE RIGHT COLUMN IS EMPTY OF PHOTOGRAPHY ─────────────────────────────
 * There is no product imagery in the data model — `Species` and `Skus` have no
 * upload field, and the s3Storage adapter is config-gated. Rather than ship a
 * hero with a grey placeholder box in it, the right column carries the coverage
 * checker. When photography lands, this swaps for the specimen shot and the
 * checker moves directly beneath the headline, where it still fits. The layout is
 * chosen to survive that swap without restructuring.
 */
export default function Hero({
  cities,
  cityName,
  seasonNote,
}: {
  cities: CityRef[]
  cityName: string
  seasonNote: string
}) {
  return (
    <section className="gap-xl px-base pt-2xl md:pt-3xl mx-auto grid max-w-[1120px] grid-cols-1 items-start md:grid-cols-[1.25fr_1fr]">
      <div>
        {/* The three-part proof. Clay, because nothing here is being asserted. */}
        <p className="text-label-caps text-clay m-0">Own nursery · Own riders · {cityName}</p>

        <h1 className="mt-sm mb-0">
          Plants that are grown
          <br />
          forty minutes away.
        </h1>

        <p className="text-ink-muted mt-base mb-0 max-w-[46ch] text-[1.05rem]">
          We grow them ourselves, we deliver them ourselves, and we will tell you the moment it
          lands. If it dies in the first few weeks, that is our problem, not yours.
        </p>

        <p className="text-ink-muted mt-base mb-0 max-w-[46ch] text-sm">{seasonNote}</p>

        <div className="mt-lg gap-sm flex flex-wrap items-center">
          <a
            href="#catalogue"
            className="bg-primary text-surface cursor-pointer rounded-sm px-6 py-4 font-semibold no-underline"
          >
            See what&rsquo;s in season
          </a>
          <Link
            href="/policies"
            className="border-border text-ink rounded-sm border px-6 py-4 font-semibold no-underline"
          >
            How the guarantee works
          </Link>
        </div>

        {/*
          Prepaid-only, explained rather than apologised for. Every competitor
          offers COD and none of them say what it costs them: a COD return leg
          is 25–30 days and the plant is unsellable afterwards. Saying so is a
          feature, and it pre-empts the single most common checkout objection.
        */}
        <p className="text-ink-muted mt-lg mb-0 max-w-[46ch] text-sm">
          <strong className="text-ink">Prepaid only.</strong> No cash on delivery — a returned plant
          arrives dead and cannot be sold again, so we do not create the return leg.
        </p>
      </div>

      {/*
        The coverage gate. Visually the most prominent object on the page, by
        design — see the note above.
      */}
      <div className="border-border bg-surface-card p-lg rounded-lg border">
        <h2 className="text-label-caps text-ink-muted mb-0">Do we deliver to you?</h2>
        <p className="text-ink-muted mt-xs mb-base text-sm">
          Check before you spend a minute choosing. We will tell you straight if it is not possible
          yet.
        </p>
        <ServiceabilityChecker cities={cities} />
      </div>
    </section>
  )
}
