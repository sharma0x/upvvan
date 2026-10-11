/**
 * The ONLY configuration a browser is allowed to see.
 *
 * ── WHY THIS FILE EXISTS AT ALL ──────────────────────────────────────────────
 *
 * `src/lib/config.ts` THROWS when it is evaluated in a production bundle, and it
 * throws at module load rather than at first use:
 *
 *     secret('PAYLOAD_SECRET')  →  no value  →  NODE_ENV === 'production'  →  throw
 *
 * That is correct and it is the behaviour the file is for: a missing secret should
 * stop a deploy on the developer's machine, not in front of a customer.
 *
 * It is also a landmine, because `process.env` in a CLIENT bundle is not the
 * server's environment. Next.js inlines only `NEXT_PUBLIC_*`; everything else
 * becomes `undefined` — including `PAYLOAD_SECRET`. So any `'use client'` module
 * that imports the server config evaluates that throw in the browser, and the
 * result is the error boundary:
 *
 *     ConfigError: PAYLOAD_SECRET is required in production.
 *     → "This page did not load."
 *
 * Which is exactly what happened to `/sign-in`, the ONE page every returning
 * customer must pass through, and to `SignOutButton`. It is invisible in
 * development — `NODE_ENV === 'development'` takes the dev fallback, the import
 * succeeds, the page works — and it is invisible to a curl, because the failure is
 * in the client bundle and the server-rendered HTML is correct.
 *
 * It was found by loading the page in a real browser against a production build.
 * Nothing else in this repository can see it: 404 unit tests, a passing journey, a
 * passing business simulation, a clean build and a green typecheck all pass with
 * the sign-in page completely unusable.
 *
 * ── WHAT IS ALLOWED IN HERE ─────────────────────────────────────────────────
 *
 * One value: the origin this app is served from. That is what `authClient` needs
 * to know where `/api/auth` lives.
 *
 * No secret, no database URL, no SMTP password, no compliance block. If a client
 * component ever needs one of those, the answer is that it needs a server route
 * instead — a value that cannot leave the server cannot be needed in the browser.
 *
 * `src/lib/accounts/__tests__` has a test that fails if a `'use client'` module
 * reaches `@/lib/config`, so this cannot regress by accident.
 */

/**
 * The origin this app is served from.
 *
 * ── WHY THE BROWSER'S OWN ORIGIN WINS ────────────────────────────────────────
 *
 * The first version preferred `NEXT_PUBLIC_SERVER_URL` and fell back to
 * `window.location.origin`. That is backwards, and it broke sign-in for anyone
 * whose port did not match the one baked into the environment.
 *
 * `/api/auth` is SAME-ORIGIN — one process serves the HTML and the API. So the
 * browser's own origin is not a fallback or a guess; it is the only value that
 * can be correct, and it is correct by construction no matter which port the app
 * actually came up on.
 *
 * Preferring the environment meant a stale port became a silent hang:
 *
 *     NEXT_PUBLIC_SERVER_URL=http://localhost:3100   # in .env
 *     $ PORT=3000 pnpm start                          # actual port
 *     → authClient posts to :3100, which is not listening
 *     → sendOtp never resolves, and the button reads "Sending…" forever
 *
 * Nothing throws, nothing logs, no test fails: the fetch simply never settles. And
 * the reason it is worth writing down is that the *previous* version of this file
 * had the same disease in the opposite direction — it hardcoded a port, which
 * breaks on any other one. The lesson is not "prefer the env var" or "prefer
 * window", it is that a value which cannot be verified at runtime must not be
 * trusted over one that can.
 *
 * `NEXT_PUBLIC_SERVER_URL` survives as the SERVER-side fallback, for the one case
 * where there is no `window`: rendering a client component on the server. No
 * better-auth client call happens there — they are all from the browser — so this
 * path only has to be plausible, not load-bearing.
 */
export const publicOrigin: string = (() => {
  // Correct by construction: this is where the HTML came from.
  if (typeof window !== 'undefined') return window.location.origin

  const configured = process.env.NEXT_PUBLIC_SERVER_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  return `http://localhost:${process.env.PORT ?? 3100}`
})()
