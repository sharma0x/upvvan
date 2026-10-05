'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * Cart contents and the pincode gate.
 *
 * The serviceability check here is the ORDER GATE, not a convenience. It runs
 * against the same `/api/serviceability` endpoint checkout calls, and the
 * database refuses an order for an unserviceable pincode regardless — so this
 * check exists to tell the customer WHY, not to enforce it.
 *
 * A cart total is always recomputed from the stored per-line prices; the server
 * re-derives them from the SKU at order-placement time regardless, so editing a
 * number here changes nothing.
 */

interface CartLine {
  skuId: string
  slug: string
  commonName: string
  sizeTier: string
  /**
   * Display only — which remedy applies. Absent on carts written before this
   * field existed, hence the fallback in `hasPlants`.
   */
  itemClass?: 'plant' | 'planter' | 'consumable'
  planterId: string | null
  totalPaise: number
}

type Gate =
  | { state: 'unknown' }
  | { state: 'checking' }
  | { state: 'blocked'; message: string }
  | { state: 'ok'; zone: string }

export default function CartClient() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)
  const [pincode, setPincode] = useState('')
  const [city] = useState('bengaluru')
  const [gate, setGate] = useState<Gate>({ state: 'unknown' })
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    try {
      setLines(JSON.parse(sessionStorage.getItem('upvvan.cart') ?? '[]'))
    } catch {
      setLines([])
    }
    setReady(true)
  }, [])

  const total = lines.reduce((sum, l) => sum + l.totalPaise, 0)
  /*
   * Was `lines.some((l) => true)`, which is always true — so a bag-of-soil-only
   * cart was told "plants are replaced, not refunded". The remedy notice has to
   * match what is actually in the cart. Unknown itemClass (a cart written before
   * this field existed) is treated as a plant, which is the conservative reading:
   * under-promise the remedy rather than over-promise it.
   */
  const hasPlants = lines.some((l) => (l.itemClass ?? 'plant') === 'plant')
  const hasRefundable = lines.some((l) => l.itemClass === 'consumable')

  async function checkPincode() {
    setGate({ state: 'checking' })
    try {
      const res = await fetch(
        `/api/serviceability?pincode=${encodeURIComponent(pincode)}&city=${city}`,
      )
      const body = await res.json()
      setGate(
        body.serviceable
          ? { state: 'ok', zone: body.zone }
          : { state: 'blocked', message: body.message },
      )
    } catch {
      setGate({ state: 'blocked', message: 'Could not check that pincode.' })
    }
  }

  async function placeOrder() {
    setPlacing(true)
    try {
      // Phase 1 checkout. The gateway is not wired yet, so this records the
      // INTENT of a prepaid order and says so plainly rather than pretending a
      // payment happened.
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pincode, lines, totalPaise: total }),
      })
      const body = await res.json()
      sessionStorage.removeItem('upvvan.cart')
      if (body.orderCode) {
        window.location.href = `/order/${body.orderCode}`
      } else {
        setGate({ state: 'blocked', message: body.message ?? 'Could not place order.' })
      }
    } finally {
      setPlacing(false)
    }
  }

  if (!ready) return null

  if (lines.length === 0) {
    return (
      <p className="border-border bg-surface-raised px-base py-lg rounded-sm border">
        Your cart is empty.{' '}
        <Link href="/" className="text-primary">
          Browse the catalogue
        </Link>
        .
      </p>
    )
  }

  return (
    <div>
      <ul className="gap-sm m-0 flex list-none flex-col p-0">
        {lines.map((line, i) => (
          <li
            key={`${line.skuId}-${i}`}
            className="border-border p-base flex items-baseline justify-between rounded-sm border"
          >
            <span>
              <Link
                href={`/plant/${line.slug}?tier=${line.sizeTier}`}
                className="text-ink no-underline hover:underline"
              >
                <strong>{line.commonName}</strong> {line.sizeTier}
              </Link>
              {line.planterId && (
                <span className="text-ink-muted block text-sm">with pot upgrade</span>
              )}
            </span>
            <span className="font-semibold">{formatPaise(line.totalPaise)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-base border-border pt-base flex justify-between border-t text-lg font-semibold">
        <span>Total</span>
        <span>{formatPaise(total)}</span>
      </p>
      <p className="text-ink-muted mt-0 text-sm">Free delivery. No minimum order.</p>

      <section className="mt-lg border-border bg-surface-raised p-base rounded-md border">
        <h2 className="text-label-caps text-ink-muted my-0">Delivery address</h2>
        <div className="mt-sm gap-sm flex">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="560001"
            aria-label="6-digit pincode"
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setGate({ state: 'unknown' })
            }}
            className="border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base"
          />
          <button
            type="button"
            onClick={checkPincode}
            disabled={pincode.length !== 6 || gate.state === 'checking'}
            className="border-border px-base shrink-0 cursor-pointer rounded-sm border py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gate.state === 'checking' ? 'Checking…' : 'Check'}
          </button>
        </div>

        {gate.state === 'ok' && (
          <p role="status" className="mt-sm mb-0 text-sm">
            We deliver to {pincode} ({gate.zone}).
          </p>
        )}
        {gate.state === 'blocked' && (
          <p role="alert" className="mt-sm text-danger mb-0 text-sm">
            {gate.message}
          </p>
        )}
      </section>

      {/*
        THE COD REFUSAL.
        There is no cash-on-delivery option — not hidden, not disabled, absent.
        The absence is the model, so it is stated rather than left as a missing
        button that reads like an oversight.
      */}
      <button
        type="button"
        onClick={placeOrder}
        disabled={gate.state !== 'ok' || placing}
        className="mt-base bg-primary text-surface w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placing ? 'Placing order…' : `Pay ${formatPaise(total)} · prepaid`}
      </button>

      {gate.state !== 'ok' && lines.length > 0 && (
        <p className="mt-sm text-ink-muted mb-0 text-sm">
          Enter a pincode we deliver to before paying.
        </p>
      )}

      {/*
        COD: shown for EVERY cart. There is no configuration of this business in
        which an order is payable on delivery — the plant is unsellable by the
        time a COD parcel comes back. This used to be gated on `hasPlants`,
        which was both wrong (a soil order is also prepaid) and pointed at the
        wrong variable.
      */}
      <p className="mt-sm text-ink-muted mb-0 text-sm">
        No cash on delivery option exists on this page. That is deliberate: a COD return takes 25–30
        days and the plant is unsellable by then.
      </p>

      {/*
        The remedy, stated per line. `cart/page.tsx` carries the full policy
        prose; this is the short form next to the pay button, and it must match
        what is actually in the cart rather than asserting the plant rule
        unconditionally.
      */}
      <p className="mt-base text-ink-muted mb-0 text-sm">
        {hasPlants
          ? 'Plants in this order are replaced, not refunded. Pots, soil and fertiliser are refunded in money within 24 hours.'
          : hasRefundable
            ? 'Everything in this order is refunded in money within 24 hours.'
            : 'Refunds for this order are settled in money within 24 hours.'}
      </p>
    </div>
  )
}
