'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * The pay button, as its own client component.
 *
 * ── WHY IT POSTS TWICE ──────────────────────────────────────────────────────
 *
 * `POST /api/payments/intent` then `POST /api/payments/capture`. Two calls
 * because they are two facts: an intent records that we ASKED, a capture records
 * that money MOVED. Collapsing them into one endpoint is what produced the
 * original bug — a single response that the UI read as "done" whether or not
 * anything was charged.
 *
 * ── WHY IT DOES NOT OPTIMISTICALLY RENDER SUCCESS ───────────────────────────
 *
 * There is no `setStep('done')` before the capture response says captured. The
 * button goes to a `processing` state, the request goes out, and only a 200 with
 * `paymentState === 'captured'` moves the page. An optimistic UI is the correct
 * choice for latency and the WRONG one here: the customer would be told their
 * plant is paid for before the gateway has answered, and a failure would then be
 * something they discover on the next page load.
 *
 * ── WHY THE DECLINE BUTTON IS HERE ──────────────────────────────────────────
 *
 * An error path that cannot be exercised is an error path that is broken. This
 * makes the decline reachable in one click. It sends `simulate: 'decline'`, which
 * only the simulated gateway honours — a real PSP decides the outcome, and this
 * button would be removed with it.
 */
export default function PayClient({
  orderCode,
  amountPaise,
  phone,
}: {
  orderCode: string
  amountPaise: number
  phone: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [declined, setDeclined] = useState(false)

  async function pay(simulate?: 'decline') {
    setBusy(true)
    setError('')
    setDeclined(false)
    try {
      const intentRes = await fetch('/api/payments/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, phone }),
      })
      const intent = await intentRes.json()
      if (!intentRes.ok) {
        setError(intent.message ?? 'Could not start the payment.')
        return
      }

      const capRes = await fetch('/api/payments/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: intent.intentId, orderCode, phone, simulate }),
      })
      const captured = await capRes.json()

      if (captured.paymentState === 'captured') {
        router.push(`/order/${orderCode}`)
        router.refresh()
        return
      }

      // 202: the gateway has not confirmed. Explicitly NOT success.
      if (capRes.status === 202) {
        setError(captured.message)
        return
      }

      setDeclined(true)
      setError(captured.message ?? 'The payment did not go through.')
    } catch {
      setError('Could not reach us. Nothing has been charged — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/*
        The total is rendered from `amountPaise`, a server-provided integer. The
        component never accepts a rupee figure from anywhere, and never multiplies
        one out — money crosses this boundary in paise and stays there.
      */}
      <p className="text-ink-muted">
        Amount due: <strong>{formatPaise(amountPaise)}</strong>
      </p>

      <button
        type="button"
        data-testid="pay-button"
        onClick={() => pay()}
        disabled={busy}
        className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Taking your payment…' : `Pay ${formatPaise(amountPaise)} · prepaid`}
      </button>

      <button
        type="button"
        data-testid="pay-decline-button"
        onClick={() => pay('decline')}
        disabled={busy}
        className="border-border text-ink-muted mt-sm w-full cursor-pointer rounded-sm border px-4 py-3 text-sm disabled:opacity-50"
      >
        Simulate a declined card (test)
      </button>

      {error && (
        <p role="alert" data-testid="pay-error" className="text-danger mt-base mb-0">
          {error}
        </p>
      )}

      {declined && (
        <p className="text-ink-muted mt-sm mb-0 text-sm">
          Your order is saved and your plant is still reserved. You can try again whenever you like
          — nothing was charged.
        </p>
      )}

      <p className="text-ink-muted mt-lg mb-0 text-sm">
        Prepaid only. There is no cash-on-delivery option: a COD return takes 25–30 days and the
        plant is unsellable by the time it comes back.
      </p>
    </div>
  )
}
