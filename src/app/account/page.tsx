import Link from 'next/link'

import { pageMetadata } from '@/app/metadata'
import { listCustomerOrders, type AccountOrder } from '@/lib/accounts/orders'
import { adoptGuestOrders, loadAccountSummary, loadProfile } from '@/lib/accounts/profile'
import { formatPaise } from '@/lib/catalogue/pricing'
import { STATUS_COPY } from '@/lib/orders/status'

/**
 * `/account` — the customer's dashboard.
 *
 * ── WHY THIS PAGE IS NOT A CAPABILITY PAGE LIKE `/order/[code]` ─────────────
 *
 * `/order/[code]` is reachable without signing in, because the order code is an
 * unguessable capability and it deliberately shows nothing but what the buyer
 * already knows. That is the right trade for a guest checkout.
 *
 * This page is different in kind: it is the account. It resolves the customer
 * from the SESSION (in the layout), never from a parameter, so there is no
 * "customer id" a customer could edit to read someone else's orders. See
 * `src/lib/accounts/orders.ts` for why that constraint is enforced at the data
 * layer rather than here.
 *
 * ── WHAT WAS WRONG WITH IT, AND WHY THE FIX IS MOSTLY ELSEWHERE ─────────────
 *
 * Three separate faults, and only one of them was on this page:
 *
 *   1. IT WAS EMPTY FOR EVERYONE. `/account` filters on `orders.customer_id`, and
 *      `POST /api/orders` never wrote that column — guest checkout has no
 *      session to read it from. 74 of 75 orders in the database had no
 *      `customer_id` at all, so this page rendered "No orders yet" to a customer
 *      who had just bought a plant. Fixed in `lib/accounts/orders.ts` +
 *      `adoptGuestOrders()`, not here.
 *
 *   2. IT SHOWED RAW ENUM LABELS. It carried its own `STATUS_COPY` keyed on
 *      `PLACED` / `DISPATCHED` / `REFUNDED` — three names the database cannot
 *      produce and one it never had — so a real order rendered as
 *      `OUT_FOR_DELIVERY · delivering to 560001`. It now imports the canonical
 *      `STATUS_COPY`, so there is no second copy left to drift.
 *
 *   3. THERE WAS NO RECEIPT. There was no link to `/invoice/<code>` anywhere on
 *      this page, and even if there had been, `/invoice/<code>` authorises on a
 *      signed order cookie that a signed-in customer does not have — they never
 *      did the code+phone lookup. So a customer who had paid could not download
 *      their invoice from the one page designed for them. Fixed in
 *      `lib/orders/access.ts`, and surfaced below.
 *
 * ── WHY IT IS `force-dynamic` ───────────────────────────────────────────────
 *
 * A statically rendered order history would bake ONE customer's orders into the
 * HTML served to everyone. Per-request rendering is the correctness requirement,
 * not a performance choice.
 */
export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  'Your orders',
  'Every order you have placed with Upvvan, with what was in it, what it cost and where it is.',
  '/account',
)

/**
 * A one-line "where is it" for the summary at the top of an order card.
 *
 * Derived from the dispatch columns rather than from `status`, because the two
 * answer different questions and only the dispatch knows the second one: an order
 * can be PAID (money in, plant reserved, no rider) or it can be PACKED (rider
 * assigned, parcel made up). Both say "not delivered yet", and a customer reading
 * "Paid — we are packing" while a rider has been assigned learns nothing useful.
 */
function progressLine(order: AccountOrder): string {
  if (order.status === 'CANCELLED') return 'Cancelled'
  if (order.deliveredAt) return 'Delivered'
  if (order.outForDeliveryAt) return 'On the road to you'
  if (order.pickedUpAt) return 'With your rider'
  if (order.paymentState !== 'captured') return 'Waiting for payment'
  return 'At the nursery — choosing a rider'
}

/**
 * The one status line on an order card.
 *
 * `STATUS_COPY.label` on its own is not enough, and pairing it with the progress
 * line produced:
 *
 *     Payment received · At the nursery — a rider is being assigned · 560001
 *
 * Two clauses saying the same thing, then a pincode. The lifecycle label already
 * answers "where is my order"; the progress line adds something only when the two
 * disagree — which is exactly when a rider has been assigned.
 *
 * So the label and the pincode always appear, and the progress line appears only
 * when it is saying something the label is not.
 */
function statusLine(order: AccountOrder): string {
  const label = STATUS_COPY[order.status].label
  const detail = progressLine(order)
  const where = `delivering to ${order.pincode}`

  if (detail === label || detail === 'Waiting for payment') return `${label} · ${where}`
  return `${label} · ${detail} · ${where}`
}

export default async function AccountPage() {
  /*
   * Adopt first, then read.
   *
   * A guest who has now signed in has orders that do not belong to them yet. The
   * link is by verified phone (see `adoptGuestOrders`), it only ever fills a
   * NULL `customer_id`, and it is one indexed UPDATE — so running it on every
   * account view is free after the first time and self-healing if a customer
   * signs in on a second device.
   */
  await adoptGuestOrders()

  const [orders, summary, profile] = await Promise.all([
    listCustomerOrders(),
    loadAccountSummary(),
    loadProfile(),
  ])

  const active = orders.find((order) => summary.activeOrderCode === order.orderCode) ?? null
  const needsName = profile?.nameIsPlaceholder ?? false

  return (
    <main>
      <h2 className="mb-xs mt-0">Your orders</h2>

      {/*
        ── THE COUNTS ──────────────────────────────────────────────────────────
        Four numbers, in the order a person actually wants them: how much you have
        bought, how much of it has arrived, what is moving right now, and what
        you have set aside for later.

        This is the `counts` object Pinterest's `/v1/me/` returns alongside a
        profile, translated to what a plant buyer's counts mean. The alternative —
        a bare list — makes a customer open every order to answer "have I bought
        anything from here before?", which is the first question anyone new to a
        shop asks themselves.
      */}
      {summary.ordersPlaced > 0 && (
        <dl
          data-testid="account-summary"
          className="gap-sm mb-xl m-0 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { label: 'Orders', value: String(summary.ordersPlaced) },
            { label: 'Plants delivered', value: String(summary.plantsDelivered) },
            { label: 'Saved plants', value: String(summary.savedItems) },
            { label: 'Lifetime spend', value: formatPaise(summary.lifetimeSpendPaise) },
          ].map((tile) => (
            <div
              key={tile.label}
              className="border-border bg-surface-raised p-base rounded-md border"
            >
              <dt className="text-label-caps text-ink-muted">{tile.label}</dt>
              <dd className="font-h2 mt-xs mb-0 text-xl">{tile.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/*
        ── THE NAME WE DO NOT HAVE ─────────────────────────────────────────────
        Asked once, in one sentence, with a link — not a modal, not a gate. The
        customer has already bought something; interrupting that flow to collect a
        name is the account-wall mistake this project decided not to make.

        It appears only while `user.name` is still the phone number better-auth
        wrote at signup, so it disappears the moment they answer and never
        returns.
      */}
      {needsName && (
        <p
          data-testid="account-name-prompt"
          className="border-border bg-surface-raised p-base rounded-md border"
        >
          <span className="block">
            Your account is your mobile number. Add your name and we can greet you properly and
            print it on your invoice.
          </span>
          <Link href="/account/profile" className="text-primary mt-xs inline-block underline">
            Add your name
          </Link>
        </p>
      )}

      {active && (
        <section
          aria-labelledby="active-heading"
          data-testid="account-active-order"
          className="border-primary bg-surface-raised mb-xl p-lg rounded-md border"
        >
          <h3 id="active-heading" className="mb-xs mt-0 text-base">
            {/*
              Not "On its way to you" unconditionally. That was the heading above an
              order whose plant was still at the nursery with no rider assigned —
              which is the one thing a customer checking on a parcel most wants to
              know, and the last thing to state optimistically.
            */}
            {active.outForDeliveryAt
              ? 'On the road to you'
              : active.pickedUpAt
                ? 'With your rider'
                : active.paymentState === 'captured'
                  ? 'At the nursery'
                  : 'Waiting for payment'}
          </h3>
          <p className="m-0">
            <Link href={`/order/${active.orderCode}`} className="text-primary font-semibold">
              {active.orderCode}
            </Link>
            {/*
              The detail line, not the heading restated. "At the nursery — choosing
              a rider" under a heading that already says "At the nursery" is two
              sentences saying one thing, and the second one is the one a customer
              scanning the page reads.
            */}
            {active.paymentState !== 'captured' && (
              <span className="text-ink-muted">
                {' · pay from '}
                <Link href={`/order/${active.orderCode}/pay`} className="text-primary underline">
                  the payment page
                </Link>
              </span>
            )}
          </p>
          <p className="text-ink-muted mt-xs mb-0 text-sm">
            {active.items.map((item) => item.name).join(', ')} · delivering to {active.pincode}
            {active.paymentState === 'captured' && !active.outForDeliveryAt && !active.pickedUpAt
              ? ' · we are choosing a rider'
              : ''}
          </p>
        </section>
      )}

      {/*
        The empty state is the one most customers will see first, because guest
        checkout does not require an account. It says what to do next rather than
        apologising for an absence — an empty table with no next step reads as a
        broken feature.
      */}
      {orders.length === 0 ? (
        <div className="border-border bg-surface-raised p-lg rounded-md border">
          <p className="mt-0">No orders yet.</p>
          <p className="text-ink-muted mb-0">
            You can check out as a guest — an account is only needed to see your order history here
            and to save addresses.
          </p>
          <Link href="/" className="text-primary mt-base inline-block underline">
            Browse plants
          </Link>
        </div>
      ) : (
        <ol className="gap-base m-0 flex list-none flex-col p-0">
          {orders.map((order) => (
            <li key={order.orderCode} className="border-border p-base rounded-md border">
              <div className="gap-xs flex flex-wrap items-baseline justify-between">
                <Link
                  href={`/order/${order.orderCode}`}
                  className="text-primary font-semibold no-underline"
                >
                  {order.orderCode}
                </Link>
                <span className="text-ink-muted text-sm">
                  {new Intl.DateTimeFormat('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata',
                  }).format(order.createdAt)}
                </span>
              </div>

              <p className="text-ink-muted mt-xs mb-0 text-sm">
                {/*
                  The canonical copy, imported. The previous local table mapped
                  names the enum cannot produce, so a real order rendered its raw
                  storage value to the customer.
                */}
                {statusLine(order)}
              </p>

              {/*
                A claim the customer filed, with its reference.

                `order_claims` has no Payload collection and no admin page, so
                before this the only place a claim reference existed was an e-mail.
                A customer who lost that e-mail had no way to ask "what happened to
                my claim?" — and this project sells a human who answers.
              */}
              {order.claimCode && (
                <p className="mt-xs mb-0 text-sm">
                  <span className="text-label-caps text-clay">Claim {order.claimCode}</span>{' '}
                  <span className="text-ink-muted">
                    {order.claimStatus === 'OPEN'
                      ? '— with us, a grower is looking at it'
                      : `— ${(order.claimStatus ?? '').toLowerCase().replace(/_/g, ' ')}`}
                  </span>
                </p>
              )}

              {order.items.length > 0 && (
                <ul className="text-ink-muted mt-xs gap-xs mb-0 flex list-none flex-col p-0 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.name}
                      {item.sizeTier ? ` · ${item.sizeTier}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-base mb-0 font-semibold">{formatPaise(order.revenuePaise)}</p>

              {/*
                ── THE RECEIPT ────────────────────────────────────────────────────

                The affordance the page did not have at all.

                Two links, because there are two different jobs and collapsing them
                is how a customer ends up printing a screen instead of a document:

                  · View    — the on-screen receipt and delivery timeline.
                  · Download — a file they can attach to an expense claim or keep.

                Gated on `payment_state = 'captured'`. The receipt is proof of
                payment for a transaction that has completed, so it is available
                from the moment money moves, not from the moment the parcel lands.
                A customer who needs the GST invoice for a delivered order has
                needed it since the day they paid.
              */}
              <div className="border-border mt-base gap-sm pt-sm flex flex-wrap border-t">
                <Link
                  href={`/order/${order.orderCode}`}
                  className="text-primary inline-flex min-h-[44px] items-center underline"
                >
                  View order
                </Link>
                {order.canDownloadReceipt && (
                  <>
                    <a
                      href={`/api/orders/${order.orderCode}/receipt`}
                      data-testid="download-receipt"
                      className="text-primary inline-flex min-h-[44px] items-center underline"
                    >
                      Download receipt
                    </a>
                    <a
                      href={`/invoice/${order.orderCode}`}
                      className="text-ink-muted inline-flex min-h-[44px] items-center underline"
                    >
                      Printable tax invoice
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
