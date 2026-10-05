import type { ReactNode } from 'react'
import Link from 'next/link'

import { requireCustomer } from '@/lib/auth/session'
import SignOutButton from '@/components/auth/SignOutButton'

/**
 * Account shell — the authenticated customer's own area.
 *
 * ── WHY THE AUTH CHECK LIVES HERE ───────────────────────────────────────────
 *
 * In the LAYOUT, not in each page. A layout check is the only placement where
 * "every account page requires a session" is true by construction rather than by
 * remembering: a page added under `/account` tomorrow is protected the moment it
 * exists, and cannot be shipped unprotected by being forgotten.
 *
 * `requireCustomer()` calls `redirect()`, which throws. That is why this is a
 * layout and not a wrapper component — the redirect has to happen before any
 * page renders.
 */
export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await requireCustomer('/account')

  return (
    <div className="px-base py-2xl mx-auto max-w-[880px]">
      <p className="text-label-caps text-ink-muted mb-0">Your account</p>
      <h1 className="mt-0 mb-xs">
        {/* better-auth has no name for a phone-only customer yet, so this is the
            number they signed in with — which is also what they will recognise. */}
        {session.user.phoneNumber}
      </h1>

      <nav className="border-border mb-xl flex gap-base border-b pb-3">
        <Link href="/account" className="text-primary text-sm no-underline">
          Orders
        </Link>
        <Link href="/account/addresses" className="text-ink-muted text-sm no-underline hover:text-ink">
          Addresses
        </Link>
        {/* better-auth's sign-out clears the httpOnly cookie; `router.refresh()`
            is what makes the header re-render as signed-out. */}
        <SignOutButton />
      </nav>

      {children}
    </div>
  )
}