import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { formatPaise } from '@/lib/catalogue/pricing'
import {
  CORPORATE_MOQ,
  MAX_QUOTE_QUANTITY,
  POT_PRINTING_EXTRA_DAYS,
  POT_PRINTING_MIN_QUANTITY,
  VOLUME_TIERS,
  estimatedTotalPaise,
  leadTimeDays,
} from '@/lib/commerce/corporate'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import { PROSE } from '@/components/layout/containers'
import FaqAccordion, { type FaqEntry } from '@/components/seo/FaqAccordion'

/**
 * Corporate gifting — `/corporate`.
 *
 * ── WHY THIS PAGE EXISTS AT ALL ──────────────────────────────────────────────
 *
 * The audit's sharpest B2B finding is not that competitors are bad at corporate
 * gifting. It is that they are UNREADABLE about it, and that they all fail the
 * same way:
 *
 *   · Kyari runs five landing pages and a microsite, every one ending in a phone
 *     number, and states its corporate MOQ as 30, 40 and 50 on three different
 *     pages. Its real volume ladder works out at ₹564–₹825 per unit while its
 *     SEO page says "starting ₹199".
 *   · FNP: MOQ 50, a downloadable PDF rather than a live bulk catalogue, a
 *     four-step funnel of enquiry form → overview call → choose → deliver, and
 *     "attractive discounts on bulk" with no tiers anywhere on site.
 *   · IGP: "You cannot place a bulk order at the IGP website directly." It will
 *     transact at 5–20 units on campaign pages while its own FAQ says 50.
 *
 * Nobody publishes a price. So the wedge is not cheaper plants and not better
 * service — it is that a procurement manager can compare three suppliers without
 * making three phone calls. That is only true if the ladder, the minimum and the
 * lead times are ON THE PAGE, which is what this is.
 *
 * ── WHY THE LIMITATIONS ARE A SECTION AND NOT A FOOTNOTE ─────────────────────
 *
 * The same audit found Bloomscape and The Sill publishing free workshops attached
 * to corporate gift recipients, and nobody in India doing it. That is a real
 * gap, but a gift nobody in the country publishes is only a differentiator if the
 * buyer believes the rest of the page.
 *
 * A page that lists what it cannot do is the reason a buyer believes what it can.
 * Pot printing takes ten extra working days above 50 units. Split delivery to
 * many addresses is allowed and takes a longer slot. We deliver in one city. We
 * deliver corporate runs to office addresses on weekdays. There are no recurring
 * plans. Every competitor will discover all five of those on the phone, after
 * they have spent an hour of your procurement manager's time — and the one who
 * says so first is the one who gets the pilot.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Corporate gifting',
    description:
      'Published GST-inclusive volume pricing from 10 plants, our real lead times, and an honest list of what we cannot do. No phone call required to find out what it costs.',
    alternates: { canonical: '/corporate' },
  }
}

export default async function CorporatePage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Corporate gifting" />

  const { cityName, taxRateBp } = storefront
  const taxPercent = taxRateBp / 100

  const entries: FaqEntry[] = [
    {
      group: 'Procurement',
      q: 'Can you invoice us, and do you accept a purchase order?',
      a: `Yes to both. Every quote is itemised plant by plant with the GST broken out at ${taxPercent}%, which is the form your accounts team needs, and we send a proper GST invoice with our GSTIN on it rather than a receipt. We accept a PO on the order — but the goods are prepaid, because a COD return leg is 25 to 30 days and the plant is unsellable on arrival. So the sequence is PO to us, invoice from us, payment before dispatch. We do not offer credit terms or a payment window; nobody in this category does, and pretending otherwise is how a procurement cycle stalls.`,
    },
    {
      group: 'Procurement',
      q: 'Can you ship to many different addresses?',
      a: `Yes, and it is the request we hear most. From 50 plants it is included up to 10 addresses in one delivery slot; from 100 it is up to 50 addresses. Above that, we deliver 50 addresses per delivery day, so a 300-address run takes several delivery days rather than one — that is our riders on one route, not a courier sorting a parcel, and it is why the slot is longer. Each address needs its recipient's name and mobile number, because the rider has to reach a person rather than leave forty live plants on a reception desk.`,
    },
    {
      group: 'Procurement',
      q: 'How does the logo and pot printing work?',
      a: `Available from ${POT_PRINTING_MIN_QUANTITY} plants and included from 100. You send artwork, we send a photograph mockup on a real pot, and nothing is printed until you have approved that exact photograph — there is no second round of "close enough". It adds ${POT_PRINTING_EXTRA_DAYS} working days, because the print lab charges per run and the run has to be booked. Below ${POT_PRINTING_MIN_QUANTITY} units we will say no rather than spread a setup charge across too few pots to be worth your while.`,
    },
    {
      group: 'Procurement',
      q: 'Can we see a sample batch first?',
      a: `Yes, and it is the most sensible thing you can do — ask for one plant of each variety you are considering, at the price you would pay at volume, before you commit. It is credited against the order. What we will not do is send a free sample box and then quote a different price for the bulk run; the sample is the bulk price, one unit of it, so what you approve is what you are invoiced for.`,
    },
    {
      group: 'Procurement',
      q: 'What happens if some plants arrive dead?',
      a: `Send a photograph on WhatsApp within 48 hours of delivery with your reference, and we replace them — no questions, no return-to-sender, no wallet credit. We do not ask you to post a dead plant back, because a plant that spent a week in a courier's network is inventory we cannot sell, and asking you to pay the freight to send us our own loss is how competitors end up offering 20% credit instead of a plant. Reference numbers exist precisely so this takes one message and no explanation of who you are.`,
    },
    {
      group: 'Procurement',
      q: 'Who actually does this work?',
      a: `One nursery and our own riders in ${cityName}. We do not white-label another nursery's stock and we do not drop-ship. That is the honest answer to "who is handling a 300-unit run", and it is also the reason the lead times on this page are numbers rather than adjectives: a chain of three suppliers cannot tell you what your plants were doing last Thursday, and neither can their published delivery estimate.`,
    },
    {
      group: 'Procurement',
      q: 'How fast do you send the quote?',
      a: 'Within one working day, and the same day if you send it before noon. The first reply is the itemised quote with the exact per-plant price, the GST line and the date we can hold — not a request for a call. If you want to talk it through afterwards, there is a number, but the quote does not depend on the call. That ordering is the whole difference between this and a four-step funnel.',
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  }

  return (
    <main id="main" tabIndex={-1} className={`py-base ${PROSE}`}>
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Corporate gifting' }]} />

      {/*
        THE HERO.

        The claim is deliberately about the buyer's afternoon rather than about
        our plants. "Cheaper" is unfalsifiable without a phone call, and
        "better service" is what everyone says. What nobody else can offer is that
        the numbers are here — which is a claim you can check in the time it takes
        to read this page, and then act on.
      */}
      <header className="mt-lg">
        <p className="text-label-caps text-clay mb-xs mt-0">Corporate gifting</p>
        <h1 className="mb-0">Compare us without making a phone call</h1>
        <p className="text-ink-muted mt-sm mb-0  text-[1.05rem] leading-relaxed">
          A procurement manager should be able to compare three suppliers without making three phone
          calls. Kyari ends every corporate page with a number, FNP starts with a four-step human
          funnel and a MOQ of 50, and IGP will not let you order on the website at all. So here is
          the price, the minimum, the lead times and the things we cannot do — before you give
          anyone an hour of your morning.
        </p>
        <p className="mt-lg gap-base mb-0 flex flex-wrap">
          <Link
            href="/corporate/request-quote"
            className="bg-primary text-surface inline-flex min-h-[44px] items-center rounded-sm px-4 no-underline"
          >
            Request a quote — it costs nothing
          </Link>
          <a
            href="#price-list"
            className="border-border hover:border-clay inline-flex min-h-[44px] items-center rounded-sm border px-4 no-underline"
          >
            See the price list
          </a>
        </p>
      </header>

      {/*
        WHAT A QUOTE IS.

        Competitors treat the quote as the top of a funnel whose next step is a
        person. Ours is the whole thing: everything a buyer needs in order to
        approve a spend is in the first reply, and the cost of it is nil because
        it costs nothing to write down what we would have said on a call anyway.
      */}
      <section className="mt-3xl">
        <h2 className="mt-0">What a quote is, and what it costs</h2>
        <p className="text-ink-muted mt-xs ">
          One e-mail, sent within a working day, containing:
        </p>
        <ul className="mt-base gap-sm flex flex-col p-0">
          {[
            'The exact per-plant price at your quantity, from the published tier sheet above — not "starting from", and not a number that changes once we have spoken',
            'An itemised bill of materials: which plant, which pot, how many, at what rate, with the GST shown as its own line',
            'A delivery date we can hold, counted in working days, with anything that would push it spelled out',
            'A mockup photograph if you want a logo on the pot, before anything is printed',
            'A split-delivery plan, if it is going to more than one address',
          ].map((item) => (
            <li key={item} className="gap-sm flex items-start">
              <span aria-hidden className="text-clay mt-1 shrink-0">
                &mdash;
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="border-primary bg-brand-soft mt-lg p-base mb-0 rounded-md border">
          <strong>It costs nothing, and it is not a sales call in disguise.</strong> There is no
          minimum you have to buy before we will tell you a price, and there is no obligation at the
          end of it. If your quantity is under our minimum we will point you at the shop rather than
          take the enquiry — that is what the {CORPORATE_MOQ}-plant minimum is for.
        </p>
      </section>

      {/*
        THE LADDER.

        A real `<table>`, not a row of cards. A procurement manager is going to
        screenshot this section or paste it into a spreadsheet, and a table is what
        survives that. The columns are exactly the four things they need to decide:
        quantity, unit price, order value at the floor of the band, and lead time.

        Every figure is GST-inclusive and every figure is INTEGER PAISE — the same
        module the API route writes to the database, so the price on this page is
        the price that gets recorded.
      */}
      <section id="price-list" className="mt-3xl scroll-mt-lg">
        <h2 className="mt-0">The price list</h2>
        <p className="text-ink-muted mt-xs ">
          Our minimum is <strong>{CORPORATE_MOQ} plants</strong> — deliberately low. FNP will not
          look at an order under 50 and IGP tells you to write to sales@igp.com, so a team of twenty
          is an order our competitors hand to somebody else. We publish a maximum too:{' '}
          {MAX_QUOTE_QUANTITY.toLocaleString('en-IN')} plants, which is where one bench, one city
          and our own riders stop being true of the operation.
        </p>

        <div className="border-border mt-base overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="text-ink-muted px-base py-sm text-left">
              Corporate plant pricing, per plant, GST included. Lead time is working days from an
              accepted quote.
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
                  Order value from
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Working days
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Included at this tier
                </th>
              </tr>
            </thead>
            <tbody>
              {VOLUME_TIERS.map((tier, index) => (
                <tr key={tier.from} className="border-border border-b align-top last:border-b-0">
                  <th scope="row" className="px-3 py-3 font-semibold whitespace-nowrap">
                    {tier.label}
                  </th>
                  <td className="px-3 py-3 text-[1.05rem] font-semibold whitespace-nowrap">
                    {formatPaise(tier.perUnitPaise)}
                  </td>
                  <td className="text-ink-muted px-3 py-3 whitespace-nowrap">
                    {formatPaise(estimatedTotalPaise(tier.from, tier.perUnitPaise))}
                    {index === 0 && <span className="block text-xs">at {tier.from} plants</span>}
                  </td>
                  <td className="text-ink-muted px-3 py-3 whitespace-nowrap">
                    {leadTimeDays(tier.from)} days
                  </td>
                  <td className="px-3 py-3">
                    <ul className="gap-xs m-0 flex list-none flex-col p-0">
                      {tier.includes.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-ink-muted mt-sm mb-0 text-sm">
          Every price above includes GST at {taxPercent}%. There is no delivery fee added at the
          end, no packaging surcharge and no handling charge — the retail checkout has the same
          rule, and the most common complaint in this category is a total that grows on the last
          screen.
        </p>

        <p className="mt-lg mb-0">
          <Link
            href="/corporate/request-quote"
            className="bg-primary text-surface inline-flex min-h-[44px] items-center rounded-sm px-4 no-underline"
          >
            Get these prices in writing
          </Link>
        </p>
      </section>

      {/*
        WHAT WE CANNOT DO.

        The section that makes the rest of the page believable. Every item here is
        a thing a competitor will reveal on a call, after the prospect has already
        spent the morning. Publishing them first is the cheapest credibility
        available and it costs us nothing but the enquiries we were going to lose
        anyway.

        Note what is NOT here: no apology, no "we hope to". Each line is a fact and
        a consequence, because a procurement manager needs to plan around the fact.
      */}
      <section className="mt-3xl">
        <h2 className="mt-0">What we cannot do</h2>
        <p className="text-ink-muted mt-xs ">
          Five things, published in advance. If any of them rules out your order, you now know that
          before you have spent an hour finding out.
        </p>
        <dl className="mt-base gap-base m-0 flex flex-col">
          <div className="border-border pb-base border-b">
            <dt className="font-semibold">
              Pot printing takes much longer above {POT_PRINTING_MIN_QUANTITY} plants
            </dt>
            <dd className="text-ink-muted mt-xs mb-0">
              Logo printing adds {POT_PRINTING_EXTRA_DAYS} working days on top of the band lead
              time, because the print lab is booked per run rather than per pot. It is included from
              100 plants and unavailable below {POT_PRINTING_MIN_QUANTITY}, where we would have to
              spread a setup charge across too few pots to be honest about. A festive order that
              needs printed pots has to be placed months ahead, not weeks.
            </dd>
          </div>
          <div className="border-border pb-base border-b">
            <dt className="font-semibold">
              Split delivery takes a longer slot, and at volume takes several days
            </dt>
            <dd className="text-ink-muted mt-xs mb-0">
              We will happily deliver to many addresses — it is the request we hear most. It is
              included up to 10 addresses from 50 plants and up to 50 from 100. Past that we deliver
              50 addresses per delivery day, so a 300-address run is several days of riding rather
              than one courier sweep. We do not have a sorting hub and we are not going to pretend
              we do.
            </dd>
          </div>
          <div className="border-border pb-base border-b">
            <dt className="font-semibold">{cityName} only</dt>
            <dd className="text-ink-muted mt-xs mb-0">
              One city, because we own the nursery and the riders. A multi-city plant operation
              means a courier and a warehouse between the bench and the doorstep, which is precisely
              the thing that makes a live plant arrive dead — the failure this category is worst at.
              If your team is outside {cityName}, we will tell you so in the first reply.
            </dd>
          </div>
          <div className="border-border pb-base border-b">
            <dt className="font-semibold">
              Corporate runs are delivered to an office, on a weekday
            </dt>
            <dd className="text-ink-muted mt-xs mb-0">
              Weekday mornings into the working day, to a reception or a loading bay, not to a
              residential address. A forty-plant parcel handed to somebody at home at seven in the
              evening is a parcel that sits on a doorstep in a Bengaluru April, and we will not do
              it. Split delivery to recipients&rsquo; own home addresses is the exception, and it is
              quoted per address.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">There is no subscription or recurring plan</dt>
            <dd className="text-ink-muted mt-xs mb-0">
              Not yet, and we would rather not take a recurring order we cannot honour. Nobody in
              this category runs a plant subscription either, so the field is open — but a monthly
              plant drop needs a bench plan and a delivery calendar we have not built yet. Ask for a
              standing order instead and we will do it as a normal repeat order.
            </dd>
          </div>
        </dl>
      </section>

      {/*
        THE FREE CARE WORKSHOP.

        Bloomscape and The Sill both attach a free workshop to a corporate gift order
        in the US, and the audit's line is that nobody in India does it. It is
        included from 50 plants above.

        It is also the honest answer to the objection that actually kills plant
        gifting: not that the recipient likes it, but that it will be dead in six
        weeks because nobody owns it. Twenty minutes on a video call where somebody
        who grows plants explains where the light is and how often to water turns a
        morale-gift objection into a solved problem, and it costs us an hour.
      */}
      <section className="mt-3xl">
        <h2 className="mt-0">A care workshop, included from 50 plants</h2>
        <p className="text-ink-muted mt-xs ">
          Twenty minutes on a video call, for the people receiving the plants, run by whoever grew
          them. Bloomscape and The Sill give this away with every bulk order in the US and not one
          Indian supplier does, which tells you the objection it answers is not being answered
          anywhere: a plant nobody owns dies in six weeks and your gifting budget gets a reputation.
          Ours is included from 50 plants and we will run it before you have paid for the second
          order.
        </p>
      </section>

      <section className="mt-3xl">
        <h2 className="mt-0">The questions a procurement manager actually asks</h2>
        <FaqAccordion entries={entries} />
      </section>

      {/*
        The escape hatch and the retail path, side by side.

        Both are real. A team of six is not a corporate order and the page that
        pretends otherwise is lying to somebody who could otherwise just buy six
        plants. Linking the shop is the honest version of the same answer the
        validator gives in `/api/quote-requests`.
      */}
      <section className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
        <h2 className="mt-0">Ready when you are</h2>
        <p className="mb-base">
          The form takes about two minutes, and the quantity you type tells you the tier and the
          total before you send anything. If you would rather just see what a plant costs on its
          own, the shop is one link away.
        </p>
        <p className="gap-base m-0 flex flex-wrap">
          <Link href="/corporate/request-quote" className="text-primary underline">
            Request a quote
          </Link>
          <Link href="/gifting" className="text-primary underline">
            Or browse gifting by occasion
          </Link>
          <Link href="/faq" className="text-primary underline">
            Delivery and guarantee questions
          </Link>
        </p>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}
