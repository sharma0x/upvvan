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
    <div className="bg-surface min-h-screen">
      {/*
        A landmark and a skip link. The console is dense and keyboard-driven, and
        a screen-reader user tabbing through 60 table rows to reach the nav has to
        pass a hundred tab stops before they can skip it.
      */}
      <a
        href="#ops-main"
        className="focus:top-sm focus:left-sm focus:bg-primary focus:px-base focus:py-sm focus:text-surface-card sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-sm"
      >
        Skip to console
      </a>

      <header className="border-border bg-surface-raised border-b">
        <div className="gap-base px-base py-base mx-auto flex max-w-[1120px] flex-wrap items-baseline">
          <p className="text-label-caps text-clay m-0">Upvvan operations</p>
          {/*
            `py-sm` on every nav link rather than padding the <nav>: the links are
            the targets, and padding the container leaves 17px-tall hit areas. A
            44px minimum is the reason this console is usable on a phone — an
            operator running a shift is often holding a phone one-handed.
          */}
          <nav aria-label="Ops sections" className="-my-sm gap-base flex flex-wrap">
            <a
              href="/admin-ops"
              className="text-ink flex min-h-[44px] items-center text-sm underline-offset-4 hover:underline"
            >
              Today
            </a>
            <a
              href="/admin-ops/queue"
              className="text-ink flex min-h-[44px] items-center text-sm underline-offset-4 hover:underline"
            >
              Queue
            </a>
            <a
              href="/admin-ops/board"
              className="text-ink flex min-h-[44px] items-center text-sm underline-offset-4 hover:underline"
            >
              Dispatch board
            </a>
            {/*
              Claims is a NAV ITEM rather than a link from the dashboard tile.

              The dashboard's "Claims open" number used to link to the dispatch
              board — a page that renders `dispatch.status` only and never reads
              `dispatch.orderStatus`. So the number was real and the destination
              could not answer it. A tile that links somewhere the question cannot
              be answered is worse than no tile: it teaches an operator that the
              number is not worth clicking.

              Claims needed a page where the decision can actually be made, so it
              needed to be somewhere an operator would look. See
              `/admin-ops/claims`.
            */}
            <a
              href="/admin-ops/claims"
              className="text-ink flex min-h-[44px] items-center text-sm underline-offset-4 hover:underline"
            >
              Claims
            </a>
          </nav>
          <a
            href="/rider"
            className="text-ink-muted ml-auto flex min-h-[44px] items-center text-sm underline-offset-4 hover:underline"
          >
            Rider view
          </a>
        </div>
      </header>

      <main id="ops-main" className="px-base py-xl mx-auto max-w-[1120px]">
        {children}
      </main>
    </div>
  )
}
