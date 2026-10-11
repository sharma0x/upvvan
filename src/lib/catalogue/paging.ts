/**
 * Catalogue paging primitives.
 *
 * ── WHY 9 ────────────────────────────────────────────────────────────────────
 *
 * **It is the grid's column count squared.** The grid is three columns wide on a
 * laptop, so nine cards is exactly three full rows and eight is not.
 *
 * Eight was the first value, chosen for how a click feels rather than for how a row
 * divides — "enough that pressing Show more visibly changes the page, small enough
 * that it still feels instant". Reasonable. But 8 into 3 columns lays out as
 * 3 + 3 + 2, so the last row has one empty cell:
 *
 *     [card][card][card]
 *     [card][card][card]
 *     [card][card][ . ]
 *
 * and a shopper reads that hole as a card that failed to arrive, not as the end of a
 * batch. It is the worst thing a "show more" affordance can look like: the control
 * exists to tell you more is coming, and the empty cell says something failed. There
 * were plenty more plants in the database — the blank was arithmetic.
 *
 * So the batch is a multiple of the column count. Nine satisfies both concerns at
 * once: three whole rows, and a page of nine is still well under a second of work.
 *
 * ── WHY A CONSTANT IN ONE FILE ───────────────────────────────────────────────
 *
 * The first version had the number inline in the API route AND inline in the client,
 * and they disagreed by one. A page then rendered "Show more" over an empty grid.
 * The page, the API and the skeleton all read this.
 */

/** How many cards one "Show more" reveals. */
export const BATCH_SIZE = 9

/**
 * The grid's column count at the `lg` breakpoint.
 *
 * Declared here rather than parsed out of a className at runtime, because a test
 * cannot assert "this divides the grid" against a string in JSX — but it CAN assert
 * this constant divides `BATCH_SIZE`, and that the two agree. That is the pairing
 * that has to hold, so it is the pairing that is written down.
 */
export const GRID_COLUMNS = 3

/** Guard rail so a hand-edited `?limit=` cannot ask for the whole catalogue. */
export const MAX_BATCH_SIZE = 24

/**
 * Clamp a requested batch size.
 *
 * A `limit` that is NaN, negative, zero or absurd has to become a usable number,
 * because it arrives from a URL and the alternative is a page that renders an
 * empty grid with no explanation.
 */
export function clampBatchSize(requested: number | null | undefined): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return BATCH_SIZE
  const whole = Math.trunc(requested)
  if (whole <= 0) return BATCH_SIZE
  return Math.min(whole, MAX_BATCH_SIZE)
}

/** Clamp an offset. Negative offsets would slice from the end and duplicate rows. */
export function clampOffset(offset: number | null | undefined): number {
  if (typeof offset !== 'number' || !Number.isFinite(offset)) return 0
  const whole = Math.trunc(offset)
  return whole > 0 ? whole : 0
}

/**
 * One batch of catalogue rows, plus whether anything remains.
 *
 * `hasMore` is computed HERE rather than in the client from `items.length`, because
 * a client that asks "did I get everything?" by comparing a count to a count gets
 * one card too many wrong and shows a button that reveals nothing.
 */
export interface CatalogueBatch<T> {
  items: T[]
  /** Total matching the filter, before batching. Drives the count in the UI. */
  total: number
  /** The offset this batch started at, echoed for debugging and tests. */
  offset: number
  /** True when `offset + items.length < total`. */
  hasMore: boolean
}

/**
 * Slice one batch out of a fully-filtered list.
 *
 * Pure, and the single place batching happens. The pages and the API both call it,
 * so "8" cannot mean two different things.
 */
export function batchOf<T>(all: readonly T[], offset: number, limit: number): CatalogueBatch<T> {
  const start = clampOffset(offset)
  const size = clampBatchSize(limit)
  const items = all.slice(start, start + size)

  return {
    items,
    total: all.length,
    offset: start,
    hasMore: start + items.length < all.length,
  }
}
