import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import CartClient from '@/components/catalogue/CartClient'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * Cart.
 *
 * Client-rendered because the cart is a sessionStorage draft until checkout
 * creates a real order. That is deliberate: nothing here is authoritative, and
 * the server re-derives every price from the SKU at order-placement time. A
 * client total is a display convenience, never a source of truth — otherwise a
 * customer can simply edit the number in devtools.
 *
 * The three refusals live on this screen, because this is where a customer looks
 * for them:
 *   · No COD — a COD return leg is 25–30 days and the plant is unsellable on
 *     return, so it is a total write-off.
 *   · Plants are replacement-only, never refunded — the marginal cost of a
 *     replacement is a plant already grown.
 *   · No orders to an unserviceable pincode — over-promising geography is the
 *     loudest failure across every competitor we researched.
 *
 * And now the guarantee window comes from the price book rather than being typed
 * here, so the cart, the PDP, the trust rail and the policy page cannot
 * disagree about how long the cover lasts.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Your cart', robots: { index: false, follow: false } }
}

export default async function CartPage() {
  const storefront = await loadStorefront()
  const terms = storefront.state === 'ready' ? storefront.terms : null

  return (
    <main id="main" tabIndex={-1} className="px-base py-2xl mx-auto max-w-[880px]">
      <a href="/plants" className="text-primary text-sm no-underline hover:underline">
        ← Continue shopping
      </a>
      <h1 className="my-sm">Your cart</h1>

      {storefront.state === 'no-city' ? (
        <NotOpenYet heading="Your cart" />
      ) : (
        <CartClient freeDeliveryThresholdPaise={terms!.freeDeliveryThresholdPaise} />
      )}

      <section className="border-border text-ink-muted mt-2xl pt-base border-t text-sm">
        <h2 className="text-label-caps mt-0">Before you pay</h2>
        <ul className="gap-xs m-0 flex list-none flex-col p-0">
          <li>
            <strong className="text-ink">Prepaid only.</strong> We do not offer cash on delivery. A
            COD return takes 25–30 days and the plant is unsellable by the time it comes back.
          </li>
          <li>
            <strong className="text-ink">Plants are replaced, not refunded.</strong> If one arrives
            damaged, send us a photo and we send another — you do not pay to ship anything back.
            Pots, soil and feed are refunded in money within 24 hours.
          </li>
          {terms && (
            <li>
              <strong className="text-ink">{terms.terms.label}.</strong> {terms.terms.remedy}
            </li>
          )}
        </ul>

        {/*
          The account upsell, AFTER the purchase, never before it.

          The one competitor documented as requiring signup before checkout has the
          worst complaint corpus in the set. So we do not gate the sale — but a
          customer who has just bought something has a real reason to want it
          remembered, and "save this plant's care schedule and get the guarantee
          registered automatically" is a genuine benefit rather than a data grab.
        */}
        <p className="mt-base mb-0">
          <Link href="/sign-in" className="text-primary underline">
            Sign in with your mobile number
          </Link>{' '}
          to keep your order history, addresses and guarantee registrations in one place. You do not
          need an account to buy.
        </p>
      </section>
    </main>
  )
}
