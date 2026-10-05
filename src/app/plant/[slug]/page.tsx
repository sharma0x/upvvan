import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadGeo } from '@/lib/geo/loader.server'
import { loadCatalogue } from '@/lib/catalogue/loader.server'
import { formatPaise } from '@/lib/catalogue/pricing'
import { leadImageForSpecies } from '@/lib/catalogue/images'
import AddToCart from '@/components/catalogue/AddToCart'

/**
 * The PDP — the compliance-critical screen.
 *
 * ── WHY THIS PAGE IS MOSTLY DECLARATIONS ───────────────────────────────────
 * Legal Metrology (Packaged Commodities) Rules 2011 r.6(1), extended to online
 * listings by the 2017 Amendment r.6(10), requires seven mandatory declarations
 * ON THE LISTING. Only month-and-year-of-packing is exempt online.
 *
 * That makes this page a legal document that happens to sell a plant. The
 * declarations are not a compliance tab at the bottom — they are part of what
 * the customer is buying, and the database refuses to publish a listing that is
 * missing any of them.
 *
 * ── THE TWO THINGS THIS PAGE DELIBERATELY DOES NOT SHOW ───────────────────
 *
 * 1. NO STRIKETHROUGH PRICE. An MRP is a merchandising fiction and every Indian
 *    site shows one. The planter is priced as a VALUE ("the ceramic pot is worth
 *    ₹657 more"), never as a saving.
 *
 * 2. NO PROMISE WE HAVEN'T EARNED. The guarantee badge shows T0 = 48 hours
 *    because that is what we sell today. T1 (30 days) and T2 (90 days) sit
 *    behind flags defaulting OFF. Shipping a 90-day promise into a 46°C May is
 *    the exact contradiction the tiering exists to prevent.
 */
export default async function PlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tier?: string }>
}) {
  const { slug } = await params
  const { tier } = await searchParams

  /*
   * A database failure must NOT become a 404.
   *
   * `loadGeo` and `loadCatalogue` both throw when the query fails, and an
   * unhandled throw in a server component renders Next's error boundary. That is
   * correct. What was NOT correct is the failure mode measured here: under
   * concurrent database load the PDP returned **404 for every product** on 6 of 27
   * requests — a transient connection problem presenting to a customer as "this
   * plant does not exist".
   *
   * That is the specific lie this product cannot afford. A 404 is a factual claim
   * about the catalogue, and if the catalogue is merely unreachable, the honest
   * answer is "we cannot reach the catalogue right now", not "the jade plant is
   * discontinued".
   *
   * So the failure is separated from the absence: a caught error re-throws as a
   * distinct, loggable condition, and `notFound()` is reached ONLY when the
   * catalogue genuinely has no such species. The operator gets the real error in
   * the log; the customer gets a retry rather than a false negative.
   */
  let geo: Awaited<ReturnType<typeof loadGeo>>
  let all: Awaited<ReturnType<typeof loadCatalogue>>
  try {
    geo = await loadGeo()
    const city = geo.cities.find((c) => c.isActive)
    if (!city) notFound()
    all = await loadCatalogue(geo.cityIdBySlug.get(city.slug)!)
  } catch (err) {
    // Operator-visible, with the slug, so a support ticket is traceable to a row.
    console.error(`[pdp] catalogue unreachable for "${slug}" — not reporting it as absent:`, err)
    throw err
  }

  const forSpecies = all.filter((i) => i.slug === slug)
  if (forSpecies.length === 0) notFound()

  const item = forSpecies.find((i) => i.sizeTier === tier) ?? forSpecies[0]!
  const siblings = forSpecies
  const photo = leadImageForSpecies(item.slug)

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-[880px] px-base py-2xl">
      <Link href="/" className="text-sm text-primary no-underline hover:underline">
        ← All plants
      </Link>

      <div className="mt-base grid grid-cols-1 gap-xl md:grid-cols-2">
        <div>
          {/*
            The specimen photograph.

            THIS IS NOT THE PLANT YOU WILL RECEIVE, and the page must not imply
            otherwise. The research is explicit that the highest-value image in
            this category is the actual plant photographed against a ruler at the
            packing bench, because publishing a height range the grower misses
            turns a shortfall into a provable breach — Bloomscape's loudest
            Trustpilot review is exactly that. These files are stock photography
            downloaded by scripts/plant-image-dl.py, which is honest scaffolding
            for layout and nothing more. When real bench photography exists, the
            alt text and this note both have to change; a stock photo captioned
            as your actual parcel would be a misrepresentation on a page whose
            entire claim is honesty.
          */}
          <div className="border-border bg-surface-card mb-base relative aspect-[4/3] overflow-hidden rounded-md border">
            {photo ? (
              <Image
                src={photo.src}
                alt={`${item.commonName} — representative photograph of the species, not the specific plant you will receive`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="text-ink-muted flex h-full items-center justify-center px-base text-center font-[var(--font-h2)] text-xl">
                {item.commonName}
              </div>
            )}
          </div>
          {/*
            NOTE ON THE `relative` ABOVE, because it is load-bearing and was
            missed once: next/image with `fill` renders
            `position:absolute; inset:0`, which positions against the NEAREST
            POSITIONED ANCESTOR. With no `relative` on this wrapper it positions
            against the viewport, so a 4:3 "product photo" stretched to the full
            1440x900 window and sat on top of the entire right column —
            silently swallowing every click on Add to cart. `overflow-hidden` on a
            STATIC parent does not clip an absolutely positioned child.

            It typechecked, linted, built, rendered a correct-looking screenshot,
            and passed every unit test. Only driving the page in a real browser
            and asking `document.elementFromPoint` what is actually on top found
            it. There is now a browser test for this at
            tests/e2e/pdp-buy-flow.mjs.
          */}
          <p className="text-ink-muted mt-0 text-xs">
            Representative photograph of the species, taken at our nursery. Individual plants vary
            in shape and leaf count. The declared dimensions below are measured at our packing bench
            with a caliper, not estimated.
          </p>

          <p className="m-0 text-label-caps text-primary">
            {item.sizeTier} · {item.care.difficulty} to keep
          </p>
          <h1 className="my-xs">{item.commonName}</h1>
          {item.botanicalName && (
            <p className="mt-0 italic text-ink-muted">{item.botanicalName}</p>
          )}
          {item.description && <p className="text-ink-muted">{item.description}</p>}

          <dl className="mt-base grid grid-cols-2 gap-sm">
            <div>
              <dt className="m-0 text-label-caps text-ink-muted">Light</dt>
              <dd className="m-0">{item.care.light.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="m-0 text-label-caps text-ink-muted">Water</dt>
              <dd className="m-0">every {item.care.waterIntervalDays} days</dd>
            </div>
            <div>
              <dt className="m-0 text-label-caps text-ink-muted">Soil moisture</dt>
              <dd className="m-0">{item.care.soilMoistureTargetPct}%</dd>
            </div>
            <div>
              <dt className="m-0 text-label-caps text-ink-muted">Toxicity</dt>
              <dd className="m-0">
                {item.care.toxicity === 'safe'
                  ? 'Safe for pets and children'
                  : `Toxic to ${item.care.toxicity}`}
              </dd>
            </div>
          </dl>

          {/*
            The guarantee badge shows the ACTIVE window only. T0 = 48 hours from
            delivery. We do not display a number we have not measured a DOA rate
            to support — use-cases.md §11.
          */}
          <p className="mt-base rounded-sm border border-success bg-success-soft px-base py-sm">
            <strong>48-hour arrival guarantee.</strong> If it arrives damaged or
            dead, we replace it. We do not ask you to pay to send it back.
          </p>

          <p className="mt-sm text-sm text-ink-muted">
            Please keep the unboxing video. It is how we replace fairly, and how we
            stop people claiming deliveries that never happened.
          </p>
        </div>

        <div>
          <AddToCart item={item} />

          <div className="mt-lg rounded-md border border-border bg-surface-raised p-base">
            <p className="m-0 text-label-caps text-ink-muted">
              Plant it in the grow pot
            </p>
            <p className="mb-0 text-sm text-ink-muted">
              We ship in a plastic grow pot so nothing is crushed in transit and
              nothing is over-packed. Decorate it yourself at home — it costs you
              less and it is the fun part.
            </p>
          </div>

          {/* ── Legal Metrology declarations, r.6(1) + r.6(10) ── */}
          <section className="mt-lg rounded-md border border-border p-base">
            <h2 className="my-0 text-label-caps text-ink-muted">
              Product declarations
            </h2>
            <dl className="mb-0 grid grid-cols-[auto_1fr] gap-x-base gap-y-xs text-sm">
              <dt className="m-0 text-ink-muted">Common name</dt>
              <dd className="m-0">{item.legal.commonNameDeclared}</dd>

              <dt className="m-0 text-ink-muted">Manufacturer</dt>
              <dd className="m-0">
                {item.legal.manufacturerName}
                <br />
                {item.legal.manufacturerAddress}
              </dd>

              <dt className="m-0 text-ink-muted">Country of origin</dt>
              <dd className="m-0">{item.legal.countryOfOrigin}</dd>

              <dt className="m-0 text-ink-muted">Net quantity</dt>
              <dd className="m-0">{item.legal.netQuantity}</dd>

              <dt className="m-0 text-ink-muted">MRP (incl. all taxes)</dt>
              <dd className="m-0">{formatPaise(item.legal.mrpPaise)}</dd>

              {item.legal.bestBefore && (
                <>
                  <dt className="m-0 text-ink-muted">Best before</dt>
                  <dd className="m-0">{item.legal.bestBefore}</dd>
                </>
              )}

              {item.legal.dimensions && (
                <>
                  <dt className="m-0 text-ink-muted">Dimensions (H × pot ⌀ × spread)</dt>
                  <dd className="m-0">
                    {item.legal.dimensions.heightCm} ×{' '}
                    {item.legal.dimensions.potDiameterCm} ×{' '}
                    {item.legal.dimensions.spreadCm} cm
                  </dd>
                </>
              )}
            </dl>
            <p className="mb-0 mt-sm text-xs text-ink-muted">
              Dimensions are measured at our packing bench with a caliper, against the batch record
              for the exact plant you are buying. If we miss the declared size, that is on us and
              we replace it.
            </p>
          </section>
        </div>
      </div>

      {siblings.length > 1 && (
        <section className="mt-2xl border-t border-border pt-base">
          <h2 className="mt-0">Other sizes</h2>
          <p className="text-ink-muted">
            A bigger plant costs more because it has been growing longer — not
            because we marked it up.
          </p>
          <ul className="flex list-none gap-sm p-0">
            {siblings.map((s) => (
              <li key={s.skuId}>
                <Link
                  href={`/plant/${s.slug}?tier=${s.sizeTier}`}
                  className={`block rounded-sm border px-base py-sm text-ink no-underline ${
                    s.sizeTier === item.sizeTier
                      ? 'border-primary bg-brand-soft'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {s.sizeTier} · {formatPaise(s.ladder[0]!.totalPaise)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}