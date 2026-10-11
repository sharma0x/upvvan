import { BATCH_SIZE } from '@/lib/catalogue/paging'

/**
 * The placeholder grid shown while a batch is in flight.
 *
 * ── WHY THE SKELETON MATCHES THE REAL GRID ───────────────────────────────────
 *
 * It is 3 columns wide on a laptop and 1 on a phone, and each block is the shape
 * of a real card — image area, then three lines of text, then a price line.
 *
 * That is not decoration. A generic spinner or a single grey bar reserves the wrong
 * amount of space, so the moment real cards arrive the page pushes everything down
 * and the customer loses the position they were reading. Same shape means no shift,
 * and the transition from skeleton to product is invisible in layout terms — only
 * in sharpness.
 *
 * ── WHY IT IS NOT ANIMATED ───────────────────────────────────────────────────
 *
 * `animate-pulse` is deliberately absent. A pulsing block reads as "something is
 * happening" and a steady one reads as "this is the page", which is the lie — and
 * `prefers-reduced-motion` means the animation would be suppressed for some
 * visitors and present for others anyway, making the two experiences inconsistent
 * for a purely cosmetic gain.
 */
function CardSkeleton() {
  return (
    <li aria-hidden="true" className="gap-xs flex flex-col">
      <div className="bg-surface-raised aspect-[4/3] w-full rounded-md" />
      <div className="bg-surface-raised h-3 w-1/3 rounded-full" />
      <div className="bg-surface-raised h-4 w-4/5 rounded-full" />
      <div className="bg-surface-raised h-3 w-2/3 rounded-full" />
    </li>
  )
}

export default function GridSkeleton({
  count = BATCH_SIZE,
  label = 'Loading plants',
  inline = false,
}: {
  count?: number
  label?: string
  /**
   * Render bare `<li>`s with no wrapper, for a Suspense boundary that sits INSIDE
   * the real grid.
   *
   * The wrapper is what caused the blank spaces: the first version of the paged
   * grid rendered each batch's skeleton as its own `<ul class="grid">` stacked under
   * the real one, and a batch of eight in three columns leaves an empty cell at the
   * end of its last row. A boundary inside the single grid keeps the skeletons in the
   * same flow, so they fill the row the way the cards will.
   */
  inline?: boolean
}) {
  const cards = Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)

  /*
   * Announced, not drawn. A screen-reader user gets "Loading plants" once, as
   * polite, rather than eight silent decorative blocks and no information at all.
   *
   * In `inline` mode there is no element of our own to hang the role on — the
   * `<li>`s belong to the caller's list, so the live region goes alongside them.
   */
  if (inline) {
    return (
      <>
        <li role="status" aria-live="polite" aria-busy="true" className="col-span-full">
          <span className="sr-only">{label}…</span>
        </li>
        {cards}
      </>
    )
  }

  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <ul className="gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {cards}
      </ul>
    </div>
  )
}

/**
 * The route-level fallback, used by each `loading.tsx`.
 *
 * `aria-busy` plus a live region is the difference between "the page is loading"
 * and a silent pause. It is also why this is a component rather than inline JSX in
 * seven files: a loading state that differs by one class between routes is a
 * loading state nobody can reason about.
 */
export function RouteSkeleton() {
  return (
    <main className="px-base py-xl mx-auto w-full max-w-[68rem]">
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <div className="bg-surface-raised mb-lg h-9 w-2/5 rounded-full" aria-hidden="true" />
        <div className="bg-surface-raised mb-md h-4 w-3/5 rounded-full" aria-hidden="true" />
        <GridSkeleton count={BATCH_SIZE} label="Loading plants" />
      </div>
    </main>
  )
}
