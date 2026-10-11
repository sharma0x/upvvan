'use client'

import { useState } from 'react'
import Link from 'next/link'

import { STATUS_COPY, canonicalStatus, type OrderStatus } from '@/lib/orders/status'

/**
 * The tracking form.
 *
 * ── WHY IT POSTS TO THE API RATHER THAN READING THE DATABASE ────────────────
 * The same reason as `LookupClient`, and it is a security property rather than a
 * style choice: `/api/orders/lookup` is rate limited, and the limiter counts
 * REQUESTS. A form that queried from the client would be a second, unlimited
 * door onto the same data — and a rate limit on one of two doors is not a rate
 * limit.
 *
 * The API sets a signed cookie on success, so the order page renders from a URL
 * with no phone number in it. The phone never goes into a link.
 *
 * ── WHY IT RENDERS THE TIMELINE HERE AND THEN OFFERS THE FULL RECEIPT ───────
 * A customer whose parcel is late wants to know the stage, not to read an
 * invoice. So this shows the stage and the next step, and offers the receipt as a
 * separate destination — the same information, ordered by what the person is
 * actually anxious about.
 */
/**
 * A status, in the customer's words.
 *
 * `orders/status.ts` is pure — no I/O, no database, no server-only — so the
 * client can import the SAME `STATUS_COPY` the receipt renders from. That is the
 * point: a tracking page and a receipt that describe `PACKED` differently is the
 * Ugaoo failure mode in miniature, and it can only be prevented by there being
 * one table of wording.
 */
type Stage = { code: OrderStatus; label: string; detail: string }

/**
 * API status → display stage.
 *
 * `canonicalStatus` rather than a cast: a stored legacy value (`PLACED`,
 * `ROUTED`, `RESOLVED`) is mapped to its modern equivalent, and an
 * unrecognised one throws rather than rendering an internal state name to a
 * customer.
 */
function toStage(stored: string): Stage {
  const code = canonicalStatus(stored)
  return { code, ...STATUS_COPY[code] }
}

export default function TrackOrderForm({ cityName }: { cityName: string }) {
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<{
    orderCode: string
    status: Stage
    events: Array<Stage & { at: string }>
  } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setOrder(null)
    try {
      const res = await fetch(
        `/api/orders/lookup?orderCode=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`,
      )
      const body = await res.json()

      if (res.status === 429) {
        // The server's own sentence, not a generic failure. A customer told
        // "something went wrong" for a rate limit retries in a tight loop and
        // locks themselves out longer.
        setError(body.message ?? 'Too many attempts. Wait a minute and try again.')
        return
      }
      if (!res.ok) {
        setError(body.message ?? 'We could not find that order. Check the code and the number.')
        return
      }
      setOrder({
        orderCode: body.orderCode,
        status: toStage(body.status),
        events: (body.events ?? []).map((e: { status: string; at: string }) => ({
          ...toStage(e.status),
          at: e.at,
        })),
      })
    } catch {
      setError('Could not reach us. Nothing has been charged — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'

  return (
    <>
      <form onSubmit={submit} className="border-border bg-surface-raised p-lg rounded-md border">
        <h2 className="mt-0">Enter your order code</h2>

        <div className="gap-sm flex flex-col">
          <label className="text-label-caps text-ink-muted" htmlFor="track-code">
            Order code
          </label>
          <input
            id="track-code"
            data-testid="track-code"
            className={inputClass}
            placeholder="UPV-XXXXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />

          <label className="text-label-caps text-ink-muted mt-sm" htmlFor="track-phone">
            Mobile number on the order
          </label>
          <input
            id="track-phone"
            data-testid="track-phone"
            className={inputClass}
            placeholder="10-digit mobile"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
            required
          />
        </div>

        <button
          type="submit"
          data-testid="track-submit"
          disabled={busy || code.trim() === '' || phone.length < 10}
          className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Looking…' : 'Where is my plant?'}
        </button>

        {error && (
          <p role="alert" data-testid="track-error" className="text-danger mt-base mb-0">
            {error}
          </p>
        )}

        <p className="text-ink-muted mt-base mb-0 text-sm">
          No account needed, and nothing is created when you look. If you have tried several times,
          wait a minute — we limit attempts so nobody can guess your order code.
        </p>
      </form>

      {/*
        The result. A live region, because the answer appears without a navigation
        and a screen-reader user needs to be told it did.

        The stage is shown FIRST and in the customer's language, then the history
        as supporting evidence. The reverse — a receipt with the status buried in
        it — is what every competitor does and it is why their tracking pages are
        not opened by anybody whose parcel is late.
      */}
      {order && (
        <section
          role="status"
          aria-live="polite"
          data-testid="track-result"
          className="border-primary mt-2xl p-lg rounded-md border"
        >
          <p className="text-label-caps text-ink-muted m-0">Order {order.orderCode}</p>
          <h2 className="mt-xs mb-0 text-[1.4rem]">{order.status.label}</h2>
          <p className="mt-sm mb-0">{order.status.detail}</p>

          {order.status.code === 'DELIVERED' && (
            <p className="mt-sm mb-0 text-sm">
              If nobody actually handed it to you, tell us — a delivery we cannot prove is not one
              we will pretend happened.{' '}
              <Link href="/contact" className="text-primary underline">
                Report a problem
              </Link>
              .
            </p>
          )}

          {order.events.length > 1 && (
            <>
              <h3 className="mt-lg mb-xs text-[1.05rem]">What has happened so far</h3>
              <ol className="gap-sm m-0 flex list-none flex-col p-0">
                {[...order.events].reverse().map((event, index) => (
                  <li key={`${event.code}-${index}`} className="border-border pb-sm border-b">
                    <span className="font-semibold">{event.label}</span>
                    <span className="text-ink-muted block text-sm">{event.detail}</span>
                    <time dateTime={event.at} className="text-ink-muted block text-xs">
                      {new Date(event.at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="mt-lg mb-0">
            <Link href={`/order/${order.orderCode}`} className="text-primary underline">
              Open the full receipt and invoice
            </Link>
          </p>
        </section>
      )}

      {/*
        The rider question, answered where a person with a delayed parcel will
        look for it rather than three pages away.

        A specific and checkable claim: the rider calls the number ON THE ORDER,
        not a number the customer can find on a website, which is what makes a
        first-time failed handover recoverable.
      */}
      <p className="text-ink-muted mt-lg text-sm">
        If it is out for delivery and nobody answered, the rider will call the number on your order.
        If your parcel is more than a day late in {cityName}, message us rather than waiting —{' '}
        <Link href="/contact" className="text-primary underline">
          a rider calls ahead, and we can see that it went out
        </Link>
        .
      </p>
    </>
  )
}
