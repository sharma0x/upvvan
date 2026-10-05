import type { Metadata } from 'next'

/**
 * The staff ops console.
 *
 * ── WHY THIS IS NOT Payload's /admin ────────────────────────────────────────
 *
 * Payload's admin panel is a CONTENT editor. It is the right tool for writing a
 * species description and the wrong tool for deciding which rider takes a 9km
 * drop, for two concrete reasons:
 *
 *   1. It has no notion of "now". Content is versioned and timeless; a dispatch
 *      board is a live question with a two-minute half-life. An operator running
 *      a shift does not want to filter a table of 4,000 historical orders to find
 *      the 6 that still need a rider.
 *
 *   2. Its access model is all-or-nothing over collections. The person who packs
 *      the orders should not be able to edit a plant's botanical name, and
 *      building a narrower permission inside Payload for a surface with two roles
 *      and two screens is more configuration than the thing is worth.
 *
 * So this is a separate, purpose-built surface with its own routes, its own
 * authorisation and its own vocabulary. It reads and writes the same database and
 * shares nothing with the content admin except the staff session.
 *
 * ── SEO: THIS ROUTE MUST NOT BE INDEXED ────────────────────────────────────
 * `robots: { index: false, follow: false }` on every ops and rider page. These are
 * internal surfaces on the same origin as the storefront; a crawler that finds
 * /admin-ops in a sitemap or a link would index an operations console, and the
 * alternative — excluding by robots.txt alone — means the page is still reachable
 * by URL, which is exactly the URL you do not want published.
 */

export const metadata: Metadata = {
  title: 'Ops console',
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      {/*
        A landmark and a skip link. The console is dense and keyboard-driven, and
        a screen-reader user tabbing through 60 table rows to reach the nav has to
        pass a hundred tab stops before they can skip it.
      */}
      <a
        href="#ops-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-sm focus:left-sm focus:z-50 focus:rounded-sm focus:bg-primary focus:px-base focus:py-sm focus:text-surface-card"
      >
        Skip to console
      </a>

      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-baseline gap-base px-base py-base">
          <p className="text-label-caps text-clay m-0">Upvvan operations</p>
          {/*
            `py-sm` on every nav link rather than padding the <nav>: the links are
            the targets, and padding the container leaves 17px-tall hit areas. A
            44px minimum is the reason this console is usable on a phone — an
            operator running a shift is often holding a phone one-handed.
          */}
          <nav aria-label="Ops sections" className="-my-sm flex flex-wrap gap-base">
            <a
              href="/admin-ops"
              className="flex min-h-[44px] items-center text-sm text-ink underline-offset-4 hover:underline"
            >
              Today
            </a>
            <a
              href="/admin-ops/queue"
              className="flex min-h-[44px] items-center text-sm text-ink underline-offset-4 hover:underline"
            >
              Queue
            </a>
            <a
              href="/admin-ops/board"
              className="flex min-h-[44px] items-center text-sm text-ink underline-offset-4 hover:underline"
            >
              Dispatch board
            </a>
          </nav>
          <a
            href="/rider"
            className="flex min-h-[44px] items-center text-sm text-ink-muted ml-auto underline-offset-4 hover:underline"
          >
            Rider view
          </a>
        </div>
      </header>

      <main id="ops-main" className="mx-auto max-w-[1120px] px-base py-xl">
        {children}
      </main>
    </div>
  )
}