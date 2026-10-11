import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { currentSeasons } from '@/lib/catalogue/loader.server'
import { COLLECTIONS, collectionSize, BENEFIT_COLLECTIONS } from '@/lib/catalogue/collections'
import { formatPaise } from '@/lib/catalogue/pricing'
import Hero from '@/components/storefront/Hero'
import TrustRail from '@/components/storefront/TrustRail'
import Catalogue from '@/components/storefront/Catalogue'
import Provenance from '@/components/storefront/Provenance'
import CollectionTiles from '@/components/catalogue/CollectionTiles'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import { loadCityRefs } from '@/lib/geo/cities.server'

/**
 * The storefront.
 *
 * ── THE PAGE ORDER IS A DECISION, NOT A TEMPLATE ─────────────────────────────
 * Every competitor audited opens with a product carousel: Ugaoo leads with
 * "Offers for You", Bloomscape with "Best Sellers", The Sill with a seasonal
 * collection, Hey Rooted with "Bundle & Save". Product first, because product
 * first is what a storefront is supposed to do.
 *
 * This page does not, and the reason is in the research rather than in taste. The
 * single most-complained-about failure across all of them is over-promised
 * geography — a customer told "yes" and then cancelled is a one-star review, and
 * Urvann grew revenue 54% while sitting at 2.1/5 on Trustpilot. A customer who
 * cannot trust our delivery map cannot be persuaded by our presentation, because
 * everything else on the page is downstream of "will it even arrive".
 *
 * So: proof, then the coverage answer, then the guarantees that make the promise
 * believable, then the room facets that stop a first plant being placed in a
 * windowless flat, then the catalogue, then the collections and the provenance
 * that explain all of it. Each section answers the objection the previous one
 * raised.
 *
 * Layout and palette come from design/MOOD-BOARD.html, which sampled the live
 * homepages of ugaoo.com, bloomscape.com, thesill.com, heyrooted.com,
 * trustbasket.com and foliage-factory.com. Tokens come from DESIGN.md, which
 * remains normative — this page uses no literal colour values.
 */
export default async function Home() {
  const storefront = await loadStorefront()

  /*
   * The coverage checker's city list.
   *
   * This was `[]` — a hardcoded empty array — which rendered a `<select>` with no
   * options above the "Check coverage" button. Both cities were in the database the
   * whole time; the list was simply never read from anywhere.
   */
  const cities = await loadCityRefs()
  if (storefront.state === 'no-city') return <NotOpenYet heading="We have not opened yet" />

  const { cityName, items, facets, terms } = storefront
  const seasons = currentSeasons()

  /*
   * Plants and consumables are split here rather than inside the component,
   * because the split is a business fact and not a display preference: freight is
   * a fixed cost per parcel, so consumables are structurally higher-margin at any
   * distance, carry no mortality risk and cannot generate a return leg. They get
   * their own rail in ochre so a customer is never confused about which products
   * are replaced and which are refunded in money.
   */
  const plants = items.filter((i) => i.itemClass === 'plant')
  const consumables = items.filter((i) => i.itemClass !== 'plant')

  /*
   * One seasonal sentence, generated from the same `currentSeasons()` that
   * filters the catalogue — so the copy and the stock can never disagree.
   * March–June is 40–46°C in Bengaluru, the window where shipping a tender
   * species is close to a write-off, so it is stated rather than hidden.
   */
  const seasonNote =
    seasons[0] === 'summer'
      ? `It is ${seasons[0]} here — March to June runs 40–46°C in ${cityName}. We list only what survives that, and we swap the catalogue as the season turns rather than pausing the shop.`
      : seasons[0] === 'monsoon'
        ? `It is ${seasons[0]} in ${cityName}. Drainage matters more than anything else right now — every plant below ships in a pot that will not waterlog.`
        : `${plants.length} species are in their window for ${cityName} this ${seasons[0]}.`

  /*
   * The collection rails, with their live counts.
   *
   * These link to PAGES, not to filter states, because that is what the
   * competition's SEO engine is made of — Kyari derives ~250 indexable
   * collection URLs from a room × benefit matrix and Urvann publishes a seasonal
   * axis nobody else in India has. The homepage is where those pages get their
   * internal links, and an internal link from the most-visited page is worth
   * more than the same link from anywhere else.
   *
   * A collection with nothing in it right now is not rendered at all, which is
   * the difference between a nav and a wishlist — see `CollectionTiles`.
   */
  const roomTiles = COLLECTIONS.filter((c) => c.axis === 'room')
  const benefitTiles = BENEFIT_COLLECTIONS
  const summerTiles = COLLECTIONS.filter(
    (c) => c.handle === 'summer-safe-plants' && collectionSize(facets, c) !== null,
  )

  return (
    <main id="main" tabIndex={-1}>
      <Hero cities={cities} cityName={cityName} seasonNote={seasonNote} />

      {/*
        The guarantee rail reads its copy from the price book now. It used to
        hardcode "48-hour arrival guarantee" and "Two acres in Bengaluru" as
        literals, which meant changing a commercial decision required a deploy
        and there were four copies of the window to keep in step — the exact
        failure Ugaoo is currently living with, shipping two contradictory
        guarantee policies at once.
      */}
      <TrustRail terms={terms} />

      <Catalogue
        plants={plants}
        consumables={consumables}
        seasonNote={seasonNote}
        cityName={cityName}
      />

      {/*
        The browsable pages. Placed between the grid and the provenance so a
        customer who has decided they want to shop by room has the route before
        they hit the footer, and so the crawlers get internal links from the
        home page rather than only from the sitemap.
      */}
      <div className="border-border mt-3xl px-base pt-2xl mx-auto max-w-[1120px] border-t">
        <CollectionTiles
          items={facets}
          collections={roomTiles}
          heading="Start from the room, not the species name"
          description="Most people kill their first plant by choosing something that needs a window they do not have. These pages are organised by where the plant will actually live."
        />

        <div className="mt-3xl">
          <CollectionTiles
            items={facets}
            collections={benefitTiles}
            heading="Or from what you need it to be"
            description="Pet-safe, edible, and the two claims we are careful about — read how we pick before you trust them."
          />
        </div>

        {/*
          The seasonal note, as a link. Urvann publishes `summer-plants` with
          4,529 SKUs and no Indian competitor publishes a ship-calendar at all.
          In April this is the most useful page on the site and it costs one
          link.
        */}
        {summerTiles.length > 0 && seasons[0] === 'summer' && (
          <aside className="border-warning bg-surface-raised mt-3xl p-lg rounded-md border">
            <h2 className="mt-0">It is {cityName}&rsquo;s summer</h2>
            <p className="mb-sm">
              March to June runs 40–46°C here, and it is the reason our catalogue changes shape
              three times a year. We swap species rather than pause the shop, and every plant we
              still list in April is one we grew outdoors through a full summer.
            </p>
            <Link href="/collections/summer-safe-plants" className="text-primary underline">
              What survives a Bengaluru summer →
            </Link>
          </aside>
        )}
      </div>

      <Provenance cityName={cityName} />

      {/*
        A page-local POLICY note, deliberately not a <footer>.
        r.4(2) of the E-Commerce Rules 2020 requires the entity and grievance
        disclosures to be displayed accessibly; `SiteFooter` in the root layout
        does that. A second <footer> here rendered BEFORE it, so the compliance
        block was pushed below a one-line policy note on the page a customer lands
        on first — and two <footer> elements in one document is invalid HTML
        besides.
      */}
      <p className="border-border text-ink-muted mt-3xl px-base pt-base mx-auto max-w-[1120px] border-t text-sm">
        Prepaid only. No cash on delivery — a returned plant is unsellable, so we do not create the
        return leg. Every listing states its size, light requirement and watering interval before
        you buy, and every dimension is measured at the bench rather than estimated. Cheapest plant
        in season today:{' '}
        {plants.length > 0
          ? formatPaise(Math.min(...plants.map((p) => p.ladder[0]!.totalPaise)))
          : '—'}
        .
      </p>
    </main>
  )
}
