import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BATCH_SIZE,
  GRID_COLUMNS,
  MAX_BATCH_SIZE,
  batchOf,
  clampBatchSize,
  clampOffset,
} from '@/lib/catalogue/paging'
import { readBrowseSet, readSort, rowsFor, withoutOwnParams } from '@/lib/catalogue/query.server'
import type { Facetable } from '@/lib/catalogue/facets'

/** The grid component, so the column constant can be checked against the markup. */
const GRID_COMPONENT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'components',
  'catalogue',
  'PagedItemGrid.tsx',
)

/**
 * Batching arithmetic, and the read helpers the API and the pages share.
 *
 * ── WHY BATCH SIZES NEED TESTS AT ALL ────────────────────────────────────────
 *
 * Because the first version of this feature had the number `8` inline in the API
 * route AND inline in the client component. They agreed until someone edited one,
 * and then the page showed a "Show more" button over an empty grid — the button
 * asked for a slice the other end was not taking.
 *
 * A constant cannot drift if there is only one of it. These tests exist mostly to
 * pin the clamping, which is where a hand-edited URL does its damage.
 */
describe('batch arithmetic', () => {
  const rows = Array.from({ length: 21 }, (_, i) => `plant-${i}`)

  it('divides the grid, so no batch leaves an empty cell', () => {
    /*
     * The whole reason this constant exists.
     *
     * Eight cards in three columns is 3 + 3 + 2, and the empty cell in the last row
     * reads as a card that failed to load — which is precisely the wrong impression
     * for a control whose job is to say more is on the way. The catalogue had plenty
     * more plants; the hole was arithmetic.
     *
     * So the invariant is asserted, not the number: BATCH_SIZE must be a whole
     * number of rows in this grid. Change the number without thinking about the
     * columns and this fails.
     */
    expect(
      BATCH_SIZE % GRID_COLUMNS,
      `BATCH_SIZE (${BATCH_SIZE}) is not a multiple of GRID_COLUMNS (${GRID_COLUMNS}).\n` +
        `That leaves an empty cell in the last row of every batch.`,
    ).toBe(0)
  })

  it('reveals three full rows at a time', () => {
    expect(BATCH_SIZE).toBe(GRID_COLUMNS * 3)
    expect(batchOf(rows, 0, BATCH_SIZE).items).toHaveLength(GRID_COLUMNS * 3)
  })

  it('is ragged on tablet, and that is a deliberate trade', () => {
    /*
     * The honest limitation, measured rather than asserted away.
     *
     * The grid is responsive: 3 columns at `lg`, 2 at `sm`, 1 below that. Nine is a
     * multiple of 3 and of 1, so those two are perfect. It is not a multiple of 2, so
     * at the tablet breakpoint a batch lays out as:
     *
     *     [card][card]
     *     [card][card]
     *     [card][card]
     *     [card][card]
     *     [card][ . ]
     *
     * Only a common multiple of 2 and 3 fixes all three at once — 6 or 12 — and
     * both were rejected: 6 is too small a step to feel like progress, and 12 is a
     * lot of catalogue to fetch before somebody has seen anything.
     *
     * So the trade is made knowingly: perfect on the widest and narrowest layouts,
     * one short cell on a tablet. If this assertion is ever revisited, the options
     * are 6 and 12 — not a different arrangement of the same nine.
     */
    expect(BATCH_SIZE % 2).not.toBe(0)

    const tablet = GRID_COLUMNS === 3 ? BATCH_SIZE % 2 : 0
    expect(tablet, '9 leaves one cell on a 2-column layout; expected and documented').toBe(1)
  })

  it('agrees with the column count the grid actually renders', () => {
    /*
     * `GRID_COLUMNS` is a constant in a module; the grid is a className in a
     * component. They can drift — someone changes the layout to 4 columns and the
     * constant stays 3, at which point the test above is asserting against a
     * fiction and the empty cell comes straight back.
     *
     * Comments are stripped because both files explain this problem and quote
     * `lg:grid-cols-3` while explaining it.
     */
    const grid = readFileSync(GRID_COMPONENT, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')

    expect(
      grid,
      `GRID_COLUMNS is ${GRID_COLUMNS} but the grid does not render ` +
        `lg:grid-cols-${GRID_COLUMNS}. One of them is lying and BATCH_SIZE follows the liar.`,
    ).toContain(`lg:grid-cols-${GRID_COLUMNS}`)
  })

  it('never returns more than the whole list, even when asked for more', () => {
    const batch = batchOf(rows, 0, 999)
    expect(batch.items).toHaveLength(21)
    expect(batch.hasMore).toBe(false)
    expect(batch.total).toBe(21)
  })

  it('walks the list exactly once, with no gaps and no repeats', () => {
    /*
     * The failure this guards is subtle: an off-by-one in `hasMore` leaves the last
     * row permanently unreachable, and an off-by-one in the offset shows one plant
     * twice. Neither throws. Both look like a catalogue that is simply shorter
     * than it should be.
     */
    const seen: string[] = []
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = batchOf(rows, offset, BATCH_SIZE)
      seen.push(...batch.items)
      if (!batch.hasMore) break
    }

    expect(seen).toEqual(rows)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('reports hasMore from the filtered total, not from the page it returned', () => {
    // 15 items: batch one (9) has more, batch two (6) does not.
    const fifteen = rows.slice(0, 15)
    expect(batchOf(fifteen, 0, BATCH_SIZE).hasMore).toBe(true)
    expect(batchOf(fifteen, BATCH_SIZE, BATCH_SIZE).hasMore).toBe(false)
    expect(batchOf(fifteen, BATCH_SIZE, BATCH_SIZE).items).toHaveLength(6)
  })

  it('leaves no empty cell at the FINAL batch, which is the one nobody rechecks', () => {
    /*
     * The last batch is the one most likely to be ragged, and it is the one the
     * shopper is looking at when they decide whether to press anything else. 12 items
     * in batches of 9 ends with a batch of 3 — one full row, no hole.
     */
    const twelve = rows.slice(0, 12)
    const second = batchOf(twelve, BATCH_SIZE, BATCH_SIZE)

    expect(second.items).toHaveLength(3)
    expect(second.hasMore).toBe(false)
    expect(second.items.length % GRID_COLUMNS).toBe(0)
  })

  it('returns nothing past the end rather than throwing', () => {
    const batch = batchOf(rows, 500, BATCH_SIZE)
    expect(batch.items).toEqual([])
    expect(batch.hasMore).toBe(false)
  })

  it('clamps a hostile or broken limit instead of rendering an empty grid', () => {
    /*
     * `?limit=` arrives from a URL. NaN, zero, a negative number and a
     * ten-million all have to become something usable, because the alternative is a
     * page with no products and no explanation.
     */
    expect(clampBatchSize(Number.NaN)).toBe(BATCH_SIZE)
    expect(clampBatchSize(0)).toBe(BATCH_SIZE)
    expect(clampBatchSize(-5)).toBe(BATCH_SIZE)
    expect(clampBatchSize(7.9)).toBe(7)
    expect(clampBatchSize(10_000_000)).toBe(MAX_BATCH_SIZE)
    expect(clampBatchSize(null)).toBe(BATCH_SIZE)
    // Infinity is not a "large batch", it is a broken value — same as NaN — so it
    // gets the default rather than the maximum. Handing back 24 cards because
    // someone typed `Infinity` would be answering a question nobody asked.
    expect(clampBatchSize(Infinity)).toBe(BATCH_SIZE)
  })

  it('clamps a negative offset, which would otherwise slice from the end', () => {
    /*
     * `slice(-3, 5)` does not mean "nothing" — it returns the last three elements,
     * so a negative offset duplicates the end of the catalogue and skips the
     * middle. The single nastiest off-by-one in a paged list.
     */
    expect(clampOffset(-3)).toBe(0)
    expect(clampOffset(Number.NaN)).toBe(0)
    expect(clampOffset(8)).toBe(8)
    expect(batchOf(rows, -3, BATCH_SIZE).items[0]).toBe('plant-0')
  })
})

describe('readSort', () => {
  it('accepts every known ordering', () => {
    for (const key of ['featured', 'price-asc', 'price-desc', 'name-asc', 'easiest', 'biggest']) {
      expect(readSort(key)).toBe(key)
    }
  })

  it('falls back to featured rather than throwing', () => {
    /*
     * An unknown `?sort=` is a hand-edited URL, a stale bookmark or a crawler.
     * 500-ing a page over a query parameter is both a bad experience and a bad
     * signal for the URL.
     */
    expect(readSort('price-sideways')).toBe('featured')
    expect(readSort('')).toBe('featured')
    expect(readSort(null)).toBe('featured')
    expect(readSort(undefined)).toBe('featured')
    expect(readSort('featured; DROP TABLE skus')).toBe('featured')
  })
})

describe('readBrowseSet', () => {
  it('maps a known collection and occasion', () => {
    expect(readBrowseSet('collection:low-maintenance-indoor-plants')).toEqual({
      kind: 'collection',
      handle: 'low-maintenance-indoor-plants',
    })
    expect(readBrowseSet('occasion:housewarming')).toEqual({
      kind: 'occasion',
      handle: 'housewarming',
    })
  })

  it('maps the homepage grids, so "Show more" cannot mix plants with soil', () => {
    expect(readBrowseSet('home:plants')).toEqual({ kind: 'home-plants' })
    expect(readBrowseSet('home:consumables')).toEqual({ kind: 'home-consumables' })
  })

  it('degrades an unknown set to the catalogue rather than 404ing', () => {
    /*
     * The PAGE for an unknown handle still calls notFound() — that is where the
     * judgement belongs, because it has copy to explain itself. An API that 404s
     * on a stale bookmark instead makes a broken link look like a broken server.
     */
    expect(readBrowseSet('collection:no-such-collection')).toEqual({ kind: 'catalogue' })
    expect(readBrowseSet('occasion:no-such-occasion')).toEqual({ kind: 'catalogue' })
    expect(readBrowseSet('garbage')).toEqual({ kind: 'catalogue' })
    expect(readBrowseSet(undefined)).toEqual({ kind: 'catalogue' })
  })
})

describe('withoutOwnParams', () => {
  it('strips the controls this module owns so a page offset is not inherited', () => {
    /*
     * If the page's `offset` leaked into the next request, every batch after the
     * first would skip further and further down the catalogue and the grid would
     * silently drop the middle of the shop.
     */
    const page = new URLSearchParams(
      'light=low&q=money&sort=price-asc&set=home:plants&offset=8&limit=8',
    )

    expect([...withoutOwnParams(page).keys()].sort()).toEqual(['light'])
  })

  it('keeps repeated facet values, which a checkbox group legitimately produces', () => {
    const page = new URLSearchParams('difficulty=easy&difficulty=medium&q=zz')
    const out = withoutOwnParams(page)

    // Facet values survive, with every repetition intact — a checkbox group
    // legitimately produces `difficulty=easy&difficulty=medium`, and collapsing
    // that to one value silently drops half the shopper's selection.
    expect(out.getAll('difficulty')).toEqual(['easy', 'medium'])

    // `q` is stripped: it is a control this module owns, and the API reads the query
    // itself. Forwarding the page's copy alongside a re-read would be ambiguous.
    expect(out.get('q')).toBeNull()
  })
})

describe('rowsFor', () => {
  /*
   * A minimal facade-shaped storefront. `rowsFor` needs `items` (keyed by skuId)
   * and `facets` (keyed by the same id), and nothing else — so the seam is small
   * enough to test without a database.
   */
  /*
   * `id` is the SKU, not the slug.
   *
   * `loadStorefront` adapts each catalogue item into a facet "same length", so a
   * facet's id IS its skuId — which is what `rowsFor` joins back on. A fixture that
   * keyed the facet by slug made the join return nothing, and the test failed for a
   * reason that had nothing to do with the code under test. Worth writing down: the
   * fixture has to be right in the same places the real adapter is.
   */
  const plant = (skuId: string, slug: string, light: 'low' | 'bright_indirect'): Facetable =>
    ({
      id: skuId,
      slug,
      commonName: slug,
      itemClass: 'plant',
      light,
      difficulty: 'easy',
      room: 'desk',
      stock: 5,
      entryPaise: skuId === 'sku-zz' ? 19900 : 29900,
    }) as unknown as Facetable

  const soil = {
    id: 'sku-pot',
    slug: 'pot-mix',
    commonName: 'Pot mix',
    itemClass: 'consumable',
    light: 'low',
    difficulty: 'easy',
    room: 'desk',
    stock: 5,
    entryPaise: 9900,
  } as unknown as Facetable

  const storefront = {
    facets: [
      plant('sku-zz', 'zz-plant', 'low'),
      plant('sku-money', 'money-plant', 'bright_indirect'),
      soil,
    ],
    items: [
      { skuId: 'sku-zz', slug: 'zz-plant', commonName: 'zz-plant', basePricePaise: 19900 },
      { skuId: 'sku-money', slug: 'money-plant', commonName: 'money-plant', basePricePaise: 29900 },
      { skuId: 'sku-pot', slug: 'pot-mix', commonName: 'Pot mix', basePricePaise: 9900 },
    ],
  } as never

  it('separates plants from consumables on the homepage set', () => {
    /*
     * The set mismatch that made this necessary: without `set=`, the API returned
     * the whole PLP, so pressing "Show more" under the homepage PLANT grid
     * appended a bag of cocopeat.
     */
    const plants = rowsFor(storefront, new URLSearchParams('set=home:plants'))
    // Cheapest first: zz (₹199) before money (₹299). "Featured" is defined as
    // in-stock, then entry price, then name — so this asserts the ordering the
    // shopper sees, not just the membership.
    expect(plants.map((p) => p.skuId)).toEqual(['sku-zz', 'sku-money'])
    expect(plants.some((p) => p.slug === 'pot-mix')).toBe(false)

    const consumables = rowsFor(storefront, new URLSearchParams('set=home:consumables'))
    expect(consumables.map((p) => p.skuId)).toEqual(['sku-pot'])
  })

  it('keeps a collection set stable no matter how many batches were requested', () => {
    /*
     * The parity property that matters most: the page's first batch and the API's
     * first batch must be the same list, or "Show more" repeats and reorders.
     */
    const pageParams = new URLSearchParams(
      'set=collection:plants-for-an-office-desk&sort=price-asc',
    )
    const fromApi = rowsFor(storefront, new URLSearchParams(pageParams.toString()))

    expect(rowsFor(storefront, pageParams)).toEqual(fromApi)
  })

  it('joins facets back to catalogue rows by id, not by array position', () => {
    const rows = rowsFor(storefront, new URLSearchParams('set=home:consumables'))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.commonName).toBe('Pot mix')
  })
})
