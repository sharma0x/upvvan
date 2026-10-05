import type { ReactNode } from 'react'

import './globals.css'

import { metadata } from '@/app/metadata'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

/**
 * The ROOT layout — required by the App Router, and the only place a global
 * stylesheet may be imported.
 *
 * This was a real bug worth recording: `globals.css` was initially imported
 * only inside the `(payload)` route group, so the storefront rendered with no
 * styles at all while looking fine in the DOM assertions. A route group is not a
 * layout — it only groups URLs — so it cannot supply the root document.
 *
 * Caught by looking at a screenshot, not by a test. Typecheck, unit tests, the
 * production build and the API click-through all passed while the page was
 * visibly unstyled, which is the clearest argument yet for actually viewing the
 * thing you built.
 *
 * `metadata` is re-exported here because Next only reads metadata from a
 * `layout.tsx` or `page.tsx` module — a standalone `src/app/metadata.ts` is never
 * picked up on its own. The definition lives in its own file so the per-page
 * `pageMetadata()` helper can be imported by routes without every route having
 * to import the layout (which would be a cycle).
 */
export { metadata }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          Skip link. Without it, every keyboard user tabs through the entire
          header — logo, four nav items — on EVERY page before reaching content,
          and `<main>` had no id to jump to. `sr-only` hides it visually but
          keeps it in the tab order; `focus` brings it back. That pattern is the
          whole implementation and it is why it uses a pseudo-class rather than
          being hidden with `display:none`, which would remove it from the tab
          order entirely.
        */}
        <a
          href="#main"
          className="bg-primary text-surface sr-only rounded-sm px-base py-3 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100"
        >
          Skip to content
        </a>

        {/*
          The header is a CLIENT component (it reads the sessionStorage draft cart
          for the badge). Rendering it in the root layout rather than per-page is
          deliberate: it is the one piece of chrome that must exist on every
          route, and putting it in each page is how the cart link ended up missing
          from the storefront entirely in the first place.
        */}
        <SiteHeader />
        {children}
        {/* Mandatory E-Commerce Rules 2020 r.4(2)/r.4(4) disclosures. */}
        <SiteFooter />
      </body>
    </html>
  )
}
