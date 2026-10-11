'use client'

import Link from 'next/link'

/**
 * Route-level error boundary.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * There was no `error.tsx` anywhere in the app, so a thrown error inside any
 * route rendered Next's bare production error page: a stack-trace-shaped slab
 * with no route back into the catalogue, no brand, and no way for a customer to
 * recover. For a storefront that is the worst possible failure surface — the
 * customer has already decided to buy, and we answer with a dead end.
 *
 * ── WHY THIS FILE IMPORTS NOTHING FROM config.ts ─────────────────────────────
 * This is the mistake that cost an afternoon, so it is written down.
 *
 * `error.tsx` MUST be a client component — that is what lets it receive `reset`.
 * But `src/lib/config.ts` calls `secret('PAYLOAD_SECRET')` at MODULE LOAD, which
 * THROWS in a browser (there is no `PAYLOAD_SECRET` in the client bundle, and it
 * must never be there). Importing config from a `'use client'` file therefore
 * throws during hydration of the error boundary itself:
 *
 *   ConfigError: PAYLOAD_SECRET is required in production
 *
 * The symptom is genuinely nasty and misdirecting. Server-rendered HTML is
 * PERFECT — `curl` shows the full correct page, titles, images and all — because
 * the failure is client-only. The moment a browser executes any JavaScript the
 * boundary's module graph throws and every page is replaced by "This page
 * couldn't load". A headless browser sees a totally broken site; curl sees a
 * totally healthy one.
 *
 * It also fails safe in the worst possible way: an error boundary that cannot
 * load has no way to render an error, so the raw framework fallback appears with
 * no way back into the site.
 *
 * The rule this establishes: **a `'use client'` module may not import
 * `config.ts`.** Server-only config reaches the client only through props.
 *
 * ── WHY THE MESSAGE IS GENERIC ───────────────────────────────────────────────
 * `error.tsx` receives the real error and `reset()`. It must NOT render
 * `error.message`. `src/app/api/orders/route.ts` already implements the
 * allowlist pattern for business-rule violations, and `AGENTS.md` records that an
 * `err.message` leak once reached a customer verbatim ("relation order_items
 * does not exist"). The same discipline applies here: the customer gets our
 * contact details and a retry, and the detail goes to the console where an
 * operator can read it.
 *
 * `global-error.tsx` handles failures in the ROOT layout itself, where this
 * boundary cannot render — see that file.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Operator-visible. Never shown to the customer.
  console.error('[route-error]', error)

  return (
    <main className="px-base py-3xl mx-auto flex min-h-[60vh] max-w-[640px] flex-col justify-center">
      <p className="text-label-caps text-clay m-0">Something broke on our side</p>

      <h1 className="mt-sm mb-0">This page did not load.</h1>

      <p className="text-ink-muted mt-base mb-0 max-w-[52ch]">
        That is our fault, not yours. Nothing has been charged and nothing has been ordered. Try
        again, and if it keeps happening use the contact details in the footer.
      </p>

      {/*
        The digest is Next's build-time identifier for this specific error. It is
        safe to show and it is the single most useful thing a customer can read
        back to us — it maps to the server log line.
      */}
      {error.digest && (
        <p className="text-ink-muted mt-sm mb-0 text-sm">
          Reference for support: <code className="text-ink">{error.digest}</code>
        </p>
      )}

      <div className="mt-lg gap-sm flex flex-wrap">
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-surface cursor-pointer rounded-sm px-6 py-4 font-semibold"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border-border text-ink rounded-sm border px-6 py-4 font-semibold no-underline"
        >
          Back to the shop
        </Link>
      </div>
    </main>
  )
}
