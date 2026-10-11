import Link from 'next/link'

import type { PriceBookTerms } from '@/lib/commerce/guarantee'

/**
 * The trust rail — four promises, one band.
 *
 * ── WHY THIS IS A BAND AND NOT FOUR BADGES ───────────────────────────────────
 * Every competitor audited carries its promises as scattered trust chips: Ugaoo
 * puts "Survival packaging · Arrives alive" four rows down under a farm story;
 * TrustBasket runs a marquee; Bloomscape buries its 30-day guarantee in a
 * support-site footer link. None of them puts the guarantees where a customer is
 * actually looking when they ask "will this survive".
 *
 * So this is a single full-bleed forest band directly under the hero, carrying
 * all four promises at equal weight. It is the most competitive asset on the
 * page and it costs nothing to run, because all four are true by structure
 * rather than by spending:
 *
 *  · own nursery + own riders  → we never touch a courier box
 *  · free delivery, no minimum → no ₹499 threshold to unlock shipping
 *  · WhatsApp, named human    → the position nobody in the set holds
 *  · prepaid only             → stated as the reason, not as a restriction
 *
 * ── WHY THE GUARANTEE COPY IS A PROP AND NOT A STRING ───────────────────────
 *
 * It used to be a literal, and the literal appeared in four places: this rail,
 * the PDP badge, the claim flow and the policies page. Ugaoo is currently
 * shipping two contradictory guarantee policies with no deprecation notice — a
 * 30-day plant guarantee on one page and a 14-day replacement window on another
 * — which is what happens when a promise is written into page copy instead of
 * read from configuration.
 *
 * So the window now arrives from `price_books.active_guarantee_tier` and this
 * component has no copy of its own to drift. When the tier moves from T0 to T1,
 * four surfaces change at once and none of them can be forgotten.
 *
 * These are LINKED. Each promise has a destination that explains it in full,
 * because a promise with no link behind it is marketing copy, and the customer
 * is on a phone.
 */
export default function TrustRail({ terms }: { terms: PriceBookTerms }) {
  const deliveryLabel =
    terms.freeDeliveryThresholdPaise > 0
      ? `Free delivery over ${rupees(terms.freeDeliveryThresholdPaise)}`
      : 'Free delivery, no minimum order'

  const promises = [
    {
      title: 'Our own nursery, our own riders',
      body: 'Grown a few kilometres away, picked the same morning, in your hands the same evening — no courier, no box, no return leg.',
      href: '/policies/shipping',
      cta: 'How delivery works',
    },
    {
      title: deliveryLabel,
      body:
        terms.freeDeliveryThresholdPaise > 0
          ? `Above ${rupees(terms.freeDeliveryThresholdPaise)} we absorb the rider's pay. Below it, ${rupees(terms.deliveryFeePaise)} — stated here rather than revealed at checkout.`
          : 'One plant costs the same to send as six. We do not set a ₹499 threshold to unlock shipping.',
      href: '/policies/shipping',
      cta: 'Delivery & returns',
    },
    {
      title: 'A human answers on WhatsApp',
      body: 'Send a photo of a plant you are worried about and a grower replies. Weekdays 10am–7pm IST.',
      href: '/contact',
      cta: 'Message us',
    },
    {
      title: terms.terms.label,
      body: terms.terms.summary,
      href: '/policies/guarantee',
      cta: 'Read the guarantee',
    },
  ] as const

  return (
    <section className="bg-forest text-surface mt-2xl" aria-labelledby="trust-heading">
      <h2 id="trust-heading" className="sr-only">
        What we promise
      </h2>
      <div className="px-base md:gap-x-xl mx-auto grid max-w-[1120px] grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-4">
        {promises.map((p, i) => (
          <div
            key={p.title}
            className={`py-lg ${i > 0 ? 'border-surface/20 md:border-t lg:border-t-0 lg:border-l' : ''} ${
              i === 2 ? 'border-surface/20 border-t md:border-t-0' : ''
            } ${i === 1 ? 'md:border-l-0 lg:border-l' : ''} ${i === 3 ? 'border-surface/20 border-t' : ''}`}
          >
            <p className="text-label-caps text-secondary-light m-0">
              {String(i + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-xs mb-0 text-[1.05rem] leading-snug font-semibold">{p.title}</h3>
            <p className="text-surface/75 mt-sm mb-sm text-sm">{p.body}</p>
            <Link
              href={p.href}
              className="text-secondary-light hover:text-surface inline-flex min-h-[44px] items-center text-sm underline underline-offset-4"
            >
              {p.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Rupees for a copy string, where the value is a threshold rather than a price
 * on an item.
 *
 * `formatPaise` is the money formatter and it is correct — but it emits
 * `₹499.00` for a non-round threshold, and a delivery threshold is quoted as a
 * whole number in every conversation about it. Integer arithmetic only; no
 * `parseInt` (ESLint bans it project-wide, rightly).
 */
function rupees(paise: number): string {
  const whole = Math.floor(paise / 100)
  const s = String(whole)
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  return `₹${rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3}`
}
