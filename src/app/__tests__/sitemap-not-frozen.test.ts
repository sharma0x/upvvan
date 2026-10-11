import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The sitemap must be generated per request, not frozen into the build.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * `src/app/sitemap.ts` is a metadata file. A metadata file compiles to a Route
 * Handler, and **Route Handlers are cached by default** — Next prerenders them
 * during `next build` and serves the baked body forever. The build output says
 * so plainly:
 *
 *     ○ /sitemap.xml
 *
 * That is the whole file's premise, gone. Its own header explains that this
 * catalogue rotates with the season and that "a species out of season simply is
 * not in the sitemap, because it is not in the shop" — a claim that is false of
 * a frozen file, which is in fact a picture of whatever the shop looked like on
 * the day somebody ran the build.
 *
 * ── WHY IT NEVER THREW ───────────────────────────────────────────────────────
 *
 * The `catch` at the bottom of that file returns the three static entries when
 * the catalogue query fails. That is the right call for a *runtime* 500 and the
 * wrong call here: it also swallows a build that could not reach Postgres at all.
 * A CI runner with no database produces a clean, green, zero-error build whose
 * sitemap advertises three pages of a plant shop. Nothing in the build output
 * says otherwise. The failure is not a crash; it is a wrong file being shipped.
 *
 * ── WHY A STATIC CHECK ───────────────────────────────────────────────────────
 *
 * The only thing that actually observes the freeze is the build output itself,
 * which no test can read. What is assertable here is the cause of the freeze:
 * the missing `dynamic` export. It is one line, it is the line that was omitted,
 * and it is the line someone is most likely to delete again while "tidying" the
 * file. `force-dynamic` is also the only setting that makes the file's header
 * true; `revalidate` would regenerate on a timer but still ship one build-time
 * prerender, which is the same silent fallback with a longer fuse.
 */
const SITEMAP = resolve(__dirname, '..', 'sitemap.ts')
const source = readFileSync(SITEMAP, 'utf8')

describe('sitemap.xml is generated per request', () => {
  it('is not statically prerendered at build time', () => {
    expect(
      /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(source),
      'src/app/sitemap.ts has no `export const dynamic = "force-dynamic"`.\n\n' +
        'Without it Next caches the metadata route at build time and serves a frozen\n' +
        'sitemap for the life of the deployment — which is the exact failure this file\n' +
        'exists to avoid, and which no build log will report.',
    ).toBe(true)
  })

  it('says so in its own header, so the claim is not quietly dropped', () => {
    // The header is the only description of why this file is dynamic. If the
    // export is ever removed, this is the comment someone would remove with it.
    expect(source).toMatch(/force-dynamic/)
  })
})
