import Link from 'next/link'

import CartClient from '@/components/catalogue/CartClient'

/**
 * Cart.
 *
 * Client-rendered because the cart is a sessionStorage draft until checkout
 * creates a real order. That is deliberate: nothing here is authoritative, and
 * the server re-derives every price from the SKU at order-placement time. A
 * client total is a display convenience, never a source of truth — otherwise a
 * customer can simply edit the number in devtools.
 *
 * The three refusals live on this screen, because this is where a customer
 * looks for them:
 *   · No COD — a COD return leg is 25–30 days and the plant is unsellable on
 *     return, so it is a total write-off.
 *   · Plants are replacement-only, never refunded — the marginal cost of a
 *     replacement is a plant already grown.
 *   · No orders to an unserviceable pincode — over-promising geography is the
 *     loudest failure across every competitor we researched.
 */
export default function CartPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-[880px] px-base py-2xl">
      <Link href="/" className="text-sm text-primary no-underline hover:underline">
        ← Continue shopping
      </Link>
      <h1 className="my-sm">Your cart</h1>

      <CartClient />

      <section className="mt-2xl border-t border-border pt-base text-sm text-ink-muted">
        <h2 className="mt-0 text-label-caps">Before you pay</h2>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          <li>
            <strong>Prepaid only.</strong> We do not offer cash on delivery. A COD
            return takes 25–30 days and the plant is unsellable by the time it
            comes back.
          </li>
          <li>
            <strong>Plants are replaced, not refunded.</strong> If one arrives
            damaged, send us the unboxing video and we send another. Pots, soil and
            feed are refunded in money within 24 hours.
          </li>
          <li>
            <strong>48-hour arrival guarantee.</strong> Damaged or dead on arrival
            within 48 hours of delivery, we replace it.
          </li>
        </ul>
      </section>
    </main>
  )
}