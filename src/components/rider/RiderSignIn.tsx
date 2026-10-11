'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Rider sign-in.
 *
 * ── WHY A CODE AND NOT A PASSWORD ──────────────────────────────────────────
 * A rider is standing at a door holding a plant pot. A password is something you
 * have to remember and retype under pressure; a code that arrives by SMS is
 * something you read. It also means no shared credential rests in the app.
 *
 * ── WHY THE DEV CODE IS SHOWN AND NOT HIDDEN ───────────────────────────────
 * There is no SMS gateway wired yet — codes land in the `outbox` table
 * (`src/lib/dispatch/schema.sql`). The API returns the code in non-production
 * only, and this screen surfaces it only when it is present, so the flow is
 * actually testable instead of being a form that can never complete. The banner
 * disappears entirely when a provider is wired.
 */
export function RiderSignIn() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [challengeId, setChallengeId] = useState<number | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch('/api/rider/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as Record<string, unknown>
    if (!response.ok) throw new Error((payload.message as string) ?? 'That did not work.')
    return payload
  }

  async function onRequestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    try {
      const payload = await send({ action: 'request', phone: String(form.get('phone') ?? '') })
      setMessage((payload.message as string) ?? 'Check your phone.')
      if (payload.challengeId != null) setChallengeId(Number(payload.challengeId))
      if (payload.devCode) setDevCode(String(payload.devCode))
      setStep('code')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    try {
      await send({
        action: 'verify',
        challengeId,
        code: String(form.get('code') ?? ''),
      })
      router.replace('/rider')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[420px]">
      <h1 className="mt-0">Rider sign-in</h1>

      {step === 'phone' ? (
        <>
          <p className="text-ink-muted mt-0">
            Enter the number on the roster. We will text you a code to start your shift.
          </p>

          <form onSubmit={onRequestCode} className="mt-lg">
            <label htmlFor="phone" className="text-label-caps text-ink-muted block">
              Phone number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              placeholder="98450 00000"
              className="mt-xs border-border bg-surface-card px-base py-base w-full rounded-sm border text-base"
            />

            <button
              type="submit"
              disabled={busy}
              className="mt-lg bg-primary px-base py-base text-surface-card w-full cursor-pointer rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send my code'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-ink-muted mt-0">{message ?? 'Enter the code we texted you.'}</p>

          {devCode && (
            <p className="mt-base border-warning bg-surface-raised p-base rounded-md border text-sm">
              <strong className="text-warning">Development only.</strong> No SMS gateway is wired
              yet, so your code is <strong className="font-h2 text-base">{devCode}</strong>. This
              banner disappears when a provider is connected.
            </p>
          )}

          <form onSubmit={onVerify} className="mt-lg">
            <label htmlFor="code" className="text-label-caps text-ink-muted block">
              Your code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              className="mt-xs border-border bg-surface-card px-base py-base font-h2 w-full rounded-sm border text-center"
            />

            <button
              type="submit"
              disabled={busy}
              className="mt-lg bg-primary px-base py-base text-surface-card w-full cursor-pointer rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Start my shift'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setError(null)
                setDevCode(null)
              }}
              className="mt-sm border-border bg-surface-card px-base py-base w-full cursor-pointer rounded-sm border"
            >
              Use a different number
            </button>
          </form>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-base border-border bg-surface-raised p-sm text-danger rounded-sm border text-sm"
        >
          {error}
        </p>
      )}
    </div>
  )
}
