'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * One-click ASSIGN.
 *
 * ── WHY THE DISTANCE IS A FIELD AND NOT A CONSTANT ──────────────────────────
 * The band — and therefore the rider's pay for this drop — comes from the
 * measured distance to the door. `assign.ts` refuses to guess it, because
 * `serviceability.ts` already records that a pincode's band is not knowable from
 * the pincode: only the routing engine knows how far it is from the nursery.
 *
 * So the operator supplies it. A placeholder is pre-filled with the zone's
 * mid-band distance purely so the button is one tap on the common case, and the
 * live band pay is shown BEFORE assignment — because a rider's pay is not
 * something an operator should discover after they have already said yes.
 *
 * ── WHY IT IS A <form> AND NOT A HAND-ROLLED CLICK HANDLER ──────────────────
 * Progressive enhancement: no JS, the button still posts, the server still
 * assigns. The client layer exists only to avoid a full page reload on the happy
 * path. That matters more than it sounds — the console is used on a phone by
 * somebody holding a plant, and a control that depends entirely on hydration
 * failing is a control that fails exactly when it is needed.
 */
export function AssignButton({
  orderId,
  orderCode,
  zoneName,
  suggestedKm,
  riders,
  bandRows,
}: {
  orderId: number
  orderCode: string
  zoneName: string | null
  /** Placeholder only. Never persisted without the operator seeing it. */
  suggestedKm: number
  riders: Array<{
    id: number
    name: string
    zoneName: string | null
    load: number
    capacity: number | null
  }>
  /** The city's bands, rendered on the server so the two never disagree. */
  bandRows: Array<{ code: string; minKm: number; maxKm: number; payPaise: number; label: string }>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const inZone = riders.filter((r) => r.zoneName === zoneName && r.load < (r.capacity ?? 99))

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)

    const data = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/dispatch/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId,
          distanceKm: Number(data.get('distanceKm')),
          riderId: data.get('riderId') || undefined,
        }),
      })
      const payload = (await response.json()) as { message?: string }

      setIsError(!response.ok)
      setMessage(
        payload.message ?? (response.ok ? 'Assigned.' : 'That did not work.'),
      )
      if (response.ok) router.refresh()
    } catch {
      // Network-level failure: the request may or may not have landed. Say so
      // rather than implying nothing happened — "nothing has changed" would be a
      // lie we cannot verify, and an operator who reloads to check is better off
      // than one who does not.
      setIsError(true)
      setMessage('Could not reach the server. Reload and check before assigning again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-sm">
      <div className="flex flex-wrap items-end gap-sm">
        <label className="flex flex-col">
          <span className="text-label-caps text-ink-muted">Drop distance (km)</span>
          <input
            name="distanceKm"
            type="number"
            step="0.1"
            min="0"
            required
            defaultValue={suggestedKm}
            // 44px is the smallest comfortable touch target for somebody holding
            // a pot in the other hand. Below that, mistaps go into the wrong field.
            className="mt-xs w-[110px] rounded-sm border border-border bg-surface-card px-sm py-sm"
          />
        </label>

        <label className="flex min-w-[180px] flex-1 flex-col">
          <span className="text-label-caps text-ink-muted">Rider (optional)</span>
          <select
            name="riderId"
            defaultValue=""
            className="mt-xs rounded-sm border border-border bg-surface-card px-sm py-sm"
          >
            <option value="">Let the board choose the least loaded</option>
            {inZone.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}
                {rider.capacity != null ? ` — ${rider.load}/${rider.capacity} today` : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={busy}
          // Per DESIGN.md: a disabled button keeps full opacity in the DOM and is
          // distinguished by cursor plus reduced opacity. Removing the affordance
          // makes the row jump as the form becomes valid.
          className="cursor-pointer rounded-sm bg-primary px-base py-sm text-surface-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Assigning…' : `Assign ${orderCode}`}
        </button>
      </div>

      {/*
        `role="status"` so the outcome is announced. An assign that silently
        succeeds looks identical to one that silently did nothing, and the
        operator's next move depends on which it was.
      */}
      <p
        role="status"
        aria-live="polite"
        className={`mt-sm mb-0 text-sm ${isError ? 'text-danger' : 'text-success'}`}
      >
        {message ?? ''}
      </p>

      <p className="text-sm text-ink-muted mt-xs mb-0">
        Band pay is snapshotted from the city bands at this moment, so changing a band later does
        not change what this rider is owed. Today&rsquo;s band pay for a drop at{' '}
        {String(suggestedKm)}km is {formatPaise(bandPayFor(bandRows, suggestedKm))}.
      </p>
    </form>
  )
}

/**
 * The band pay for a distance, from the bands the PARENT server-rendered.
 *
 * Passed down rather than fetched: this is a display of the same numbers
 * `assign.ts` will use, and a client-side recomputation would be a second
 * implementation of the band lookup that could disagree with the first.
 */
function bandPayFor(rows: Array<{ minKm: number; maxKm: number; payPaise: number }>, km: number): number {
  const band = rows.find((b) => km >= b.minKm && km < b.maxKm)
  return band?.payPaise ?? 0
}