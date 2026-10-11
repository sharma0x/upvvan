'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Profile editor — name and e-mail.
 *
 * ── WHY A CLIENT ISLAND AND NOT A SERVER ACTION ─────────────────────────────
 *
 * `updateUser` needs the raw incoming `Cookie` header, which a Server Action
 * body does not carry in the shape `auth.api.*` expects. The write goes through
 * `/api/account/profile` instead. See that route for the rest.
 *
 * ── WHY IT RELOADS RATHER THAN PATCHING LOCAL STATE ─────────────────────────
 *
 * The header greeting is rendered on the server from `user.name`. A local
 * `setState` would show "Good evening, Meera" in the form while the greeting
 * above it still said "Good evening" — two versions of the truth on one screen.
 * `router.refresh()` re-runs the layout, so the whole page agrees.
 */
export default function ProfileForm({
  initialName,
  initialEmail,
  phone,
}: {
  initialName: string
  initialEmail: string
  phone: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const FIELD = 'w-full rounded-sm border border-border bg-surface-raised px-3.5 py-3.5 text-base'

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Same-origin cookie must ride along, or the request is unauthenticated
        // and the customer is told to sign in while signed in.
        credentials: 'same-origin',
        body: JSON.stringify({ name, contactEmail: email }),
      })
      const body = (await res.json()) as { error?: string; adoptedOrders?: number }

      if (!res.ok) {
        setError(body.error ?? 'We could not save that just now.')
        return
      }

      setSaved(true)
      router.refresh()
    } catch {
      setError('We could not reach us. Nothing has been saved — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="gap-base flex max-w-[480px] flex-col">
      <div>
        <label htmlFor="profile-name" className="text-label-caps text-ink-muted block">
          Your name
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby="profile-name-help"
          className={`${FIELD} mt-xs`}
        />
        <p id="profile-name-help" className="text-ink-muted mt-xs mb-0 text-sm">
          Printed on your tax invoice and read aloud by the rider at the door.
        </p>
      </div>

      <div>
        <label htmlFor="profile-email" className="text-label-caps text-ink-muted block">
          Email for order updates
        </label>
        <input
          id="profile-email"
          name="contactEmail"
          type="email"
          autoComplete="email"
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby="profile-email-help"
          className={`${FIELD} mt-xs`}
        />
        <p id="profile-email-help" className="text-ink-muted mt-xs mb-0 text-sm">
          Optional, and not how we reach you. Your confirmation, delivery code and invoice go to the
          phone above — that is the number we can prove belongs to you. We keep this address on file
          so we can send you a copy of anything you ask for.
        </p>
      </div>

      {/*
        The phone is shown and NOT editable, deliberately.

        The mobile number IS the account (C-1). Changing it is not a profile edit;
        it is an identity change that needs an OTP on the NEW number to prove the
        person asking is the one who will receive every future delivery code. A
        text box here would either be a lie ("edit it here") or a second, weaker
        flow. Neither.
      */}
      <div>
        <span className="text-label-caps text-ink-muted block">Mobile number</span>
        <p className="border-border bg-surface-raised mt-xs rounded-sm border px-3.5 py-3.5">
          {phone}
        </p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          This is your account. We will never change it without an OTP on the new number.
        </p>
      </div>

      {error && (
        <p role="alert" className="border-danger text-danger rounded-sm border px-4 py-3">
          {error}
        </p>
      )}

      <div role="status" aria-live="polite">
        {saved && !error && <p className="text-success m-0">Saved. Your details are up to date.</p>}
      </div>

      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        data-testid="save-profile"
        className="bg-primary text-surface cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save details'}
      </button>
    </form>
  )
}
