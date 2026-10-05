import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import PayClient from './PayClient'
import { db, loadOrderVerified, normaliseCode } from '@/lib/orders/db'
import { orderCookieName, verifyOrderSignature } from '@/lib/orders/cookie'
import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * `/order/<code>/pay` — where an UNPAID order gets paid.
 *
 * ── WHY THIS IS A SEPARATE PAGE AND NOT A BUTTON ────────────────────────────
 *
 * Because "we have not taken your money" is a state, not an error, and it deserves
 * its own URL. The order page can therefore LINK to it ("we have not taken your
 * money yet — pay here"), and a customer who closes the tab mid-checkout has
 * something they can bookmark. The previous design had nowhere to send them: the
 * only route was the order page, which said "Order placed" and offered no way to
 * actually pay.
 *
 * Same authorisation as the order page — the signed cookie. No phone in this URL
 * either.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pay for your order — Upvvan',
  description: 'Complete payment for your Upvvan order.',
  robots: { index: false, follow: false },
}

export default async function PayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalised = normaliseCode(code)

  const jar = await cookies()
  const signature = jar.get(orderCookieName(normalised))?.value
  if (!signature || !verifyOrderSignature(normalised, signature)) {
    // Without proof of ownership we do not even say whether the order exists.
    notFound()
  }

  const found = await loadOrderVerified(db(), normalised)
  if (!found) notFound()

  const { order } = found
  const paid = order.paymentState === 'captured'

  return (
    <main className="mx-auto max-w-[560px] px-base py-2xl">
      <p className="text-label-caps text-ink-muted mb-0">Order {order.orderCode}</p>
      <h1 className="my-sm">
        {paid ? 'Already paid' : `Pay ${formatPaise(order.revenuePaise)}`}
      </h1>

      {paid ? (
        <>
          <p role="status" data-testid="already-paid">
            This order is paid in full. Your plant is on the bench.
          </p>
          <p className="mt-base">
            <Link href={`/order/${order.orderCode}`} className="text-primary underline">
              View your order
            </Link>
          </p>
        </>
      ) : (
        <PayClient
          orderCode={order.orderCode}
          amountPaise={order.revenuePaise}
          phone={order.customerPhone ?? ''}
        />
      )}
    </main>
  )
}
