'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The lookup form.
 *
 * Posts to the API rather than calling the loader directly, for one concrete reason:
 * the endpoint is rate limited and the limiter counts REQUESTS. A form that queried
 * the database from the client would be a second, unlimited path to the same data,
 * and a rate limit on one of two doors is not a rate limit.
 */
export default function LookupClient({ initialCode }: { initialCode: string }) {
  const router = useRouter()
  const [code, setCode] = useState(initialCode)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(
        `/api/orders/lookup?orderCode=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`,
      )
      const body = await res.json()

      if (res.status === 429) {
        // Show the server's own sentence. A client-side "something went wrong" for a
        // rate limit is how a customer ends up retrying in a tight loop and getting
        // locked out longer.
        setError(body.message ?? 'Too many attempts. Please wait a minute.')
        return
      }
      if (!res.ok) {
        setError(body.message ?? 'We could not find that order.')
        return
      }

      // The API set the signed cookie on success, so the order page renders from a
      // clean URL with no phone in it.
      router.push(`/order/${body.orderCode}`)
    } catch {
      setError('Could not reach us. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'

  return (
    <form onSubmit={submit} className="mt-base">
      <div className="gap-sm flex flex-col">
        <label className="text-label-caps text-ink-muted" htmlFor="order-code">
          Order code
        </label>
        <input
          id="order-code"
          data-testid="lookup-code"
          className={inputClass}
          placeholder="UPV-XXXXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />

        <label className="text-label-caps text-ink-muted mt-sm" htmlFor="order-phone">
          Phone number on the order
        </label>
        <input
          id="order-phone"
          data-testid="lookup-phone"
          className={inputClass}
          placeholder="10-digit mobile"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={12}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
          required
        />
      </div>

      <button
        type="submit"
        data-testid="lookup-submit"
        disabled={busy || code.trim() === '' || phone.length < 10}
        className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Looking…' : 'Find my order'}
      </button>

      {error && (
        <p role="alert" data-testid="lookup-error" className="text-danger mt-base mb-0">
          {error}
        </p>
      )}

      {/*
        The rate limit is stated, not hidden. A customer who is told "too many
        attempts" with no explanation concludes the site is broken; told "you can try
        again in a minute", they wait. The limiter allows 8 attempts per minute, and
        that number is a code-level constant rather than a config key — it is an abuse
        threshold, not a business setting, and it should not be tunable from a panel.
      */}
      <p className="text-ink-muted mt-base mb-0 text-sm">
        If you have tried several times, wait a minute — we limit attempts so nobody else can guess
        your order.
      </p>
    </form>
  )
}
