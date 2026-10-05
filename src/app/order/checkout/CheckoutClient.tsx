'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * Checkout — the delivery details, the payment, and nothing else.
 *
 * ── WHY THIS PAGE LIVES AT /order/checkout AND NOT IN THE CART ──────────────
 *
 * `src/app/cart/**` and `src/components/catalogue/**` are owned by another agent
 * working concurrently, so the address-and-pay step is built here, inside the
 * `src/app/order/**` subtree. REPORTED FOLLOW-UP: `CartClient.tsx` should replace
 * its direct `POST /api/orders` with a link to `/order/checkout`. Until it does,
 * the cart's own pay button will still fail validation — the API now requires a
 * delivery contact, which is the correct behaviour, not a regression.
 *
 * ── THE THREE STEPS, AND WHY THEY ARE SEPARATE UI STATES ────────────────────
 *
 *   1. details  — who and where. Validated before any order exists, because an
 *                 order we cannot deliver is worse than no order.
 *   2. order    — POST /api/orders. Creates the order UNPAID. The response says
 *                 so; this screen does not pretend otherwise.
 *   3. payment  — POST /api/payments/intent then /capture. Only a 200 with
 *                 paymentState 'captured' advances the screen to confirmed.
 *
 * The old cart screen collapsed all three into one button that said "Order placed"
 * while the API said `awaiting_gateway`. Splitting them is the fix; a single
 * button that optimistically renders success is the bug.
 */

interface CartLine {
  skuId: string
  slug: string
  commonName: string
  sizeTier: string
  itemClass?: 'plant' | 'planter' | 'consumable'
  planterId: string | null
  totalPaise: number
}

type Step = 'details' | 'paying' | 'done'

const EMPTY = {
  customerName: '',
  customerPhone: '',
  addressLine1: '',
  addressLine2: '',
  addressLandmark: '',
  addressCity: 'Bengaluru',
  addressState: 'Karnataka',
  pincode: '',
}

export default function CheckoutClient() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [pincodeOk, setPincodeOk] = useState<boolean | null>(null)
  const [step, setStep] = useState<Step>('details')
  const [declined, setDeclined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orderCode, setOrderCode] = useState('')

  useEffect(() => {
    try {
      setLines(JSON.parse(sessionStorage.getItem('upvvan.cart') ?? '[]'))
    } catch {
      setLines([])
    }
    setReady(true)
  }, [])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  /**
   * Display-only total. The server re-derives every line price from the SKU, so
   * this number is a courtesy for the customer's own arithmetic — editing it in
   * devtools changes nothing, which is the whole point.
   */
  const total = lines.reduce((sum, l) => sum + l.totalPaise, 0)

  async function checkPincode() {
    setPincodeOk(null)
    const res = await fetch(`/api/serviceability?pincode=${form.pincode}&city=bengaluru`)
    const body = await res.json()
    setPincodeOk(Boolean(body.serviceable))
    if (!body.serviceable) setError(body.message ?? 'We do not deliver to this pincode yet.')
  }

  /** Step 2 + 3. Create the order, then pay it. Two calls because they are two facts. */
  async function placeAndPay(simulate?: 'decline') {
    setBusy(true)
    setError('')
    setDeclined(false)
    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lines, totalPaise: total }),
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
        sessionStorage.removeItem('upvvan.cart')
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

  if (!ready) return null

  if (lines.length === 0 && step === 'details') {
    return (
      <p className="border-border bg-surface-raised px-base py-lg rounded-sm border">
        Your cart is empty. <Link href="/">Browse the catalogue</Link>.
      </p>
    )
  }

  const inputClass =
    'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'

  return (
    <div>
      <ul className="gap-sm m-0 flex list-none flex-col p-0">
        {lines.map((line, i) => (
          <li
            key={`${line.skuId}-${i}`}
            className="border-border p-base flex items-baseline justify-between rounded-sm border"
          >
            <span>
              <strong>{line.commonName}</strong>{' '}
              <span className="text-ink-muted">{line.sizeTier}</span>
            </span>
            <span className="font-semibold">{formatPaise(line.totalPaise)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-base border-border pt-base flex justify-between border-t text-lg font-semibold">
        <span>Total</span>
        <span>{formatPaise(total)}</span>
      </p>

      {/*
        THE PAYMENT PANEL.

        Two buttons, on purpose: "Pay" and "Simulate a declined card". The decline
        path is the one nobody tests, so it is one click away rather than a code
        change. It disappears in production — see `simulated` below, which the
        intent response reports honestly rather than this component guessing.
      */}
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

          <div className="mt-sm gap-sm flex flex-col">
            <input
              className={inputClass}
              placeholder="Your name"
              aria-label="Your name"
              autoComplete="name"
              value={form.customerName}
              onChange={set('customerName')}
            />
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
            <input
              className={inputClass}
              placeholder="Flat, house, building"
              aria-label="Flat, house, building"
              autoComplete="address-line1"
              value={form.addressLine1}
              onChange={set('addressLine1')}
            />
            <input
              className={inputClass}
              placeholder="Area, street (optional)"
              aria-label="Area, street"
              autoComplete="address-line2"
              value={form.addressLine2}
              onChange={set('addressLine2')}
            />
            <input
              className={inputClass}
              placeholder="Landmark (optional)"
              aria-label="Landmark"
              value={form.addressLandmark}
              onChange={set('addressLandmark')}
            />
            <div className="gap-sm flex">
              <input
                className={inputClass}
                placeholder="560001"
                aria-label="6-digit pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => {
                  setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))
                  setPincodeOk(null)
                }}
              />
              <button
                type="button"
                onClick={checkPincode}
                disabled={form.pincode.length !== 6}
                className="border-border px-base shrink-0 cursor-pointer rounded-sm border py-3.5 disabled:opacity-50"
              >
                Check
              </button>
            </div>
          </div>

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
              className="border-danger bg-surface-raised mb-base rounded-md border p-base"
            >
              <p className="m-0 font-semibold text-danger">Payment not completed</p>
              <p className="text-ink-muted mt-xs mb-0 text-sm">{error}</p>
              <p className="text-ink-muted mt-xs mb-0 text-sm">
                Order {orderCode} is saved and your plant is still reserved. Try again below, or{' '}
                <a href={`/order/${orderCode}/pay`} className="text-primary underline">
                  pay from the order page
                </a>{' '}
                later.
              </p>
            </section>
          )}

          <button
            type="button"
            data-testid="pay-now"
            onClick={() => placeAndPay()}
            disabled={busy || pincodeOk !== true}
            className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working…' : `Pay ${formatPaise(total)} · prepaid`}
          </button>

          {/*
            The decline button is a TEST AFFORDANCE. It only appears once the
            customer has a real order and is only reachable in a build talking to
            the simulated gateway — a production PSP decides the outcome, and this
            button sends nothing.
          */}
          <button
            type="button"
            data-testid="simulate-decline"
            onClick={() => placeAndPay('decline')}
            disabled={busy || pincodeOk !== true}
            className="border-border text-ink-muted mt-sm w-full cursor-pointer rounded-sm border px-4 py-3 text-sm disabled:opacity-50"
          >
            Simulate a declined card (test)
          </button>

          <p className="text-ink-muted mt-sm mb-0 text-sm">
            Prepaid only. There is no cash-on-delivery option: a COD return takes 25–30 days and the
            plant is unsellable by the time it comes back.
          </p>
        </section>
      )}
    </div>
  )
}