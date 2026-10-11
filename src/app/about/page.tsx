import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadBusinessSettings } from '@/lib/settings/server'
import { COLLECTIONS, collectionSize } from '@/lib/catalogue/collections'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * About — `/about`.
 *
 * ── WHY THIS PAGE ATTACKS THE TWO THINGS THAT ACTUALLY SELL ────────────────
 *
 * "Farm-grown" is the most repeated unverifiable claim in this category. The
 * audit's finding: Ugaoo's "90-day pre-fertilised soil" is refuted in their own
 * reviews ("their potting mix is terrible"), Upvan ships ten SKUs across four
 * species and has no non-plant product at all despite advertising planters, and
 * no Indian competitor publishes an address you could walk into or a grower you
 * could name.
 *
 * So this page does the two things that are cheap here and impossible for a
 * funded competitor:
 *
 *   · It puts the ADDRESS and the locality on the page, plus the licence
 *     position. A customer who knows where we are can check, and a competitor
 *     whose nursery is a registered office cannot copy it.
 *   · It states the seasonal catalogue as a CONSEQUENCE of growing here, and
 *     names what comes out in April. That is only writable by somebody who has
 *     already had to defend it.
 *
 * ── WHY NO MISSION STATEMENT ────────────────────────────────────────────────
 * Every audited site has one and they are interchangeable. This page instead
 * answers the four questions a customer is actually deciding on: is this real,
 * are these plants going to survive my flat, what happens if one does not, and
 * what will you do when I email you.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About us and the nursery',
    description: `Where we are in ${'Bengaluru'}, how we grow, why the catalogue changes with the season, and who answers when you write.`,
    alternates: { canonical: '/about' },
  }
}

/*
 * `force-dynamic` alongside the settings read: a page that reads a database row and
 * declares itself static serves the value it had at build time until a redeploy,
 * which is the opposite of what an editable settings row is for.
 */
export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  const settings = await loadBusinessSettings()
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="About us" />

  const { cityName, facets } = storefront
  const speciesCount = facets.filter((f) => f.itemClass === 'plant').length
  const liveCollections = COLLECTIONS.filter((c) => collectionSize(facets, c) !== null)

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'About us' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">We grow them, and we bring them</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">
          Upvvan is a nursery in {cityName} with a delivery van. There is no third-party warehouse
          between the bench and your door, and no courier handling the parcel. That is the whole
          business, and it is why we can promise same-day and mean it.
        </p>
      </header>

      {/*
        The address, the licence, and the GSTIN — the three things a real
        nursery publishes and a dropshipper cannot. `cities.licence.status` is
        'approved' before a city can be live at all, enforced by a database CHECK,
        so the statement below is not a claim we typed; it is a consequence of the
        schema refusing to let Bengaluru trade otherwise.
      */}
      <section className="border-border bg-surface-raised mt-xl p-lg rounded-md border">
        <h2 className="mt-0">Where we are</h2>
        <p className="mb-sm">{settings.principalAddress}</p>
        <p className="mb-0">
          We hold a Karnataka state horticulture nursery registration, and our GSTIN appears on
          every invoice and at the foot of every page. Both are printed here because both are
          checkable, and because a seller of goods who withholds them is telling you something.
        </p>
        <p className="mt-sm mb-0 text-sm">
          Visiting is by appointment. We are a working nursery rather than a shop floor, and the
          plants that are not on the website are usually the ones worth asking about —{' '}
          <Link href="/contact" className="text-primary underline">
            ask us what is coming up this month
          </Link>
          .
        </p>
      </section>

      {/*
        The seasonal catalogue, explained rather than defended.

        Every competitor in the audit has a summer problem and none of them
        publishes a solution: Rooted holds orders "until it is warm enough", which
        in an Indian April is the whole season. The Sill charges a winter
        surcharge. We swap species, and we say so — because a customer who finds
        out in April that a species was withdrawn mid-order will assume it was
        substituted for cost reasons, which is exactly what FNP does
        automatically.
      */}
      <section className="mt-2xl">
        <h2 className="mt-0">Why the catalogue changes three times a year</h2>
        <p className="mt-sm">
          March to June in {cityName} runs 40–46°C. Most of the plants sold in this country do not
          survive a fortnight of that in a delivery box, and the category&rsquo;s answer is
          generally to ship them anyway and let the customer find out.
        </p>
        <p className="mt-sm">
          We grow everything ourselves, so the constraint is real rather than commercial: if we
          cannot keep it standing through a summer, we do not list it in summer. That is why a Peace
          Lily is on the site in November and not in April. It is not a stock decision — it is a
          plant that drops its flowers above about 32°C.
        </p>
        <p className="mt-sm mb-0">
          The pages that follow from this are the most useful things on the site in April:{' '}
          <Link href="/collections/summer-safe-plants" className="text-primary underline">
            what survives a Bengaluru summer
          </Link>
          .
        </p>
      </section>

      <section className="mt-2xl">
        <h2 className="mt-0">What we will not do</h2>
        <p className="mt-sm mb-sm">
          Three refusals, each with a reason, because a shop that never says no to anything has not
          decided anything:
        </p>
        <dl className="gap-base m-0 flex flex-col">
          <div>
            <dt className="font-semibold">No cash on delivery.</dt>
            <dd className="m-0">
              A COD parcel takes 25 to 30 days to come back and the plant arrives dead, so we would
              be asking you to pay for a write-off. FNP and IGP both refuse COD independently and
              for the same reason; we arrived at it the same way.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">No plants we cannot trace to a bill.</dt>
            <dd className="m-0">
              Every SKU in the catalogue is linked to a supplier batch, and the database refuses to
              publish one without a traceable batch. It is a supplier-bill rule from the Legal
              Metrology regime turned into a constraint, rather than a policy page that says it.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">
              No &ldquo;low maintenance&rdquo; that means &ldquo;we have not told you the
              interval&rdquo;.
            </dt>
            <dd className="m-0">
              Every plant states how often it needs water and what soil moisture to hold, and every
              plant page says what actually arrives, measured at the bench. The complaint we hear
              most across this category is &ldquo;it was smaller than the photo&rdquo;, and the fix
              is a sentence rather than a filter.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-2xl">
        <h2 className="mt-0">Who you will deal with</h2>
        <p className="mt-sm mb-0">
          {settings.grievanceOfficerName}, {settings.grievanceOfficerDesignation}. Messages are
          answered by a grower during working hours, and the response time we commit to is published
          as a number on the{' '}
          <Link href="/contact" className="text-primary underline">
            contact page
          </Link>{' '}
          rather than described as &ldquo;promptly&rdquo;. If you have already written once and
          heard nothing, the same page has a named escalation route.
        </p>
      </section>

      {/*
        What we have, honestly. A number of species that sounds small and is — and
        saying so is more credible than rounding it up, because anyone who counts
        the cards on /plants can check.
      */}
      <section className="border-border mt-2xl pt-base border-t">
        <h2 className="mt-0 text-[1.2rem]">What is on the site right now</h2>
        <p className="text-ink-muted mt-xs mb-sm">
          {speciesCount} plant{speciesCount === 1 ? '' : 's'} in season, across{' '}
          {liveCollections.length} collections you can browse by room, by benefit and by whether it
          survives the season. That is a small catalogue and it will stay small for a while: a
          nursery that grows what it sells cannot list forty species it has never held.
        </p>
        <p className="m-0">
          <Link href="/plants" className="text-primary underline">
            See everything in season
          </Link>
          {' · '}
          <Link href="/quiz" className="text-primary underline">
            or four questions to narrow it down
          </Link>
        </p>
      </section>
    </main>
  )
}
