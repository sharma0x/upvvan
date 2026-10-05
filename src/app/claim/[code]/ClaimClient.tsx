'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The claim form.
 *
 * The item picker is per-LINE and not per-order, because a claim that does not say
 * which plant died becomes a support conversation: ops has to work out which plant
 * to replace, and that step is what turns a 48-hour guarantee into a ticket. One line
 * per plant, named, and the customer picks the one that is wrong.
 */
export default function ClaimClient({
  orderCode,
  phone,
  delivered,
  items,
}: {
  orderCode: string
  phone: string
  delivered: boolean
  items: Array<{ id: string; label: string; refundable: boolean }>
}) {
  const router = useRouter()
  const [kind, setKind] = useState('DAMAGED')
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!delivered) {
    return (
      <section
        role="alert"
        data-testid="claim-not-delivered"
        className="border-warning bg-surface-raised p-base rounded-md border"
      >
        <p className="m-0 font-semibold">This order has not been delivered yet</p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          We can only take a claim once the plant has arrived — a claim on an order in transit is not
          a damage report. If your tracking says delivered and this does not, tell us and we will
          sort it out.
        </p>
      </section>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, phone, kind, orderItemId: itemId, description, evidenceUrl }),
      })
      const body = await res.json()

      if (!res.ok) {
        setError(body.message ?? 'We could not record your claim.')
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('Could not reach us. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section role="status" data-testid="claim-submitted" className="border-success bg-success-soft p-base rounded-md border">
        <p className="m-0 font-semibold">Claim received</p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">{''}</p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          We are looking at what arrived. If a plant is damaged or dead we send a replacement and you
          keep nothing to return — there is nothing more for you to do.
        </p>
        <p className="mt-base mb-0">
          <a href={`/order/${orderCode}`} className="text-primary underline">
            Back to your order
          </a>
        </p>
      </section>
    )
  }

  const inputClass = 'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'

  return (
    <form onSubmit={submit} className="mt-base">
      <fieldset className="border-0 m-0 p-0">
        <legend className="text-label-caps text-ink-muted">What is wrong</legend>
        <div className="mt-sm flex flex-wrap gap-sm">
          {[
            { value: 'DAMAGED', label: 'Arrived damaged' },
            { value: 'DEAD_ON_ARRIVAL', label: 'Dead on arrival' },
            { value: 'WRONG_ITEM', label: 'Wrong plant' },
            { value: 'MISSING_ITEM', label: 'Missing from the box' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              data-testid={`claim-kind-${option.value}`}
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
              className={`cursor-pointer rounded-sm border px-4 py-3 text-sm ${
                kind === option.value ? 'border-border bg-brand-soft' : 'border-border'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="text-label-caps text-ink-muted mt-base block" htmlFor="claim-item">
        Which plant
      </label>
      <select
        id="claim-item"
        data-testid="claim-item"
        className={inputClass}
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
            {item.refundable ? ' — refunded in money' : ' — replaced, not refunded'}
          </option>
        ))}
      </select>

      <label className="text-label-caps text-ink-muted mt-base block" htmlFor="claim-description">
        What happened
      </label>
      <textarea
        id="claim-description"
        data-testid="claim-description"
        className={`${inputClass} min-h-24`}
        placeholder="The pot was cracked on one side and the soil had come out."
        maxLength={1000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      {/*
        VIDEO IS A REPORTED GAP. A link to a clip the customer already has (WhatsApp,
        Drive) is accepted so the evidence is not lost while presigned S3 upload is
        built. The column exists on the claim row already, so that work lands without
        a migration.
      */}
      <label className="text-label-caps text-ink-muted mt-base block" htmlFor="claim-evidence">
        Link to a photo or video (optional)
      </label>
      <input
        id="claim-evidence"
        data-testid="claim-evidence"
        className={inputClass}
        type="url"
        placeholder="https://…"
        value={evidenceUrl}
        onChange={(e) => setEvidenceUrl(e.target.value)}
      />

      <button
        type="submit"
        data-testid="claim-submit"
        disabled={busy || description.trim().length < 10}
        className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send my claim'}
      </button>

      {error && (
        <p role="alert" data-testid="claim-error" className="text-danger mt-base mb-0">
          {error}
        </p>
      )}

      <p className="text-ink-muted mt-base mb-0 text-sm">
        You have {orderCode ? '48 hours from delivery' : ''} to tell us. Plants are replaced, not
        refunded — the marginal cost is a plant we have already grown.
      </p>
    </form>
  )
}
