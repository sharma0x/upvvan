import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPool } from '@/lib/db/pool'

/**
 * The coverage checker must have a city to check.
 *
 * ── THE BUG ──────────────────────────────────────────────────────────────────
 *
 * The homepage rendered `<Hero cities={[]} … />`. `ServiceabilityChecker` maps that
 * array into `<option>` elements, so the city `<select>` shipped with ZERO options:
 * an empty dropdown sitting directly above a "Check coverage" button.
 *
 * Both cities were in the database the entire time — Bengaluru live, Hyderabad
 * pending licence. The list was never read from anywhere.
 *
 * ── WHY NOTHING CAUGHT IT ────────────────────────────────────────────────────
 *
 * The page returned 200. The `<select>` existed, with an `id`, a `name` and a
 * `<label htmlFor>`. Its submit button was correctly disabled, so the form looked
 * deliberate rather than broken. And no assertion anywhere in the repository
 * required a `<select>` to have options — an empty one is valid HTML.
 *
 * So this is checked from both ends that actually matter: the rendered markup, and
 * the query that feeds it.
 */
const PAGE = resolve(__dirname, '..', '..', '..', 'app', 'page.tsx')
const CHECKER = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'components',
  'geo',
  'ServiceabilityChecker.tsx',
)

const page = readFileSync(PAGE, 'utf8')
const checker = readFileSync(CHECKER, 'utf8')

describe('the city list', () => {
  it('is loaded, not hardcoded empty', () => {
    /*
     * The direct assertion. `cities={[]}` is a four-character mistake with no type
     * error, no lint error and no test failure anywhere in this repository.
     */
    expect(
      page,
      'src/app/page.tsx passes an empty array to <Hero>. That renders a <select> with no options.',
    ).not.toMatch(/cities=\{\[\]\}/)
  })

  it('comes from the database', () => {
    expect(page).toMatch(/loadCityRefs/)
  })

  it('has rows to offer', async () => {
    // The other end: a loader that returns [] renders exactly the same empty box.
    const db = await getPool()
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "cities" WHERE "status" <> 'killed'`,
    )

    expect(
      rows[0]!.n,
      'No cities in the table — the coverage checker has nothing to list.',
    ).toBeGreaterThan(0)
  })
})

describe('the city select', () => {
  it('renders one option per city', () => {
    expect(checker).toMatch(/\{cities\.map\(\(c\) => \(/)
    expect(checker).toMatch(/<option key=\{c\.slug\}/)
  })

  it('has a defined state when there is nothing to list', () => {
    /*
     * If the table is ever empty the dropdown must say so. An empty `<select>` is
     * valid HTML and looks identical to the bug above; a labelled option saying
     * "No cities to check yet" is a visible, honest state.
     */
    expect(checker).toMatch(/cities\.length === 0/)
  })

  it('lists unopened cities rather than hiding them', () => {
    /*
     * A shopper in Hyderabad types their pincode into this form. With Hyderabad
     * absent, the dropdown silently defaults to Bengaluru and answers about the
     * wrong city — which is the exact failure the city gate exists to prevent.
     */
    expect(checker).toMatch(/not open here yet/)
  })

  it('clears a stale verdict when the city changes', () => {
    /*
     * Otherwise "We deliver to your pincode" stays on screen after switching city,
     * and we are answering about Bengaluru when they asked about Hyderabad.
     */
    /*
     * Anchored on `id="city"`, not on the first `onChange` in the file — the pincode
     * field has one too, so slicing from it inspected the wrong handler. Same trap as
     * finding the chevron's className instead of the button's.
     */
    const city = checker.slice(checker.indexOf('id="city"'))
    expect(city.slice(0, 600)).toMatch(/setVerdict\(\{ state: 'idle' \}\)/)
  })
})
