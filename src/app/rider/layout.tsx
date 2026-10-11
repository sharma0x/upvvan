import type { Metadata } from 'next'

import { currentRider } from '@/lib/dispatch/session.server'

/**
 * The rider surface.
 *
 * ── WHY NO MOBILE APP, AND WHAT THAT FORCES ────────────────────────────────
 * AGENTS.md is explicit: "No mobile app. Rider and customer surfaces are
 * responsive web / PWA." That is a commercial constraint as much as a technical
 * one — an app install is a support burden on a team that also has to answer
 * WhatsApp inside 15 minutes, and a rider whose phone cannot install the app
 * cannot work at all.
 *
 * So this is responsive web, and that means the layout has to work at 390px with
 * one thumb, in bright sun, possibly while holding a plant pot. Which is the
 * whole design brief:
 *
 *   · The next action is ONE big button at the bottom of the screen, in thumb
 *     reach. A rider's primary interaction with this app happens standing at a
 *     door with a phone in one hand.
 *   · 44px minimum touch targets. Not a guideline — a tap on a 32px target
 *     while holding a pot misfires, and the misfire here is "marked delivered"
 *     or "marked failed" on a drop that is neither.
 *   · The pay for every drop is visible up front. research/concept.md §4.1
 *     requires it and §4.4 forbids hiding the banding behind an internal
 *     formula. A rider who cannot see what a drop pays will not trust the run.
 *   · Zero client-side routing. Every action is a POST that re-renders
 *     server-side, because a client router losing a state transition is a
 *     dispatch that silently did not move.
 *
 * ── SEO: NOT INDEXED ───────────────────────────────────────────────────────
 * An internal surface on the storefront's origin. `noindex, nofollow` here rather
 * than only in robots.txt, because robots.txt keeps the page crawlable by URL —
 * which is the URL we least want published.
 */
export const metadata: Metadata = {
  title: 'Rider run',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const rider = await currentRider()

  return (
    <div className="bg-surface min-h-screen">
      <a
        href="#rider-main"
        className="focus:top-sm focus:left-sm focus:bg-primary focus:px-base focus:py-sm focus:text-surface-card sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-sm"
      >
        Skip to your run
      </a>

      <header className="border-border bg-surface-raised border-b">
        <div className="gap-sm px-base py-base mx-auto flex max-w-[640px] flex-wrap items-baseline justify-between">
          <p className="text-label-caps text-clay m-0">{rider ? rider.name : 'Upvvan rider'}</p>
          {rider ? (
            <form action="/api/rider/session" method="post">
              {/*
                A real <form> POST, not a button with onClick. Signing out has to
                work when hydration has not happened or the phone is on a bad
                connection — a rider locked out of their own run because a
                JavaScript bundle failed is not an acceptable failure mode for the
                one control that ends the shift.
              */}
              <input type="hidden" name="action" value="signout" />
              <button
                type="submit"
                className="border-border bg-surface-card px-base py-sm min-h-[44px] cursor-pointer rounded-sm border text-sm"
              >
                End shift
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <main id="rider-main" className="px-base py-xl pb-3xl mx-auto max-w-[640px]">
        {children}
      </main>
    </div>
  )
}
