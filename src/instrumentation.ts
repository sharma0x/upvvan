/**
 * Next.js instrumentation — runs once when the server process boots.
 *
 * Fails FAST here rather than at first request. A missing DATABASE_URL or a
 * placeholder production secret should stop the deploy on the developer's
 * machine, where it is cheap, not in front of a customer.
 *
 * `register()` must stay synchronous-safe: Next runs this in the Node runtime
 * before the server accepts connections.
 *
 * ── WHY NOTHING NODE-ONLY MAY BE REACHABLE FROM HERE ─────────────────────────
 *
 * Next does not compile this file for one runtime. `register()` "runs in all
 * environments", so `instrumentation.ts` is bundled TWICE — once for the Node
 * server and once for the Edge runtime — and the Edge compiler has no
 * `resolve.fallback` for Node builtins beyond `process`.
 *
 * That second bundle is invisible until it is fatal. This file used to end with:
 *
 *     const { sweepStaleQueuedEmails } = await import('./lib/email/send')
 *     void sweepStaleQueuedEmails()
 *
 * and `email/send` reaches `pg` and `nodemailer`, which `require` Node builtins:
 *
 *     ⨯ ./node_modules/.pnpm/pg@8.23.1/.../pg/lib/crypto/utils.js:1:1
 *     Module not found: Can't resolve 'crypto'
 *
 *     ⨯ ./node_modules/.pnpm/nodemailer@9.1.1/.../base64/index.js:3:21
 *     Module not found: Can't resolve 'stream'
 *
 *     Import trace for requested module:
 *     ./node_modules/.../nodemailer/lib/nodemailer.js
 *     ./src/lib/email/send.ts
 *     ./src/instrumentation.ts
 *
 * Every route then answered **500**, and the 500 body WAS the resolution error.
 *
 * ── AND IT WAS NOT A PRODUCTION BUILD FAILURE ────────────────────────────────
 *
 * Next drops the Edge instrumentation entry when it is the only Edge entry, so
 * this depended on whether something else gave the Edge compiler a reason to
 * exist. `src/proxy.ts` is that something: add it and `pnpm dev` dies, remove it
 * and `pnpm dev` serves 200. Same code, same lockfile.
 *
 * `pnpm build` passed throughout — as a *warning*, and Next prints the warning
 * block EMPTY (`result.warnings` is `[[], [], []]`, so "Compiled with warnings"
 * is printed unconditionally and the text is `'\n\n'`). A green production build
 * and a dead dev server is the exact shape of bug this repository keeps writing
 * headers about.
 *
 * So: only `@/lib/config` may be reachable from here, and it imports nothing.
 * `serverExternalPackages` does not rescue this — the Edge compiler's `externals`
 * array never calls `handleExternals`, so `pg` and `nodemailer` are bundled
 * there whatever the config says.
 *
 * The queued-email sweep that used to live here now runs from the Node-only email
 * module on this process's first send. See `ensureBootstrapped` in
 * `src/lib/email/send.ts`, and `instrumentation-boundary.test.ts`, which fails if
 * anything Node-only becomes reachable from this file again.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { assertConfigValid } = await import('./lib/config')
  assertConfigValid()
}
