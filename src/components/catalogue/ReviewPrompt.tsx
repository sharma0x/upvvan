'use client'

import { useState } from 'react'

/**
 * "How did it arrive?" — the post-delivery review prompt.
 *
 * ── WHY IT IS HERE AND NOT ON THE PRODUCT PAGE ───────────────────────────────
 *
 * Because a review wall is only worth anything if the reviews are about things
 * people actually received, and the only moment a customer is holding the plant
 * and has an opinion is the day it lands. The product page is where they are
 * choosing; the order page is where they are holding it.
 *
 * The database enforces the same rule independently
 * (`reviews_must_be_about_a_delivered_line`), so this placement is a convenience
 * rather than the control.
 *
 * ── WHY THE AUTHOR NAME IS NOT ASKED FOR ─────────────────────────────────────
 *
 * A free-text name field on a review wall is how contact details end up scraped,
 * and there is a database CHECK that refuses any body or author containing a
 * phone number or an e-mail address. Better to derive it from the order than to
 * rely on a customer not to type their number into a "name" field.
 */
export default function ReviewPrompt({
  orderCode,
  phone,
  items,
}: {
  orderCode: string
  phone: string
  items: Array<{ id: string; label: string }>
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (items.length === 0) return null

  if (done) {
    return (
      <section
        role="status"
        data-testid="review-thanks"
        className="border-border bg-surface-raised p-base rounded-md border"
      >
        <p className="m-0 font-semibold">Thank you.</p>
        <p className="text-ink-muted mt-xs mb-0 text-sm">{done}</p>
      </section>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode,
          phone,
          orderItemId: itemId,
          rating,
          title,
          review: body,
        }),
      })
      const payload = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        setError(payload.error ?? 'We could not record that just now.')
        return
      }
      setDone(payload.message ?? 'We read every review before it goes up.')
    } catch {
      setError('We could not reach us. Nothing has been saved — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const FIELD = 'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'

  return (
    <form onSubmit={submit} className="mt-base" data-testid="review-form">
      <label htmlFor="review-item" className="text-label-caps text-ink-muted block">
        Which plant
      </label>
      <select
        id="review-item"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        className={FIELD}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <fieldset className="mt-base border-0 p-0">
        <legend className="text-label-caps text-ink-muted">Stars</legend>
        <div className="mt-xs gap-xs flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="inline-flex min-h-[44px] cursor-pointer items-center">
              <input
                type="radio"
                name="rating"
                value={star}
                checked={rating === star}
                onChange={() => setRating(star)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`text-2xl leading-none ${star <= rating ? 'text-clay' : 'text-ink-muted'}`}
              >
                ★
              </span>
              <span className="sr-only">
                {star} star{star === 1 ? '' : 's'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="review-title" className="text-label-caps text-ink-muted mt-base block">
        In a few words
      </label>
      <input
        id="review-title"
        type="text"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Arrived bigger than I expected"
        className={FIELD}
      />

      <label htmlFor="review-body" className="text-label-caps text-ink-muted mt-base block">
        Anything we should know
      </label>
      <textarea
        id="review-body"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Packed really well. Two days in and no shock to the leaves."
        className={`${FIELD} min-h-24`}
      />

      {error && (
        <p role="alert" className="text-danger mt-base mb-0">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || title.trim().length < 3 || body.trim().length < 10}
        className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Leave a review'}
      </button>

      <p className="text-ink-muted mt-xs mb-0 text-xs">
        Your name is shortened from the one on the order. Please do not include a phone number or an
        e-mail — we publish these, and the system will refuse them.
      </p>
    </form>
  )
}
