import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { auth } from '@/lib/auth'

/**
 * Server-side customer session access.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The account pages need to know "is this request a signed-in customer, and
 * which one?" before they render anything. Without a single helper, that
 * question gets answered differently in each page — and one of those answers is
 * always "trust the `customer_id` from the query string". So the one place that
 * resolves a session is named, and it is here.
 *
 * ── WHY `cache()` ───────────────────────────────────────────────────────────
 *
 * A page that renders the header, the order list and the address book would
 * otherwise validate the same session cookie three times — three signature
 * verifications and three DB round-trips per page view. `cache` collapses
 * identical calls within one render pass into one. It is request-scoped, so it
 * can never leak a session across users.
 */

/** The authenticated customer, or null. Never throws, never redirects. */
export const getSession = cache(async () => {
  /*
   * better-auth reads the raw `Cookie` header via `auth.api.getSession`. We
   * forward the incoming headers rather than reconstructing them, because
   * reconstructing them is how proxy headers get dropped and every session
   * mysteriously fails in production behind a load balancer.
   */
  const requestHeaders = await headers()

  return auth.api.getSession({
    headers: requestHeaders,
  })
})

export type CustomerSession = NonNullable<Awaited<ReturnType<typeof getSession>>>

/** The signed-in customer's id, or null. The ONLY way a customer_id enters this app. */
export const getCustomerId = cache(async (): Promise<string | null> => {
  const session = await getSession()
  return session?.user.id ?? null
})

/**
 * Require a signed-in customer, or redirect to sign-in.
 *
 * ── WHY REDIRECT INSTEAD OF A 401 ───────────────────────────────────────────
 *
 * Every caller of this is a PAGE, not a fetch. A 401 on a page renders a blank
 * error to someone who simply has not signed in yet; a redirect to /sign-in
 * renders the way to fix it. The API routes under /api/* use
 * `getCustomerId()` and return 401 instead, because a JSON body is the correct
 * answer to a fetch.
 *
 * `next` is preserved so a customer sent to sign-in lands back where they were
 * trying to go, rather than on a home page that discards their intent.
 */
export async function requireCustomer(next?: string): Promise<CustomerSession> {
  const session = await getSession()

  if (!session) {
    const target = next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'
    redirect(target)
  }

  return session
}
