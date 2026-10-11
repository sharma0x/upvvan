import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { COLLECTIONS, collectionSize } from '@/lib/catalogue/collections'
import { formatPaise } from '@/lib/catalogue/pricing'
import { resolveArt } from '@/components/catalogue/ItemGrid'
import PagedItemGrid from '@/components/catalogue/PagedItemGrid'
import { BATCH_SIZE } from '@/lib/catalogue/paging'
import { firstBatch } from '@/lib/catalogue/grid.server'
import { rowsFor } from '@/lib/catalogue/query.server'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

/**
 * Search — `/search?q=`.
 *
 * ── WHY A PAGE AND NOT A DROPDOWN ───────────────────────────────────────────
 *
 * The audit found search undocumented for every competitor we studied — Upvan's
 * works, nothing else was verifiable — which makes it a page rather than a
 * widget for two reasons:
 *
 *   · It is LINKABLE. "Plants for a dim flat with no window" is a search string
 *     someone sends to a flatmate, and a dropdown has no URL.
 *   · It works on a slow connection. A live search box that fires a request per
 *     keystroke is a nice-to-have on Wi-Fi and unusable on the connections this
 *     business actually sells over.
 *
 * So the header input submits to here, and the results are server-rendered.
 *
 * ── WHY AND-SEMANTICS AND PREFIX MATCHING ───────────────────────────────────
 * The matcher lives in `facets.ts` and is unit-tested there. The two decisions
 * worth repeating: every term must land somewhere, because a query is a
 * description of what someone wants rather than a list of alternatives; and
 * matching is at word boundaries rather than by substring, because `includes()`
 * matches "jade" inside "adjacent" and a search that returns nonsense is worse
 * than no search at all — the customer concludes the catalogue is empty.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  return {
    title: q ? `Search: ${q}` : 'Search',
    // A search-results page must never be indexed. It is a generated page over a
    // query string, and an index of every query anyone has ever typed is a spam
    // surface with a canonical tag on it.
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Search" />

  const params = await searchParams
  const raw = typeof params.q === 'string' ? params.q : ''
  const query = raw.trim().slice(0, 120)

  const all = storefront.facets

  // Shared with /api/catalogue so "Show more" cannot re-rank what page one found.
  const rows = rowsFor(storefront, new URLSearchParams(query ? { q: query } : {}))
  const art = resolveArt(rows)

  /*
   * Why we are not showing you this.
   *
   * A bare "no results" is the least helpful thing a search can render. So when
   * a query finds nothing we show the categories that DO have stock, because a
   * customer who searched "basil" and got nothing is far better served by
   * "we have Tulsi, which is what a basil plant is to an Indian kitchen" than by
   * an apology.
   */
  const suggestions = query
    ? rows.length === 0
      ? COLLECTIONS.map((def) => ({ def, size: collectionSize(all, def) })).filter(
          (
            x,
          ): x is {
            def: (typeof COLLECTIONS)[number]
            size: NonNullable<ReturnType<typeof collectionSize>>
          } => x.size !== null,
        )
      : []
    : []

  /*
   * What the customer TYPED, echoed as buttons. Typo tolerance is not worth
   * building; three plausible alternatives are, and they are the cheapest
   * interface in search.
   */
  const typos = query
    ? (['jade plant', 'money plant', 'snake plant', 'peace lily', 'zz plant', 'tulsi'] as const)
        .filter(
          (t) => t !== query.toLowerCase() && !rows.some((r) => r.commonName.toLowerCase() === t),
        )
        .slice(0, 4)
    : []

  return (
    <main id="main" tabIndex={-1} className="px-base pt-base mx-auto max-w-[1120px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Search' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">
          {query ? <>Search for &ldquo;{query}&rdquo;</> : 'Search the catalogue'}
        </h1>

        {/*
          The form again, in the page. A customer who arrives at /search with no
          query has nothing to look at, so the page gives them the input rather
          than showing an empty state and a shrug.
        */}
        <form
          role="search"
          action="/search"
          method="get"
          className="gap-sm mt-sm flex max-w-[560px]"
        >
          <label htmlFor="q" className="sr-only">
            Search plants by name, botanical name or description
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            autoFocus={!query}
            placeholder="jade, money plant, snake…"
            className="border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base"
          />
          <button
            type="submit"
            className="bg-primary text-surface px-base shrink-0 cursor-pointer rounded-sm font-semibold"
          >
            Search
          </button>
        </form>
      </header>

      {query && (
        <p className="text-ink-muted mt-lg" role="status">
          {rows.length === 0 ? (
            <>Nothing matches &ldquo;{query}&rdquo;.</>
          ) : (
            <>
              {rows.length} result{rows.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;.
            </>
          )}
        </p>
      )}

      <div className="py-xl">
        {rows.length > 0 ? (
          <PagedItemGrid
            initial={firstBatch(rows, art, BATCH_SIZE).first}
            params={{ q: query }}
            total={rows.length}
          />
        ) : query ? (
          <>
            {/*
              Zero results. Named alternatives, never an apology alone — the two
              things a person does at this point are "type something else" and
              "browse", so both are offered.
            */}
            <section className="border-border bg-surface-raised p-lg rounded-md border">
              <h2 className="mt-0">We could not find &ldquo;{query}&rdquo;</h2>
              <p className="text-ink-muted mb-sm">
                Our catalogue is small and seasonal — six species at a time, and they change with
                the weather. If the plant you wanted is not here, ask us and we will tell you when
                it is back rather than take your money and refund you later.
              </p>
              <ul className="gap-xs m-0 flex list-none flex-col p-0">
                <li>
                  <Link href="/contact" className="text-primary underline">
                    Ask us about a specific plant →
                  </Link>
                </li>
                <li>
                  <Link href="/quiz" className="text-primary underline">
                    Not sure what to search for? Take the 30-second quiz →
                  </Link>
                </li>
              </ul>
            </section>

            {typos.length > 0 && (
              <section className="mt-2xl">
                <h2 className="mt-0">Did you mean</h2>
                <ul className="gap-sm m-0 flex list-none flex-wrap p-0">
                  {typos.map((t) => (
                    <li key={t}>
                      <a
                        href={`/search?q=${encodeURIComponent(t)}`}
                        className="border-border bg-surface-card hover:border-clay inline-flex min-h-[44px] items-center rounded-sm border px-3 no-underline"
                      >
                        {t}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {suggestions.length > 0 && (
              <section className="mt-2xl">
                <h2 className="mt-0">What we do have</h2>
                <ul className="gap-sm m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestions.map(({ def, size }) => (
                    <li key={def.handle}>
                      <Link
                        href={`/collections/${def.handle}`}
                        className="border-border bg-surface-card hover:border-clay p-base text-ink block h-full rounded-md border no-underline"
                      >
                        <span className="text-label-caps text-clay block">
                          {size.count} in stock
                        </span>
                        <span className="mt-xs block font-semibold">{def.label}</span>
                        <span className="text-ink-muted mt-xs block text-sm">
                          from {formatPaise(size.minPaise)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            {/*
              No query yet. Every species, and the collections, because browsing
              is the other half of searching and a customer who typed nothing has
              not failed — they are choosing a different starting point.
            */}
            <PagedItemGrid
              initial={
                firstBatch(
                  storefront.items.filter((i) => i.itemClass === 'plant'),
                  art,
                  BATCH_SIZE,
                ).first
              }
              params={{}}
              total={storefront.items.filter((i) => i.itemClass === 'plant').length}
            />

            <section className="mt-3xl">
              <h2 className="mt-0">Or start from what you need</h2>
              <ul className="gap-sm m-0 flex list-none flex-wrap p-0">
                {COLLECTIONS.filter((c) => collectionSize(all, c) !== null).map((c) => (
                  <li key={c.handle}>
                    <Link
                      href={`/collections/${c.handle}`}
                      className="border-border bg-surface-card hover:border-clay gap-sm inline-flex min-h-[44px] items-center rounded-sm border px-3 no-underline"
                    >
                      {c.label}
                      <span className="text-ink-muted text-xs">
                        {collectionSize(all, c)!.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
