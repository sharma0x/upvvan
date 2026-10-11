import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { findCollection, COLLECTIONS } from '@/lib/catalogue/collections'
import { resolveArt } from '@/components/catalogue/ItemGrid'
import PagedItemGrid from '@/components/catalogue/PagedItemGrid'
import { BATCH_SIZE } from '@/lib/catalogue/paging'
import { firstBatch } from '@/lib/catalogue/grid.server'
import { rowsFor } from '@/lib/catalogue/query.server'
import CollectionTiles from '@/components/catalogue/CollectionTiles'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import ProseSplit from '@/components/layout/ProseSplit'
import { WIDE } from '@/components/layout/containers'

/**
 * A collection page — `/collections/[handle]`.
 *
 * ── WHAT THIS PAGE IS FOR ───────────────────────────────────────────────────
 *
 * A facet is a control; this is a page. Someone who types "plants for a low
 * light bedroom" into a search engine needs a URL that answers it, with copy
 * that explains WHY a ZZ plant belongs in a bedroom and a tulsi does not. A
 * checkbox can never do that, which is why Kyari generates ~250 of these and it
 * is the cheapest SEO surface in the category.
 *
 * ── WHY THE COPY IS NOT GENERATED FROM A TEMPLATE ──────────────────────────
 *
 * Eleven handles are all it looks like, and the tempting approach is to
 * interpolate a handle name into a shared paragraph. That produces eleven pages
 * that say the same eleven sentences in a different order, which is the thing
 * search engines have spent twenty years getting better at ignoring, and which
 * a customer who lands on three of them in a session will recognise and bounce
 * from.
 *
 * So each handle carries its own `headline`, `body` and FAQ in
 * `collections.ts`. That is a writing cost, paid once, and it is the difference
 * between a page and a doorway.
 *
 * ── THE OTHER THING ON THE PAGE ────────────────────────────────────────────
 *
 * "How we pick" — the fields the predicate reads, stated plainly. A customer
 * asking "why is my ZZ plant not on the pet-safe page?" deserves an answer
 * before they ask. It is three lines of copy and it is the most trust-building
 * text on any plant site.
 */

/**
 * Pre-render every handle.
 *
 * These are the highest-intent URLs the site has and they must exist without a
 * database round trip on first request. The alternative — `dynamic` — means our
 * best pages are the slowest, which is backwards.
 */
export function generateStaticParams(): Array<{ handle: string }> {
  return COLLECTIONS.map((c) => ({ handle: c.handle }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const def = findCollection(handle)
  if (!def) return { title: 'Collection not found' }

  return {
    title: `${def.headline}`,
    description: def.body.slice(0, 300),
    alternates: { canonical: `/collections/${def.handle}` },
    openGraph: { title: def.headline, description: def.body.slice(0, 300), type: 'website' },
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const def = findCollection(handle)
  // An unknown handle is a 404, not an empty grid. A page that renders "nothing
  // here" at a URL that looks like a category is the doorway-page failure this
  // page type is specifically designed to avoid.
  if (!def) notFound()

  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="We have not opened here yet" />

  // Shared with /api/catalogue — `set` is how the API is told which curated set this
  // page is, so batch two matches batch one exactly.
  const rows = rowsFor(storefront, new URLSearchParams({ set: `collection:${handle}` }))
  const art = resolveArt(rows)

  /*
   * Sibling collections. A visitor who arrived on "Pet safe" and finds nothing
   * in the exact size they wanted needs somewhere to go, and "Air purifying" is
   * the honest next question. Two is enough; eleven is a menu.
   */
  const siblings = COLLECTIONS.filter((c) => c.axis === def.axis && c.handle !== def.handle).slice(
    0,
    6,
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: def.headline,
    description: def.body.slice(0, 300),
    numberOfItems: rows.length,
    itemListElement: rows.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `/plant/${item.slug}?tier=${item.sizeTier}`,
      name: item.commonName,
    })),
  }

  const faqLd = def.faq.map((entry) => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: { '@type': 'Answer', text: entry.a },
  }))

  return (
    <main id="main" tabIndex={-1}>
      <div className={`pt-base ${WIDE}`}>
        <Breadcrumbs
          trail={[
            { href: '/', label: 'Home' },
            { href: '/plants', label: 'Plants' },
            { label: def.label },
          ]}
        />
      </div>

      <header className={`border-border pt-lg pb-lg ${WIDE} border-b`}>
        {/* Split: the grid below needs 1120px, the header did not use it. */}
        <ProseSplit>
          <div>
            <p className="text-label-caps text-clay m-0">
              {rows.length} plant{rows.length === 1 ? '' : 's'} · {storefront.cityName}
            </p>
            <h1 className="mt-xs mb-0 max-w-[20ch]">{def.headline}</h1>
          </div>
          <p className="text-ink-muted mt-0 mb-0 text-[1.05rem] leading-relaxed">{def.body}</p>
        </ProseSplit>
      </header>

      <div className={`py-xl ${WIDE}`}>
        {rows.length === 0 ? (
          /*
            Honest, and it names the reason. This is the same situation Kyari and
            Ugaoo render as an empty grid: a handle whose predicate nothing in
            the current season satisfies. Usually it is seasonal, so the copy
            says so and links somewhere that has something.
          */
          <div className="border-warning bg-surface-raised p-lg rounded-md border">
            <h2 className="mt-0">Nothing in {def.label.toLowerCase()} this month</h2>
            <p className="mb-0">
              The catalogue changes with the season and nothing here clears this bar right now. We
              would rather tell you than show you a grid of nothing.{' '}
              <a href="/plants" className="text-primary underline">
                See everything in season
              </a>
              .
            </p>
          </div>
        ) : (
          <PagedItemGrid
            initial={firstBatch(rows, art, BATCH_SIZE).first}
            params={{ set: `collection:${handle}` }}
            total={rows.length}
          />
        )}
      </div>

      {/* How the list was built. Three lines; the most trust-building copy here. */}
      <section className="border-border bg-surface-raised border-y">
        <div className={`py-lg ${WIDE}`}>
          <h2 className="mt-0 text-[1.2rem]">How we decide what is on this page</h2>
          <p className="text-ink-muted mt-xs mb-sm text-[1.05rem] leading-relaxed">
            No hand-picked lists. Every plant on this page satisfies all of these, taken straight
            from the record our growers keep at the bench — so if a plant is not here, that is a
            measurement and not an opinion.
          </p>
          <ul className="text-ink-muted gap-sm m-0 flex list-none flex-wrap p-0">
            {def.derivedFrom.map((field) => (
              <li
                key={field}
                className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm"
              >
                {field}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {def.faq.length > 0 && (
        <section className={`py-xl ${WIDE}`}>
          <h2 className="mt-0">Questions we get about this</h2>
          <div className="mt-base gap-lg grid lg:grid-cols-2">
            {def.faq.map((entry) => (
              <article key={entry.q}>
                <h3 className="mt-0 text-[1.05rem]">{entry.q}</h3>
                <p className="text-ink-muted mt-xs mb-0">{entry.a}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {rows.length > 0 && siblings.length > 0 && (
        <section className="border-border bg-surface-raised border-t">
          <div className={`py-xl ${WIDE}`}>
            <CollectionTiles
              items={storefront.facets}
              collections={siblings}
              heading="Somewhere else to look"
              headingLevel="h2"
            />
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faqLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqLd,
            }),
          }}
        />
      )}
    </main>
  )
}
