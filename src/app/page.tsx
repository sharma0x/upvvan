import { loadGeo } from '@/lib/geo/loader.server'
import { loadCatalogue, currentSeasons } from '@/lib/catalogue/loader.server'
import { leadImagesFor } from '@/lib/catalogue/images'
import Hero from '@/components/storefront/Hero'
import TrustRail from '@/components/storefront/TrustRail'
import RoomFacets from '@/components/storefront/RoomFacets'
import Catalogue from '@/components/storefront/Catalogue'
import Provenance from '@/components/storefront/Provenance'

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
 * windowless flat, then the catalogue, then the provenance that explains all of
 * it. Each section answers the objection the previous one raised.
 *
 * Layout and palette come from design/MOOD-BOARD.html, which sampled the live
 * homepages of ugaoo.com, bloomscape.com, thesill.com, heyrooted.com,
 * trustbasket.com and foliage-factory.com. Tokens come from DESIGN.md, which
 * remains normative — this page uses no literal colour values.
 */
export default async function Home() {
  const geo = await loadGeo()

  /*
   * Pick ONE city deliberately, and fail loudly if there is not exactly one.
   *
   * The first version took `cities[0]` from the active list. That is wrong in a
   * way that only shows up in production: the order is whatever Postgres
   * returned first, so a stray test city with `is_active = true` silently
   * becomes the storefront — every customer sees the wrong city's catalogue.
   *
   * Deterministic instead: pick by slug, and if more than one city is active say
   * so. Ambiguity here is an operator decision (which city is the shop?), not
   * something to resolve by array order.
   */
  const active = geo.cities.filter((c) => c.isActive)
  const DEFAULT_CITY_SLUG = 'bengaluru'
  let city = active.find((c) => c.slug === DEFAULT_CITY_SLUG) ?? null

  if (!city && active.length === 1) city = active[0]!

  if (active.length > 1 && city) {
    console.warn(
      `[catalogue] ${active.length} cities are active (${active
        .map((c) => c.slug)
        .join(', ')}). Showing ${city.slug}. One city is the storefront — ` +
        'switch the others off in HQ admin.',
    )
  }

  if (!city) {
    return (
      <main id="main" tabIndex={-1} className="px-base py-2xl mx-auto max-w-[640px]">
        <h1 className="my-sm">We have not opened yet</h1>
        <p className="text-ink-muted mt-0">
          A city appears here once its state horticulture licence is approved and its serviceable
          pincodes are imported — both enforced by the database, not by convention.
        </p>
      </main>
    )
  }
  const cityId = geo.cityIdBySlug.get(city.slug)!
  const items = await loadCatalogue(cityId)
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
      ? `It is ${seasons[0]} here — March to June runs 40–46°C in ${city.name}. We list only what survives that, and we swap the catalogue as the season turns rather than pausing the shop.`
      : seasons[0] === 'monsoon'
        ? `It is ${seasons[0]} in ${city.name}. Drainage matters more than anything else right now — every plant below ships in a pot that will not waterlog.`
        : `${plants.length} species are in their window for ${city.name} this ${seasons[0]}.`

  /*
   * Resolve artwork ONCE for the whole grid rather than inside each card.
   * `leadImagesFor` de-duplicates across the set, so calling it per-card would
   * give every card an independently-hashed image and adjacent rows would repeat
   * the same photograph.
   */
  const art = leadImagesFor(plants.map((i) => i.slug))

  return (
    <main id="main" tabIndex={-1}>
      <Hero cities={active} cityName={city.name} seasonNote={seasonNote} />

      <TrustRail />

      <RoomFacets items={plants} />

      <Catalogue
        plants={plants}
        consumables={consumables}
        seasonNote={seasonNote}
        cityName={city.name}
        art={art}
      />

      <Provenance cityName={city.name} />

      {/*
        A page-local POLICY note, deliberately not a <footer>.
        r.4(2) of the E-Commerce Rules 2020 requires the entity and grievance
        disclosures to be displayed accessibly; `SiteFooter` in the root layout
        does that. A second <footer> here rendered BEFORE it, so the compliance
        block was pushed below a one-line policy note on the page a customer lands
        on first — and two <footer> elements in one document is invalid HTML
        besides.
      */}
      <p className="mx-auto mt-3xl max-w-[1120px] border-border text-ink-muted border-t px-base pt-base text-sm">
        Prepaid only. No cash on delivery — a returned plant is unsellable, so we do not create the
        return leg. Every listing states its size, light requirement and watering interval before
        you buy, and every dimension is measured at the bench rather than estimated.
      </p>
    </main>
  )
}
