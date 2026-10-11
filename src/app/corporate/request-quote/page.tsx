import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { formatPaise } from '@/lib/catalogue/pricing'
import {
  CORPORATE_MOQ,
  MINIMUM_BOOKING_DAYS,
  VOLUME_TIERS,
  earliestDeliveryDate,
  latestDeliveryDate,
  leadTimeDays,
} from '@/lib/commerce/corporate'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import QuoteForm from './QuoteForm'

/**
 * Request a quote — `/corporate/request-quote`.
 *
 * ── WHY THE FORM IS SELF-SERVE AND NOT A CALL ────────────────────────────────
 *
 * FNP's corporate funnel is four steps and two of them are people: enquiry form,
 * overview call, choose, deliver. Kyari ends every page with a phone number. So
 * competing on reachability is unwinnable — they are extremely reachable, they
 * are just opaque about what you are buying.
 *
 * What is winnable is the opposite. A procurement manager who has spent a morning
 * on three phone calls has not decided anything, and the way to beat that is to be
 * the supplier they do NOT have to call. So the first reply is the quote, in
 * writing, with the price — and the phone number still exists for whoever wants
 * it, after the document has arrived rather than before.
 *
 * ── WHY THIS PAGE RESTATES THE LADDER BESIDE THE FORM ────────────────────────
 *
 * A buyer who arrives here from a search has not read `/corporate`, and sending
 * them back to read it before they can type a number is a step that loses people.
 * The five bands are reproduced in full, from the same module, so the number in
 * the form and the number in the tab behind it are the same number.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Request a corporate quote',
    description:
      'Tell us the quantity and see the tier, the total and the lead time before you send anything. A quote costs nothing and lands within one working day.',
    alternates: { canonical: '/corporate/request-quote' },
  }
}

export default async function RequestQuotePage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Request a quote" />

  /*
   * The date bounds are computed HERE, on the server, and handed to the client
   * component as props.
   *
   * Computing them inside the client component would work right up to a
   * hydration mismatch: `Date.now()` runs on the server during the SSR pass and
   * again in the browser, and a buyer loading the page across IST midnight gets
   * two different `min` values for the same document. The value is a prop, so it
   * is serialised into the RSC payload and both renders read the identical
   * string. The cost — a page served before midnight keeps yesterday's bound until
   * it is reloaded — is worth far less than a hydration error in the console.
   */
  const earliestDate = earliestDeliveryDate()
  const latestDate = latestDeliveryDate()

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs
        trail={[
          { href: '/', label: 'Home' },
          { href: '/corporate', label: 'Corporate gifting' },
          { label: 'Request a quote' },
        ]}
      />

      <header className="mt-lg">
        <h1 className="mb-0">Request a quote</h1>
        <p className="text-ink-muted mt-sm mb-0 max-w-[62ch] text-[1.05rem] leading-relaxed">
          About two minutes, and it costs nothing. Put your quantity in and you will see the tier,
          the order value and the delivery lead time on this page before you send a single field.
          The quote comes back as a written document with the GST itemised — not a request for a
          call.
        </p>
      </header>

      {/*
        The commitment, as numbers, at the top and before the form.

        `/contact` already publishes a response-time SLA and this form is a
        higher-value, lower-volume version of the same promise, so it gets the same
        treatment: a number, not "we aim to respond quickly". Publishing a figure we
        have not measured is how a support promise becomes a complaint, so it is
        deliberately the one we can keep from a two-person bench.
      */}
      <section className="border-primary bg-brand-soft mt-xl p-lg rounded-md border">
        <h2 className="mb-base mt-0">What happens after you press send</h2>
        <dl className="gap-base m-0 grid sm:grid-cols-3">
          <div>
            <dt className="text-label-caps text-ink-muted">A written quote</dt>
            <dd className="m-0 text-[1.15rem] font-semibold">within 1 working day</dd>
            <dd className="text-ink-muted m-0 text-sm">
              The same day if you send this before noon. Itemised per plant, with GST as its own
              line.
            </dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Charged</dt>
            <dd className="m-0 text-[1.15rem] font-semibold">nothing</dd>
            <dd className="text-ink-muted m-0 text-sm">
              No card details on this form. A quote is a document, not a commitment.
            </dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Shortest run we work to</dt>
            <dd className="m-0 text-[1.15rem] font-semibold">
              {leadTimeDays(CORPORATE_MOQ)} working days
            </dd>
            <dd className="text-ink-muted m-0 text-sm">
              And at least {MINIMUM_BOOKING_DAYS} days&rsquo; notice, because a plant that is cut on
              Monday is not a plant that is boxed on Monday.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-3xl">
        <h2 className="mt-0">The form</h2>
        <p className="text-ink-muted mt-xs max-w-[62ch] text-sm">
          Everything with a star is required. The two optional boxes — a budget and a date — are
          genuinely optional: a buyer who has not been given either can still ask, and we would
          rather have the enquiry than a made-up figure.
        </p>
        <QuoteForm earliestDate={earliestDate} latestDate={latestDate} />
      </section>

      {/*
        The ladder, in full, directly under the form.

        Reproduced rather than linked because this is the page a buyer is most
        likely to screenshot into an approval request, and a screenshot of a link
        is not a screenshot of a price.
      */}
      <section className="mt-3xl">
        <h2 className="mt-0">The published price list</h2>
        <p className="text-ink-muted mt-xs max-w-[62ch]">
          All prices per plant, GST included, minimum {CORPORATE_MOQ} plants. The estimate above is
          computed from this same table — there is no second price list.
        </p>
        <div className="border-border mt-base overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="text-ink-muted px-base py-sm text-left">
              Corporate plant pricing per plant, GST included.
            </caption>
            <thead>
              <tr className="border-border bg-surface-raised border-b">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Plants
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Per plant
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Working days
                </th>
              </tr>
            </thead>
            <tbody>
              {VOLUME_TIERS.map((tier) => (
                <tr key={tier.from} className="border-border border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    {tier.label}
                  </th>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    {formatPaise(tier.perUnitPaise)}
                  </td>
                  <td className="text-ink-muted px-3 py-2.5 whitespace-nowrap">
                    {leadTimeDays(tier.from)} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-ink-muted mt-xl mb-0 text-sm">
        Prefer to read first?{' '}
        <Link href="/corporate" className="text-primary underline">
          What we cannot do, and why it is written down
        </Link>{' '}
        — pot printing lead times, split delivery, {storefront.cityName} only, weekday office
        delivery and no recurring plans. Better to know before you fill anything in.
      </p>
    </main>
  )
}
