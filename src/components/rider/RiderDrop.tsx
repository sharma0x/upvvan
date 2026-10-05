'use client'

import { useState } from 'react'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { DispatchRow } from '@/lib/dispatch/store.server'

/**
 * One drop on the rider's run.
 *
 * ── WHY DELIVERY IS A CODE ENTRY AND NOT A BUTTON ──────────────────────────
 *
 * This is the most important 40 lines of rider UI in the project.
 *
 * "Order marked delivered but not received" is the complaint that produced
 * Urvann's 2.1/5, and their fix was to fine staff ₹100 for exactly this. A fine
 * is an admission that lying is cheaper than delivering — and for a rider closing
 * ten drops before dinner, it still is. So the honest path has to be the EASY
 * path instead.
 *
 * The easy path is: read the code off the customer's phone, type it, done. Four
 * digits, one field, no penalty, no fine, no escalation. What we have removed is
 * every reason to skip it.
 *
 * What we have NOT done is trusted anybody. The `DELIVERED` write is refused by
 * the database unless `delivery_otp_verified_at` is set, so this component is a
 * convenience over a control that holds without it. Two defences of the same
 * thing is the point: the UI makes it easy, the schema makes it true.
 *
 * The rider is not the adversary in this design. A rider asked to fake a delivery
 * is a rider whose employer made honesty expensive, and the fix for that is the
 * pay structure in `assign.ts` — not a threat on a screen.
 */
export function RiderDrop({ drop }: { drop: DispatchRow }) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? 'That did not work.')
    return payload
  }

  async function advance(to: string) {
    setBusy(true)
    setError(null)
    try {
      await post(`/api/rider/dispatch/${drop.id}/transition`, { to })
      // Full reload rather than router.refresh(): the run list re-sorts by band
      // after every transition, so this card may no longer belong where it is.
      // A refresh cannot leave a rider looking at a card that has moved.
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function closeDelivery() {
    setBusy(true)
    setError(null)
    try {
      await post(`/api/rider/dispatch/${drop.id}/deliver`, {
        code,
        claimEvidenceKind: 'unboxing_video_requested',
        claimEvidenceNote: 'Told the customer to film the unboxing, same day, uncut.',
      })
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const terminal = drop.status === 'DELIVERED' || drop.status === 'FAILED' || drop.status === 'CANCELLED'

  return (
    <article className="rounded-lg border border-border bg-surface-card p-base">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h3 className="mt-0 mb-0 font-body-md text-base font-normal">{drop.orderCode}</h3>
        <span
          className={`inline-block rounded-sm border border-border px-sm py-xs text-label-caps ${
            drop.status === 'DELIVERED'
              ? 'bg-success-soft text-success'
              : drop.status === 'FAILED'
                ? 'bg-surface-raised text-danger'
                : 'bg-brand-soft text-forest'
          }`}
        >
          {drop.status.replace(/_/g, ' ').toLowerCase()}
        </span>
      </div>

      <p className="text-ink-muted mt-sm mb-0 text-sm">
        {drop.pincode} · {drop.zoneName ?? 'No zone'}
      </p>

      {/*
        The pay line is not decoration. research/concept.md §4.1 requires per-drop
        pay to be visible upfront and §4.4 forbids hiding the banding behind an
        internal formula — so the band AND the resulting amount are both shown,
        and so is the per-rider multiplier when it is not 1.0×. A rider who
        cannot see what a drop pays stops trusting the run, and an untrusted run
        is where a "let me just tap this" shortcut comes from.
      */}
      <p className="mt-sm mb-0">
        <span className="text-ink-muted text-sm">Band {drop.bandCode} · </span>
        <span className="text-base">{formatPaise(drop.payoutPaise)}</span>
        {drop.payMultiplierBp !== 10_000 && (
          <span className="text-ink-muted text-sm">
            {' '}
            (band {formatPaise(drop.bandPayPaise)} × {drop.payMultiplierBp / 10_000})
          </span>
        )}
      </p>

      {terminal ? (
        <p className="text-ink-muted mt-base mb-0 text-sm">
          {drop.status === 'DELIVERED'
            ? `Delivered at ${drop.deliveredAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Closed on the customer's code.`
            : drop.failureReason ?? 'This drop is closed.'}
        </p>
      ) : drop.status === 'OUT_FOR_DELIVERY' ? (
        <div className="mt-base">
          {showCode ? (
            <>
              <label htmlFor={`code-${drop.id}`} className="block text-label-caps text-ink-muted">
                Code from the customer&rsquo;s phone
              </label>
              {/*
                `inputMode="numeric"` + `autoComplete="one-time-code"` so iOS
                offers the code straight from the SMS banner and Android offers
                autofill. It is the difference between typing six digits at a
                doorstep and one tap — and this screen is used at a doorstep.
              */}
              <input
                id={`code-${drop.id}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="mt-xs w-full rounded-sm border border-border bg-surface px-base py-sm text-center font-h2"
              />

              <p className="text-ink-muted mt-sm mb-0 text-sm">
                Ask the customer for the code in the SMS we sent them. Give it to me only when the
                plant is in your hands.
              </p>

              <button
                type="button"
                onClick={closeDelivery}
                disabled={busy || code.length !== 6}
                className="mt-base w-full cursor-pointer rounded-sm bg-primary px-base py-base text-surface-card disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Closing…' : 'Close delivery'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowCode(true)}
              className="w-full cursor-pointer rounded-sm bg-primary px-base py-base text-surface-card"
            >
              Ask for the customer&rsquo;s code
            </button>
          )}
        </div>
      ) : drop.status === 'PICKED_UP' ? (
        <button
          type="button"
          onClick={() => advance('OUT_FOR_DELIVERY')}
          disabled={busy}
          className="mt-base w-full cursor-pointer rounded-sm bg-primary px-base py-base text-surface-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Out for delivery'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => advance('PICKED_UP')}
          disabled={busy}
          className="mt-base w-full cursor-pointer rounded-sm bg-primary px-base py-base text-surface-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Picked up'}
        </button>
      )}

      {/*
        `role="alert"` rather than `status`: a refused code is the outcome the
        rider needs to react to immediately, and an alert interrupts. A success
        message here would be `status` — but success reloads the page, so there
        is nothing to announce.
      */}
      {error && (
        <p
          role="alert"
          className="mt-sm mb-0 rounded-sm border border-border bg-surface-raised p-sm text-sm text-danger"
        >
          {error}
        </p>
      )}
    </article>
  )
}