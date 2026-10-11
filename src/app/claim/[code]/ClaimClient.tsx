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
  guaranteeLabel,
  guaranteeDays,
  arrivalWindowHours,
  supportPhone,
  existingClaims,
}: {
  orderCode: string
  phone: string
  delivered: boolean
  items: Array<{ id: string; label: string; refundable: boolean }>
  /**
   * The promise, read from `price_books.active_guarantee_tier` on the server.
   *
   * This component used to print a hardcoded "48 hours from delivery" for BOTH
   * the arrival case and the mortality case. On the default T0 tier that happens
   * to be right for arrival, and wrong for a plant that dies on day 20 of a 30-day
   * guarantee — so a customer reading this form was told to report a dead plant
   * within two days while `/policies/guarantee` told them thirty.
   *
   * Two contradictory numbers on one site is worse than one wrong number: the
   * customer believes whichever one they read second, and the category's entire
   * reputation problem is being believed about something different each time.
   *
   * So the server passes the numbers down and this component has no opinion about
   * them. That is the whole contract.
   */
  guaranteeLabel: string
  guaranteeDays: number
  arrivalWindowHours: number
  supportPhone: string
  /** Claims already filed, so the customer can see one instead of filing twice. */
  existingClaims: Array<{ id: string; kind: string; status: string }>
}) {
  const router = useRouter()
  const [kind, setKind] = useState('DAMAGED')
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [claimCode, setClaimCode] = useState<string | null>(null)

  /*
   * ── ALREADY CLAIMED ─────────────────────────────────────────────────────────
   *
   * The API refuses a second claim with 409 and the sentence "we already have a
   * claim open for this order and it is being handled" — which was the only place
   * that existed, and only AFTER the customer had written out a description and
   * pressed submit.
   *
   * Shown BEFORE the form instead, with the reference. So a customer who comes
   * back a second time sees the state of their claim instead of being asked to
   * describe the same dead plant twice and then told off.
   */
  const openClaim = existingClaims.find((c) => c.status === 'OPEN')

  if (openClaim) {
    return (
      <section
        role="status"
        data-testid="claim-already-open"
        className="border-border bg-surface-raised p-base rounded-md border"
      >
        <p className="m-0 font-semibold">You already have a claim open on this order</p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          Reference <strong>{openClaim.id}</strong> —{' '}
          {openClaim.kind.replace(/_/g, ' ').toLowerCase()}, raised and with a grower. There is
          nothing more for you to do; we will be in touch.
        </p>
        <p className="mt-base mb-0">
          <a href={`/order/${orderCode}`} className="text-primary underline">
            Back to your order
          </a>
        </p>
      </section>
    )
  }

  if (!delivered) {
    /*
     * This used to be a dead end: an alert with no form and no link, whose own
     * copy said "tell us and we will sort it out" — with no way to tell us.
     *
     * A customer who reads "Delivered" on their tracking and arrives here to find
     * a claim form is describing the exact dispute this business is built to
     * settle, and the two most useful things they can do are call and WhatsApp.
     * Both are one tap away.
     */
    return (
      <section
        role="alert"
        data-testid="claim-not-delivered"
        className="border-warning bg-surface-raised p-base rounded-md border"
      >
        <p className="m-0 font-semibold">This order has not been delivered yet</p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          We can only take a claim once the plant has arrived — a claim on an order in transit is
          not a damage report.
        </p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          If your tracking says delivered and this does not, that is a problem we want to know about
          today rather than in the guarantee window.
        </p>
        <p className="mt-base gap-sm mb-0 flex flex-wrap">
          {supportPhone && (
            <a
              href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`}
              className="bg-primary text-surface-card inline-flex min-h-[44px] items-center rounded-sm px-4 no-underline"
            >
              Call {supportPhone}
            </a>
          )}
          {supportPhone && (
            <a
              href={`https://wa.me/91${supportPhone.replace(/\D/g, '').slice(-10)}`}
              className="border-border inline-flex min-h-[44px] items-center rounded-sm border px-4 no-underline"
            >
              WhatsApp us
            </a>
          )}
          <a
            href="/contact"
            className="border-border inline-flex min-h-[44px] items-center rounded-sm border px-4 no-underline"
          >
            Send a message
          </a>
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
        body: JSON.stringify({
          orderCode,
          phone,
          kind,
          orderItemId: itemId,
          description,
          evidenceUrl,
        }),
      })
      const body = await res.json()

      if (!res.ok) {
        setError(body.message ?? 'We could not record your claim.')
        return
      }
      /*
       * The reference, kept.
       *
       * The API returns `claimId` and this component discarded it, so the only
       * place a customer could ever see `CLM-000123` was the acknowledgement
       * e-mail. Losing an e-mail means losing the only handle you have on a
       * conversation with a company — which is why the number is on the success
       * screen now, and why it is the largest thing on it.
       */
      setClaimCode(body.claimId ?? null)
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
      <section
        role="status"
        data-testid="claim-submitted"
        className="border-success bg-success-soft p-base rounded-md border"
      >
        <p className="m-0 font-semibold">Claim received</p>
        {claimCode && (
          <p className="mt-xs mb-0" data-testid="claim-reference">
            <span className="text-label-caps text-ink-muted block">Your reference</span>
            <strong className="font-h2 text-xl">{claimCode}</strong>
          </p>
        )}
        <p className="text-ink-muted mt-xs mb-0 text-sm">
          We are looking at what arrived. If a plant is damaged or dead we send a replacement and
          you keep nothing to return — there is nothing more for you to do.
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
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-label-caps text-ink-muted">What is wrong</legend>
        <div className="mt-sm gap-sm flex flex-wrap">
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

      {/*
        The window, from the server. See the prop docs: this used to be a literal
        "48 hours" on this line while `/policies/guarantee` published the tier's
        real number.
      */}
      <p className="text-ink-muted mt-base mb-0 text-sm">
        Your {guaranteeLabel.toLowerCase()} — report an arrival problem within {arrivalWindowHours}{' '}
        hours of delivery, and a plant that dies within {guaranteeDays} days. Plants are replaced,
        not refunded: the marginal cost is a plant we have already grown, and asking you to post one
        back would cost you a courier fee.
      </p>
    </form>
  )
}
