import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { formatPaise } from '@/lib/catalogue/pricing'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import FaqAccordion, { type FaqEntry } from '@/components/seo/FaqAccordion'

/**
 * FAQ — `/faq`.
 *
 * ── WHY THIS IS A PAGE AND NOT A WIDGET ON THE HOMEPAGE ─────────────────────
 *
 * The audit's specific finding about Upvan: it generated five genuinely good
 * Q&As and left them in an accordion on the homepage, where a crawler cannot
 * index them. That is a free SEO win left on the table, and it is the most
 * common shape in this category — an FAQ is nearly always present and nearly
 * always invisible to search.
 *
 * So: a real route, in the footer, and rendered as `<details>` on the server so
 * it works with JavaScript off and each question is its own URL fragment.
 *
 * ── WHY THE ANSWERS ARE ABOUT OUR DECISIONS AND NOT ABOUT PLANTS ────────────
 *
 * Every plant question is answered on the plant page, where the answer belongs
 * and where it can be specific to that plant. A generic FAQ about "how often do
 * I water a money plant" is worse than the PDP, because it is true of nothing in
 * particular.
 *
 * What belongs here is the set of questions a customer asks BEFORE they trust
 * us — will you deliver to me, what happens if it dies, why is there no COD, why
 * is this ₹3,000 when that plant is ₹300 — and which are the questions whose
 * answers are commercial decisions. Those are the ones a competitor can copy and
 * the ones a customer actually needs.
 *
 * Some answers interpolate the live price book, so the delivery-cost and
 * guarantee answers cannot go stale.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Questions we get asked',
    description:
      'Delivery, guarantees, payment, gifting and the questions people actually ask before their first order.',
    alternates: { canonical: '/faq' },
  }
}

export default async function FaqPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Questions we get asked" />

  const { terms, cityName, items } = storefront
  const cheapest = Math.min(
    ...items.filter((i) => i.itemClass === 'plant').map((i) => i.ladder[0]!.totalPaise),
  )
  const dearest = Math.max(
    ...items.filter((i) => i.itemClass === 'plant').map((i) => i.ladder[0]!.totalPaise),
  )

  const entries: FaqEntry[] = [
    {
      group: 'Delivery',
      q: `Do you deliver to my area?`,
      a: `Only within ${cityName}, and only to a list of pincodes we maintain. Put your pincode in the box at the top of any page and it will tell you in a second — before you have spent any time choosing. We would rather say no now than take your money and refund you later, which is what the two largest gifting competitors do.`,
      href: '/#main',
    },
    {
      group: 'Delivery',
      q: 'How long does delivery take?',
      a: `Same day if you order before noon, next evening if you order after. Your plant is cut from the bench and packed that morning and one of our own riders carries it to you. There is no courier and no third-party warehouse in between, which is the only reason a same-day promise is possible in a city with April at 46°C.`,
      href: '/policies/shipping',
    },
    {
      group: 'Delivery',
      q: 'What if I am not there when it arrives?',
      a: 'We call you, and the plant stays at the bench. We do not leave a live plant unattended on a doorstep, and we do not hand it to a neighbour without that neighbour agreeing. If it cannot be delivered on the day, you get a message and a redelivery, not a phone call from a stranger asking you to come home.',
    },
    {
      group: 'Delivery',
      q: 'Can I send a plant to someone else as a gift?',
      a: 'Yes, and you should — put THEIR address and THEIR mobile number in the delivery fields, because the rider needs to reach the person receiving it. You can add a handwritten note on a card in the parcel, free, and we never put prices on it.',
      href: '/gifting',
    },

    {
      group: 'Money',
      q: 'Why do you not offer cash on delivery?',
      a: 'A COD parcel takes 25 to 30 days to come back, and a plant that has spent a month in a sealed box is unsellable inventory. That is a total write-off, so we do not create the return leg. FNP and IGP both refuse COD independently and for the same reason. Everything is prepaid, which also means there is no cash to recover when something goes wrong — only a plant to receive.',
      href: '/policies/refund',
    },
    {
      group: 'Money',
      q: `Why is one plant ${formatPaise(cheapest)} and another ${formatPaise(dearest)}?`,
      a: 'Two things, and neither is a sale. The SIZE TIER is the plant: XS is a windowsill plant, MD is a floor plant, and an MD plant has genuinely been at the bench two to three times longer. The POT is separate and always optional — every plant can be bought in a plain grow pot for the tier price, and the decorative pots add between 45% and 121% of the plant price on top. We show the pot as a value ("worth ₹657 more") and never as a discount, and we do not show a struck-through price, because an MRP is a merchandising fiction.',
      href: '/policies/terms',
    },
    {
      group: 'Money',
      q: 'Are the prices the final price?',
      a: 'Yes, and they include GST. There is no delivery fee revealed at the last step of checkout, which is the most common complaint in this category. You can see the full landed total — plants, pots, delivery and the GST that is inside the price — before you press anything.',
      href: '/order/checkout',
    },
    {
      group: 'Money',
      q: 'Can I get a refund if I change my mind?',
      a: 'You can cancel any time before a rider picks the order up, and the money goes back to the method you paid with. After that the plant is on a bike and cancellation becomes a delivery-failure conversation rather than a cancellation. We do not do partial cancellations on a multi-plant order: every competitor that offers them ends up shipping a replacement anyway with extra handling.',
    },

    {
      group: 'The guarantee',
      q: terms.terms.label,
      a: `${terms.terms.remedy} Send us a photo on WhatsApp with your order code — that is the whole process, there is no form and nothing to post back.`,
      href: '/policies/guarantee',
    },
    {
      group: 'The guarantee',
      q: 'What is NOT covered?',
      a: 'Over- or under-watering, repotting inside the first 30 days, the wrong light, pests arriving weeks after delivery, and the ordinary droop a plant goes through for a day after being in a box. We are precise about this because a guarantee that quietly excludes the common case is not a guarantee. Every one of those has a "we will help anyway" answer on the guarantee page.',
      href: '/policies/guarantee',
    },
    {
      group: 'The guarantee',
      q: 'Why is your guarantee window shorter than the big brands?',
      a: 'Because a guarantee with no end date cannot be priced. We grow the replacement before we know whether it is needed, so an open-ended promise means every honest customer subsidises every dishonest one. The window is a number we can hold, and we will lengthen it when we have measured enough deliveries to stand behind a longer one — not on a calendar.',
    },

    {
      group: 'Choosing',
      q: 'I have no idea what to buy.',
      a: 'Four questions will narrow it to three specific plants, each with a reason. It asks whether your room has an AC and which way the window faces rather than how bright it is, because nobody can answer that and everybody can answer the other two. It also asks whether you rent, which removes about a third of what people would otherwise buy.',
      href: '/quiz',
    },
    {
      group: 'Choosing',
      q: 'Will this plant survive my flat?',
      a: 'It will if we tell you the truth about its light and water needs, which every page does before you buy. What we cannot promise is that a plant will thrive where it merely survives — if you have no window, that is a real constraint and the quiz will say so rather than sell you something.',
    },
    {
      group: 'Choosing',
      q: 'Why is my species not on the site?',
      a: 'Almost always because of the season. Between March and June we list only what we grew outdoors through a full summer, and that is a much shorter list. It is a decision about the plant rather than about your address, and the seasonal pages explain which ones come back and when.',
      href: '/collections/summer-safe-plants',
    },
    {
      group: 'Choosing',
      q: 'Do you have anything safe around a cat or a toddler?',
      a: 'Yes, and we will not list one as safe without a dated check at the bench — the database refuses it. That matters because a great many common houseplants cause vomiting if chewed, and the filter is the thing a household with a cat is looking for.',
      href: '/collections/plants-that-are-safe-around-cats-and-dogs',
    },

    {
      group: 'Orders',
      q: 'Where is my order?',
      a: 'Enter the order code and the phone number on the order. You do not need an account for this, and we would rather not make one.',
      href: '/track-order',
    },
    {
      group: 'Orders',
      q: 'Something arrived damaged.',
      a: 'Send a photo on WhatsApp within 48 hours of delivery and we replace it. You do not pay to ship anything back — a returned plant is a dead plant, so asking you to post it would cost you money and cost us a plant we cannot sell.',
      href: '/claim',
    },
    {
      group: 'Orders',
      q: 'Do I need an account?',
      a: 'No. Checkout works with just a name, a mobile number and an address. Sign-in is available if you want your order history and addresses in one place, and it uses your mobile number rather than a password — but it is never in front of a purchase, because the one competitor in this category that gates checkout has the worst complaint record of any site we looked at.',
      href: '/sign-in',
    },
    {
      group: 'Orders',
      q: 'How fast do you reply?',
      a: 'Under 15 minutes on WhatsApp during working hours, under 4 working hours by e-mail or the form, and 48 hours is the statutory outer bound for anything escalated. Those are published as numbers because "we aim to respond quickly" is not a commitment, and because the category record on this is 1.4 to 2.1 out of 5 across the two largest players.',
      href: '/contact',
    },
  ]

  /*
   * JSON-LD FAQPage. A FAQ page is one of the few pieces of structured data that
   * is both easy and genuinely matched by consumers, and it is the whole reason
   * this page exists rather than an accordion on the homepage.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  }

  const groups = [...new Set(entries.map((e) => e.group))]

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Questions we get asked' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">Questions we get asked</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">
          These are the ones that come before a first order — will it arrive, what happens if it
          does not, and why is it priced that way. Care questions are answered on the plant&rsquo;s
          own page, where the answer is specific to that plant.
        </p>
      </header>

      <nav aria-label="Jump to a section" className="mt-xl gap-sm flex flex-wrap">
        {groups.map((group) => (
          <a
            key={group}
            href={`#${group.toLowerCase()}`}
            className="border-border bg-surface-card hover:border-clay inline-flex min-h-[44px] items-center rounded-sm border px-3 text-sm no-underline"
          >
            {group}
          </a>
        ))}
      </nav>

      {groups.map((group) => (
        <section key={group} id={group.toLowerCase()} className="mt-2xl scroll-mt-lg">
          <h2 className="border-border pb-xs mt-0 border-b">{group}</h2>
          <FaqAccordion entries={entries.filter((e) => e.group === group)} />
        </section>
      ))}

      {/*
        The escape hatch, at the bottom where a customer who has read all of it
        and is still stuck will actually look.
      */}
      <section className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
        <h2 className="mt-0">Not answered here?</h2>
        <p className="mb-sm">
          Ask a grower. Messages get answered during working hours by somebody who grows plants, and
          the response time we commit to is a number rather than a promise.
        </p>
        <p className="gap-base m-0 flex flex-wrap">
          <Link href="/contact" className="text-primary underline">
            Contact us
          </Link>
          <Link href="/problems" className="text-primary underline">
            Or look up your plant&rsquo;s symptoms
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
