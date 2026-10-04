import type { ReactNode } from 'react'

import './globals.css'

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
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
