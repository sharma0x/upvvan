'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { authClient } from '@/lib/auth/client'

/**
 * Sign out.
 *
 * ── WHY THIS IS A BUTTON AND NOT A LINK ─────────────────────────────────────
 *
 * Signing out is a STATE CHANGE, not a navigation. A link would GET the sign-out
 * endpoint — which is exactly the shape that lets a third-party page sign a
 * customer out with an `<img src>`, and turns "log me out" into a thing that can
 * be triggered by anything that can make the browser issue a request.
 *
 * better-auth's `signOut` is a POST for the same reason.
 */
export default function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    try {
      await authClient.signOut()
      /*
       * `push` then `refresh`, not `refresh` alone. The account LAYOUT calls
       * `requireCustomer()`, which runs on the server — a refresh re-runs it and
       * redirects, but only after the client has already rendered the signed-in
       * shell, which flashes the customer's name on screen as they log out.
       */
      router.push('/')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="text-ink-muted ml-auto cursor-pointer bg-transparent text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}