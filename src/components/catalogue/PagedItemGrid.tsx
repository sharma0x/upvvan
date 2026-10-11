'use client'

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react'
import PlantCard from '@/components/catalogue/PlantCard'
import GridSkeleton from '@/components/catalogue/GridSkeleton'
import { BATCH_SIZE } from '@/lib/catalogue/paging'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'
import type { PlantImage } from '@/lib/catalogue/images'

/**
 * A product grid that reveals eight more cards at a time.
 *
 * ── HOW THE LOADING ACTUALLY WORKS ───────────────────────────────────────────
 *
 * Not a spinner, and not a fake delay. Each press of "Show more" starts a real
 * fetch, wraps it in a promise, and stores that promise in state:
 *
 *     setPages((prev) => [...prev, fetchBatch(qs)])
 *
 * That promise is handed to a component inside `<Suspense>`, which calls React's
 * `use()`. `use()` suspends, so the Suspense fallback — a grid-shaped skeleton — is
 * what the shopper sees while the request is in flight, and the real cards replace
 * it when the data lands.
 *
 * This is React's own model for async data rather than a hand-rolled
 * `loading && <Spinner/>`. Two differences are visible. The fallback occupies the
 * exact space the cards will take, so nothing below the button moves when they
 * arrive. And the browser is genuinely waiting, instead of the component
 * pretending to while it already holds the data.
 *
 * ── WHY THE FIRST BATCH IS STILL SERVER-RENDERED ─────────────────────────────
 *
 * `initial` arrives as finished HTML, so the first eight cards are in the document
 * before any JavaScript runs: indexable, crawlable, and readable on a slow phone
 * before the bundle has finished parsing. Only batches *two onward* are fetched.
 *
 * A grid that fetched its own first cards would be quicker to write, worse to
 * crawl, and worse on a bad connection. This is the trade, made on purpose.
 *
 * ── WHY ART TRAVELS WITH EACH CARD ───────────────────────────────────────────
 *
 * `leadImagesForExcluding` guarantees no two adjacent cards show the same
 * photograph, and it needs to know which images the page already claimed — which a
 * client cannot see. So the server resolves art per batch, around the indexes sent
 * up in `taken`, and sends it alongside the item.
 *
 * That is why the `Map` the server starts with is converted to an array of
 * `{ item, art }` before crossing the boundary: a `Map` is not serialisable, and the
 * alternative — a module-level Map shared between requests — would make two
 * simultaneous visitors see each other's photographs.
 */

/** One card's worth of data as it crosses the wire. */
export type WireItem = CatalogueItem & { art: PlantImage | null }

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MicroSpinner } from '@/components/ui/MicroSpinner'

interface Batch {
  items: WireItem[]
  total: number
  /** Echoed so the client can track how much has been appended. */
  offset: number
  hasMore: boolean
  /** Set instead of rejecting — see `fetchBatch`. */
  error: string | null
}

function messageFor(status: number): string {
  if (status === 0) return 'You appear to be offline. Check your connection and try again.'
  return 'We could not load more plants just now. Please try again.'
}

/**
 * Renders one fetched batch.
 *
 * `use()` suspends until the promise settles, which is what shows the skeleton.
 *
 * `onLoaded` fires in an effect, never in the render body: a side effect during
 * render is double-invoked under StrictMode, and the visible symptom is a batch
 * counted — and therefore skipped — twice.
 */
function BatchCards({
  request,
  onLoaded,
}: {
  request: Promise<Batch>
  onLoaded: (batch: Batch) => void
}) {
  const batch = use(request)

  useEffect(() => {
    onLoaded(batch)
  }, [batch, onLoaded])

  if (batch.error) {
    return (
      <p role="alert" className="border-warning bg-surface-raised p-lg rounded-md border">
        {batch.error}
      </p>
    )
  }

  if (batch.items.length === 0) return null

  /*
   * `<li>`s, not `<li>`s inside a second `<ul>`.
   *
   * The first version gave every batch its own `<ul className="grid">`, which is two
   * separate grids stacked on each other. At three columns a batch of eight lays out
   * as 3 + 3 + 2 and leaves one empty cell in the last row — a blank hole in the
   * middle of the shop, on every grid whose batch was not a multiple of three.
   *
   * So the batches are now `<li>`s inside ONE `<ul>` and the grid simply flows: card
   * nine fills the hole card six left. It is also the more honest document — these
   * are forty products, not two lists of eight.
   */
  return (
    <>
      {batch.items.map((item) => (
        <PlantCard key={item.skuId} item={item} image={item.art ?? undefined} priority={false} />
      ))}
    </>
  )
}

export default function PagedItemGrid({
  initial,
  params,
  total,
  heading,
  headingLevel = 'h3',
  emptyMessage,
  batchSize = BATCH_SIZE,
  nounOne = 'plant',
  nounMany = 'plants',
}: {
  /** The first batch, already server-rendered, art included. */
  initial: readonly WireItem[]
  /** The page's query string, forwarded verbatim so the API matches its filters. */
  params: Record<string, string | string[] | undefined>
  /** How many items match the filter overall. */
  total: number
  heading?: string
  headingLevel?: 'h2' | 'h3'
  emptyMessage?: string
  batchSize?: number
  /**
   * What these rows are called, so the count is not a lie.
   */
  nounOne?: string
  nounMany?: string
}) {
  const [pages, setPages] = useState<Promise<Batch>[]>([])
  const [appended, setAppended] = useState(0)
  const [totalMatched, setTotalMatched] = useState(total)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const Heading = headingLevel

  /** Image indexes already on the page, so the next batch picks different photos. */
  const taken = useRef<Set<number>>(new Set())
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    for (const item of initial) {
      if (item.art) taken.current.add(item.art.index)
    }
  }, [initial])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const onLoaded = useCallback((batch: Batch) => {
    setTotalMatched(batch.total)
    setFailure(batch.error)
    setAppended((prev) => Math.max(prev, batch.items.length))
    setBusy(false)
  }, [])

  /**
   * Never rejects. Uses AbortController to cleanly cancel stale inflight queries.
   */
  async function fetchBatch(qs: URLSearchParams): Promise<Batch> {
    const offset = initial.length + appended
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch(`/api/catalogue?${qs.toString()}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })

      if (!res.ok) {
        return {
          items: [],
          total: totalMatched,
          offset,
          hasMore: false,
          error: messageFor(res.status),
        }
      }

      const body = (await res.json()) as Omit<Batch, 'error'>
      return { ...body, error: null }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { items: [], total: totalMatched, offset, hasMore: true, error: null }
      }
      return { items: [], total: totalMatched, offset, hasMore: false, error: messageFor(0) }
    }
  }

  function showMore(): void {
    if (busy) return
    setBusy(true)
    setFailure(null)

    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) for (const v of value) qs.append(key, v)
      else if (value != null) qs.set(key, value)
    }
    qs.set('offset', String(initial.length + appended))
    qs.set('limit', String(batchSize))
    if (taken.current.size > 0) qs.set('taken', [...taken.current].join(','))

    const request = fetchBatch(qs)
    setPages((prev) => [...prev, request])
  }

  const shown = initial.length + appended
  const hasMore = shown < totalMatched

  if (initial.length === 0) {
    if (!emptyMessage) return null
    return (
      <section>
        {heading && <Heading className="mt-0">{heading}</Heading>}
        <div className="border-border bg-surface-raised p-xl flex flex-col items-center justify-center rounded-md border text-center">
          <p className="text-ink text-base font-semibold">{emptyMessage}</p>
          <p className="text-ink-muted mt-xs max-w-sm text-sm">
            Try adjusting your active filters or explore our complete seasonal collections.
          </p>
          <a
            href="/plants"
            className="bg-primary text-surface mt-base focus-visible:ring-primary inline-flex min-h-[44px] items-center rounded-sm px-4 py-2 text-sm font-semibold no-underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Reset all filters
          </a>
        </div>
      </section>
    )
  }

  return (
    <ErrorBoundary label="Plant Grid">
      <section>
      {heading && <Heading className="mt-0">{heading}</Heading>}

      {/*
        ONE grid for every batch. The Suspense boundaries live INSIDE it, so the
        skeleton is a run of `<li>`s that takes its place in the same flow instead of
        a second grid appearing below the first.
      */}
      <ul className="gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {initial.map((item) => (
          <PlantCard key={item.skuId} item={item} image={item.art ?? undefined} priority={false} />
        ))}

        {pages.map((request, index) => (
          <Suspense
            key={index}
            fallback={<GridSkeleton count={batchSize} label="Loading more plants" inline />}
          >
            <BatchCards request={request} onLoaded={onLoaded} />
          </Suspense>
        ))}
      </ul>

      <div className="mt-lg gap-sm flex flex-col items-center">
        {hasMore ? (
          <button
            type="button"
            onClick={showMore}
            disabled={busy}
            /*
             * Styled as an underlined action rather than a boxed button.
             *
             * It shipped as `className="btn btn-secondary"`, and there is no `.btn`
             * rule in this codebase — those class names came from a different design
             * system and resolved to nothing at all. The element was rendering with
             * `background: transparent`, `border: 0` and `cursor: default`: a run of
             * underlined-nothing, un-clickable-looking text sitting under the grid.
             * Computed style is the only thing that would have shown it; the class
             * list looks fine in a diff.
             *
             * So it is spelled out with utilities that exist: primary colour,
             * underline with room to breathe, a pointer cursor, and a visible focus
             * ring. A link-shaped affordance for a link-shaped action — it navigates
             * the shopper further down a list, and that is what an underlined word
             * promises. The chevron says the same thing: there is more BELOW.
             */
            className="text-primary hover:text-forest focus-visible:ring-primary cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[1.0625rem] underline underline-offset-[6px] hover:underline-offset-[8px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            data-testid="show-more"
          >
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <MicroSpinner size="sm" />
                <span>Loading…</span>
              </span>
            ) : (
              'Show more plants'
            )}
            <span aria-hidden="true" className="ml-xs">
              ↓
            </span>
          </button>
        ) : (
          <p className="text-ink-muted text-sm" data-testid="grid-end">
            That is every {nounOne} we have right now.
          </p>
        )}

        {failure && (
          <p role="alert" className="text-danger text-sm">
            {failure}
          </p>
        )}

        <p className="text-ink-muted text-sm" aria-live="polite" data-testid="grid-count">
          Showing {Math.min(shown, totalMatched)} of {totalMatched}{' '}
          {totalMatched === 1 ? nounOne : nounMany}
        </p>
      </div>
    </section>
    </ErrorBoundary>
  )
}
