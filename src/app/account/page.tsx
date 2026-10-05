import Link from 'next/link'

import { pageMetadata } from '@/app/metadata'
import { listCustomerOrders } from '@/lib/accounts/addresses'
import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * Order history.
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
 * `src/lib/accounts/addresses.ts` for why that constraint is enforced at the
 * data layer rather than here.
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
  'Every order you have placed with Upvvan, with what was in it and what it cost.',
  '/account',
)

/** Human wording for the order lifecycle. */
const STATUS_COPY: Record<string, string> = {
  PLACED: 'Placed — waiting for payment',
  PAID: 'Paid — we are packing',
  PACKED: 'Packed',
  DISPATCHED: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export default async function AccountPage() {
  const orders = await listCustomerOrders()

  return (
    <main>
      <h2 className="mt-0 mb-xs">Your orders</h2>

      {/*
        The empty state is the one most customers will see first, because guest
        checkout does not require an account. It says what to do next rather than
        apologising for an absence — an empty table with no next step reads as a
        broken feature.
      */}
      {orders.length === 0 ? (
        <div className="border-border bg-surface-raised rounded-md border p-lg">
          <p className="mt-0">No orders yet.</p>
          <p className="text-ink-muted mb-0">
            You can check out as a guest — an account is only needed to see your
            order history here and to save addresses.
          </p>
          <Link href="/" className="text-primary mt-base inline-block underline">
            Browse plants
          </Link>
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-base p-0">
          {orders.map((order) => (
            <li key={order.orderCode} className="border-border rounded-md border p-base">
              <div className="flex flex-wrap items-baseline justify-between gap-xs">
                <Link
                  href={`/order/${order.orderCode}`}
                  className="text-primary font-semibold no-underline"
                >
                  {order.orderCode}
                </Link>
                <span className="text-ink-muted text-sm">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <p className="text-ink-muted mt-xs mb-0 text-sm">
                {STATUS_COPY[order.status] ?? order.status} · delivering to {order.pincode}
              </p>

              {order.items.length > 0 && (
                <ul className="text-ink-muted mt-xs mb-0 flex list-none flex-col gap-xs p-0 text-sm">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.name}
                      {item.sizeTier ? ` · ${item.sizeTier}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-base mb-0 font-semibold">{formatPaise(order.revenuePaise)}</p>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}