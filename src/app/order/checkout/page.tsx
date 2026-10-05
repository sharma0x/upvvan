import Link from 'next/link'

import CheckoutClient from './CheckoutClient'

/**
 * Checkout.
 *
 * Client-rendered because the cart is a sessionStorage draft and the totals shown
 * are display-only — the server re-derives every price from the SKU at order
 * placement. A client total is a convenience for the customer's own arithmetic,
 * never a source of truth.
 *
 * The three refusals the cart used to carry live on the order page now, because
 * that is where the payment decision is actually made.
 */
export const metadata = {
  title: 'Checkout — Upvvan',
  description:
    'Enter your delivery details and pay. Prepaid only — plants are replaced, never refunded.',
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-[880px] px-base py-2xl">
      <Link href="/cart" className="text-primary text-sm no-underline hover:underline">
        ← Back to cart
      </Link>
      <h1 className="my-sm">Checkout</h1>

      <CheckoutClient />
    </main>
  )
}