import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { config } from '@/lib/config'
import CheckoutClient from './CheckoutClient'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import { FORM } from '@/components/layout/containers'

/**
 * Checkout.
 *
 * Client-rendered because the cart is a sessionStorage draft and the totals shown
 * are display-only — the server re-derives every price from the SKU at order
 * placement. A client total is a convenience for the customer's own arithmetic,
 * never a source of truth.
 *
 * The three refusals the cart used to carry live here instead, because this is
 * where the payment decision is made.
 *
 * ── WHY EVERY COMMERCIAL VALUE IS A PROP ────────────────────────────────────
 * Delivery threshold, delivery fee and tax rate all come from `price_books` and
 * `config`, and are passed in rather than imported into the client component. Two
 * reasons: a client component importing `config` drags the whole env-backed
 * config object — including the compliance block — into the browser bundle; and a
 * prop makes it obvious to a reader which of these numbers is a commercial
 * decision an operator can change.
 *
 * `id="main" tabIndex={-1}` was missing here while every other page had it. The
 * skip link in the root layout targets `#main`, so with no such element the skip
 * link silently moved focus to the body — the exact thing it exists to prevent,
 * on the page where a keyboard user's most likely destination is the pay button.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout',
    description:
      'Enter your delivery details and pay. Prepaid only — plants are replaced, never refunded.',
    robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Checkout" />

  const { terms, cityName } = storefront

  return (
    <main id="main" tabIndex={-1} className={`py-2xl ${FORM}`}>
      <Link href="/cart" className="text-primary text-sm no-underline hover:underline">
        ← Back to cart
      </Link>
      <h1 className="my-sm">Checkout</h1>
      <p className="text-ink-muted mt-0">
        No account needed. Enter where it is going and pay. You will get a message when your plant
        leaves the bench and again when a rider is on the way.
      </p>

      <div className="mt-lg">
        <CheckoutClient
          freeDeliveryThresholdPaise={terms.freeDeliveryThresholdPaise}
          deliveryFeePaise={terms.deliveryFeePaise}
          taxRateBp={storefront.taxRateBp}
          enableE2E={config.features.enableE2E}
          cityName={cityName}
          stateName={storefront.stateName}
        />
      </div>
    </main>
  )
}
