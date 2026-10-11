import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadBusinessSettings } from '@/lib/settings/server'
import ContactForm from '@/components/contact/ContactForm'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import { FORM } from '@/components/layout/containers'

/**
 * Contact — `/contact`.
 *
 * ── WHY THIS PAGE IS THE STRATEGIC BET ──────────────────────────────────────
 *
 * The audit's single clearest finding about this category is that support is
 * where every competitor fails, and it fails in public:
 *
 *   · Kyari — Trustpilot 1.4/5 from 78 reviews; Justdial 3.5/664. Complaints:
 *     "unresponsive support", "escalated, no reply".
 *   · Urvann — Trustpilot 2.1/10, PissedConsumer 1.4/78. Its own design is above
 *     category norm and its execution is not. One WhatsApp line is also the
 *     published phone number, for a claimed 12–15 lakh customers.
 *   · Ugaoo — Play Store 1-star for "ghost customer service, radio silence for
 *     weeks, return window closed though I complained on day one".
 *   · IGP — "I escalated to the Compliance Officer. ZERO response."
 *   · FNP — the ONLY competitor documented as publishing a named grievance
 *     officer, because the rules require it. Process exists; outcomes still fail.
 *
 * Not one publishes a response-time SLA. Urvann says 10am–7pm; nobody says how
 * fast.
 *
 * So the whole strategy lands on one page that says a NUMBER rather than
 * "we aim to respond quickly", and that number is a promise the business has to
 * be able to keep from a two-person bench. That is why the SLA here is
 * conservative and stated as a number: a promise nobody can keep is the thing
 * that produced every one of those reviews.
 *
 * ── WHY THERE IS A FORM AND NOT JUST AN ADDRESS ─────────────────────────────
 * A mailbox that nobody reads is what the competitors have. The form posts to a
 * tracked endpoint and produces a reference the customer can quote, which is
 * what r.4(6)(b) requires of a grievance channel and what turns "I emailed you"
 * into something with a status.
 *
 * ── WHAT THIS PAGE IS NOT ───────────────────────────────────────────────────
 * It is not a support portal, and there is no ticket queue behind it beyond the
 * database. The claim flow (`/claim/[code]`) is the structured path for anything
 * involving a plant; this page is for everything else, and it says so.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Contact us',
    description:
      'Message a grower on WhatsApp, send an e-mail, or use the form. We publish our response-time promise rather than asking you to be patient.',
    alternates: { canonical: '/contact' },
  }
}

export default async function ContactPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Contact us" />

  /*
   * The settings ROW, not the environment.
   *
   * This page read `config.compliance` directly, so an owner who corrected a
   * misspelt registered address or a changed support number in the admin panel
   * changed the footer and nothing else — while this page, which is the one a
   * customer uses to reach a human, kept printing the old value.
   *
   * The SLA numbers were the same problem in a worse shape: "under 15 minutes" and
   * "under 4 working hours" were LITERAL STRINGS on this page while the
   * acknowledgement e-mail sent by `/api/contact` read
   * `settings.supportResponseMinutes`. So editing the panel changed the e-mail and
   * not the page that publishes the promise — the customer was told one number
   * and shown another.
   *
   * Both now come from the same row.
   */
  const s = await loadBusinessSettings()
  const whatsappDigits = s.whatsappDigits

  return (
    <main id="main" tabIndex={-1} className={`py-base ${FORM}`}>
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Contact us' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">Talk to a grower</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">
          Not a chatbot and not a ticket queue that takes four days. You will get an answer from
          somebody who grows plants, and we will tell you the response time we actually keep rather
          than the one we would like to.
        </p>
      </header>

      {/*
        The SLA, as a number, at the top.

        This is the whole page. Every audited competitor's support failure is the
        same failure — silence followed by a closed window — and publishing a
        commitment we hold ourselves to is the cheapest possible wedge against it.
        It is deliberately modest: 15 minutes in hours, 4 working hours otherwise,
        and 48 hours is the statutory outer bound for anything formal.
      */}
      <section className="border-primary bg-brand-soft mt-xl p-lg rounded-md border">
        <h2 className="mb-base mt-0">What we commit to</h2>
        <dl className="gap-base m-0 grid grid-cols-1 sm:grid-cols-3">
          <div>
            <dt className="text-label-caps text-ink-muted">On WhatsApp, in hours</dt>
            <dd className="m-0 text-[1.3rem] font-semibold">
              under {s.supportResponseMinutes} minutes
            </dd>
            <dd className="text-ink-muted m-0 text-sm">
              Weekdays 10am–7pm IST, from a person who grows plants.
            </dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Any other channel</dt>
            <dd className="m-0 text-[1.3rem] font-semibold">under 4 working hours</dd>
            <dd className="text-ink-muted m-0 text-sm">
              E-mail or the form below. Same people, no auto-reply.
            </dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Statutory outer bound</dt>
            <dd className="m-0 text-[1.3rem] font-semibold">{s.grievanceResponseHours} hours</dd>
            <dd className="text-ink-muted m-0 text-sm">
              To acknowledge anything you have escalated, with a reference number.
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-2xl gap-2xl grid lg:grid-cols-2">
        <section>
          <h2 className="mt-0">The three ways to reach us</h2>

          <div className="mt-base">
            <h3 className="mt-0 text-[1.05rem]">WhatsApp — fastest</h3>
            <p className="text-ink-muted mt-xs text-sm">
              Send a photograph and describe what you are worried about. If you have an order code,
              put it in the message so we can find you without asking.
            </p>
            <p className="mt-sm mb-0">
              <a
                href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                  `Hi — I have a question about a plant${storefront ? ' I ordered from ' + storefront.cityName : ''}.`,
                )}`}
                className="bg-primary text-surface inline-flex min-h-[44px] items-center rounded-sm px-4 no-underline"
              >
                Message us on WhatsApp
              </a>
            </p>
          </div>

          <div className="mt-lg">
            <h3 className="mt-0 text-[1.05rem]">E-mail — recorded</h3>
            <p className="text-ink-muted mt-xs text-sm">
              Goes to a real inbox, and anything formal should go here so it is on record. We do not
              run a marketing list, so nothing you send here is used for anything else.
            </p>
            <ul className="mt-sm gap-xs m-0 flex list-none flex-col p-0">
              <li>
                <a href={`mailto:${s.customerCareEmail}`} className="text-primary underline">
                  {s.customerCareEmail}
                </a>{' '}
                <span className="text-ink-muted">— customer care</span>
              </li>
              <li>
                <a href={`tel:${s.customerCarePhone}`} className="text-primary underline">
                  {s.customerCarePhone}
                </a>{' '}
                <span className="text-ink-muted">— customer care</span>
              </li>
            </ul>
          </div>

          {/*
            The grievance officer, named and reachable, because r.4(4) requires it
            to be DISPLAYED and r.4(6) requires a route to it that is not the same
            as customer care. Two different-looking paths is the point: a customer
            who has already complained once should not have to start again in the
            same queue.
          */}
          <div className="mt-lg">
            <h3 className="mt-0 text-[1.05rem]">Escalate — named officer</h3>
            <p className="text-ink-muted mt-xs text-sm">
              If you have already told us and nothing happened, or you want to escalate rather than
              ask again. Required by the Consumer Protection (E-Commerce) Rules 2020, r.4(4).
            </p>
            <dl className="mt-sm gap-xs m-0 flex flex-col text-sm">
              <div>
                <dt className="inline font-semibold">Officer: </dt>
                <dd className="m-0 inline">
                  {s.grievanceOfficerName}, {s.grievanceOfficerDesignation}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">E-mail: </dt>
                <dd className="m-0 inline">
                  <a href={`mailto:${s.grievanceOfficerEmail}`} className="text-primary underline">
                    {s.grievanceOfficerEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Telephone: </dt>
                <dd className="m-0 inline">
                  <a href={`tel:${s.grievanceOfficerPhone}`} className="text-primary underline">
                    {s.grievanceOfficerPhone}
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-sm mb-0 text-sm">
              <Link href="/grievance" className="text-primary underline">
                How the grievance process works, and your escalation rights
              </Link>
            </p>
          </div>
        </section>

        <section>
          <h2 className="mt-0">Or send a message</h2>
          <p className="text-ink-muted mt-xs text-sm">
            Use this for anything that is not about a specific plant you received. For a damaged or
            failing plant the claim flow is faster, because it registers your guarantee window
            automatically and it is what we can measure.
          </p>
          <p className="mt-sm text-sm">
            <Link href="/claim" className="text-primary underline">
              Report a plant or a delivery problem →
            </Link>
          </p>

          <ContactForm />

          <div className="border-border bg-surface-raised mt-xl p-base rounded-md border text-sm">
            <h3 className="mt-0">Before you write</h3>
            <p className="text-ink-muted mb-xs">
              These answer most of it in a sentence, and they are the questions our inbox actually
              gets:
            </p>
            <ul className="gap-xs m-0 flex list-none flex-col p-0">
              <li>
                <Link href="/faq" className="text-primary underline">
                  Do you deliver to my pincode?
                </Link>
              </li>
              <li>
                <Link href="/policies/shipping" className="text-primary underline">
                  When will it arrive?
                </Link>
              </li>
              <li>
                <Link href="/policies/guarantee" className="text-primary underline">
                  My plant is unhappy — is that covered?
                </Link>
              </li>
              <li>
                <Link href="/track-order" className="text-primary underline">
                  Where is my order?
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/*
        The nursery, in words. Nobody in the category publishes an address you
        could walk into, and "own nursery" is an unverifiable claim unless the
        location is on the page. It is also the fastest way to be believed — a
        customer who knows where we are can check.
      */}
      <section className="border-border mt-3xl pt-base border-t">
        <h2 className="mt-0">Where the plants are</h2>
        <p className="text-ink-muted mt-xs text-[1.05rem] leading-relaxed">
          {s.principalAddress}. Visit by appointment — we are a working nursery, not a shop floor,
          and the plants that are not yet listed are the ones to ask about.{' '}
          <Link href="/about" className="text-primary underline">
            More about how we grow
          </Link>
          .
        </p>
      </section>
    </main>
  )
}
