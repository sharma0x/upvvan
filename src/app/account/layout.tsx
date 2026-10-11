import type { ReactNode } from 'react'
import Link from 'next/link'

import { requireCustomer } from '@/lib/auth/session'
import { greetingFor, loadProfile } from '@/lib/accounts/profile'
import SignOutButton from '@/components/auth/SignOutButton'
import { FORM } from '@/components/layout/containers'

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
 *
 * ── WHAT THE HEADER IS, AND WHY IT USED TO BE WRONG ──────────────────────────
 *
 * It used to render exactly this:
 *
 *     <p className="text-label-caps">Your account</p>
 *     <h1>{session.user.phoneNumber}</h1>
 *
 * under a comment explaining that "better-auth has no name for a phone-only
 * customer yet". The comment was true about the COLUMN and wrong about the
 * LIBRARY: `user.name` has always been writable through `updateUser`. It had
 * simply never been written, so every customer in the country greeted a stranger
 * with a phone number, the page had no e-mail to show, and there was no control
 * anywhere to set either.
 *
 * What replaced it is the ordinary shape of a signed-in account anywhere on the
 * web — and deliberately the same shape Pinterest's own API describes for
 * `/v1/me/`: a display name, a stable handle, a join date, and counts of the
 * things a person has done. Translated to this business rather than copied:
 *
 *   · `first_name` / `last_name` → one `name`, because an Indian customer is not
 *     going to fill in a Western first/last split.
 *   · `username`                → the verified phone number. It is already the
 *     unique, immutable handle for this person and it is what a rider dials.
 *   · `image`                   → NOT rendered. There is no avatar upload and no
 *     gravatar, so this project shows a monogram derived from the name rather
 *     than an empty image frame that reads as a broken upload.
 *   · `created_at`              → "with us since …", which is the one line of
 *     social proof a new customer can actually check.
 *   · `counts`                  → on the page itself, not here. See
 *     `src/app/account/page.tsx`.
 *   · `boards()` / `pins()`     → the nav below. Orders, addresses and saved
 *     plants are this store's equivalent of boards and pins: the things a
 *     customer organises and comes back to.
 */
export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await requireCustomer('/account')
  const profile = await loadProfile()
  const greeting = profile ? greetingFor(profile) : null

  /*
   * The tabs.
   *
   * `aria-current` marks the active one, which is what a screen-reader user
   * navigates by when they land on `/account/addresses` without knowing where
   * they are. The previous version marked nothing, so every tab read identically
   * and the only cue that you had moved was the page title changing underneath
   * you.
   *
   * `Saved` is deliberately present even though it can be empty. A dashboard
   * that hides a section until it has content is a dashboard where a customer's
   * first visit shows three links and no explanation of what the fourth is for.
   */
  const tabs = [
    { href: '/account', label: 'Orders' },
    { href: '/account/addresses', label: 'Addresses' },
    { href: '/account/saved', label: 'Saved plants' },
    { href: '/account/profile', label: 'Profile' },
  ] as const

  /*
   * A monogram, not an avatar.
   *
   * Two initials from the name, or nothing at all when we have no name yet — in
   * which case the block is omitted entirely rather than rendered as an empty
   * circle, which on a page about "your profile" reads as a failed upload.
   */
  const monogram = profile?.name
    ? profile.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : ''

  return (
    <div className={`py-2xl ${FORM}`}>
      <header className="gap-base flex items-start">
        {monogram && (
          <span
            aria-hidden="true"
            data-testid="account-monogram"
            className="bg-brand-soft text-forest border-border font-h2 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-lg"
          >
            {monogram}
          </span>
        )}

        <div className="min-w-0">
          <p className="text-label-caps text-ink-muted mb-0">Your account</p>
          <h1 className="mt-0 mb-0" data-testid="account-greeting">
            {/*
              A salutation, not an identifier. When we have a name this reads
              "Good evening, Meera"; when we do not it reads "Good evening" and
              the page asks for a name in the profile tab rather than printing a
              phone number as though it were one.
            */}
            {greeting?.text ?? 'Welcome back'}
          </h1>

          <p className="text-ink-muted mt-xs mb-0 text-sm">
            {profile?.name && <span className="text-ink block">{profile.name}</span>}
            {profile?.phone && (
              <span data-testid="account-handle">
                {profile.phone}
                {' · '}
              </span>
            )}
            <span data-testid="account-member-since">
              with us since{' '}
              {new Intl.DateTimeFormat('en-IN', {
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Kolkata',
              }).format(session.user.createdAt ?? new Date())}
            </span>
          </p>
        </div>
      </header>

      <nav
        aria-label="Your account"
        className="border-border mb-xl gap-base flex flex-wrap items-center border-b pb-3"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === '/account' ? 'page' : undefined}
            className={`text-sm no-underline ${
              tab.href === '/account'
                ? 'text-primary font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        ))}
        {/* better-auth's sign-out clears the httpOnly cookie; `router.refresh()`
            is what makes the header re-render as signed-out. */}
        <SignOutButton />
      </nav>

      {children}
    </div>
  )
}
