import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { OCCASIONS, findOccasion, liveSiblings } from '@/lib/commerce/gifting'
import { formatPaise } from '@/lib/catalogue/pricing'
import { resolveArt } from '@/components/catalogue/ItemGrid'
import PagedItemGrid from '@/components/catalogue/PagedItemGrid'
import { BATCH_SIZE } from '@/lib/catalogue/paging'
import { firstBatch } from '@/lib/catalogue/grid.server'
import { rowsFor } from '@/lib/catalogue/query.server'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import FaqAccordion from '@/components/seo/FaqAccordion'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * One occasion — `/gifting/[occasion]`.
 *
 * ── WHY ONE ROUTE AND NOT TEN PAGES ─────────────────────────────────────────
 *
 * A directory of ten page files is ten places to keep the breadcrumbs, the
 * empty state, the JSON-LD and the sibling rail correct. This is a data-driven
 * route over a closed set, so a handle that does not exist in `gifting.ts` is a
 * 404 rather than a second implementation of the same page.
 *
 * ── WHY THE COPY ON THIS PAGE IS NOT THE CATALOGUE'S ────────────────────────
 *
 * A species page can tell you a ZZ plant tolerates low light. It cannot tell you
 * that a ZZ plant is the right thing to send to a flat nobody has measured yet,
 * which is the only question this page is answering. So each occasion carries its
 * own headline, body, note and FAQ — the argument is the page, and the grid is
 * the evidence for it.
 *
 * ── WHY THE GRID CAN BE EMPTY AND THE PAGE STILL RENDERS ────────────────────
 *
 * The catalogue is filtered by season. A handle whose predicate nothing clears
 * this month must not 404 — that would tell a customer the occasion does not
 * exist, which is a different and false claim. It gets an honest empty state
 * that names the reason and points somewhere that does have products.
 */

/**
 * Pre-render every handle.
 *
 * Occasion pages are the acquisition surface the audit identified, so they must
 * exist without a database round trip on first request. `dynamic` would make our
 * best-intent URLs our slowest ones, which is backwards.
 */
export function generateStaticParams(): Array<{ occasion: string }> {
  return OCCASIONS.map((o) => ({ occasion: o.handle }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ occasion: string }>
}): Promise<Metadata> {
  const { occasion: handle } = await params
  const def = findOccasion(handle)
  // An unknown handle in `generateMetadata` is not an error. Next calls this
  // before the page for every request including the one that 404s, and throwing
  // here turns a bad link into a 500 instead of a 404.
  if (!def) return { title: 'Occasion not found' }

  return {
    title: def.label,
    description: def.body.slice(0, 300),
    alternates: { canonical: `/gifting/${def.handle}` },
    openGraph: { title: def.headline, description: def.body.slice(0, 300), type: 'website' },
  }
}

export default async function OccasionPage({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion: handle } = await params
  const def = findOccasion(handle)
  // A handle that looks like an occasion and is not one is a 404. Rendering
  // "nothing here" at that URL is the doorway-page failure.
  if (!def) notFound()

  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading={def.label} />

  const { facets, cityName } = storefront

  // Facet rows are keyed by slug while catalogue rows are keyed by SKU (two tiers
  // of one species are two rows), so the join happens inside `rowsFor` — the same
  // function /api/catalogue uses, which is what keeps "Show more" consistent.
  const rows = rowsFor(storefront, new URLSearchParams({ set: `occasion:${handle}` }))
  const art = resolveArt(rows)

  /*
   * Sibling occasions, filtered to the ones that HAVE products.
   *
   * A rail that links to an occasion with nothing behind it is a customer
   * clicking through to an empty grid — the exact failure `CollectionTiles` is
   * built to avoid, and it is worse here because the rail looks like
   * navigation rather than like a menu of aspirations. `liveSiblings` does the
   * count; this page only has to decide how many to show.
   *
   * Six is enough. Ten is a menu, and a menu on a page the customer is already
   * reading is a way to lose them.
   */
  const siblings = liveSiblings(facets, def.handle).slice(0, 6)

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
      <div className="px-base pt-base mx-auto max-w-[1120px]">
        <Breadcrumbs
          trail={[
            { href: '/', label: 'Home' },
            { href: '/gifting', label: 'Gifting' },
            { label: def.label },
          ]}
        />
      </div>

      <header className="border-border px-base pt-lg pb-lg mx-auto max-w-[1120px] border-b">
        <p className="text-label-caps text-clay m-0">
          {def.label} · {cityName} ·{' '}
          {rows.length === 0
            ? 'nothing in season'
            : `${rows.length} plant${rows.length === 1 ? '' : 's'}`}
        </p>
        <h1 className="mt-xs mb-0 max-w-[22ch]">{def.headline}</h1>
        <p className="text-ink-muted mt-sm mb-0 max-w-[66ch] text-[1.05rem] leading-relaxed">
          {def.body}
        </p>
      </header>

      <div className="px-base py-xl mx-auto max-w-[1120px]">
        {rows.length === 0 ? (
          /*
            Honest, and it names the cause. The catalogue is filtered to what can
            be shipped this month, so an empty occasion is almost always seasonal
            rather than a broken page. Every audited competitor renders this as a
            blank grid, which tells the customer nothing and looks like the shop
            is broken rather than between seasons.
          */
          <div className="border-warning bg-surface-raised p-lg rounded-md border">
            <h2 className="mt-0">Nothing for {def.label.toLowerCase()} this month</h2>
            <p className="mb-0">
              The catalogue changes with the season — between March and June in {cityName} it is 40
              to 46°C, and species that cannot take it come off the shelf rather than being sold
              into it. Nothing we grow clears this bar right now, which usually means the handle is
              seasonal rather than that we have stopped doing it.{' '}
              <a href="/plants" className="text-primary min-h-[44px] underline">
                See everything in season
              </a>{' '}
              or{' '}
              <Link href="/gifting" className="text-primary min-h-[44px] underline">
                start from another occasion
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-0">
                {rows.length} plant{rows.length === 1 ? '' : 's'} for {def.label.toLowerCase()}
              </h2>
              {/*
                The item grid's own `<section>` is not wrapped again here — a
                `<section>` inside a `<section>` with no heading of its own is
                announced as a region with no name, which is noise for a
                screen-reader user and nothing at all for a crawler.
              */}
              <div className="mt-base">
                <PagedItemGrid
                  initial={firstBatch(rows, art, BATCH_SIZE).first}
                  params={{ set: `occasion:${handle}` }}
                  total={rows.length}
                />
              </div>
            </section>

            {/*
              THE NOTE. Gift-specific advice the catalogue cannot give, because
              the catalogue knows the plant and not the occasion. It is the one
              paragraph on this page that exists to change behaviour rather than
              to describe a product.
            */}
            <section className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
              <h2 className="mt-0">Before you send this one</h2>
              <p className="mt-sm mb-0 max-w-[62ch]">{def.note}</p>
            </section>

            {/*
              PRACTICALS. What a gift order actually looks like on this occasion,
              stated as one paragraph with the recipient-address rule in it, since
              that is the mistake that turns a gift order into a return trip.
            */}
            <section className="mt-2xl">
              <h2 className="mb-0">How the delivery works</h2>
              <p className="text-ink-muted mt-sm mb-base max-w-[62ch]">{def.delivery}</p>
              <ul className="text-ink-muted gap-sm m-0 flex list-none flex-wrap p-0">
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  Free handwritten note, up to 280 characters
                </li>
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  No prices on the card or the packing slip
                </li>
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  Prepaid only — a returned plant is unsellable
                </li>
              </ul>
              <p className="m-0">
                <Link href="/order/checkout" className="text-primary min-h-[44px] underline">
                  See the full landed total before you press anything
                </Link>
              </p>
            </section>

            {def.faq.length > 0 && (
              <section className="mt-2xl">
                <h2 className="mb-0">Questions we get about this</h2>
                {/*
                  Native `<details>` rather than a stateful accordion, so the
                  answers are in the HTML for a crawler that does not run
                  JavaScript and for `Ctrl-F`. The occasion-specific questions are
                  exactly the content that must be indexable to be worth writing.
                */}
                <FaqAccordion entries={def.faq.map((entry) => ({ group: def.label, ...entry }))} />
              </section>
            )}
          </>
        )}

        {siblings.length > 0 && (
          <section className="border-border bg-surface-raised mt-3xl p-lg rounded-md border">
            <h2 className="mt-0">A different occasion</h2>
            <p className="text-ink-muted mt-xs mb-base max-w-[62ch]">
              Every one of these has plants behind it right now. Occasions with nothing in season
              are left off this list on purpose — a link to an empty grid is worse than no link.
            </p>
            {/*
              A `<ul>` of cards, and each card is a single `<Link>` wrapping only
              its own text. Nothing here nests a link inside a link: the grid on
              the occasion page is a list of products, and the tile row above it is
              a list of pages. Both are separate lists, and they are rendered
              separately.
            */}
            <ul className="gap-sm m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {siblings.map(({ occasion, count, minPaise }) => (
                <li key={occasion.handle}>
                  <Link
                    href={`/gifting/${occasion.handle}`}
                    className="border-border bg-surface-card hover:border-clay p-base text-ink flex h-full flex-col rounded-md border no-underline"
                  >
                    <span className="text-label-caps text-clay block">
                      {count} plant{count === 1 ? '' : 's'}
                    </span>
                    <span className="mt-xs block font-semibold">{occasion.label}</span>
                    <span className="text-ink-muted pt-sm mt-auto block text-sm">
                      from {formatPaise(minPaise)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

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
