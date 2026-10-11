'use client'

import { useSearchParams } from 'next/navigation'

import {
  FACET_GROUPS,
  facetCounts,
  facetSelectionToQuery,
  parseFacetSelection,
  priceBounds,
  type Facetable,
  type SortKey,
} from '@/lib/catalogue/facets'
import { SORT_OPTIONS } from '@/lib/catalogue/facets'
import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * Facet controls.
 *
 * ── WHY THE URL IS THE STATE ────────────────────────────────────────────────
 *
 * Every facet is a link, not a click handler. That is three requirements in
 * one decision:
 *
 *   · RELOAD — a customer who filters, opens a second tab, and comes back must
 *     still be filtered. State in React state is gone.
 *   · SHARE — "this is what I found for my flat" has to be a URL, and a
 *     customer who cannot send it will describe it over the phone instead.
 *   · CRAWL — `/plants?light=low&care=easy` is a page. Kyari's room × benefit
 *     matrix is ~250 indexable URLs and it is the cheapest SEO surface in the
 *     category; a client-only filter tree produces none of them.
 *
 * So this component renders `<a>` elements inside a `<form method="get">` and
 * the browser does the navigation. No `fetch`, no `useState`, no router.
 *
 * ── WHY COUNTS ARE PASSED IN RATHER THAN COMPUTED HERE ─────────────────────
 * `facetCounts` is pure and runs on the server in `facets.test.ts`. Recomputing
 * it in the browser would be the same code with a second bug surface, and the
 * whole point of the count is that it agrees with what happens when you click.
 *
 * ── THE COUNT RULE ─────────────────────────────────────────────────────────
 * A count is computed with that option's OWN facet removed. Ticking the last
 * box in a group must not zero out its siblings, or a filter group looks like a
 * dead end exactly when the customer is about to widen their search.
 */
export default function FacetControls({
  items,
  sort,
  resultCount,
  totalCount,
}: {
  items: Facetable[]
  sort: SortKey
  resultCount: number
  totalCount: number
}) {
  const params = useSearchParams()
  const selection = parseFacetSelection(new URLSearchParams(params.toString()))
  const counts = facetCounts(items, selection)
  const bounds = priceBounds(items)
  const currentQuery = facetSelectionToQuery(selection)

  /**
   * Toggle one value, preserving everything else.
   *
   * Built as a URL string rather than by mutating a params object so the
   * behaviour is visible in one place: toggling ON adds, toggling OFF removes,
   * and every other facet survives.
   */
  function hrefFor(key: string, value: string): string {
    const next = new URLSearchParams(currentQuery)
    const held = next.getAll(key)
    next.delete(key)
    if (held.includes(value)) {
      for (const v of held) if (v !== value) next.append(key, v)
    } else {
      for (const v of held) next.append(key, v)
      next.append(key, value)
    }
    // Sorting is a view preference, not a filter. Keeping it means a customer
    // who chose "price: low to high" and then narrows by light still wants it
    // sorted by price — losing the sort on every tick is a small betrayal that
    // makes the whole control feel broken.
    if (sort !== 'featured') next.set('sort', sort)
    const qs = next.toString()
    return qs ? `/plants?${qs}` : '/plants'
  }

  const clearHref = sort === 'featured' ? '/plants' : `/plants?sort=${sort}`

  function sortHref(next: SortKey): string {
    const p = new URLSearchParams(currentQuery)
    if (next === 'featured') p.delete('sort')
    else p.set('sort', next)
    const qs = p.toString()
    return qs ? `/plants?${qs}` : '/plants'
  }

  const hasFilters = currentQuery.length > 0

  return (
    <div className="gap-lg flex flex-col">
      {/*
        A real GET form, not a div. Pressing Enter in a text input submits it,
        which is what a keyboard user expects from a filter box, and it degrades
        to a working form if JavaScript never arrives.
      */}
      <form
        method="get"
        action="/plants"
        className="border-border bg-surface-raised p-base rounded-md border"
      >
        <h2 className="m-0">Narrow it down</h2>

        {hasFilters && (
          <p className="text-ink-muted mt-sm mb-sm text-sm">
            {resultCount} of {totalCount} match.{' '}
            <a href={clearHref} className="text-primary underline">
              Clear
            </a>
          </p>
        )}

        {FACET_GROUPS.map((group) => (
          <fieldset key={group.key} className="border-border mt-base pt-sm border-t">
            <legend className="text-label-caps text-ink-muted py-0">{group.label}</legend>
            <ul className="gap-xs m-0 flex list-none flex-col p-0">
              {group.options.map((option) => {
                const key = `${group.key}:${option.value}`
                const count = counts[key] ?? 0
                const selected = (selection[group.key] ?? []).includes(option.value)

                /*
                 * A zero-count option renders as a non-interactive <span>, not a
                 * disabled <button>. Disabled controls are still focusable in
                 * some browsers and announce as "unavailable" with no
                 * explanation; a plain span with the count beside it reads
                 * correctly to a screen reader and to everyone else. Clicking a
                 * dead filter is how a store starts to feel broken.
                 */
                if (count === 0 && !selected) {
                  return (
                    <li
                      key={key}
                      className="text-ink-muted gap-sm flex items-start justify-between text-sm"
                    >
                      <span aria-disabled className="gap-sm flex items-baseline">
                        <span>
                          {option.label}
                          {option.hint && (
                            <span className="block text-xs opacity-75">{option.hint}</span>
                          )}
                        </span>
                        <span className="font-semibold">{count}</span>
                      </span>
                    </li>
                  )
                }

                return (
                  <li key={key}>
                    <a
                      href={hrefFor(group.key, option.value)}
                      aria-current={selected ? 'true' : undefined}
                      className={`hover:bg-brand-soft gap-sm inline-flex min-h-[44px] w-full items-start justify-between rounded-sm px-2 text-sm no-underline ${
                        selected ? 'bg-brand-soft font-semibold' : ''
                      }`}
                    >
                      <span className="text-ink">
                        {option.label}
                        {option.hint && (
                          <span className="text-ink-muted block text-xs">{option.hint}</span>
                        )}
                      </span>
                      <span className="text-ink-muted font-semibold">{count}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ))}

        {/*
          Price range, as a form that actually submits.

          A price slider with no server-rendered equivalent is unusable with a
          keyboard and invisible to a crawler, and "₹200–₹900" is a genuinely
          searched phrase. Two number inputs and a submit button, prefilled with
          the real bounds so the customer can see what exists.
        */}
        <fieldset className="border-border mt-base pt-sm border-t">
          <legend className="text-label-caps text-ink-muted py-0">Price of the plant alone</legend>
          <p className="text-ink-muted mt-xs mb-sm text-xs">
            {formatPaise(bounds.minPaise)} to {formatPaise(bounds.maxPaise)}. Pots are chosen on the
            plant page.
          </p>
          <div className="gap-xs flex items-center">
            <label className="flex-1 text-xs">
              <span className="sr-only">Minimum price in rupees</span>
              <input
                type="number"
                name="min"
                inputMode="numeric"
                min={0}
                step={50}
                defaultValue={selection.minPaise ? Math.floor(selection.minPaise / 100) : ''}
                placeholder="Min"
                className="border-border bg-surface w-full rounded-sm border px-2 py-2.5"
              />
            </label>
            <label className="flex-1 text-xs">
              <span className="sr-only">Maximum price in rupees</span>
              <input
                type="number"
                name="max"
                inputMode="numeric"
                min={0}
                step={50}
                defaultValue={selection.maxPaise ? Math.floor(selection.maxPaise / 100) : ''}
                placeholder="Max"
                className="border-border bg-surface w-full rounded-sm border px-2 py-2.5"
              />
            </label>
            {FACET_GROUPS.map((g) =>
              (selection[g.key] ?? []).map((v) => (
                <input key={`${g.key}:${v}`} type="hidden" name={g.key} value={v} />
              )),
            )}
            <button
              type="submit"
              className="border-border cursor-pointer rounded-sm border px-3 py-2.5 text-sm"
            >
              Go
            </button>
          </div>
        </fieldset>
      </form>

      {/*
        Sort. Also links, for the same reason the facets are links: the sort has
        to survive a reload and be shareable, and "sorted by cheapest" is a
        state a customer will want to come back to.
      */}
      <nav
        aria-label="Sort results"
        className="border-border bg-surface-raised p-base rounded-md border"
      >
        <h2 className="m-0">Sort</h2>
        <ul className="mt-sm gap-xs m-0 flex list-none flex-col p-0">
          {SORT_OPTIONS.map((option) => (
            <li key={option.key}>
              <a
                href={sortHref(option.key)}
                aria-current={sort === option.key ? 'true' : undefined}
                className={`hover:bg-brand-soft inline-flex min-h-[44px] w-full items-center rounded-sm px-2 text-sm no-underline ${
                  sort === option.key ? 'bg-brand-soft font-semibold' : ''
                }`}
              >
                {option.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
