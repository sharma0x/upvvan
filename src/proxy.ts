import { NextResponse, type NextRequest } from 'next/server'

/**
 * Tags staff surfaces so the root layout can leave the storefront chrome off them.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * `src/app/layout.tsx` is the ROOT layout, so it wraps EVERY route — including
 * Payload's admin panel. That meant the storefront rendered inside the CMS:
 *
 *     Same-day delivery in Bengaluru before 2pm · Track your order
 *     Upvvan   Plants  Gifting  Corporate  About   [search]  Account  Cart · 0
 *     ────────────────────────────────────────────────────────────────────
 *     [ Payload's dark admin UI ]
 *
 * Two navigation systems, two colour schemes, and a "Cart · 0" link sitting above
 * a screen where the person is managing the shop. It reads as a broken page rather
 * than as two apps, and it pushes the CMS content down below the fold.
 *
 * ── WHY A HEADER AND NOT A ROUTE-GROUP MOVE ──────────────────────────────────
 *
 * The idiomatic Next fix is to put the storefront pages in a `(site)` route group
 * with its own layout, leaving the root layout as bare `<html>`. That is a large
 * mechanical move of ~35 page directories, done late, for a layout concern — and
 * the failure mode of a half-finished move is a site that 404s, which is a far
 * worse outcome than a header that renders where it should not.
 *
 * A request header is a two-line change with no route rearrangement, and it says
 * exactly the one thing the layout needs to know: is this a staff surface?
 *
 * ── WHY IT IS SAFE ──────────────────────────────────────────────────────────
 *
 * It ADDS a request header and returns `NextResponse.next()`. No rewrite, no
 * redirect, no body. It cannot change which handler runs, so it cannot break
 * Payload's routing, the auth routes or the checkout. If the header is somehow
 * absent, the fallback is today's behaviour — the chrome shows — rather than a
 * blank page.
 *
 * Written as `proxy.ts` rather than `middleware.ts`: Next 16 renamed the
 * convention and deprecated the old name.
 */
const STAFF_SURFACES = ['/admin', '/admin-ops', '/rider']

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  const isStaff = STAFF_SURFACES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  const headers = new Headers(request.headers)
  headers.set('x-upvvan-surface', isStaff ? 'staff' : 'storefront')

  return NextResponse.next({ request: { headers } })
}

export const config = {
  /*
   * Only these three prefixes run it.
   *
   * The proxy adds no behaviour for anything else, so letting it touch every
   * request would be pure cost on the storefront — the paths that matter for
   * latency — to compute a header nobody reads.
   */
  matcher: ['/admin/:path*', '/admin-ops/:path*', '/rider/:path*'],
}
