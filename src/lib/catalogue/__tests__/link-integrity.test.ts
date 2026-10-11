/**
 * Link integrity — no customer-facing page may link to a 404.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * Two dead links shipped inside the COMPLIANCE FOOTER, which is the worst
 * possible place for one: Consumer Protection (E-Commerce) Rules 2020 r.4(2)
 * requires the entity and grievance disclosures to be displayed accessibly, and
 * a reader who clicks through to find the policies gets a 404.
 *
 * The first version of this check did not exist, so both links were found by
 * curling them by hand after a reviewer noticed. Nothing in typecheck, lint, the
 * 158-test suite, or the production build can see a link target that does not
 * resolve — the link is valid JSX and the route is simply absent.
 *
 * So: walk the rendered routes, extract every internal href, and assert each one
 * is a route this app actually serves.
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'

/** Routes a customer can reach. Kept explicit so a new page is a deliberate act. */
const ROUTES = ['/', '/cart', '/policies', '/grievance']

let available = false

/*
 * `happy-dom` replaces global fetch with a DOM stub, so a real HTTP request from
 * a unit suite fails even when the server IS running. The first version of this
 * file detected that and returned early — which meant it passed having verified
 * NOTHING, and it passed while a dead `/privacy` link sat in the compliance
 * footer. That is precisely the "green test never seen failing" failure the
 * project treats as no evidence, committed by me.
 *
 * Two changes:
 *   1. Use node's fetch explicitly (`node:...` is not stubbed by happy-dom).
 *   2. When the server genuinely is unreachable, FAIL unless E2E_BASE_URL is
 *      unset-and-skip-allowed. A silent skip is how this hid a real bug.
 */
/*
 * A REAL fetch, not the DOM stub.
 *
 * `happy-dom` installs its own `globalThis.fetch` that cannot open a socket, and
 * it does so before `setupFiles` run — so capturing the global in setup was too
 * late and still got the stub. `undici` ships Node's actual HTTP client and
 * nothing stubs it, so this is the fetch that can genuinely reach a running
 * server.
 */
const { fetch: realFetch } = await import('undici')

/*
 * Is a server actually there?
 *
 * ── WHY THE TIMEOUT IS GENEROUS ─────────────────────────────────────────────
 *
 * This was 4 seconds, and that turned a COLD DEV SERVER into "no server". A first
 * request to a Next dev route compiles it, and on this project the homepage takes
 * ~20s cold. So the probe timed out, `available` stayed false, and all three
 * tests returned early — reported as SKIPPED, which is exactly the state this file
 * exists to prevent. A dead-link check that quietly does nothing when the machine
 * is slow is worse than one that does not exist: it looks like coverage.
 *
 * 30 seconds costs nothing when the server is warm (the probe returns in
 * milliseconds) and is the difference between "ran" and "silently skipped" when it
 * is not.
 *
 * `/` is used because it is the route the crawler fetches first anyway, so the
 * compile it triggers is one the crawl was going to pay for regardless.
 */
const REACHABLE_TIMEOUT_MS = 30_000

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await realFetch(url, { signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS) })
    return res.ok
  } catch {
    return false
  }
}

beforeAll(async () => {
  available = await reachable(BASE)
  if (!available) {
    const allowSkip = process.env.ALLOW_E2E_SKIP === '1'
    if (!allowSkip) {
      throw new Error(
        `[links] No server answered on ${BASE} within ${REACHABLE_TIMEOUT_MS / 1000}s.\n` +
          'Start one with `make dev`, or `make test-links`, which boots it for you.\n' +
          'If the server IS running, check whether the first compile is simply slow —\n' +
          'that is a timeout here, not a missing server.\n\n' +
          'These tests are deliberately not skipped: a dead-link check that quietly ' +
          'passes when the machine is slow is indistinguishable from one that found nothing.',
      )
    }
    console.warn(`[links] SKIPPED — no server on ${BASE}. This proves nothing.`)
  }
})

/** Internal hrefs only — external links are not ours to validate. */
function internalHrefs(html: string): string[] {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)
  return hrefs.filter(
    (h) =>
      h.startsWith('/') &&
      !h.startsWith('//') && // protocol-relative
      !h.startsWith('/_next') && // build asset
      !/\.(svg|png|jpg|jpeg|webp|css|js|ico|xml|txt|json)$/i.test(h),
  )
}

/**
 * Fetch a path, retrying once on a 5xx.
 *
 * ── WHY A RETRY IS NOT A WEAKENING ──────────────────────────────────────────
 *
 * A dev server compiling a route cold, while sharing a Postgres pool with the
 * crawls own other requests, returns 500 for reasons that have nothing to do with
 * the page. A page with a real bug returns 500 every time.
 *
 * One retry separates those two cases without ignoring either: a route that
 * errors twice in a row still fails this suite, loudly, which is the assertion
 * that matters. Without it the honest 500s get lost in the load-induced ones, and
 * the 500 check — which catches a reachable-but-broken link, the worst kind —
 * becomes the noisiest test in the file.
 */
/*
 * `undici`'s Response, not the global one.
 *
 * The global `Response` here is happy-dom's DOM stub — the same stub that made
 * the first version of this suite pass having verified nothing. Returning undici's
 * type explicitly keeps the compile-time and runtime fetch the SAME client, so a
 * future refactor cannot quietly fall back to the stub while still type-checking.
 */
type UndiciResponse = Awaited<ReturnType<typeof realFetch>>

async function fetchWithRetryOnServerError(path: string): Promise<UndiciResponse> {
  const first = await realFetch(`${BASE}${path}`, { redirect: 'manual' })
  if (first.status < 500) return first

  // Brief pause so the compile or the query can finish, rather than hammering a
  // server that has already said it is struggling.
  await new Promise((r) => setTimeout(r, 750))
  return realFetch(`${BASE}${path}`, { redirect: 'manual' })
}

/** Every ROUTES document, fetched once and shared by the tests below. */
let htmlCache: Promise<Array<[string, string]>> | null = null
function pageHtml(): Promise<Array<[string, string]>> {
  if (!htmlCache) {
    htmlCache = Promise.all(
      ROUTES.map(async (route) => {
        const res = await realFetch(`${BASE}${route}`)
        return [route, await res.text()] as [string, string]
      }),
    )
  }
  return htmlCache
}

describe('customer-facing link integrity', () => {
  it('every internal link on every route resolves', async () => {
    if (!available) {
      console.warn('[links] SKIPPED — no server on ' + BASE + ' (run `make start`)')
      return
    }

    /*
     * WHY THIS SUITE MUST NOT RUN ALONGSIDE THE DB SUITES
     * --------------------------------------------------
     * `link-integrity` asserts against a RUNNING SERVER while
     * `catalogue-invariants.db.test.ts` (and the other `*.db.test.ts` files) run
     * raw `DELETE FROM species …` / `DELETE FROM cities …` against the SAME
     * development database. Vitest runs files in parallel by default.
     *
     * So the suite was racing the fixtures: the PDP calls `loadCatalogue`, and
     * when a concurrent suite had deleted the seeded species mid-request the
     * catalogue came back empty, `notFound()` fired, and the test recorded every
     * product URL as a dead link.
     *
     * It reproduces with exactly two files and nothing else running:
     *
     *   link-integrity alone              → 3 passed
     *   link-integrity + catalogue-inv.   → 1 failed (all 6 species "dead")
     *
     * That is a FALSE failure and it is worse than no test at all, because the
     * obvious reaction — to add a 404 to an ignore list, or to "fix" the PDP — is
     * wrong on both counts. The product was never broken; the harness was.
     *
     * The fix is sequencing, not a longer timeout and not a relaxed assertion.
     * `fileParallelism: false` would serialise the entire suite, which is a real
     * cost for the dozen unit suites that share nothing. So this one file opts
     * into the SAME lock the DB suites already use — `describe.sequential` only
     * orders tests WITHIN a file, so the ordering that matters is implemented as
     * a single-file run in `package.json`, documented at the script.
     */
    /*
     * ── COLLECT EVERYTHING, THEN FETCH EACH TARGET ONCE ────────────────────────
     *
     * The loop this replaced walked route-by-route and re-fetched every link on
     * every hop: `/policies` was requested once per page that links to it, and
     * the four `ROUTES` between them reference most of the site. By the time
     * corporate, gifting, tracking and claims pages existed the suite ran past
     * the 30s timeout — and a suite that times out reports "the server is
     * broken", not "the crawl is quadratic".
     *
     * So the two phases are separated. Pass one reads four documents (cheap, and
     * only four). Pass two resolves the UNION of their targets exactly once,
     * eight at a time. Cost is now O(routes + distinct links) rather than
     * O(routes x links), which is the property that matters as the site grows:
     * the crawl gets cheaper per page, not more expensive.
     *
     * The concurrency is bounded deliberately, and LOWERED from 8 to 3 after it
     * caused real false failures.
     *
     * At 8, the crawl rendered `/quiz`, `/search`, `/faq`, `/gifting/[occasion]`
     * and `/corporate/request-quote` simultaneously. Each is a cold Next compile
     * that also opens a Postgres pool, and the log filled with
     *
     *   Connection terminated due to connection timeout
     *
     * while the 5xx assertion I had just added reported every one of them broken.
     * They were not: each returned 200 when curled on its own. The harness had
     * starved itself, and a test that fails because IT was too aggressive teaches
     * a developer to ignore it — which is the failure mode this whole file exists
     * to avoid.
     */
    const crawl = ROUTES.map(async (route) => {
      const res = await realFetch(`${BASE}${route}`)
      expect(res.status, `${route} should render`).toBe(200)
      // Strip the query string; a filter or tier is not a different page.
      const hrefs = new Set(internalHrefs(await res.text()).map((h) => h.split('?')[0]!))
      return { route, hrefs }
    })

    const pages = await Promise.all(crawl)

    /** path -> the routes that link to it, so a failure names its own sources. */
    const linkedFrom = new Map<string, string[]>()
    for (const { route, hrefs } of pages) {
      for (const path of hrefs) {
        if (!linkedFrom.has(path)) linkedFrom.set(path, [])
        linkedFrom.get(path)!.push(route)
      }
    }

    const paths = [...linkedFrom.keys()]
    const settled = new Map<string, { status: number; body: string }>()

    const CONCURRENCY = 3
    for (let i = 0; i < paths.length; i += CONCURRENCY) {
      const batch = paths.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (path) => {
          const res = await fetchWithRetryOnServerError(path)
          // Only a 404 is dead. A 3xx is a redirect we chose on purpose
          // (`/problems/x` -> `/blog/x` is canonicalisation, not breakage), and
          // a 500 that PERSISTS past the retry means the page exists and is
          // broken, which this suite must not swallow — see the assertion below.
          return [
            path,
            { status: res.status, body: res.status === 404 ? await res.text() : '' },
          ] as const
        }),
      )
      for (const [path, value] of results) settled.set(path, value)
    }

    const broken = paths
      .filter((path) => settled.get(path)!.status === 404)
      .map(
        (path) =>
          `${[...new Set(linkedFrom.get(path)!)].join(
            ', ',
          )} -> ${path} :: ${settled.get(path)!.body.slice(0, 160).replace(/\s+/g, ' ')}`,
      )

    expect(
      broken,
      `Dead internal links — a compliance disclosure that 404s is worse than none:\n  ${broken.join('\n  ')}`,
    ).toEqual([])

    /*
     * A 500 is not a dead link, so the previous version reported it as PASS.
     *
     * Every href here now has a status. A route that exists and throws still
     * renders a link a customer can click, and "clicked and got a 500" is a
     * launch blocker that a 404-only check declares healthy.
     */
    const serverErrors = paths
      .filter((path) => settled.get(path)!.status >= 500)
      .map((path) => `${path} -> ${settled.get(path)!.status}`)

    expect(
      serverErrors,
      `Linked routes that 5xx. A reachable link that errors is worse than a missing one:\n  ${serverErrors.join('\n  ')}`,
    ).toEqual([])
  }, 180_000) // server rather than a slow one. // global 30s is sized for unit tests; timing this one out reports a broken // A real HTTP crawl against a dev server that is also compiling. The

  it('the compliance footer renders on every route', async () => {
    if (!available) return
    // One fetch per route, shared: this and the next test used to each pull all
    // four documents again for no reason.
    for (const [route, html] of await pageHtml()) {
      expect(html, `${route} must carry the r.4(2) disclosures`).toContain('Grievance officer')
    }
  })

  it('exactly ONE footer per document', async () => {
    if (!available) return
    // Two <footer> elements is invalid HTML, and it meant the site footer — the
    // one carrying the legal disclosures — rendered below a page-local policy
    // note on the homepage.
    for (const [route, html] of await pageHtml()) {
      const count = (html.match(/<footer/g) ?? []).length
      expect(count, `${route} has ${count} <footer> elements`).toBe(1)
    }
  })
})
