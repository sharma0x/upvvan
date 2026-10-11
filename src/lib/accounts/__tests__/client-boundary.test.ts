import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * No client bundle may reach the server configuration.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * `src/lib/config.ts` throws when it is evaluated in a production bundle:
 *
 *     secret('PAYLOAD_SECRET')  →  no value  →  NODE_ENV === 'production'  →  throw
 *
 * Which is correct, and which is the whole point of the file. But `process.env` in
 * a BROWSER is not the server's environment — Next.js inlines only `NEXT_PUBLIC_*`
 * and everything else is `undefined` there.
 *
 * So a `'use client'` module importing `@/lib/config` imports a module that throws
 * in production, and the page renders the error boundary instead of itself.
 *
 * That is not hypothetical. `src/lib/auth/client.ts` did exactly this, and the
 * result was that `/sign-in` — the page every returning customer must pass through —
 * rendered "This page did not load" in a real browser against a production build:
 *
 *     ConfigError: PAYLOAD_SECRET is required in production.
 *
 * Nothing else caught it. Development is fine (the dev fallback), curl is fine (the
 * server-rendered HTML is correct), `pnpm build` is clean, typecheck is clean, 404
 * unit tests pass, the journey passes, and a 76-check business simulation that
 * drives the auth API over HTTP passes. Every one of those either does not load a
 * client bundle or loads it in development.
 *
 * It took a real browser against a production build to find it.
 *
 * ── WHY A STATIC SCAN RATHER THAN A BUILD-TIME ASSERTION ─────────────────────
 *
 * The honest build-time check would be a bundler plugin walking the client graph.
 * This scan is not that: it looks at first-party source, and a client module that
 * reaches the server config THROUGH another client module would not be caught.
 *
 * That gap is worth naming rather than hiding. It is closed in practice by
 * `public-config.ts` being the only module a client may import for configuration,
 * by this test catching the direct case, and by the browser check in the business
 * simulation's own warm-up list — which loads `/sign-in` and would surface a
 * hydration failure as a failed check rather than as a mystery.
 */
// `__dirname` here is `src/lib/accounts/__tests__`, so three levels up is `src`.
const SRC = resolve(__dirname, '..', '..', '..')

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // `.next` and `node_modules` live outside `src`, but be explicit: this walk
      // must never be the thing that slows a test down.
      if (entry === 'node_modules' || entry === '.next') continue
      sourceFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

const ALL = sourceFiles(SRC)

const CLIENT_FILES = ALL.filter((f) =>
  /^\s*(?:'use client'|"use client")/.test(readFileSync(f, 'utf8')),
)

describe('the client/server boundary', () => {
  it('found the client components it is supposed to be checking', () => {
    // A scan that silently matches nothing is a green test that cannot fail, which
    // is the state this repository's own rule exists to prevent.
    expect(
      CLIENT_FILES.length,
      'No "use client" modules were found. The scan is not looking at anything.',
    ).toBeGreaterThan(5)
  })

  it('no "use client" module imports the server config directly', () => {
    const offenders: string[] = []

    for (const file of CLIENT_FILES) {
      const source = readFileSync(file, 'utf8')
      if (/from\s+['"]@\/lib\/config['"]/.test(source)) {
        offenders.push(relative(SRC, file))
      }
    }

    expect(
      offenders,
      `These client components import @/lib/config, which THROWS in a production\n` +
        `bundle because process.env.PAYLOAD_SECRET is undefined in a browser:\n` +
        `  ${offenders.join('\n  ')}\n` +
        `\nThe page will render "This page did not load" for every real visitor and\n` +
        `work perfectly in development, which is why nothing else catches it.\n` +
        `\nUse @/lib/public-config — it exposes one value, the origin — or add a server\n` +
        `route. A value that must not leave the server cannot be needed in a browser.`,
    ).toEqual([])
  })

  it('no "use client" module imports a server-only module', () => {
    const offenders: string[] = []

    for (const file of CLIENT_FILES) {
      const source = readFileSync(file, 'utf8')

      /*
       * `import type` is erased by the compiler and cannot reach the browser, so it
       * is not a violation.
       *
       * `RiderDrop.tsx` imports `DispatchRow` from `@/lib/dispatch/store.server` as
       * a type — a genuinely correct thing to do, and one a naive scan reports as a
       * bundler error. A test that cries wolf about the right pattern is a test
       * whose real findings get ignored, so the distinction is made here.
       */
      const runtimeImports = source.replace(/import\s+type\s+[^;]*?from\s+['"][^'"]+['"];?/g, '')

      // `.server.ts` is this codebase's marker for "server only".
      for (const match of runtimeImports.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = match[1]!
        if (spec.endsWith('.server') || spec.includes('.server.')) {
          offenders.push(`${relative(SRC, file)} → ${spec}`)
        }
      }
    }

    expect(
      offenders,
      `These client components import a server-only module:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('public-config exposes an origin and nothing else', () => {
    const source = readFileSync(join(SRC, 'lib', 'public-config.ts'), 'utf8')
    const exports = [...source.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)].map(
      (m) => m[1]!,
    )

    /*
     * One export, and the reason it stays one is in the file header: this is the
     * only module a browser may read, so every value added here is a value that has
     * decided to be public. Growing it is a decision that must be made on purpose.
     */
    expect(
      exports,
      `public-config.ts should export exactly one value — the origin.\n` +
        `Found: ${exports.join(', ')}\n` +
        `Everything added here ships to every visitor. If a client needs more, it\n` +
        `needs a server route.`,
    ).toEqual(['publicOrigin'])
  })

  it('public-config prefers the browser origin over a configured one', () => {
    const full = readFileSync(join(SRC, 'lib', 'public-config.ts'), 'utf8')

    /*
     * `/api/auth` is same-origin, so `window.location.origin` is the only value
     * that cannot be wrong. When this file preferred `NEXT_PUBLIC_SERVER_URL`
     * instead, a stale port in the environment meant every auth call went to a
     * port that was not listening: `sendOtp` never resolved and the button read
     * "Sending…" forever. No throw, no log, no failing test.
     *
     * So the order is load-bearing and asserted here — the browser check has to
     * come first in the CODE, not merely appear somewhere in the file. The header
     * doc comments name `NEXT_PUBLIC_SERVER_URL` before any code does, because that
     * is the whole story they are telling — so the scan starts at the initializer.
     */
    // Scan the initializer itself, past every doc comment in the file.
    const body = full.slice(full.indexOf('export const publicOrigin'))
    const windowIndex = body.indexOf("typeof window !== 'undefined'")
    const envIndex = body.indexOf('NEXT_PUBLIC_SERVER_URL')

    expect(windowIndex, 'public-config must check window.location.origin').toBeGreaterThan(-1)
    expect(
      envIndex,
      'public-config should still read NEXT_PUBLIC_SERVER_URL as a fallback',
    ).toBeGreaterThan(-1)
    expect(
      windowIndex,
      `public-config reads NEXT_PUBLIC_SERVER_URL before window.location.origin.\n` +
        `That makes a stale port in the environment silently hang every auth call.`,
    ).toBeLessThan(envIndex)
  })

  it('public-config reads only NEXT_PUBLIC_ variables', () => {
    const source = readFileSync(join(SRC, 'lib', 'public-config.ts'), 'utf8')
    const read = [...source.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]!)
    const notPublic = read.filter((name) => !name.startsWith('NEXT_PUBLIC_') && name !== 'PORT')

    expect(
      notPublic,
      `public-config.ts reads ${notPublic.join(', ')}, which is undefined in a browser.\n` +
        `Only NEXT_PUBLIC_* and PORT are legible on the client.`,
    ).toEqual([])
  })
})
