import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { formatPaise } from '@/lib/catalogue/pricing'
import { db, loadOrder, loadOrderVerified, normaliseCode, phoneTail } from '@/lib/orders/db'
import { hsnFor, taxInvoice } from '@/lib/orders/invoice'
import { orderCookieName, verifyOrderSignature } from '@/lib/orders/cookie'
import { STATUS_COPY, type OrderStatus } from '@/lib/orders/status'
import type { OrderEventSummary } from '@/lib/orders/db'

/**
 * The order page — a receipt AND a tracking timeline.
 *
 * ── WHAT CHANGED, AND WHY IT MATTERED ───────────────────────────────────────
 *
 * The previous version rendered, unconditionally:
 *
 *     <p>Order placed</p>
 *
 * while the API it had just called returned `paymentState: 'awaiting_gateway'`. No
 * money had moved. So the page told a customer their plant was on its way when we
 * had their name and a pincode and nothing else — and the page had no way to show
 * where the order actually was, because `orders.status` was a logistics field that
 * nothing ever advanced.
 *
 * Three things are now separable on purpose:
 *
 *   · PAYMENT STATE IS RENDERED FROM THE CAPTURE, NOT FROM THE ORDER EXISTING.
 *     "Payment pending" and "Paid" are different pages, not different wording, and
 *     only a captured payment may say the order is confirmed.
 *
 *   · THE TIMELINE IS AN APPEND-ONLY EVENT LOG (`order_events`), not a derived
 *     guess from `status`. A derived timeline shows the current state and pretends
 *     the customer watched it happen; an event log shows what happened and when,
 *     which is the thing a customer is actually asking.
 *
 *   · THE RECEIPT IS A REAL TAX INVOICE — GSTIN, HSN per line, and the address the
 *     plant is going to. Legal Metrology r.6(1)(e) requires the tax-inclusive
 *     retail price to be declared, and an invoice that omits the GSTIN is not one.
 *
 * ── THE URL PHONE, AND WHY IT IS EXCHANGED FOR A COOKIE IMMEDIATELY ─────────
 *
 * Lookup is authorised by code + phone. The checkout passes the phone in the query
 * string so this page can render without a second prompt — and then this page
 * redirects to the CLEAN `/order/<code>` URL, relying on a signed cookie the
 * checkout set.
 *
 * The alternative (a redirect loop back to the phone prompt, or leaving the phone in
 * the URL for every subsequent render) is worse in a way worth naming: a link
 * containing a phone number ends up in browser history, in the `Referer` header of
 * any outbound link, in a support ticket when someone pastes the URL, and in a
 * screenshot. The code was moved off `Date.now()` precisely to stop orders being
 * enumerable; carrying the phone in the address bar would hand back most of that.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  return {
    title: `Order ${code} — Upvvan`,
    description: 'Your order receipt, payment status and delivery timeline.',
    // A receipt is personal: it carries an address and a phone number. Any
    // intermediary — a CDN, a support tool, a browser extension — must not keep a
    // copy, and must not hand it to a crawler.
    robots: { index: false, follow: false, nocache: true },
  }
}

const IND_STATES: Record<string, string> = {
  KA: 'Karnataka',
  MH: 'Maharashtra',
  TS: 'Telangana',
  KL: 'Kerala',
  TN: 'Tamil Nadu',
  DL: 'Delhi',
}

/**
 * Indian date and time, and ONLY that.
 *
 * `toLocaleString()` with an explicit `en-IN` + `timeZone: 'Asia/Kolkata'` is the
 * correct call and worth spelling out, because the default here is the SERVER's
 * zone: a receipt rendered by a container running UTC tells a Bengaluru customer
 * their order was placed at 6am when it was placed at half past eleven. On a tax
 * document that is a real discrepancy, not a cosmetic one.
 */
function indianDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(d)
}

function indianDate(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(d)
}

function addressLines(order: {
  address: {
    line1: string | null
    line2: string | null
    landmark: string | null
    city: string | null
    state: string | null
  } | null
  pincode: string
  customerName: string | null
}): string[] {
  const a = order.address
  if (!a) return [order.customerName ?? '', order.pincode, '(address pending)'].filter(Boolean)
  return [
    order.customerName ?? '',
    a.line1 ?? '',
    a.line2 ?? '',
    a.landmark ?? '',
    [a.city, a.state ? (IND_STATES[a.state] ?? a.state) : null].filter(Boolean).join(', '),
    order.pincode,
  ].filter(Boolean)
}

/** The guarantee window in hours, from the tier the customer was actually SOLD. */
function guaranteeHours(tier: string): number {
  switch (tier) {
    case 'T0':
      return 48
    case 'T1':
      return 720
    case 'T2':
      return 2160
    default:
      return 48
  }
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ phone?: string }>
}) {
  const { code } = await params
  const { phone } = await searchParams
  const normalised = normaliseCode(code)
  const jar = await cookies()

  /*
   * ── TWO WAYS IN, ONE WAY TO RENDER ────────────────────────────────────────
   *
   * 1. A signed cookie from a previous verified visit. Authorised, render.
   *
   * 2. A phone in the query string. Verify it, then redirect to the clean URL. The
   *    checkout sets the cookie on the way through, so the clean URL is authorised
   *    on the very next request.
   *
   * Neither: the code alone is unguessable but NOT authorised — a leaked code from a
   * screenshot must not render an address and a phone number. So we ask.
   */
  const signature = jar.get(orderCookieName(normalised))?.value
  const alreadyVerified = signature ? verifyOrderSignature(normalised, signature) : false

  /*
   * ── ALWAYS STRIP THE PHONE ─────────────────────────────────────────────────
   *
   * The cookie is set on the SAME request that carries `?phone=`, so by the time a
   * later render sees the cookie, the URL may still hold the phone — and it would
   * then be rendered, bookmarked and screenshotted with the phone in it. The first
   * version only redirected on the un-verified branch, which meant the exact flow
   * that matters (checkout → captured → order page) kept the phone in the URL.
   *
   * This check is unconditional and comes first, so no code path can render a
   * receipt at a URL containing a customer's phone number.
   */
  if (phoneTail(phone ?? '')) {
    // The cookie below is set by the checkout/intent/lookup request that verified
    // this phone. If it is somehow absent, the redirect sends the customer to lookup
    // and they prove it again — which is a worse experience but never a leak.
    if (alreadyVerified) redirect(`/order/${normalised}`)
  }

  if (!alreadyVerified) {
    if (!phoneTail(phone ?? '')) {
      redirect(`/orders/lookup?orderCode=${encodeURIComponent(normalised)}`)
    }

    const verified = await loadOrder(db(), { orderCode: normalised, phone: phone! })

    // One 404 for "no such order" and "wrong phone" alike. Differentiating them
    // turns this page into an oracle for which codes exist.
    if (!verified) notFound()

    // The checkout set the cookie on the request that carried this phone, so the
    // clean URL is already authorised and this redirect terminates immediately.
    redirect(`/order/${verified.order.orderCode}`)
  }

  /*
   * ── AUTHORISED: LOAD BY CODE ──────────────────────────────────────────────
   *
   * Past this point the cookie is the credential, so the order row is read by code
   * alone. That is safe precisely because the signature cannot be forged — the
   * query above required a phone that matched the order's own phone, and that proof
   * is what the cookie carries.
   */
  const pool = db()
  const byCode = await pool.query<{ order_code: string }>(
    `SELECT "order_code" FROM "orders" WHERE "order_code" = $1`,
    [normalised],
  )
  if (byCode.rowCount === 0) notFound()

  const found = await loadOrderVerified(pool, normalised)
  if (!found) notFound()

  const { order, items, events } = found
  const paid = order.paymentState === 'captured'
  const copy = STATUS_COPY[order.status]
  const invoice = taxInvoice(order.orderCode)
  const windowHours = guaranteeHours(order.guaranteeTier)

  return (
    <main className="mx-auto max-w-[640px] px-base py-2xl">
      {/*
        THE HEADLINE IS THE PAYMENT STATE. It is the first thing on the page and it is
        driven by `paymentState`, never by the order existing. An order that exists
        but is unpaid says "Payment pending" in the same position a paid one says
        "Payment received" — because to a customer those are the only two facts that
        matter, and conflating them is how you end up dispatching plants you have not
        been paid for.
      */}
      <p
        data-testid="order-payment-state"
        data-payment-state={order.paymentState ?? 'created'}
        className={`text-label-caps mb-0 ${paid ? 'text-success' : 'text-warning'}`}
      >
        {paid ? 'Payment received' : 'Payment pending'}
      </p>
      <h1 className="mb-xs mt-0">{order.orderCode}</h1>

      {!paid && (
        <section
          role="alert"
          data-testid="payment-pending-notice"
          className="border-warning bg-surface-raised mt-sm p-base rounded-md border"
        >
          <p className="m-0 font-semibold">
            {order.paymentState === 'failed'
              ? 'Your payment did not go through'
              : 'We have not taken your money yet'}
          </p>
          <p className="text-ink-muted mt-xs mb-0 text-sm">
            Your order is saved and your plant is reserved. Pay from{' '}
            <Link href={`/order/${order.orderCode}/pay`} className="text-primary underline">
              the payment page
            </Link>{' '}
            and it goes to the packing bench. Nothing is charged until a payment is captured.
          </p>
        </section>
      )}

      {paid && (
        <section
          role="status"
          data-testid="payment-captured-notice"
          className="border-success bg-success-soft mt-sm p-base rounded-md border"
        >
          <p className="m-0 font-semibold">
            Paid {formatPaise(order.revenuePaise)} in full. Your plant is reserved.
          </p>
          {order.paymentReference && (
            <p className="text-ink-muted mt-xs mb-0 text-sm">
              Payment reference <strong>{order.paymentReference}</strong> — quote this to support.
            </p>
          )}
        </section>
      )}

      <p className="text-ink-muted mt-base">{copy.detail}</p>

      <section className="mt-xl" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="mt-0 mb-sm">
          Where your order is
        </h2>
        <ol className="m-0 flex list-none flex-col p-0" data-testid="order-timeline">
          {events.map((event, i) => (
            <TimelineRow
              key={`${event.status}-${event.at.toISOString()}-${i}`}
              event={event}
              last={i === events.length - 1}
            />
          ))}
        </ol>
      </section>

      <section className="mt-2xl" aria-labelledby="receipt-heading" id="receipt">
        <h2 id="receipt-heading" className="mt-0 mb-xs">
          Tax invoice
        </h2>

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-muted">Invoice number</dt>
          <dd className="m-0 font-semibold">{invoice.invoiceNumber}</dd>

          <dt className="text-ink-muted">GSTIN</dt>
          <dd className="m-0" data-testid="gstin">
            {invoice.gstinMissing ? (
              <span className="text-warning">
                GSTIN not configured — set GSTIN in the environment to issue a compliant invoice.
              </span>
            ) : (
              invoice.gstin
            )}
          </dd>

          <dt className="text-ink-muted">Invoice date</dt>
          <dd className="m-0">{indianDate(order.createdAt)}</dd>

          <dt className="text-ink-muted">Payment</dt>
          <dd className="m-0">
            {paid ? `Captured ${indianDateTime(order.capturedAt ?? order.updatedAt)}` : 'Not captured'}
          </dd>
        </dl>

        <ul className="gap-sm mt-base m-0 flex list-none flex-col border-t border-border p-0 pt-sm">
          {items.map((item) => (
            <li key={item.id} className="border-border pb-sm flex justify-between border-b">
              <span>
                {item.commonName ?? 'Item'}{' '}
                <span className="text-ink-muted">
                  {item.sizeTier}
                  {item.planterName ? ` · ${item.planterName}` : ''}
                </span>
                <br />
                {/*
                  HSN ON EVERY LINE. A plant is 0602 90, a pot 6914 90, a consumable
                  3105 90 — and the classification keys the remedy, which is why it
                  is derived from `item_class` rather than typed in per line.
                */}
                <span className="text-ink-muted text-xs">
                  HSN {hsnFor(item.itemClass)}
                  {item.heightCm ? ` · declared height ${item.heightCm} cm` : ''}
                </span>
              </span>
              <span className="font-semibold">{formatPaise(item.pricePaise)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-base flex justify-between font-semibold">
          <span>Total (inclusive of GST)</span>
          <span data-testid="order-total">{formatPaise(order.revenuePaise)}</span>
        </p>

        <p className="text-ink-muted mt-xs mb-0 text-sm">
          Prices are inclusive of all taxes, as required by the Legal Metrology (Packaged Commodities)
          Rules 2011 r.6(1)(e). Free delivery. No minimum order.
        </p>

        <div className="border-border mt-lg rounded-sm border">
          <p className="text-label-caps text-ink-muted mt-0 mb-1 px-base pt-sm">Delivering to</p>
          <address className="m-0 px-base pb-sm text-sm not-italic">
            {addressLines(order).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>
      </section>

      <section className="mt-xl" aria-labelledby="next-heading">
        <h2 id="next-heading" className="mt-0 mb-xs">
          What happens next
        </h2>
        <ol className="gap-xs text-ink-muted m-0 flex list-decimal flex-col pl-md">
          <li>Prepaid only — there is no cash-on-delivery option to choose at the door.</li>
          <li>Our rider brings it to {order.pincode}.</li>
          <li>
            You confirm delivery with an OTP, a photo and a condition check. You have {windowHours}{' '}
            hours to report damage.
          </li>
        </ol>

        <p className="text-ink-muted mt-base text-sm">
          Plants are replaced, not refunded — the marginal cost is a plant we have already grown. Pots,
          soil and fertiliser are refunded in money within 24 hours.
        </p>

        {order.status === 'DELIVERED' && (
          <p className="mt-base">
            <Link href={`/claim/${order.orderCode}`} className="text-primary underline">
              Report damage or a dead plant
            </Link>
          </p>
        )}
      </section>

      <section className="mt-2xl border-t border-border pt-base">
        <p className="text-label-caps text-ink-muted mt-0 mb-1">Keep this</p>
        <p className="text-ink-muted mt-0 text-sm">
          Your order code is the only thing you need to look this up again — along with the phone
          number on the order.
        </p>
        <div className="mt-sm flex gap-sm">
          <Link
            href={`/invoice/${order.orderCode}`}
            className="border-border rounded-sm border px-4 py-3 no-underline"
          >
            Open printable invoice
          </Link>
          <Link
            href="/orders/lookup"
            className="border-border rounded-sm border px-4 py-3 no-underline"
          >
            Look up an order
          </Link>
        </div>
      </section>

      {/*
        JSON-LD.

        schema.org/Order is what makes this order machine-readable by a wallet, an
        aggregator or a customer's own app. Emitted ONLY once payment is captured:
        an Order with a price and no money paid is a schema.org claim that we took
        the customer's money, and the whole reason this page exists is that we must
        not make that claim until we have.
      */}
      {paid && (
        <script
          type="application/ld+json"
          /*
           * Built from validated order data, not request input: the code is
           * CSPRNG-generated, prices are integer paise, and the name comes from the
           * order row. JSON.stringify plus escaping `<` is the standard defence
           * against a `</script>` inside a string value ending the tag early — the
           * order code cannot contain one today, but a name typed by a customer can.
           */
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Order',
              orderNumber: order.orderCode,
              orderStatus: 'https://schema.org/OrderProcessing',
              priceCurrency: 'INR',
              price: (order.revenuePaise / 100).toFixed(2),
              // ISO 8601 with an explicit offset. A bare local time on a schema.org
              // value is ambiguous to every consumer.
              orderDate: order.createdAt.toISOString(),
              invoiceNumber: invoice.invoiceNumber,
              seller: { '@type': 'Organization', name: 'Upvvan' },
              address: {
                '@type': 'PostalAddress',
                streetAddress: [order.address?.line1, order.address?.line2]
                  .filter(Boolean)
                  .join(', '),
                addressLocality: order.address?.city ?? undefined,
                addressRegion: order.address?.state ?? undefined,
                postalCode: order.pincode,
                addressCountry: 'IN',
              },
              item: items.map((item) => ({
                '@type': 'Product',
                name: item.commonName ?? 'Plant',
                sku: item.skuCode,
                quantity: item.quantity,
                /*
                 * Paise → the schema.org unit is a currency major unit. This division
                 * happens ONCE, at the serialisation boundary, and only for the
                 * structured data. Every internal value stays integer paise.
                 */
                price: (item.pricePaise / 100).toFixed(2),
              })),
            }).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </main>
  )
}

function TimelineRow({ event, last }: { event: OrderEventSummary; last: boolean }) {
  const copy = STATUS_COPY[event.status as OrderStatus]
  return (
    <li className="border-border flex gap-sm pb-base" data-status={event.status}>
      <span aria-hidden="true" className="bg-primary mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" />
      <span className={last ? '' : 'flex-1'}>
        <strong className="block">{copy.label}</strong>
        <span className="text-ink-muted block text-sm">{event.note || copy.detail}</span>
        <span className="text-ink-muted block text-xs">{indianDateTime(event.at)}</span>
      </span>
    </li>
  )
}
