import Image from 'next/image'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { PlantImage } from '@/lib/catalogue/images'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'

/**
 * The seasonal catalogue grid.
 *
 * ── WHAT EACH CARD SHOWS, AND WHY EACH FIELD IS ON IT ────────────────────────
 * Every card carries four facts before the price. That is not decoration — it is
 * the substitution list, in order of how often they stop a purchase:
 *
 *  1. SIZE TIER — Bloomscape's XS/MD/LG/XL ladder, which is both the
 *     merchandising axis and a Legal Metrology r.6(10) declaration.
 *  2. LIGHT — because the dominant first-plant failure is a plant placed in a
 *     windowless room. Naming the light requirement up front is the cheapest
 *     possible substitute for the plant finder.
 *  3. PET/CHILD SAFETY — the schema every global leader exposes as a filter, and
 *     the one Indian competitors mostly hide.
 *  4. WATER INTERVAL + SOIL MOISTURE % — the single most transferable mechanic in
 *     the whole category. Bloomscape expresses water as "top 50–75% of the soil
 *     is dry" because that is a TESTABLE instruction and "water weekly" is
 *     neither. We show the interval AND the target.
 *
 * ── WHAT IS NOT ON THE CARD ──────────────────────────────────────────────────
 * No struck-through MRP. No "Save X%". No urgency banner. An MRP is a
 * merchandising fiction and every Indian site shows one; the planter ladder is
 * already presented as VALUE on the PDP ("the pot is worth ₹657 more"), and a
 * discount framing here would contradict it.
 *
 * ── WHY CONSUMABLES ARE SEPARATED ────────────────────────────────────────────
 * Freight is a fixed cost per parcel, so a 450g pack of neem cake ships at the
 * same courier rate as a 5ft mango plant — supplies are structurally
 * higher-margin at any distance, and both TrustBasket and Paudhewale have
 * quietly made supplies the business. They get their own rail, in ochre, because
 * the goods are soil and fertiliser and not living things.
 */
function PlantCard({ item, image }: { item: CatalogueItem; image?: PlantImage }) {
  const safe = item.care.toxicity === 'safe'

  return (
    <li>
      <Link
        href={`/plant/${item.slug}?tier=${item.sizeTier}`}
        className="border-border bg-surface-card hover:border-clay flex h-full flex-col overflow-hidden rounded-md border text-ink no-underline"
      >
        {/*
          4:3 is the aspect every one of the eight audited sites uses for a
          catalogue tile, and it is the shape Pinterest returns, so the art does
          not need cropping. `sizes` is required by next/image and must describe
          the real rendered width, otherwise the browser downloads a 1400px file
          for a 340px slot — which is most of why plant sites ship 300KB cards.

          ── `w-full shrink-0` IS LOAD-BEARING, AND WAS MISSED ──────────────────
          The card is `flex flex-col`, and this wrapper is a FLEX ITEM. A flex item
          in a column has no intrinsic width, so with only `aspect-[4/3]` it
          collapses to the 1px minimum and the whole grid renders as 352x192 cards
          containing a 1x1 image. Measured in a browser:

            <a>   352 x 192   ← the card
            <div>   1 x   1   ← this wrapper: aspectRatio "4 / 3", width 1px
            <img>   1 x   0   ← position:absolute inset:0 inside a 1px box

          `aspect-ratio` alone cannot rescue a zero-width box — it needs a width to
          compute a height from, and a flex item has none. The images were
          downloading perfectly the whole time (12/12 loaded, natural 340x340);
          they were being painted into a 1px box, so the storefront simply looked
          like it had no photography.

          Worth recording WHY this survived every gate: the images WERE in the
          HTML, the optimizer URLs resolved, the test asserted `img.complete &&
          naturalWidth > 0` — which was true — and the build, lint, typecheck and
          all 354 tests passed. It is invisible to anything that does not measure
          a rendered box. Only `getBoundingClientRect()` on the wrapper found it,
          which is the same lesson as the missing `relative` on the PDP: a
          zero-size element is not a type error, a lint error, or a test failure.
        */}
        <div className="border-border bg-surface-raised relative aspect-[4/3] w-full shrink-0 border-b">
          {image ? (
            <Image
              src={image.src}
              alt={item.commonName}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
              className="object-cover"
            />
          ) : (
            // No art for this species: a typographic plate, not a broken image.
            // `fill` needs a positioned parent, which the div above provides.
            <span className="text-ink-muted absolute inset-0 flex items-center justify-center px-base text-center font-[var(--font-h2)] text-lg">
              {item.commonName}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-base">
          <span className="text-label-caps text-clay block">
            {item.sizeTier} · {item.care.light.replace('_', ' ')}
          </span>

          <span className="mt-xs block text-[1.1rem] leading-tight font-semibold">
            {item.commonName}
          </span>
          {item.botanicalName && (
            <span className="text-ink-muted block text-sm italic">{item.botanicalName}</span>
          )}

          <span className="text-ink-muted mt-sm block text-sm">
            Water every {item.care.waterIntervalDays} days · keep soil at{' '}
            {item.care.soilMoistureTargetPct}%
          </span>

          <span className="mt-xs block text-sm">
            {safe ? (
              <span className="text-success">Safe around pets &amp; kids</span>
            ) : (
              <span className="text-ink-muted">Toxic if eaten — keep it up high</span>
            )}
          </span>

          {/*
            mt-auto pins the price to the bottom of the card so a grid row of
            different-length titles still lines its prices up. Without it the
            price floats and the grid reads as ragged.
          */}
          <span className="mt-auto block pt-base text-[1.05rem] font-semibold">
            from {formatPaise(item.ladder[0]!.totalPaise)}
          </span>
        </div>
      </Link>
    </li>
  )
}

export default function Catalogue({
  plants,
  consumables,
  seasonNote,
  cityName,
  art,
}: {
  plants: CatalogueItem[]
  consumables: CatalogueItem[]
  seasonNote: string
  cityName: string
  /** slug → lead image, pre-resolved and de-duplicated by the caller. */
  art: Map<string, PlantImage>
}) {
  return (
    <section id="catalogue" className="mx-auto max-w-[1120px] scroll-mt-lg px-base pt-3xl">
      <p className="text-label-caps text-clay m-0">
        {cityName} · {plants.length} listing{plants.length === 1 ? '' : 's'} in season
      </p>
      <h2 className="mt-xs mb-0">What we can honestly sell you right now</h2>
      <p className="text-ink-muted mt-xs mb-lg max-w-[62ch]">{seasonNote}</p>

      {plants.length === 0 ? (
        <p className="border-warning bg-surface-raised rounded-md border p-lg">
          Nothing is in season for {cityName} right now. We would rather say so than sell you
          something that will not survive the weather — we swap species in and out with the
          season rather than pausing the site.
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-base p-0 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((item) => (
            <PlantCard key={item.skuId} item={item} image={art.get(item.slug)} />
          ))}
        </ul>
      )}

      {/*
        The consumables rail. Separate because the economics are different: a
        refill is 70–80% margin, ships flat and cheap, has no mortality, and
        cannot generate a return leg. It is the highest-margin line in the entire
        category and every competitor treats it as a bonus rather than a business.
      */}
      {consumables.length > 0 && (
        <div className="border-border bg-surface-raised mt-2xl rounded-lg border p-lg">
          <div className="flex flex-wrap items-baseline justify-between gap-base">
            <h3 className="m-0">Soil, feed &amp; tools</h3>
            <p className="text-ink-muted m-0 text-sm">
              Cheaper than a plant to send and worth more to a plant that survives. Prepaid, and
              the only thing on this site we refund in money.
            </p>
          </div>
          <ul className="mt-base m-0 grid list-none grid-cols-1 gap-sm p-0 sm:grid-cols-3">
            {consumables.map((item) => (
              <li key={item.skuId}>
                <Link
                  href={`/plant/${item.slug}?tier=${item.sizeTier}`}
                  className="border-border bg-surface-card hover:border-ochre block rounded-sm border p-sm text-ink no-underline"
                >
                  <span className="text-label-caps text-ochre block">
                    {item.itemClass} · {item.sizeTier}
                  </span>
                  <span className="mt-xs block font-semibold">{item.commonName}</span>
                  <span className="mt-xs block font-semibold">
                    {formatPaise(item.ladder[0]!.totalPaise)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}