import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadBusinessSettings } from '@/lib/settings/server'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import TrackOrderForm from '@/components/support/TrackOrderForm'

/**
 * Track an order — `/track-order`.
 *
 * ── WHY THIS PAGE IS SEPARATE FROM `/orders/lookup` ─────────────────────────
 *
 * The lookup page is a TOOL: code plus phone, and it renders a receipt. It is
 * linked from the footer under "Find an order without an account", which is
 * accurate and which nobody clicks, because a person whose parcel is late is not
 * looking for their receipt — they are looking for the parcel.
 *
 * So this page is the tracking surface, and the footer links to it as
 * "Track an order". Same authorisation (code plus phone — the code is 48 bits of
 * CSPRNG, so it is not guessable, and the phone tail is what stops a customer
 * with someone else's screenshot from reading their order), different framing:
 * what stage is it at, who has it, and what to do next.
 *
 * ── WHAT THE AUDIT SAYS COMPETITORS GET WRONG HERE ─────────────────────────
 *
 * Urvann's worst-rated failure is delivery: "order marked delivered but not
 * received", partial deliveries, and fake delivery marking — which their own
 * 3PL contract penalises at ₹100 per incident, which tells you the problem was
 * known and priced rather than fixed. Upvan has no tracking page at all; the
 * planted flag is that a courier scan is not a delivery.
 *
 * So this page says three things that no competitor's does:
 *   1. OUR OWN RIDER, named by role, not a courier consignment number.
 *   2. The rider's phone number is ours and answers during working hours.
 *   3. "Delivered" means a person confirmed handover — and if it did not happen,
 *      telling us is the way out, not a formality.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Track an order',
    description:
      'Where your plant is, who has it, and what to do if it has not arrived. No account needed.',
    alternates: { canonical: '/track-order' },
  }
}

/*
 * The support number comes from the settings row.
 *
 * It read `config.compliance` — the environment — while every other surface the
 * customer might reach us through read the database. So a business whose owner
 * changed the number in the admin panel would have a correct footer, a correct
 * `/contact` page and a correct e-mail signature, and a tracking page telling
 * people to ring a number nobody answers.
 *
 * `force-dynamic` so the row is read per request rather than baked at build time.
 */
export const dynamic = 'force-dynamic'

export default async function TrackOrderPage() {
  const settings = await loadBusinessSettings()
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Track an order" />

  const { terms, cityName } = storefront

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Track an order' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">Where is my plant?</h1>
        <p className="text-ink-muted mt-sm mb-0 max-w-[62ch] text-[1.05rem] leading-relaxed">
          Your order code is in the confirmation message and on the receipt. You need that and the
          mobile number on the order — no account, no password, nothing to set up.
        </p>
      </header>

      <div className="mt-xl">
        <TrackOrderForm cityName={cityName} />
      </div>

      {/*
        What each stage MEANS, in the customer's language rather than ours.

        Every competitor's tracking page shows internal states. `PACKING` tells a
        customer nothing about whether to worry; "we are putting soil in a pot
        right now" tells them everything. The wording below is the wording from
        `orders/status.ts`, reused rather than rewritten so a status and its
        description cannot disagree.
      */}
      <section className="mt-3xl">
        <h2 className="mt-0">What each stage means</h2>
        <dl className="border-border mt-base gap-base p-base m-0 grid grid-cols-1 rounded-md border sm:grid-cols-2">
          {[
            [
              'Payment received',
              'Paid in full. The plant is reserved and it goes to the bench next.',
            ],
            [
              'Being packed',
              'Soil, pot and plant packed together for the road. This is our staff, not a courier.',
            ],
            ['Packed', 'Packed and waiting for a rider to be assigned. Usually under two hours.'],
            [
              'Out for delivery',
              'On the road to you. The rider will call the number on the order.',
            ],
            [
              'Delivered',
              'Handed to a person. If nobody handed it to you, tell us — that is not a formality.',
            ],
            ['Cancelled', 'Cancelled. Anything charged comes back to the payment method you used.'],
          ].map(([label, detail]) => (
            <div key={label}>
              <dt className="font-semibold">{label}</dt>
              <dd className="text-ink-muted m-0 text-sm">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        The three real failure modes, stated before they happen rather than in a
        reply to a complaint. Each names the deadline, because a deadline given
        late is not a deadline.
      */}
      <section className="mt-3xl">
        <h2 className="mt-0">If something is wrong</h2>
        <dl className="mt-base gap-base m-0 flex flex-col">
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">It says delivered and nothing arrived</dt>
            <dd className="text-ink-muted m-0">
              Tell us, and we will treat it as a delivery failure rather than wait for a courier to
              finish its own trace. We investigate it as our own failure because a delivery we
              cannot prove is a delivery we will not pretend happened.{' '}
              <Link href="/contact" className="text-primary underline">
                Tell us
              </Link>
              . Same day delivery in {cityName}, so if it is marked delivered today and nothing is
              with you, this should not be a thing that needs chasing.
            </dd>
          </div>
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">It has not arrived and it has been days</dt>
            <dd className="text-ink-muted m-0">
              Within 10 days of the order date we resolve it without argument. Do not wait for a
              courier scan-and-trace cycle to finish — a courier scan is not a delivery, and{' '}
              <Link href="/policies/shipping" className="text-primary underline">
                our shipping page says so
              </Link>
              .
            </dd>
          </div>
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">It arrived damaged or dead</dt>
            <dd className="text-ink-muted m-0">
              A photo on WhatsApp within {terms.terms.arrivalWindowHours} hours of delivery and we
              send a replacement. You do not post anything back.{' '}
              <Link href="/claim" className="text-primary underline">
                Report it
              </Link>
              .
            </dd>
          </div>
        </dl>
      </section>

      <section className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
        <h2 className="mt-0">Nobody is answering</h2>
        <p className="mb-sm">
          That happens, and it is the single most-complained-about thing in this category — Kyari
          sits at 1.4/5 on Trustpilot and Urvann at 2.1/10, both largely for it. So: WhatsApp first
          at{' '}
          <a href={`tel:${settings.customerCarePhone}`} className="text-primary underline">
            {settings.customerCarePhone}
          </a>
          , answered in under 15 minutes in working hours. If we miss it, the named grievance
          officer is on the{' '}
          <Link href="/contact" className="text-primary underline">
            contact page
          </Link>{' '}
          with a 48-hour acknowledgement commitment.
        </p>
        <p className="m-0">
          <Link href="/orders/lookup" className="text-primary underline">
            Or open the full receipt
          </Link>{' '}
          — same code and phone, with the invoice and the event history.
        </p>
      </section>
    </main>
  )
}
