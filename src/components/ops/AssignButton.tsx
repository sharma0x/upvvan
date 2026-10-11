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
 *
 * ── WHICH IT WAS NOT, UNTIL NOW ──────────────────────────────────────────────
 *
 * That comment was aspirational. The `<form>` had no `action` and no `method`,
 * and `onSubmit` called `preventDefault()` before fetching. So with JavaScript
 * unavailable or a hydration error, submitting the form issued a GET to the
 * current URL, dropped both fields into the query string, and assigned nothing.
 *
 * The documented behaviour and the actual behaviour disagreed, which is the worst
 * of both: a reader checking the code would believe there was a fallback, and
 * there was not.
 *
 * `action` and `method="post"` are now real. `/api/dispatch/assign` accepts
 * form-encoded bodies as well as JSON — see its `readBody` — so the no-JS path
 * does the assignment for real. The consequence is that the form no longer
 * navigates away, so the client layer `router.refresh()`es on success; without JS
 * the browser POSTs, gets the JSON back as a page, and the operator reloads. That
 * is a worse experience than a redirect and a much better one than "nothing
 * happened, silently".
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

  /*
   * The distance the OPERATOR HAS TYPED, not the placeholder.
   *
   * The hint under the button used to read `bandPayFor(bandRows, suggestedKm)` —
   * the `defaultValue`. The moment somebody edited the distance, the line kept
   * quoting the old one. So the console told an operator "today's band pay for a
   * drop at 3km is ₹45" while the field said 9 and the rider was about to be paid
   * ₹75.
   *
   * That is the one number on this screen a rider will later be held to, and it
   * was displaying a value nobody had chosen.
   */
  const [km, setKm] = useState<number | ''>(suggestedKm)

  const inZone = riders.filter((r) => r.zoneName === zoneName && r.load < (r.capacity ?? 99))

  /*
   * "a distance in no band" rather than "₹0".
   *
   * The bands are 0–3, 3–7, 7–12. Type 15 and the previous code printed ₹0, which
   * reads as "this rider gets nothing" rather than "we do not know what this
   * pays" — and an operator who believes the first will send somebody out for
   * nothing.
   */
  const kmLabel = km === '' ? '—' : String(km)
  const pay = km === '' || !Number.isFinite(km) ? null : bandPayFor(bandRows, km)
  const bandHint =
    pay === null
      ? 'a distance we will need to be told about.'
      : pay === 0
        ? 'a distance outside every configured band, which the board will refuse.'
        : `${formatPaise(pay)}.`

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
      setMessage(payload.message ?? (response.ok ? 'Assigned.' : 'That did not work.'))
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
    <form action="/api/dispatch/assign" method="post" onSubmit={onSubmit} className="mt-sm">
      {/* Present for the no-JS path; ignored by the client, which sends JSON. */}
      <input type="hidden" name="orderCode" value={orderCode} />
      <div className="gap-sm flex flex-wrap items-end">
        <label className="flex flex-col">
          <span className="text-label-caps text-ink-muted">Drop distance (km)</span>
          <input
            name="distanceKm"
            type="number"
            step="0.1"
            min="0"
            required
            defaultValue={suggestedKm}
            onChange={(e) => setKm(e.target.value === '' ? '' : Number(e.target.value))}
            // 44px is the smallest comfortable touch target for somebody holding
            // a pot in the other hand. Below that, mistaps go into the wrong field.
            className="mt-xs border-border bg-surface-card px-sm py-sm w-[110px] rounded-sm border"
          />
        </label>

        <label className="flex min-w-[180px] flex-1 flex-col">
          <span className="text-label-caps text-ink-muted">Rider (optional)</span>
          <select
            name="riderId"
            defaultValue=""
            className="mt-xs border-border bg-surface-card px-sm py-sm rounded-sm border"
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
          className="bg-primary px-base py-sm text-surface-card cursor-pointer rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="text-ink-muted mt-xs mb-0 text-sm">
        Band pay is snapshotted from the city bands at this moment, so changing a band later does
        not change what this rider is owed. Today&rsquo;s band pay for a drop at {kmLabel}km is{' '}
        {bandHint}
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
function bandPayFor(
  rows: Array<{ minKm: number; maxKm: number; payPaise: number }>,
  km: number,
): number {
  const band = rows.find((b) => km >= b.minKm && km < b.maxKm)
  return band?.payPaise ?? 0
}
