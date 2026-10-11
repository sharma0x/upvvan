'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Send a new delivery code" — the repair control for a stuck drop.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Three rider-facing errors said "ask the dispatcher to reissue it":
 *
 *     That delivery code has expired.
 *     Too many wrong codes on this drop (5).
 *     No delivery code was sent for this drop.
 *
 * `reissueOtp` was written, tested and had ZERO callers — no route, no button, no
 * admin screen. So all three told a rider at a doorstep to ask a dispatcher to do
 * something no dispatcher could do.
 *
 * The five-attempt cap is what makes this more than an inconvenience: it is
 * permanent. A customer who cannot read the SMS, or who fat-fingers the code five
 * times, leaves a parcel that cannot be closed by anyone through any interface.
 * The database refuses to set DELIVERED without a verified code, which is the
 * control working exactly as designed — with no escape hatch for the human it
 * strands.
 *
 * ── WHY IT IS NOT A PLAIN LINK ───────────────────────────────────────────────
 *
 * Because it does three things at once, and one of them can fail: it mints a new
 * code, it resets the attempt counter, and it sends the code to the customer. The
 * route AWAITS the send and returns 502 if the mail did not go, precisely so this
 * button can say "we have not changed anything" rather than leaving an operator
 * believing a code is on its way when the customer's working code has just been
 * invalidated.
 */
export function ReissueCodeButton({
  dispatchId,
  orderCode,
}: {
  dispatchId: number
  orderCode: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function reissue() {
    setBusy(true)
    setMessage(null)
    setIsError(false)
    try {
      const res = await fetch(`/api/dispatch/${dispatchId}/reissue`, { method: 'POST' })
      const body = (await res.json()) as { message?: string }
      setIsError(!res.ok)
      setMessage(body.message ?? (res.ok ? 'A new code is on its way.' : 'That did not work.'))
      if (res.ok) router.refresh()
    } catch {
      setIsError(true)
      setMessage('Could not reach the server. Nothing has changed — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-border mt-base p-sm rounded-sm border">
      <button
        type="button"
        onClick={reissue}
        disabled={busy}
        data-testid={`reissue-${orderCode}`}
        className="border-border min-h-[44px] cursor-pointer rounded-sm border px-4 text-sm disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send a new delivery code'}
      </button>
      <p className="text-ink-muted mt-xs mb-0 text-xs">
        Invalidates the old code, clears the attempt counter, and messages the customer. Use this
        when a rider reports an expired code, or a customer has run out of tries.
      </p>
      {message && (
        <p
          role="status"
          className={`mt-xs mb-0 text-sm ${isError ? 'text-danger' : 'text-success'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
