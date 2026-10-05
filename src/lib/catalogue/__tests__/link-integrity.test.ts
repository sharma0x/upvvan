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

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await realFetch(url, { signal: AbortSignal.timeout(4000) })
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
        `[links] No server on ${BASE}. Start one with \`make start\`, or set ` +
          'ALLOW_E2E_SKIP=1 to allow this suite to pass without a server — ' +
          'knowing that a skipped link check is no evidence at all.',
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
    const broken: string[] = []

    for (const route of ROUTES) {
      const res = await realFetch(`${BASE}${route}`)
      expect(res.status, `${route} should render`).toBe(200)

      for (const href of new Set(internalHrefs(await res.text()))) {
        // Strip the query string; a filter or tier is not a different page.
        const path = href.split('?')[0]!
        const target = await realFetch(`${BASE}${path}`, { redirect: 'manual' })
        if (target.status === 404) {
          const body = await target.text()
          broken.push(
            `${route} → ${path} :: ${body.slice(0, 160).replace(/\s+/g, ' ')}`,
          )
        }
      }
    }

    expect(
      broken,
      `Dead internal links — a compliance disclosure that 404s is worse than none:\n  ${broken.join('\n  ')}`,
    ).toEqual([])
  })

  it('the compliance footer renders on every route', async () => {
    if (!available) return
    for (const route of ROUTES) {
      const html = await (await realFetch(`${BASE}${route}`)).text()
      expect(html, `${route} must carry the r.4(2) disclosures`).toContain('Grievance officer')
    }
  })

  it('exactly ONE footer per document', async () => {
    if (!available) return
    // Two <footer> elements is invalid HTML, and it meant the site footer — the
    // one carrying the legal disclosures — rendered below a page-local policy
    // note on the homepage.
    for (const route of ROUTES) {
      const html = await (await realFetch(`${BASE}${route}`)).text()
      const count = (html.match(/<footer/g) ?? []).length
      expect(count, `${route} has ${count} <footer> elements`).toBe(1)
    }
  })
})
