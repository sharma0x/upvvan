import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { OCCASIONS, occasionSize } from '@/lib/commerce/gifting'
import { formatPaise } from '@/lib/catalogue/pricing'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import ProseSplit from '@/components/layout/ProseSplit'
import { WIDE } from '@/components/layout/containers'

/**
 * Gifting — `/gifting`.
 *
 * ── WHY THE INDEX IS THE OCCASION, NOT THE PRODUCT ──────────────────────────
 *
 * The audit called IGP's occasion rail "the acquisition engine", and the reason
 * is structural rather than cosmetic. A shopper can reach a specific plant from
 * search, but they cannot reach a plant by describing a situation — and the
 * situation is what they are actually in. Somebody's cousin moved into a flat
 * on the 14th, a colleague's results came out on Tuesday, a sibling sent a rakhi
 * and the reply needs to be a gift. Nobody types "Sansevieria trifasciata" at
 * that moment.
 *
 * So this page never opens with a plant grid. It opens with the reason a plant
 * is a gift at all, then names the situations, and only lets the catalogue
 * through underneath.
 *
 * ── WHY A PLANT BEATS EVERY OTHER GIFT, STATED AS AN ARGUMENT ───────────────
 *
 * Every competitor writes gifting pages as bouquets, vases and gift boxes. The
 * argument that they cannot make is the one below: a plant is the only gift that
 * is still going on the 14th of next month. That is a claim about duration
 * against a competitor's category, it is true, and it does not require
 * hyperbole to state.
 *
 * ── WHY THE PRICE PROMISE IS ON THIS PAGE AND NOT ONLY AT CHECKOUT ──────────
 *
 * The gift note is free, handwritten and capped at 280 characters, and the one
 * thing a customer is actually anxious about is whether the price is on it.
 * Ugaoo's high-converting element is "Make this a gift · add a hand-written
 * note free" on every plant — the note is the conversion lever, and the price
 * question is the objection standing next to it. So the no-prices promise is
 * stated here, in the hero, not buried in a policy.
 */

/** Characters on a physical card. The same cap the checkout textarea enforces. */
const GIFT_NOTE_MAX = 280

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Gift a plant',
    description:
      'Plants for housewarming, thank you, congratulations, rakhi, good luck and the day you say sorry. A free handwritten note with no prices on it, delivered by our own riders in the same city.',
    alternates: { canonical: '/gifting' },
  }
}

export default async function GiftingPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city')
    return <NotOpenYet heading="Gifting, once we are open in your city" />

  const { facets, cityName } = storefront

  /*
   * Only occasions with products behind them are rendered.
   *
   * This is the same rule `CollectionTiles` applies and for the same reason:
   * Kyari's sitemap carries `/pages/tesing` and two gift-box builders, Ugaoo's
   * mega-menu links four pages that 404. A tile that leads to an empty grid is
   * not a wishlist — it is the appearance of a shop that does not know what it
   * stocks. An occasion page with nothing behind it is worse than no occasion
   * page at all, because the customer's search for it has already succeeded.
   *
   * The count and the floor price travel with the tile for the same reason they
   * do on a collection tile: "Housewarming · 4 plants · from ₹149" is a price
   * comparison, which is the actual question behind browsing by occasion.
   */
  const live = OCCASIONS.map((occasion) => {
    const size = occasionSize(occasion, facets)
    return size ? { occasion, size } : null
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  /*
   * `after-diwali` leads the rail.
   *
   * Not alphabetical and not newest-first: the audit's clearest finding is that
   * this page does not exist anywhere in India. Ugaoo tags products
   * `post-diwali` and `arrives-post-diwali` and never built the page for either,
   * which means the demand is documented and the supply is absent. A gap that
   * specific gets the top of the list rather than a slot in a grid ordered by
   * how often the occasion happens.
   */
  const featured = live.find((e) => e.occasion.handle === 'after-diwali') ?? null
  const rest = live.filter((e) => e.occasion !== featured?.occasion)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Plant gifting occasions',
    numberOfItems: live.length,
    itemListElement: live.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `/gifting/${entry.occasion.handle}`,
      name: entry.occasion.headline,
    })),
  }

  return (
    <main id="main" tabIndex={-1}>
      <div className={`pt-base ${WIDE}`}>
        <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Gifting' }]} />
      </div>

      {/*
        ── WHY THE HERO IS SPLIT IN TWO COLUMNS ──────────────────────────────────

        This hero used to be a 1120px container holding a 66ch paragraph, which
        left the right-hand ~40% of the header permanently empty on every screen
        wider than a laptop. The occasion grid further down genuinely needs
        1120px — three cards side by side is the whole point of the rail — so the
        width was not the mistake. Putting one short paragraph in it was.

        So the second paragraph moves into its own column. Both are the same
        measure, both stay inside the 68ch limit DESIGN.md sets, and the header
        now occupies the container it was already given. The heading and the
        argument sit together on the left; the no-prices promise — the single
        most differentiating thing on the page — gets the right column to itself.
      */}
      <header className={`border-border pt-lg pb-lg ${WIDE} border-b`}>
        <ProseSplit>
          <div>
            <p className="text-label-caps text-clay m-0">Gifting · {cityName}</p>
            <h1 className="mt-xs mb-0 max-w-[20ch]">
              A plant is the only gift that is still there next month
            </h1>
          </div>
          <div className="text-ink-muted flex flex-col gap-sm text-[1.05rem] leading-relaxed">
            <p className="mt-0 mb-0">
              Everything else is consumed on the day it is given — the flowers, the sweets, the vase
              that becomes shelf furniture. A plant is still in leaf on the fourteenth of next month,
              and the person you sent it to has to water it. That is what makes it read as a thought
              rather than as a transaction, and it is why every plant on this site can be sent to
              somebody else with a handwritten note on the card.
            </p>
            <p className="mb-0">
              We never print a price on a gift note. Not on the card, not on the packing slip inside
              the parcel, not anywhere. It is a gift, not an invoice, and the recipient should find
              out what you spent the way they find out what anyone spent: by asking you.
            </p>
          </div>
        </ProseSplit>
      </header>

      <div className={`py-xl ${WIDE}`}>
        {live.length === 0 ? (
          /*
           * The whole rail empty. The honest reason is always the season — the
           * catalogue is filtered to what can be shipped this month — and saying
           * so is better than an index with no occasions on it, which is what the
           * customers would otherwise see.
           */
          <div className="border-warning bg-surface-raised p-lg rounded-md border">
            <h2 className="mt-0">Nothing to gift this month</h2>
            <p className="mb-0">
              The catalogue changes with the season and nothing here clears its bar right now. We
              would rather say that than show you a page of empty occasions.{' '}
              <a href="/plants" className="text-primary min-h-[44px] underline">
                See everything in season
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            {featured && (
<section className="border-border bg-brand-soft mt-3xl p-lg rounded-md border">
          <ProseSplit>
            <div>
              <p className="text-label-caps text-clay m-0">The page nobody has built</p>
              <h2 className="mt-xs mb-0 text-[1.35rem]">{featured.occasion.headline}</h2>
            </div>
            <div>
              <p className="mt-0 mb-base text-[1.05rem] leading-relaxed">
                {featured.occasion.body}
              </p>
              {/*
                One link, and it is a `<Link>` on its own line rather than a
                styled card. A card here would put the whole paragraph inside a
                link, which is both a hydration hazard and a much larger tap
                target than the thing it points at.
              */}
              <p className="m-0">
                <Link
                  href={`/gifting/${featured.occasion.handle}`}
                  className="border-primary text-primary hover:bg-surface bg-surface-card px-base inline-flex min-h-[44px] items-center rounded-sm border font-semibold no-underline"
                >
                  {featured.occasion.label} — {featured.size.count} plant
                  {featured.size.count === 1 ? '' : 's'}, from{' '}
                  {formatPaise(featured.size.minPaise)}
                </Link>
              </p>
            </div>
          </ProseSplit>
        </section>
            )}

            <section className="mt-2xl">
              {/*
                Heading left, argument right. The heading is short and the
                argument is a paragraph, so stacking them left-aligned in a
                1120px column is what produced the original void on this page.
              */}
              <ProseSplit>
                <div>
                  <h2 className="mb-0">Every occasion</h2>
                </div>
                <div>
                  <p className="text-ink-muted mt-0 mb-0 text-[1.05rem] leading-relaxed">
                    Each one is a real selection over the same care data the catalogue is built from,
                    so the count beside it is the number of plants that clear it this month. If an
                    occasion is not here, nothing we grow is right for it right now, and we would
                    rather not link you to a page with nothing on it.
                  </p>
                </div>
              </ProseSplit>

              {/*
                `<li>` inside `<ul>` rather than a div grid: this is a list of ten
                things a customer can choose between, and "list, 10 items" is the
                only thing a screen-reader user gets about the size of the choice.
              */}
              <ul className="gap-sm m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map(({ occasion, size }) => (
                  <li key={occasion.handle}>
                    <Link
                      href={`/gifting/${occasion.handle}`}
                      className="border-border bg-surface-card hover:border-clay p-base text-ink flex h-full flex-col rounded-md border no-underline"
                    >
                      <span className="text-label-caps text-clay block">
                        {size.count} plant{size.count === 1 ? '' : 's'}
                      </span>
                      <span className="mt-xs block text-[1.05rem] leading-tight font-semibold">
                        {occasion.headline}
                      </span>
                      <span className="text-ink-muted mt-xs block text-sm">{occasion.label}</span>
                      <span className="text-ink-muted pt-sm mt-auto block text-sm">
                        from {formatPaise(size.minPaise)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/*
          THE GIFT NOTE.

          This is the element the audit found to be Ugaoo's highest-converting PDP
          element — "Make this a gift · Add a hand-written note free", on every
          plant. It costs one text field and it converts a self-purchase into a
          gift purchase, which is the difference between a customer and a
          customer who comes back.

          Three facts are stated here rather than left to be discovered at
          checkout: the length cap, the fact that it is handwritten, and the fact
          that no price is printed. The cap is physical, not arbitrary — it is
          what fits legibly on a card, and a note longer than the card is a note
          we would have to refuse.
        */}
        <section className="border-border bg-surface-raised mt-3xl p-lg rounded-md border">
          {/*
            The four facts sit in the right column rather than under the
            paragraph. They were a wrapping row of chips at the bottom of a
            full-width card, which left the card's right half empty above them
            and made the chips read as a footer to a short paragraph rather than
            as the list they are.
          */}
          <ProseSplit>
            <div>
              <h2 className="mt-0 text-[1.35rem]">
                The note on the card is free, and it is the whole trick
              </h2>
            </div>
            <div>
              <p className="mt-0 mb-base text-[1.05rem] leading-relaxed">
                At checkout there is a box that says whether this is a gift. If it is, we write what
                you put there on a card by hand and put the card in the parcel. There is no charge
                for it and no option to charge for it.
              </p>
              <ul className="text-ink-muted m-0 grid list-none grid-cols-1 gap-sm p-0 sm:grid-cols-2">
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  Up to {GIFT_NOTE_MAX} characters — what fits legibly on a card
                </li>
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  Written by hand, not printed
                </li>
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  No prices on the card or the packing slip
                </li>
                <li className="border-border bg-surface-card rounded-sm border px-3 py-2 text-sm">
                  Arrives with the plant, so nobody misses the delivery
                </li>
              </ul>
            </div>
          </ProseSplit>
        </section>

        {/*
          SENDING IT TO SOMEBODY ELSE.

          The single most common checkout mistake in this category: the customer
          fills in their own address because it is the only one they have, and
          then the parcel travels back to them. So the instruction is stated as a
          field-level instruction, not as reassurance — put THEIR address and
          THEIR mobile number in the delivery fields, because the rider calls the
          number on the delivery to reach the person receiving it.
        */}
        <section className="mt-2xl">
          <ProseSplit>
            <div>
              <h2 className="mb-0">Sending it to someone else</h2>
            </div>
            <div>
              <p className="text-ink-muted mt-0 mb-base text-[1.05rem] leading-relaxed">
                Put the recipient&rsquo;s address and the recipient&rsquo;s mobile number in the
                delivery fields. Not yours — the rider calls the number on the delivery, which is how
                they reach the person it is for. If your own number goes in there instead, the rider
                has nobody to call and the parcel turns around.
              </p>
              <ul className="text-ink-muted m-0 flex list-none flex-col gap-sm p-0">
                <li>
                  Nobody has to be home. If they are not, we call, and the plant stays at the bench
                  rather than sitting on a doorstep in the afternoon sun.
                </li>
                <li>We do not hand a live plant to a neighbour who did not agree to take it.</li>
                <li>
                  We only deliver to a list of pincodes we publish. Check yours before you spend any
                  time choosing — we would rather say no now than take the money and refund you
                  later.
                </li>
              </ul>
              <p className="mt-base mb-0">
                <Link href="/faq" className="text-primary min-h-[44px] underline">
                  What happens if something arrives damaged
                </Link>
              </p>
            </div>
          </ProseSplit>
        </section>

        {/*
          CORPORATE.

          A separate funnel and a separate page, because the quote genuinely
          differs: the minimum order, the packing and the delivery cadence all
          change with quantity. Funnelling it through checkout would mean
          discovering the commercial terms at the last step, which is the
          complaint the FAQ makes about delivery fees and the same complaint.
        */}
        <section className="border-border bg-surface-raised mt-2xl p-lg rounded-md border">
          <ProseSplit>
            <div>
              <h2 className="mt-0 text-[1.35rem]">Twenty desks, a client list, or a whole floor</h2>
            </div>
            <div>
              <p className="mt-0 mb-base text-[1.05rem] leading-relaxed">
                Corporate and bulk gifting is a different order. Below four units it is cheaper to
                pick and pack by hand, so four is the minimum, and repeats — one desk at a time as
                people join — are the shape most offices want. Quote rather than cart, because the
                terms change with the quantity and you should see them before you commit.
              </p>
              {/*
                Footer links to both of these and neither route exists yet, so they
                are rendered as the two real targets rather than invented as anchors
                pointing at a section. They will start working the moment the
                corporate pages land, which is the point of a link rather than a
                paragraph promising a route.
              */}
              <p className="gap-base m-0 flex flex-wrap">
                <Link href="/corporate" className="text-primary min-h-[44px] underline">
                  Corporate and bulk gifting
                </Link>
                <Link
                  href="/corporate/request-quote"
                  className="text-primary min-h-[44px] underline"
                >
                  Request a quote
                </Link>
              </p>
            </div>
          </ProseSplit>
        </section>

        {/*
          Policy note rather than a footer: `SiteFooter` already carries the
          E-Commerce Rules r.4(2) disclosures and a second <footer> here would
          render before them.
        */}
        <p className={`border-border text-ink-muted mt-3xl pt-base ${WIDE} border-t text-sm`}>
          Prepaid only. No cash on delivery — a returned plant is unsellable, so we do not create
          the return leg. Every plant states its size, light requirement and watering interval
          before you buy.
        </p>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}
