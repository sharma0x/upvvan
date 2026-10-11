import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Structural invariants of the paged grid, checked against the source.
 *
 * ── WHY THESE ARE SOURCE CHECKS AND NOT RENDER TESTS ──────────────────────────
 *
 * All three defects below were invisible to every existing test, because all three
 * are about how the markup is ASSEMBLED rather than what it says. A render test
 * would need a browser, a seeded catalogue and a layout engine to notice that a
 * grid has a hole in it; this reads the component.
 *
 * That is a real limitation and worth stating: none of this proves the page looks
 * right. What it does is make the specific shape that broke it expensive to
 * reintroduce.
 */
const GRID = resolve(__dirname, '..', '..', '..', 'components', 'catalogue', 'PagedItemGrid.tsx')
const SKELETON = resolve(__dirname, '..', '..', '..', 'components', 'catalogue', 'GridSkeleton.tsx')

/**
 * Source with comments stripped.
 *
 * The comments in both files EXPLAIN these defects and name `<ul>` while doing it,
 * so a naive search for `<ul` matched the explanation of the bug it was looking for.
 * A test that fires on its own documentation is a test people learn to ignore.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

const grid = readFileSync(GRID, 'utf8')
const skeleton = readFileSync(SKELETON, 'utf8')

const gridCode = code(grid)
const skeletonCode = code(skeleton)

describe('the paged grid is ONE list, not a stack of grids', () => {
  it('renders exactly one grid element', () => {
    /*
     * The blank spaces. Each batch used to render its own
     * `<ul className="grid … lg:grid-cols-3">`, so the page was two or three
     * independent grids stacked on each other: at three columns a batch of eight
     * lays out 3 + 3 + 2 and leaves one empty cell, and the next batch starts a
     * fresh grid below the gap.
     *
     * A shopper reads that hole as a card that failed to load, which is the worst
     * possible thing for a loading affordance to look like.
     */
    const gridElements = gridCode.match(/<ul className="gap-base[^"]*grid[^"]*"/g) ?? []
    expect(
      gridElements.length,
      `PagedItemGrid must render exactly ONE <ul class="grid">; batches are <li>s inside it.\n` +
        `Found ${gridElements.length}. Each one is a separate grid, and each batch that is not a\n` +
        `multiple of the column count leaves empty cells at the end of its last row.`,
    ).toBe(1)
  })

  it('renders batches as list items, not as their own lists', () => {
    // `BatchCards` is the only place appended cards are emitted. A `<ul>` in its
    // body would be a second grid; `<li>`s flow into the caller's grid.
    //
    // Sliced to the end of THAT FUNCTION, not to end-of-file — the component's own
    // single `<ul>` lives after it, and including that made the first version of
    // this assertion fail on correct code.
    const from = gridCode.indexOf('function BatchCards')
    const to = gridCode.indexOf('export default function PagedItemGrid')
    expect(from).toBeGreaterThan(-1)
    expect(to).toBeGreaterThan(from)

    const body = gridCode.slice(from, to)
    expect(body).toMatch(/<PlantCard/)
    expect(body, 'BatchCards must not open its own <ul>; that is a second grid').not.toMatch(/<ul/)
  })

  it('keeps the skeletons inside that same list', () => {
    /*
     * The skeleton has to be `<li>`s too. If the Suspense fallback renders its own
     * grid, the hole reappears for every second and third press.
     */
    // `[^}]*` cannot be used here: the fallback line itself contains `}` inside
    // `count={batchSize}`, so the pattern stopped before reaching `inline` and
    // reported a failure on a file that was correct.
    const fallback = gridCode.match(/<GridSkeleton[^>]*inline[^>]*\/>/)
    expect(fallback, 'the Suspense fallback must be <GridSkeleton … inline />').toBeTruthy()

    /*
     * Bounded to the `if (inline)` block ALONE. Slicing to end-of-file swept in the
     * non-inline branch, which legitimately renders its own `<ul>` — so the
     * assertion fired on the one place a `<ul>` is correct.
     */
    const from = skeletonCode.indexOf('if (inline)')
    const to = skeletonCode.indexOf('<div role="status"', from)
    expect(from, 'GridSkeleton has no inline branch').toBeGreaterThan(-1)
    expect(to, 'the inline branch has no end marker to bound the slice').toBeGreaterThan(from)

    const inline = skeletonCode.slice(from, to)
    expect(inline).toMatch(/return \(\s*<>/)
    expect(inline).toMatch(/\{cards\}/)
    expect(inline, 'the inline skeleton must emit bare <li>s, not a nested <ul>').not.toMatch(/<ul/)
  })
})

/**
 * The `<button>`'s own className.
 *
 * `data-testid` is the button's LAST attribute, so the class list that belongs to it
 * is the closest `className="` BEFORE it. Anything searched forward finds the
 * chevron `<span className="ml-xs">` instead — which is how the first version of the
 * affordance test reported a button with no cursor on a button that had one.
 */
function showMoreClassName(): string {
  const at = grid.indexOf('data-testid="show-more"')
  if (at < 0) throw new Error('PagedItemGrid has no show-more control')
  const before = grid.slice(0, at)
  const match = before.slice(before.lastIndexOf('className="')).match(/className="([^"]*)"/)
  if (!match) throw new Error('the show-more control has no className')
  return match[1]!
}

describe('the show-more control looks clickable', () => {
  it('does not rely on class names that no stylesheet defines', () => {
    /*
     * It shipped as `className="btn btn-secondary"`. There is no `.btn` rule
     * anywhere in this repository — those names came from another design system and
     * resolved to nothing, leaving the element with `background: transparent`,
     * `border: 0` and `cursor: default`. It rendered as inert underlined-nothing
     * under the grid.
     *
     * The class list looks perfectly reasonable in a diff. Only computed style shows
     * it, which is why "does it look clickable" has to be an assertion rather than a
     * judgement call at review time.
     */
    const className = showMoreClassName()
    expect(className, 'could not find the show-more className').toBeTruthy()

    const classes = className.split(/\s+/).filter(Boolean)
    const undefinedUtilities = classes.filter(
      (c) => c === 'btn' || c === 'btn-secondary' || c === 'btn-primary',
    )

    expect(
      undefinedUtilities,
      `PagedItemGrid uses ${undefinedUtilities.join(', ')}, which no stylesheet in this repo defines.\n` +
        `That renders an unstyled element with no cursor, no border and no background —\n` +
        `the control stops looking clickable. Use real utilities.`,
    ).toEqual([])
  })

  it('declares the affordances that make it read as a link', () => {
    /*
     * The className is the one BEFORE `data-testid`, not after.
     *
     * `data-testid` sits on the `<button>`'s last attribute, and the chevron `<span>`
     * with `className="ml-xs"` follows it — so searching forward found the chevron
     * and reported a button with no cursor on a button that had one. Which is the
     * failure mode of every assertion written by guessing at string order.
     */
    const className = showMoreClassName()

    // A pointer cursor, an underline, and a visible focus ring. Any one of these
    // missing is the exact complaint that prompted this file.
    expect(className).toContain('cursor-pointer')
    expect(className).toMatch(/underline/)
    expect(className).toMatch(/focus-visible:ring/)
    // The focus ring needs a colour that exists; `ring-primary` resolves to
    // `--color-primary`, which is in the generated theme.
    expect(className).toContain('ring-primary')
  })

  it('says there is more below, not above', () => {
    // "Show more" with nothing indicating direction reads as "more of this row".
    const button = grid.slice(grid.indexOf('data-testid="show-more"'))
    expect(button.slice(0, 400)).toMatch(/↓/)
  })
})

describe('the count labels what is actually being counted', () => {
  it('takes the noun from the caller instead of assuming "plant"', () => {
    /*
     * The homepage's "Soil, feed & tools" grid announced "Showing 3 of 3 plants"
     * directly under three bags of cocopeat. The count is the first thing a shopper
     * reads, and calling soil a plant tells them the page does not know what it
     * sells.
     */
    expect(grid).toMatch(/nounOne = 'plant'/)
    expect(grid).toMatch(/nounMany = 'plants'/)
    expect(grid).toMatch(/\{totalMatched === 1 \? nounOne : nounMany\}/)
    expect(grid).not.toMatch(/'plants'\}\s*$/)
  })

  it('passes "product" on the grid that is not selling plants', () => {
    const catalogue = readFileSync(
      resolve(__dirname, '..', '..', '..', 'components', 'storefront', 'Catalogue.tsx'),
      'utf8',
    )
    const consumables = catalogue.slice(catalogue.indexOf("set: 'home:consumables'"))
    expect(consumables).toMatch(/nounOne="product"/)
  })
})
