import { Suspense } from 'react'
import type { Metadata } from 'next'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { hasActiveSelection, parseFacetSelection, priceBounds } from '@/lib/catalogue/facets'
import { formatPaise } from '@/lib/catalogue/pricing'
import { COLLECTIONS } from '@/lib/catalogue/collections'
import { resolveArt } from '@/components/catalogue/ItemGrid'
import PagedItemGrid from '@/components/catalogue/PagedItemGrid'
import { BATCH_SIZE } from '@/lib/catalogue/paging'
import { firstBatch } from '@/lib/catalogue/grid.server'
import { readSort, rowsFor } from '@/lib/catalogue/query.server'
import FacetControls from '@/components/catalogue/FacetControls'
import CollectionTiles from '@/components/catalogue/CollectionTiles'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * The catalogue — `/plants`.
 *
 * ── WHY THIS IS A PAGE AND NOT THE HOMEPAGE ────────────────────────────────
 *
 * The homepage was doing this job and could not do it well: its grid is
 * unfiltered, un-sortable and unbounded, so a customer who wanted "low light,
 * pet safe, cheapest first" had three options and none of them were the right
 * one. Every competitor audited has this page; ours was an anchor.
 *
 * ── WHY THE FILTERS ARE SERVER-RENDERED ────────────────────────────────────
 *
 * `/plants?light=low&care=easy` is a URL a customer can bookmark, send to their
 * flatmate, and a crawler can index. Kyari derives ~250 indexable collection
 * URLs from exactly this shape, and it is the cheapest SEO surface in the
 * category. A client-only filter tree produces none of them.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
 *
 * No reviews filter, no "new arrivals", no urgency banner. The catalogue is a
 * few dozen listings grown at the bench, and a filter that returns everything
 * for every input is a control that teaches a customer not to use controls.
 */
export async function generateMetadata(): Promise<Metadata> {
  const storefront = await loadStorefront()
  const name = storefront.state === 'ready' ? storefront.cityName : 'Bengaluru'
  return {
    title: `Plants in season — ${name}`,
    description: `Every plant we can honestly sell in ${name} right now, with its light requirement, watering interval and measured size before you buy. Filter by room, light, difficulty and pets.`,
    alternates: { canonical: '/plants' },
  }
}

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="We have not opened yet" />

  const plainParams = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(plainParams)) {
    if (Array.isArray(value)) for (const v of value) params.append(key, v)
    else if (value != null) params.set(key, value)
  }

  const selection = parseFacetSelection(params)
  const sort = readSort(params.get('sort'))

  /*
   * Two pools, deliberately.
   *
   * `ALL` is the entire catalogue and is what the facet counts are computed
   * from, because a count that changes as you tick is not a count. `FILTERED` is
   * what the customer is looking at.
   *
   * The season gate is applied before both, and it is what makes this page
   * honest: a species we cannot grow or ship this month is not in here at all,
   * rather than sitting behind a "pre-order" button we would then have to
   * honour in May.
   */
  const all = storefront.facets

  /*
   * The filter decision itself now lives in `rowsFor`, shared with `/api/catalogue`.
   *
   * That matters because "Show more" is a second request: if the page filtered one
   * way and the API another, the second batch would arrive in a different order and
   * the shopper would see plants repeat. One implementation, one answer — the page
   * and the API cannot disagree about which rows match, because they call the same
   * function with the same params.
   */
  const rows = rowsFor(storefront, params)

  const art = resolveArt(rows)
  const bounds = priceBounds(all)
  const filteredOut = all.length - rows.length

  /*
   * "12 plants and 3 packs of soil", not "15 plants".
   *
   * A bag of cocopeat is not a plant, and the number that labels the grid is the
   * first thing a customer reads. More practically, the remedies differ — plants
   * are replaced, supplies are refunded in money — so calling the whole
   * catalogue "plants" quietly overstates the replacement promise for a third of
   * what is on screen.
   */
  const plantCount = rows.filter((r) => r.itemClass === 'plant').length
  const supplyCount = rows.length - plantCount

  /*
   * JSON-LD for the result set. A faceted catalogue with no structured data
   * gives a crawler a page of eleven divs and nothing else, and the ItemList is
   * the cheapest way to say "these are eleven products at these prices".
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Plants in season in ${storefront.cityName}`,
    numberOfItems: rows.length,
    itemListElement: rows.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: item.commonName,
        description: item.summary ?? item.description ?? undefined,
        sku: item.skuCode,
        image: art.get(item.slug)?.src,
        offers: {
          '@type': 'Offer',
          price: (item.ladder[0]!.totalPaise / 100).toFixed(2),
          priceCurrency: 'INR',
          availability:
            item.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
        ...(item.rating.count > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: item.rating.average.toFixed(1),
                reviewCount: item.rating.count,
              },
            }
          : {}),
      },
    })),
  }

  return (
    <main id="main" tabIndex={-1}>
      {/*
        The header states the filter state in words, not just in the checkboxes.
        A customer who arrived from a shared link needs to know what the URL
        meant before they trust the grid below it.
      */}
      <header className="border-border px-base pt-2xl pb-lg mx-auto max-w-[1120px] border-b">
        <p className="text-label-caps text-clay m-0">
          {storefront.cityName} · {all.length} listing{all.length === 1 ? '' : 's'} in season
        </p>
        <h1 className="mt-xs mb-0">Every plant we can honestly sell you right now</h1>
        <p className="text-ink-muted mt-sm mb-0 max-w-[62ch]">
          March to June runs 40–46°C in {storefront.cityName}, and that is why the catalogue changes
          shape three times a year. We swap species rather than pause the shop, so what you see here
          is what is genuinely on the bench this month. Pot choice is on each plant&rsquo;s page.
        </p>
      </header>

      <div className="gap-xl px-base py-xl mx-auto grid max-w-[1120px] lg:grid-cols-[280px_1fr]">
        <div>
          {/*
            `useSearchParams` inside a client component forces the subtree to be
            client-rendered, which is exactly what we want for a control panel
            and exactly what we do not want for the grid — hence the boundary.
          */}
          <Suspense fallback={<div className="h-[600px]" aria-hidden />}>
            <FacetControls
              items={all}
              sort={sort}
              resultCount={rows.length}
              totalCount={all.length}
            />
          </Suspense>
        </div>

        <div>
          <div className="border-border mb-base gap-base pb-sm flex flex-wrap items-baseline justify-between border-b">
            <h2 className="m-0">
              {supplyCount === 0
                ? `${plantCount} plant${plantCount === 1 ? '' : 's'}`
                : `${plantCount} plant${plantCount === 1 ? '' : 's'} and ${supplyCount} ${
                    supplyCount === 1 ? 'pack' : 'packs'
                  } of soil, feed & tools`}
              {filteredOut > 0 && (
                <span className="text-ink-muted text-lg font-normal">
                  {' '}
                  of {all.length} — {filteredOut} filtered out
                </span>
              )}
            </h2>
            {hasActiveSelection(selection) && (
              <p className="text-ink-muted m-0 text-sm">
                Priced from {formatPaise(bounds.minPaise)} for the plant alone.
              </p>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyResult hasSelection={hasActiveSelection(selection)} />
          ) : (
            <PagedItemGrid
              initial={firstBatch(rows, art, BATCH_SIZE).first}
              params={plainParams}
              total={rows.length}
            />
          )}

          {/*
            The collection tiles are ON this page, below the grid, not in the
            header. A customer who has filtered and found nothing needs a way
            out that is not "clear your filters" — and a customer who wants to
            browse by room has a page, not a set of checkboxes.
          */}
          <div className="mt-3xl">
            <CollectionTiles
              items={all}
              collections={COLLECTIONS.filter((c) => c.axis !== 'room')}
              heading="Or start from what you need"
            />
          </div>
        </div>
      </div>

      {/*
        A page-level policy note, not a footer. `SiteFooter` in the root layout
        carries the E-Commerce Rules r.4(2) disclosures and a second <footer>
        here would render before them — invalid HTML, and it would push the
        compliance block below a paragraph.
      */}
      <p className="border-border text-ink-muted mt-3xl px-base pt-base mx-auto max-w-[1120px] border-t text-sm">
        Prepaid only. No cash on delivery — a returned plant is unsellable, so we do not create the
        return leg. Every listing states its size, light requirement and watering interval before
        you buy, and every dimension is measured at the bench rather than estimated.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}

/**
 * The empty state.
 *
 * ── WHY THIS IS NOT "NO RESULTS" ────────────────────────────────────────────
 *
 * An empty grid with a sentence saying no results matches is the least helpful
 * thing a store can render, and it is what every competitor does. Two very
 * different situations land on it:
 *
 *   · The catalogue really is empty this month (a genuine summer). Then the
 *     customer needs to know when it changes, and that the shop is not closed.
 *   · The customer filtered themselves into a corner — pet-safe AND direct sun
 *     AND under ₹200 is a real contradiction, and it is our job to say so and
 *     point at the axis that is doing the damage.
 *
 * So the two cases render differently, and the second one names the facet that
 * emptied the grid.
 */
function EmptyResult({ hasSelection }: { hasSelection: boolean }) {
  return (
    <div className="border-border bg-surface-raised p-lg rounded-md border">
      <h3 className="mt-0">Nothing matches all of that</h3>
      {hasSelection ? (
        <>
          <p>
            These filters contradict each other — and that is a real answer, not a bug. It usually
            means two of them want opposite things: a pet-safe plant that wants direct sun does not
            really exist.
          </p>
          <p className="mb-0">
            Try dropping the <strong>Light</strong> filter first, then re-add the others. Or{' '}
            <a href="/plants" className="text-primary underline">
              start over
            </a>
            .
          </p>
        </>
      ) : (
        <p className="mb-0">
          Nothing is in season here right now. We would rather say so than sell you something that
          will not survive the weather — species go in and out with the season, and the shop does
          not close.
        </p>
      )}
    </div>
  )
}

/**
 * Read a sort key from the query string, defaulting rather than throwing.
 *
 * An unknown `?sort=` is a hand-edited URL, a stale bookmark, or a crawler
 * probing. Throwing would 500 a page over a query parameter, which is both a
 * terrible experience and a bad signal for the URL. The total set is closed, so
 * anything unrecognised is `featured`.
 */
