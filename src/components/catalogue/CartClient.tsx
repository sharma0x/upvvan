'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'
import { readCart, writeCart, type CartLine } from '@/lib/cart'
import { CartSkeleton } from '@/components/ui/Skeleton'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MicroSpinner } from '@/components/ui/MicroSpinner'

/**
 * Cart contents, quantity editing, and the delivery gate.
 */
type Gate =
  | { state: 'unknown' }
  | { state: 'checking' }
  | { state: 'blocked'; message: string }
  | { state: 'ok'; zone: string; message: string }

export default function CartClient({
  freeDeliveryThresholdPaise,
}: {
  freeDeliveryThresholdPaise: number
}) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)
  const [pincode, setPincode] = useState('')
  const [city] = useState('bengaluru')
  const [gate, setGate] = useState<Gate>({ state: 'unknown' })
  const abortRef = useRef<AbortController | null>(null)
  const saving = false

  useEffect(() => {
    setLines(readCart())
    setReady(true)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  /*
   * Every mutation goes through `commit`, which writes to sessionStorage and
   * sets state in one place.
   */
  const commit = useCallback((next: CartLine[]) => {
    writeCart(next)
    setLines(next)
  }, [])

  const total = lines.reduce((sum, l) => sum + l.totalPaise * l.quantity, 0)
  const units = lines.reduce((sum, l) => sum + l.quantity, 0)

  const hasPlants = lines.some((l) => (l.itemClass ?? 'plant') === 'plant')
  const hasRefundable = lines.some((l) => l.itemClass === 'consumable')

  const shortfall = Math.max(0, freeDeliveryThresholdPaise - total)
  const freeDeliveryEarned = freeDeliveryThresholdPaise > 0 && shortfall === 0

  async function checkPincode() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGate({ state: 'checking' })
    try {
      const res = await fetch(
        `/api/serviceability?pincode=${encodeURIComponent(pincode)}&city=${city}`,
        { signal: controller.signal },
      )
      const body = await res.json()
      setGate(
        body.serviceable
          ? { state: 'ok', zone: body.zone, message: body.message ?? `We deliver to ${pincode}.` }
          : { state: 'blocked', message: body.message ?? 'We do not deliver there yet.' },
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setGate({ state: 'blocked', message: 'Could not check that pincode. Try again.' })
    }
  }

  function setQuantity(index: number, quantity: number) {
    if (quantity <= 0) {
      commit(lines.filter((_, i) => i !== index))
      return
    }
    commit(lines.map((l, i) => (i === index ? { ...l, quantity } : l)))
  }

  function changePlanter(index: number, planterId: string | null, totalPaise: number) {
    commit(lines.map((l, i) => (i === index ? { ...l, planterId, totalPaise } : l)))
  }

  if (!ready) return <CartSkeleton />

  if (lines.length === 0) {
    return (
      <div className="border-border bg-surface-raised p-xl flex flex-col items-center justify-center rounded-md border text-center">
        <p className="text-ink text-lg font-semibold">Your cart is empty.</p>
        <p className="text-ink-muted mt-xs max-w-sm text-sm">
          Select plants in season and pot pairings grown honestly at our nursery.
        </p>
        <Link
          href="/plants"
          className="bg-primary text-surface mt-base inline-flex min-h-[44px] items-center rounded-sm px-5 py-2.5 text-sm font-semibold no-underline"
        >
          Browse the catalogue
        </Link>
      </div>
    )
  }

  return (
    <ErrorBoundary label="Shopping Cart">
      <div>
      <ul className="gap-sm m-0 flex list-none flex-col p-0">
        {lines.map((line, i) => (
          <li key={`${line.skuId}-${i}`} className="border-border p-base rounded-sm border">
            <div className="gap-base flex flex-wrap items-start justify-between">
              <span>
                <Link
                  href={`/plant/${line.slug}?tier=${line.sizeTier}`}
                  className="text-ink no-underline hover:underline"
                >
                  <strong>{line.commonName}</strong> {line.sizeTier}
                </Link>
                {line.planterName ? (
                  <span className="text-ink-muted block text-sm">with {line.planterName}</span>
                ) : (
                  <span className="text-ink-muted block text-sm">in its grow pot</span>
                )}
                {line.itemClass === 'consumable' && (
                  <span className="text-ochre block text-sm">Soil, feed or tool</span>
                )}
              </span>

              <span className="text-right">
                <span className="block font-semibold">{formatPaise(line.totalPaise)}</span>
                {line.quantity > 1 && (
                  <span className="text-ink-muted block text-sm">
                    {formatPaise(line.totalPaise * line.quantity)} for {line.quantity}
                  </span>
                )}
              </span>
            </div>

            {/*
              Quantity and remove.
              
              `AddToCart` writes one row per add, so adding the same plant twice
              produced two identical rows with two identical "total" figures that
              were not the order total — which is the kind of arithmetic a
              customer trusts us not to get wrong. Quantity controls make the
              second add a quantity of two instead of a duplicate line.
            */}
            <div className="border-border mt-sm gap-sm pt-sm flex flex-wrap items-center border-t">
              <span className="text-ink-muted text-sm">Quantity</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setQuantity(i, line.quantity - 1)}
                  disabled={saving}
                  aria-label={`One fewer ${line.commonName}`}
                  className="border-border hover:bg-brand-soft min-h-[44px] min-w-[44px] cursor-pointer rounded-l-sm border px-3 text-lg"
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  className="border-border min-h-[44px] min-w-[3rem] border-y px-3 py-2.5 text-center font-semibold"
                >
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(i, line.quantity + 1)}
                  disabled={saving}
                  aria-label={`One more ${line.commonName}`}
                  className="border-border hover:bg-brand-soft min-h-[44px] min-w-[44px] cursor-pointer rounded-r-sm border px-3 text-lg"
                >
                  +
                </button>
              </div>

              {line.itemClass === 'plant' &&
                line.planterOptions &&
                line.planterOptions.length > 0 && (
                  <label className="ml-auto text-sm">
                    <span className="sr-only">Pot for {line.commonName}</span>
                    <select
                      value={line.planterId ?? ''}
                      onChange={(e) => {
                        const option = line.planterOptions!.find(
                          (o) => o.planterId === e.target.value,
                        )
                        if (option) changePlanter(i, option.planterId || null, option.totalPaise)
                      }}
                      className="border-border bg-surface min-h-[44px] rounded-sm border px-2 py-2.5"
                    >
                      {line.planterOptions.map((option) => (
                        <option key={option.planterId || 'grow'} value={option.planterId}>
                          {option.name} — {formatPaise(option.totalPaise)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

              <button
                type="button"
                onClick={() => commit(lines.filter((_, n) => n !== i))}
                disabled={saving}
                className="text-danger min-h-[44px] cursor-pointer px-2 text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-base border-border pt-base flex justify-between border-t text-lg font-semibold">
        <span>
          Total <span className="text-ink-muted text-base font-normal">({units} units)</span>
        </span>
        <span>{formatPaise(total)}</span>
      </p>
      <p className="text-ink-muted mt-0 text-sm">
        {freeDeliveryEarned
          ? 'Delivery is free. Prepaid only.'
          : freeDeliveryThresholdPaise > 0
            ? `${formatPaise(shortfall)} more and delivery is free. Prepaid only.`
            : 'Free delivery. No minimum order. Prepaid only.'}
      </p>

      <section className="border-border bg-surface-raised mt-lg p-base rounded-md border">
        <h2 className="text-label-caps text-ink-muted my-0">Where is this going?</h2>
        <p className="text-ink-muted mt-xs mb-sm text-sm">
          Check before you go any further — we would rather say no now than refund you later.
        </p>
        <div className="gap-sm flex">
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
            {gate.state === 'checking' ? (
              <span className="inline-flex items-center gap-1.5">
                <MicroSpinner size="sm" />
                <span>Checking…</span>
              </span>
            ) : (
              'Check'
            )}
          </button>
        </div>

        {gate.state === 'ok' && (
          <p role="status" className="mt-sm mb-0 text-sm">
            {gate.message}
          </p>
        )}
        {gate.state === 'blocked' && (
          <p role="alert" className="mt-danger mt-sm mb-0 text-sm">
            {gate.message}
          </p>
        )}
      </section>

      {/*
        The handoff. This link is the fix for the cart's dead end, and it is the
        single most important line in the file: without it there is no path from
        "I have chosen plants" to "I have paid", and the whole funnel is a
        brochure.
      */}
      <Link
        href="/order/checkout"
        className="bg-primary text-surface mt-base block w-full rounded-sm px-4 py-4 text-center font-semibold no-underline"
      >
        Continue to delivery &amp; payment
      </Link>

      {/*
        COD: there is no configuration of this business in which an order is
        payable on delivery — the plant is unsellable by the time a COD parcel
        comes back, 25–30 days later. FNP and IGP independently refuse COD for the
        same reason, so this is stated as a policy with its reason attached rather
        than left as a missing button that reads like an oversight.
      */}
      <p className="text-ink-muted mt-sm mb-0 text-sm">
        No cash on delivery option exists on this page, and there is not one to enable. A COD return
        takes 25–30 days and the plant arrives dead, so we do not create the return leg.
      </p>

      {/*
        The remedy, stated per line. `cart/page.tsx` carries the full policy prose;
        this is the short form next to the pay button, and it must match what is
        actually in the cart rather than asserting the plant rule unconditionally.
      */}
      <p className="text-ink-muted mt-base mb-0 text-sm">
        {hasPlants
          ? 'Plants in this order are replaced, not refunded. Pots, soil and fertiliser are refunded in money within 24 hours.'
          : hasRefundable
            ? 'Everything in this order is refunded in money within 24 hours.'
            : 'Refunds for this order are settled in money within 24 hours.'}
      </p>
    </div>
    </ErrorBoundary>
  )
}
