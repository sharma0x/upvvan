'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'
import { readCart, clearCart, cartTotalPaise, type CartLine } from '@/lib/cart'
import { CheckoutSkeleton } from '@/components/ui/Skeleton'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { MicroSpinner } from '@/components/ui/MicroSpinner'

/**
 * Checkout — the delivery details, the payment, and nothing else.
 */
interface CheckoutProps {
  /** From `price_books`. 0 means every order ships free. */
  freeDeliveryThresholdPaise: number
  deliveryFeePaise: number
  /** GST rate in basis points, so the tax line is a fact and not a surprise. */
  taxRateBp: number
  /** True only in an E2E build; gates the simulated-decline button. */
  enableE2E: boolean
  cityName: string
  stateName: string
}

const EMPTY = {
  customerName: '',
  customerPhone: '',
  addressLine1: '',
  addressLine2: '',
  addressLandmark: '',
  addressCity: '',
  addressState: '',
  pincode: '',
  giftNote: '',
}

export default function CheckoutClient({
  freeDeliveryThresholdPaise,
  deliveryFeePaise,
  taxRateBp,
  enableE2E,
  cityName,
  stateName,
}: CheckoutProps) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState({ ...EMPTY, addressCity: cityName, addressState: stateName })
  const [pincodeOk, setPincodeOk] = useState<boolean | null>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [step, setStep] = useState<'details' | 'paying' | 'done'>('details')
  const [declined, setDeclined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orderCode, setOrderCode] = useState('')
  const pincodeAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLines(readCart())
    setReady(true)
  }, [])

  useEffect(() => {
    return () => {
      pincodeAbortRef.current?.abort()
    }
  }, [])

  const set =
    (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const subtotal = useMemo(() => cartTotalPaise(lines), [lines])
  const delivery = subtotal >= freeDeliveryThresholdPaise ? 0 : deliveryFeePaise
  const taxPaise = taxRateBp > 0 ? Math.round((subtotal * taxRateBp) / (10_000 + taxRateBp)) : 0
  const total = subtotal + delivery

  const checkPincode = useCallback(async () => {
    if (form.pincode.length !== 6) return
    setPincodeOk(null)
    setError('')
    setPincodeChecking(true)

    pincodeAbortRef.current?.abort()
    const controller = new AbortController()
    pincodeAbortRef.current = controller

    try {
      const res = await fetch(`/api/serviceability?pincode=${encodeURIComponent(form.pincode)}&city=bengaluru`, {
        signal: controller.signal,
      })
      const body = await res.json()
      setPincodeOk(Boolean(body.serviceable))
      if (!body.serviceable) {
        setError(body.message ?? 'We do not deliver to this pincode yet. Nothing has been charged.')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('We could not check that pincode. Nothing has been charged — try again.')
    } finally {
      setPincodeChecking(false)
    }
  }, [form.pincode])

  // Debounced auto-check when 6 digits are reached
  useEffect(() => {
    if (form.pincode.length === 6 && pincodeOk === null) {
      const timer = setTimeout(() => {
        void checkPincode()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [form.pincode, pincodeOk, checkPincode])

  /** Step 2 + 3. Create the order, then pay it. Two calls because they are two facts. */
  async function placeAndPay(simulate?: 'decline') {
    setBusy(true)
    setError('')
    setDeclined(false)
    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lines: lines.map((l) => ({ ...l, quantity: l.quantity })),
          totalPaise: total,
        }),
      })
      const order = await orderRes.json()

      if (!orderRes.ok) {
        setError(order.message ?? 'Could not place your order.')
        return
      }

      // The order exists and is UNPAID. Say so in the UI before touching money.
      setOrderCode(order.orderCode)
      setStep('paying')

      const intentRes = await fetch('/api/payments/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: order.orderCode, phone: form.customerPhone }),
      })
      const intent = await intentRes.json()
      if (!intentRes.ok) {
        setError(intent.message ?? 'Could not start the payment.')
        setStep('details')
        return
      }

      const capRes = await fetch('/api/payments/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intent.intentId,
          orderCode: order.orderCode,
          phone: form.customerPhone,
          simulate,
        }),
      })
      const captured = await capRes.json()

      if (captured.paymentState === 'captured') {
        clearCart()
        // The phone lives in the URL ONLY for this one navigation, and the order
        // page 302s to the clean URL once it has verified it. Order lookup is
        // authorised by code + phone; putting the phone in a shareable link is the
        // exact leak the code was randomised to prevent.
        window.location.href = `/order/${order.orderCode}?phone=${encodeURIComponent(form.customerPhone)}`
        return
      }

      // 202 means the gateway has not confirmed. Do NOT call this success.
      if (capRes.status === 202) {
        setError(captured.message)
        setStep('details')
        return
      }

      /*
       * Stay on the details step rather than switching to a dead-end panel.
       *
       * The customer has an unpaid order that is STILL PAYABLE, so the useful thing
       * is to leave them exactly where they were with an explanation — the order
       * code is already in `orderCode` state and one click from the pay page. A
       * `declined` step that hides the pay button would make a declined card look
       * like a cancelled order.
       */
      setStep('details')
      setDeclined(true)
      setError(captured.message ?? 'The payment did not go through.')
    } catch {
      setError('Could not reach us. Nothing has been charged — please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <CheckoutSkeleton />

  if (lines.length === 0 && step === 'details') {
    return (
      <p className="border-border bg-surface-raised px-base py-lg rounded-sm border">
        Your cart is empty. <Link href="/plants">Browse the catalogue</Link>.
      </p>
    )
  }

  const inputClass = 'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'
  const canPay =
    pincodeOk === true &&
    !busy &&
    form.customerName.trim() !== '' &&
    form.customerPhone.trim() !== '' &&
    form.addressLine1.trim() !== ''

  return (
    <ErrorBoundary label="Checkout">
      <div>
      <ul className="gap-sm m-0 flex list-none flex-col p-0">
        {lines.map((line, i) => (
          <li
            key={`${line.skuId}-${i}`}
            className="border-border p-base gap-sm flex flex-wrap items-baseline justify-between rounded-sm border"
          >
            <span>
              <strong>
                {line.commonName} <span className="text-ink-muted">{line.sizeTier}</span>
              </strong>
              {line.quantity > 1 && <span className="text-ink-muted"> × {line.quantity}</span>}
              {line.planterName && (
                <span className="text-ink-muted block text-sm">with {line.planterName}</span>
              )}
            </span>
            <span className="font-semibold">{formatPaise(line.totalPaise * line.quantity)}</span>
          </li>
        ))}
      </ul>

      {/*
        THE LANDED PRICE, ITEMISED, BEFORE THE BUTTON.

        Three problems solved by one block: the delivery fee is a fact rather than
        a surprise, the tax is shown rather than buried, and the total the customer
        is about to be charged is the total they can see. IGP's most-cited UX
        complaint in the category is undisclosed charges at checkout; this is the
        fix and it costs eleven lines.
      */}
      <dl className="border-border mt-base gap-xs pt-base flex flex-col border-t text-base">
        <div className="flex justify-between">
          <dt>Plants and pots</dt>
          <dd className="m-0">{formatPaise(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Delivery by our own rider</dt>
          <dd className="m-0">
            {delivery === 0 ? <span className="text-success">Free</span> : formatPaise(delivery)}
          </dd>
        </div>
        {taxPaise > 0 && (
          <div className="text-ink-muted flex justify-between text-sm">
            <dt>Includes GST at {(taxRateBp / 100).toFixed(0)}%</dt>
            <dd className="m-0">{formatPaise(taxPaise)} of the above</dd>
          </div>
        )}
        <div className="border-border pt-sm flex justify-between border-t text-lg font-semibold">
          <dt>Total, prepaid</dt>
          <dd className="m-0">{formatPaise(total)}</dd>
        </div>
      </dl>

      {step === 'paying' && (
        <section
          role="status"
          aria-live="polite"
          data-testid="payment-state"
          className="border-border bg-surface-raised mt-lg p-base rounded-md border"
        >
          <p className="m-0 font-semibold">Taking your payment…</p>
          <p className="text-ink-muted mt-xs mb-0 text-sm">
            Order {orderCode}. Do not close this page — nothing is charged until it says so.
          </p>
        </section>
      )}

      {step === 'details' && (
        <section className="mt-lg">
          <h2 className="text-label-caps text-ink-muted my-0">Delivery details</h2>
          <p className="text-ink-muted mt-xs mb-sm text-sm">
            No account needed. We use your number only to deliver the plant and to send the
            guarantee registration.
          </p>

          <div className="mt-sm gap-sm flex flex-col">
            <label className="block">
              <span className="sr-only">Your name</span>
              <input
                className={inputClass}
                placeholder="Your name"
                aria-label="Your name"
                autoComplete="name"
                value={form.customerName}
                onChange={set('customerName')}
              />
            </label>
            <label className="block">
              <span className="sr-only">10-digit mobile</span>
              <input
                className={inputClass}
                placeholder="10-digit mobile"
                aria-label="10-digit mobile"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={13}
                value={form.customerPhone}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    customerPhone: e.target.value.replace(/\D/g, '').slice(0, 12),
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="sr-only">Flat, house, building</span>
              <input
                className={inputClass}
                placeholder="Flat, house, building"
                aria-label="Flat, house, building"
                autoComplete="address-line1"
                value={form.addressLine1}
                onChange={set('addressLine1')}
              />
            </label>
            <label className="block">
              <span className="sr-only">Area, street (optional)</span>
              <input
                className={inputClass}
                placeholder="Area, street (optional)"
                aria-label="Area, street"
                autoComplete="address-line2"
                value={form.addressLine2}
                onChange={set('addressLine2')}
              />
            </label>
            <label className="block">
              <span className="sr-only">Landmark (optional)</span>
              <input
                className={inputClass}
                placeholder="Landmark (optional)"
                aria-label="Landmark"
                value={form.addressLandmark}
                onChange={set('addressLandmark')}
              />
            </label>

            {/*
              City and state were HARDCODED to Bengaluru / Karnataka with no input
              to change them, while the pincode field accepted any six digits in
              the country. So a customer in Delhi could type a valid Delhi pincode,
              pass the serviceability check (which is city-scoped), and have the
              order written with a Bengaluru address. The mismatch was invisible
              because nothing on the screen showed the city.
            */}
            <div className="gap-sm flex">
              <label className="flex-1">
                <span className="sr-only">City</span>
                <input
                  className={inputClass}
                  placeholder="City"
                  aria-label="City"
                  autoComplete="address-level2"
                  value={form.addressCity}
                  onChange={set('addressCity')}
                />
              </label>
              <label className="flex-1">
                <span className="sr-only">State</span>
                <input
                  className={inputClass}
                  placeholder="State"
                  aria-label="State"
                  autoComplete="address-level1"
                  value={form.addressState}
                  onChange={set('addressState')}
                />
              </label>
            </div>

            <div className="gap-sm flex">
              <label className="flex-1">
                <span className="sr-only">6-digit pincode</span>
                <input
                  className={inputClass}
                  placeholder="560001"
                  aria-label="6-digit pincode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                    }))
                    setPincodeOk(null)
                  }}
                />
              </label>
              <button
                type="button"
                onClick={checkPincode}
                disabled={form.pincode.length !== 6 || pincodeChecking}
                className="border-border px-base shrink-0 cursor-pointer rounded-sm border py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pincodeChecking ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <MicroSpinner size="sm" />
                    <span>Checking…</span>
                  </span>
                ) : (
                  'Check'
                )}
              </button>
            </div>
          </div>

          {/*
            THE GIFT NOTE.
          */}
          <label className="border-border bg-surface-raised mt-lg p-base block rounded-md border">
            <span className="text-label-caps text-ink-muted block">Is this a gift?</span>
            <span className="text-ink-muted mt-xs block text-sm">
              Add a handwritten note, free, on a card in the parcel. We never include prices.
            </span>
            <textarea
              className={`${inputClass} mt-sm`}
              rows={3}
              maxLength={280}
              placeholder="For the new flat — sorry it took two years."
              aria-label="Gift note"
              value={form.giftNote}
              onChange={set('giftNote')}
            />
            <span className="text-ink-muted mt-xs block text-xs">{form.giftNote.length}/280</span>
          </label>

          {pincodeOk && (
            <p role="status" className="mt-sm mb-0 text-sm">
              We deliver to {form.pincode}.
            </p>
          )}

          {error && !declined && (
            <p role="alert" className="text-danger mt-sm mb-0 text-sm">
              {error}
            </p>
          )}

          {declined && (
            <section
              role="alert"
              data-testid="payment-declined"
              className="border-danger bg-surface-raised mb-base p-base rounded-md border"
            >
              <p className="text-danger m-0 font-semibold">Payment not completed</p>
              <p className="text-ink-muted mt-xs mb-0 text-sm">{error}</p>
              <p className="text-ink-muted mt-xs mb-0 text-sm">
                Order {orderCode} is saved and your plant is still reserved. Try again below, or{' '}
                <a href={`/order/${orderCode}/pay`} className="text-primary underline">
                  pay from the order page
                </a>{' '}
                later. Nothing has been charged.
              </p>
            </section>
          )}

          <button
            type="button"
            data-testid="pay-now"
            onClick={() => placeAndPay()}
            disabled={!canPay}
            className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50 transition-transform active:scale-[0.99]"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <MicroSpinner size="sm" />
                <span>Working…</span>
              </span>
            ) : (
              `Pay ${formatPaise(total)} · prepaid`
            )}
          </button>

          {canPay === false && !busy && (
            <p className="text-ink-muted mt-sm mb-0 text-sm">
              Enter your name, mobile, address and a pincode we deliver to, then check the pincode.
            </p>
          )}

          {/*
            The decline button is a TEST AFFORDANCE and it is gated on
            `ENABLE_E2E`. It used to render unconditionally on every build while
            its comment claimed it only appeared when talking to the simulated
            gateway — so a production page carried a button labelled "Simulate a
            declined card" that a real customer could press.
          */}
          {enableE2E && (
            <button
              type="button"
              data-testid="simulate-decline"
              onClick={() => placeAndPay('decline')}
              disabled={!canPay}
              className="border-border text-ink-muted mt-sm w-full cursor-pointer rounded-sm border px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Simulate a declined card (test)
            </button>
          )}

          <p className="text-ink-muted mt-sm mb-0 text-sm">
            Prepaid only. There is no cash-on-delivery option: a COD return takes 25–30 days and the
            plant is unsellable by the time it comes back.
          </p>
        </section>
      )}
    </div>
    </ErrorBoundary>
  )
}
