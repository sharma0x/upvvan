import { describe, it, expect } from 'vitest'
import { builtinModules } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Nothing Node-only may be reachable from `src/instrumentation.ts`.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * `instrumentation.ts` ended with:
 *
 *     const { sweepStaleQueuedEmails } = await import('./lib/email/send')
 *     void sweepStaleQueuedEmails()
 *
 * Next does not compile `instrumentation.ts` for one runtime. `register()` "runs
 * in all environments", so the file is bundled for the Edge runtime too, and the
 * Edge compiler has no `resolve.fallback` for Node builtins beyond `process`.
 * `email/send` reaches `pg` and `nodemailer`, which require them:
 *
 *     Module not found: Can't resolve 'crypto'
 *     Module not found: Can't resolve 'net'
 *     Module not found: Can't resolve 'tls'
 *     Module not found: Can't resolve 'util/types'
 *     Module not found: Can't resolve 'stream'
 *
 * Every route then answered 500, and the 500 body was the resolution error.
 *
 * ── WHY NONE OF THE EXISTING CHECKS CAUGHT IT ────────────────────────────────
 *
 * `pnpm build` passed. As a *warning*, and Next prints the warning block EMPTY:
 * `result.warnings` is `[[], [], []]`, so `length > 0` is always true and the
 * joined text is `'\n\n'`. The build said "Compiled with warnings" and showed
 * nothing, which reads as a build that is fine.
 *
 * Worse, the failure was CONDITIONAL. Next drops the Edge instrumentation entry
 * when it is the only Edge entry, so whether dev died depended on whether
 * something else had given the Edge compiler a reason to exist. `src/proxy.ts`
 * is that something: with it, every route 500s; without it, dev serves 200.
 *
 * `serverExternalPackages` cannot rescue this, which is why the fix had to be
 * structural rather than configuration. In `next/dist/build/webpack-config.js`
 * the client and Edge compilers get a fixed `externals` array; only the Node
 * compiler gets `builtinModules` plus `handleExternals`. A package listed in
 * `serverExternalPackages` is therefore still BUNDLED for Edge, builtins and all.
 *
 * ── WHY A STATIC SCAN ────────────────────────────────────────────────────────
 *
 * The alternative is a webpack plugin walking the real graph, which this is not.
 * Named here rather than hidden: a Node-only package reached from instrumentation
 * THROUGH another first-party module that this scan resolves would still be
 * caught, because the walk follows relative and `@/` specifiers transitively —
 * but a package reached through a barrel that resolves outside `src/`, or through
 * a computed specifier webpack cannot see either, is not. The scan is a guard
 * rail, not a proof.
 */
// `__dirname` here is `src/lib/email/__tests__`, so three levels up is `src`.
const SRC = resolve(__dirname, '..', '..', '..')
const ENTRY = join(SRC, 'instrumentation.ts')

/** Node's builtin modules, with and without the `node:` prefix. */
const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  ...builtinModules.map((m) => `node:${m.replace(/^node:/, '')}`),
])

/*
 * Node-only packages this repository actually depends on, named explicitly so a
 * failure message can say which dependency is at fault rather than "a package".
 *
 * `pg` and `nodemailer` are the two that broke the build, and both are reached
 * the same way — transitively through `src/lib/email/send` — so neither shows up
 * as a bare specifier in `instrumentation.ts` itself.
 */
const NODE_ONLY_PACKAGES = new Set(['pg', 'pg-native', 'nodemailer', 'sharp'])

/** An import this scan reached but will not follow: a package, or a builtin. */
type Reached = { readonly spec: string; readonly from: string }

const EXTENSION_CANDIDATES = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']

function resolveLocal(spec: string, fromFile: string): string | null {
  if (!spec.startsWith('@/') && !spec.startsWith('./') && !spec.startsWith('../')) return null

  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : resolve(dirname(fromFile), spec)

  for (const suffix of EXTENSION_CANDIDATES) {
    const candidate = `${base}${suffix}`
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Every import specifier in a module, minus the ones TypeScript erases. */
function specifiersIn(source: string): string[] {
  /*
   * Comments are stripped FIRST, and not as a nicety.
   *
   * The prose in this repository quotes strings — `from "we rejected your claim"`
   * appears in a doc comment in `email/send.ts` — and a naive scan reports those
   * as imports of packages that do not exist. A guard rail that cries wolf about
   * English is a guard rail whose real findings get ignored, so the same care
   * `client-boundary.test.ts` takes with `import type` is taken here.
   */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/import\s+type\s+[^;]*?from\s+['"][^'"]+['"];?/g, '')

  const found = [...code.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1]!,
  )
  return [...new Set(found)]
}

/** Walk the first-party graph from the entry, collecting what it reaches. */
function walk(): { external: Reached[]; visited: string[] } {
  const external: Reached[] = []
  const visited: string[] = []
  const queue = [ENTRY]

  while (queue.length > 0) {
    const file = queue.shift()!
    if (visited.includes(file)) continue
    visited.push(file)

    for (const spec of specifiersIn(readFileSync(file, 'utf8'))) {
      const local = resolveLocal(spec, file)
      if (local) {
        queue.push(local)
        continue
      }
      if (spec.startsWith('node:') || BUILTINS.has(spec)) {
        external.push({ spec, from: relative(SRC, file) })
        continue
      }
      // Bare or absolute: a package, or a path outside `src/`. Not followed.
      external.push({ spec, from: relative(SRC, file) })
    }
  }

  return { external, visited }
}

const { external, visited } = walk()

describe('the instrumentation runtime boundary', () => {
  it('resolves the entry and actually walks a graph', () => {
    /*
     * A scan that matches nothing is a green test that cannot fail, which is the
     * state this repository's own rule exists to prevent. The entry must exist,
     * and the walk must have followed at least the dynamic import it contains.
     */
    expect(existsSync(ENTRY), 'src/instrumentation.ts must exist').toBe(true)
    expect(
      visited.length,
      'The walk followed no first-party module. The scan is not looking at anything.',
    ).toBeGreaterThan(1)
    expect(
      visited.some((f) => f.endsWith(join('lib', 'config.ts'))),
      'Expected instrumentation.ts to reach src/lib/config. If the scan cannot see it, ' +
        'the resolver is broken and every other assertion here is vacuous.',
    ).toBe(true)
  })

  it('classifies specifiers the way the assertions below assume', () => {
    /*
     * The falsifiability check for the scan itself. Each of these is a claim the
     * scan's two rules rest on, so if the rules ever change this has to fail with
     * them rather than quietly agreeing.
     */
    const from = ENTRY
    expect(resolveLocal('@/lib/config', from)).toBe(join(SRC, 'lib', 'config.ts'))
    expect(resolveLocal('./lib/config', from)).toBe(join(SRC, 'lib', 'config.ts'))
    expect(resolveLocal('@/lib/db/pool', from)).toBe(join(SRC, 'lib', 'db', 'pool.ts'))
    expect(resolveLocal('pg', from), 'a bare specifier must not resolve to a file').toBeNull()
    expect(BUILTINS.has('crypto')).toBe(true)
    expect(BUILTINS.has('node:crypto')).toBe(true)
    expect(BUILTINS.has('net')).toBe(true)
    expect(BUILTINS.has('tls')).toBe(true)
    expect(BUILTINS.has('util/types')).toBe(true)
    expect(NODE_ONLY_PACKAGES.has('pg')).toBe(true)
    expect(NODE_ONLY_PACKAGES.has('nodemailer')).toBe(true)
  })

  it('reaches no Node builtin', () => {
    const offenders = external
      .filter(({ spec }) => BUILTINS.has(spec))
      .map(({ spec, from }) => `${from} → ${spec}`)

    expect(
      offenders,
      `src/instrumentation.ts reaches Node builtins:\n  ${offenders.join('\n  ')}\n` +
        `\nNext bundles instrumentation.ts for the Edge runtime too, and the Edge\n` +
        `compiler has no fallback for these beyond \`process\`. This is a 500 on every\n` +
        `route in dev, and an invisible warning in \`pnpm build\`.`,
    ).toEqual([])
  })

  it('reaches no Node-only package', () => {
    const offenders = external
      .filter(({ spec }) => NODE_ONLY_PACKAGES.has(spec))
      .map(({ spec, from }) => `${from} → ${spec}`)

    expect(
      offenders,
      `src/instrumentation.ts reaches Node-only packages:\n  ${offenders.join('\n  ')}\n` +
        `\nA listed \`serverExternalPackages\` entry does NOT help: the Edge compiler's\n` +
        `externals array never calls handleExternals, so these are bundled there with\n` +
        `their \`require('crypto')\` and friends intact.\n` +
        `\nBoot work that needs the database or SMTP has to be triggered from a\n` +
        `Node-only module instead — see ensureBootstrapped in src/lib/email/send.ts.`,
    ).toEqual([])
  })

  it('reaches no package at all, and that empty list is pinned', () => {
    /*
     * The inventory, asserted rather than assumed.
     *
     * A denylist only catches what somebody thought to put in it, and this file
     * was written by the person who just watched `pg` and `nodemailer` take a dev
     * server down — not a good place to rely on having thought of everything. So
     * the rule is the strict one: NOTHING from `node_modules` may be reachable
     * from `instrumentation.ts`.
     *
     * That costs nothing today, because the entire reachable graph is `config.ts`
     * and `config.ts` imports nothing at all. If a future observability SDK
     * genuinely belongs at boot, this should be a conscious edit to an empty list
     * rather than an addition to a list of known-bad names.
     */
    const packages = external
      .filter(({ spec }) => !spec.startsWith('@/') && !spec.startsWith('.'))
      .map(({ spec, from }) => `${from} → ${spec}`)

    expect(
      packages,
      `src/instrumentation.ts reaches packages:\n  ${packages.join('\n  ')}\n` +
        `\nEvery one of them is bundled into an Edge-runtime chunk that has no Node\n` +
        `builtins available. If this list needs to change, verify the package resolves\n` +
        `under the Edge compiler first, and record the reason here.`,
    ).toEqual([])
  })
})
