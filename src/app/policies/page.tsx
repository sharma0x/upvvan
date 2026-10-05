import Link from 'next/link'

/**
 * Policies — the customer-facing rules, in one place.
 *
 * ── WHY THIS PAGE IS NOT OPTIONAL ───────────────────────────────────────────
 *
 * Every claim here is a commitment we make and must be able to keep, and several
 * of them exist because every competitor does the opposite:
 *
 *  · Prepaid only. A COD return leg is 25–30 days and the plant is unsellable by
 *    the time it arrives — a total write-off. So there is no COD affordance, and
 *    "pay the rider on delivery" is not a thing that can be requested.
 *  · Plants are replaced, never refunded. The marginal cost of a replacement is a
 *    plant we have already grown and would otherwise discard. Competitors
 *    (Ugaoo, Urvann) default to wallet credit or coupon, which suppresses the
 *    complaint and starves the DOA model of the feedback it depends on.
 *  · Consumables — pots, soil, fertiliser — ARE refunded in money within 24
 *    hours, because there is no mortality risk involved.
 *  · Guarantee is 48 hours at launch. T1 (30 days) and T2 (90 days) are behind
 *    flags that default OFF, and the database refuses an order carrying a tier
 *    the city's price book has not enabled. Shipping a 90-day promise we cannot
 *    price is the specific mistake being prevented.
 *
 * The numbers are not hardcoded anywhere else — the tiers live in `price_books`
 * and the window is enforced by a trigger.
 */
export const metadata = {
  title: 'Policies',
}

export default function PoliciesPage() {
  return (
    <main id="main" tabIndex={-1} className="px-base py-2xl mx-auto max-w-[640px]">
      <h1 className="mt-0">Policies</h1>

      <h2 className="mt-xl mb-xs">Payment</h2>
      <p className="text-ink-muted mt-0">
        <strong className="text-ink">Prepaid only.</strong> We do not offer cash on delivery,
        and there is no request option for it at checkout or at the door. A COD parcel takes 25–30
        days to come back, and a returned plant is unsellable — so we do not create the return leg
        in the first place.
      </p>

      <h2 className="mt-xl mb-xs">Delivery</h2>
      <p className="text-ink-muted mt-0">
        We deliver only to pincodes we have explicitly marked serviceable. If your pincode is not
        covered we will tell you before you pay, rather than after — a cancelled order is worse for
        both of us than an honest &ldquo;not yet&rdquo;.
      </p>

      <h2 className="mt-xl mb-xs">The 48-hour guarantee</h2>
      <p className="text-ink-muted mt-0">
        If a plant arrives damaged or dead, tell us within{' '}
        <strong className="text-ink">48 hours of delivery</strong> and we replace it. Not a
        voucher, not store credit — the actual plant.
      </p>
      <p className="mt-sm text-ink-muted">
        We are not yet promising 30 or 90 days. Our damage-on-arrival rate is an assumption, not a
        measurement, and no Indian seller publishes one. We will lengthen this window when we have
        the data to price it — not before.
      </p>

      <h2 className="mt-xl mb-xs">Replacements and refunds</h2>
      <ul className="gap-xs pl-md text-ink-muted mt-0 flex list-disc flex-col">
        <li>
          <strong className="text-ink">Plants: replaced, never refunded.</strong> The
          marginal cost is a plant we have already grown.
        </li>
        <li>
          <strong className="text-ink">
            Pots, soil, fertiliser: refunded in money within 24 hours.
          </strong>{' '}
          No mortality risk, so no reason to delay or substitute.
        </li>
      </ul>

      <h2 className="mt-xl mb-xs">Heat waves</h2>
      <p className="text-ink-muted mt-0">
        Between March and June, Bengaluru reaches 40–46&deg;C. We do not stop selling — we
        substitute hardy species and exclude the ones that cannot take it. Every listing states its
        own dimensions so you can judge what is arriving.
      </p>

      <h2 className="mt-xl mb-xs">Complaints</h2>
      <p className="text-ink-muted mt-0">
        <Link href="/grievance" className="text-primary underline">
          Grievance redressal
        </Link>{' '}
        — a named officer, a ticket number, acknowledgement within 48 hours, resolution within 30
        days.
      </p>

      <h2 className="mt-xl mb-xs">Your data</h2>
      <p className="text-ink-muted mt-0">
        We hold your phone number and delivery address, and nothing else we do not need. Consent and
        retention are handled under the DPDP Act 2023, whose substantial provisions take effect on
        13 May 2027.
      </p>
    </main>
  )
}
