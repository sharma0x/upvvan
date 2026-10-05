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
 * all four promises at equal weight. It is the single most competitive asset on
 * the page and it costs nothing to run, because all four are true by structure
 * rather than by spending:
 *
 *  · own nursery + own riders  → we never touch a courier box
 *  · free delivery, no minimum → no ₹499 threshold to unlock shipping
 *  · WhatsApp, named human    → the position nobody in the set holds
 *  · prepaid only             → stated as the reason, not as a restriction
 *
 * ── WHY THE GUARANTEE NUMBER IS 48 HOURS AND NOT 90 DAYS ────────────────────
 * It says "48-hour arrival guarantee", which is what the PDP sells today
 * (`Skus.guaranteeTier` defaults to T0). The 90-day survival promise is the
 * Phase 1 target and it is NOT printed here, because printing a number we have
 * not measured a dead-on-arrival rate against is the exact thing that produces
 * the review sites' worst complaints. When the tier ships, this string is the one
 * that changes.
 *
 * These are LINKED. Each promise has a destination that explains it in full,
 * because a promise with no link behind it is marketing copy, and the customer
 * is on a phone.
 */
const PROMISES = [
  {
    title: 'Our own nursery, our own riders',
    body: 'Two acres in Bengaluru. Picked this morning, in your hands by 7pm — no courier, no box, no return leg.',
    href: '/policies',
    cta: 'How delivery works',
  },
  {
    title: 'Free delivery, no minimum order',
    body: 'One plant costs the same to send as six. We do not set a ₹499 threshold to unlock shipping.',
    href: '/policies',
    cta: 'Delivery & returns',
  },
  {
    title: 'A human answers on WhatsApp',
    body: 'Send a photo of a plant you are worried about and a grower replies. Weekdays 10am–7pm IST.',
    href: '/grievance',
    cta: 'Message us',
  },
  {
    title: '48-hour arrival guarantee',
    body: 'Damaged or dead on arrival, we replace it — you do not pay to send it back. Prepaid only, on purpose.',
    href: '/policies',
    cta: 'Read the guarantee',
  },
] as const

export default function TrustRail() {
  return (
    <section className="bg-forest text-surface mt-2xl" aria-labelledby="trust-heading">
      <h2 id="trust-heading" className="sr-only">
        What we promise
      </h2>
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-0 px-base md:grid-cols-2 md:gap-x-xl lg:grid-cols-4">
        {PROMISES.map((p, i) => (
          <div
            key={p.title}
            className={`py-lg ${i > 0 ? 'border-surface/20 md:border-t lg:border-t-0 lg:border-l' : ''} ${
              i === 2 ? 'border-surface/20 border-t md:border-t-0' : ''
            } ${i === 1 ? 'md:border-l-0 lg:border-l' : ''} ${i === 3 ? 'border-surface/20 border-t' : ''}`}
          >
            <p className="m-0 text-label-caps text-secondary-light">{String(i + 1).padStart(2, '0')}</p>
            <h3 className="mt-xs mb-0 text-[1.05rem] leading-snug font-semibold">{p.title}</h3>
            <p className="text-surface/75 mt-sm mb-sm text-sm">{p.body}</p>
            <a
              href={p.href}
              className="text-secondary-light text-sm underline underline-offset-4 hover:text-surface"
            >
              {p.cta} →
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}