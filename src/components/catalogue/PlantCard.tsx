/*
 * `'use client'`.
 *
 * The card is a client component because "Show more" appends batches on the client,
 * and a client component cannot render a server one. So the card moved to the
 * client, not the batches to the server.
 *
 * The alternative was a second card — one for the server-rendered first batch and
 * one for the appended ones — and this file exists precisely because that happened
 * once already and the two drifted within a week (see "THE CARD IS ONE COMPONENT"
 * below). Duplicating the card to avoid a `'use client'` line would reintroduce the
 * exact bug that comment is about.
 *
 * It is safe here because the card already depends on nothing server-side:
 * `next/image`, `next/link`, and two pure formatting helpers. The only import from a
 * `.server` module is `import type` for `CatalogueItem`, which TypeScript erases —
 * it never reaches the bundle, and `client-boundary.test.ts` knows to allow it.
 *
 * The cost is real and worth naming: every card is now client-rendered, so the
 * first batch ships as RSC payload and hydrates. In exchange the catalogue stays a
 * single component, and progressive loading is possible at all.
 */
'use client'

import Image from 'next/image'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'
import { stockBadge } from '@/lib/catalogue/facets'
import type { PlantImage } from '@/lib/catalogue/images'
import type { CatalogueItem } from '@/lib/catalogue/loader.server' // type-only: erased, never bundled

/**
 * The plant card.
 *
 * ── WHAT IS ON IT, AND WHY EACH FIELD IS ON IT ──────────────────────────────
 *
 * Four facts before the price. That is not decoration — it is the substitution
 * list, ordered by how often each one stops a purchase:
 *
 *   1. RATING — every serious seller shows one (Ugaoo: 4.8 from 440 on Peace
 *      Lily) and Upvan has 845 real Flipkart ratings it surfaces nowhere on its
 *      own site. A first-time buyer has no other independent signal, and the
 *      category's defining complaint is "it arrived smaller than the photo".
 *
 *   2. SIZE TIER — both the merchandising axis and a Legal Metrology r.6(10)
 *      declaration.
 *
 *   3. LIGHT — because the dominant first-plant failure is a plant placed in a
 *      windowless room. Naming the light requirement up front is the cheapest
 *      possible substitute for the plant finder.
 *
 *   4. WATER INTERVAL + SOIL MOISTURE % — the single most transferable mechanic
 *      in the category. Bloomscape expresses water as "top 50–75% of the soil is
 *      dry" because that is a TESTABLE instruction and "water weekly" is
 *      neither. We show the interval AND the target.
 *
 * ── WHAT IS NOT ON IT ───────────────────────────────────────────────────────
 *
 * No struck-through MRP and no "Save X%". Every Indian site shows one; an MRP is
 * a merchandising fiction. The planter ladder is already presented as VALUE on
 * the PDP ("the pot is worth ₹657 more"), and a discount framing here would
 * contradict it on the same screen.
 *
 * No urgency banner. "Only 3 left" appears only when it is a fact about our
 * bench, from one named threshold, so it means something on every card.
 *
 * ── THE CARD IS ONE COMPONENT, NOT A HOMEPAGE SPECIAL ───────────────────────
 * The homepage grid, the PLP, the collection pages, the search results and the
 * cart cross-sell all render this. The previous version was private to
 * `Catalogue.tsx`, so building a second grid meant writing a second card, and
 * the two drifted within a week — the PLP would show stock and the homepage
 * would not.
 */
export default function PlantCard({
  item,
  image,
  /** Shown as the link's accessible name suffix, e.g. "MD · bright indirect". */
  priority = false,
}: {
  item: CatalogueItem
  image?: PlantImage
  priority?: boolean
}) {
  const badge = stockBadge(item.stock)
  const isPlant = item.itemClass === 'plant'
  const soldOut = item.stock <= 0

  return (
    <li>
      <article className="h-full">
        <Link
          href={itemHref(item)}
          aria-disabled={soldOut}
          className={`border-border bg-surface-card text-ink flex h-full flex-col overflow-hidden rounded-md border no-underline ${
            soldOut ? 'opacity-70' : 'hover:border-clay'
          }`}
        >
          {/*
            4:3 is the aspect every audited site uses for a catalogue tile, and it
            is the shape Pinterest returns, so the art does not need cropping.
            `sizes` must describe the REAL rendered width or the browser downloads
            a 1400px file for a 340px slot — which is most of why plant sites ship
            300KB cards.

            ── `w-full shrink-0` IS LOAD-BEARING ─────────────────────────────────
            The card is `flex flex-col`, and this wrapper is a FLEX ITEM. A flex
            item in a column has no intrinsic width, so with only `aspect-[4/3]` it
            collapses to the 1px minimum and the whole grid renders as 352x192
            cards containing a 1x1 image. Measured in a browser:

              <a>   352 x 192   ← the card
              <div>   1 x   1   ← this wrapper: aspectRatio "4 / 3", width 1px
              <img>   1 x   0   ← position:absolute inset:0 inside a 1px box

            `aspect-ratio` alone cannot rescue a zero-width box — it needs a width
            to compute a height from, and a flex item has none. The images were
            downloading perfectly the whole time (12/12 loaded, natural 340x340);
            they were being painted into a 1px box, so the storefront simply
            looked like it had no photography.

            Worth recording WHY this survived every gate: the images WERE in the
            HTML, the optimizer URLs resolved, the test asserted `img.complete &&
            naturalWidth > 0` — which was true — and the build, lint, typecheck and
            all 354 tests passed. It is invisible to anything that does not measure
            a rendered box.
          */}
          {/*
           * The image plate renders ONLY when there is a photograph.
           *
           * It used to render unconditionally with a typographic fallback inside, and
           * that is defensible for a PLANT whose art failed to download — one gap, the
           * card keeps its shape, and the card is still recognisable.
           *
           * But a bag of cocopeat has no art and never will: the photograph library is
           * plants, keyed by species slug. So the homepage's "Soil, feed & tools" grid
           * was three tall, empty `aspect-[4/3]` boxes with one word floating in the
           * middle of each — the "blank space where a card should be" a shopper sees,
           * and no amount of pagination could fill it, because it was never a gap in
           * the data. It was a gap in the layout pretending to be a product.
           *
           * So: no photograph, no plate. The card goes compact, which is also more
           * honest — a 5kg bag of soil does not need a square that exists to show off
           * a leaf.
           */}
          {image && (
            <div className="border-border bg-surface-raised relative aspect-[4/3] w-full shrink-0 border-b">
              <Image
                src={image.src}
                alt={
                  isPlant
                    ? `${item.commonName}${item.botanicalName ? `, ${item.botanicalName}` : ''}`
                    : item.commonName
                }
                fill
                priority={priority}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
                className="object-cover"
              />

              {/*
                The stock badge sits ON the photograph rather than under it, because
                a sold-out plant that still looks available is the failure. The
                audit found Upvan displaying "Sold out" on an in-stock SKU, and
                Kyari offering 399 of 428 without ever saying which 29.
              */}
              {badge && (
                <span
                  className={`absolute top-2 left-2 rounded-sm px-2 py-1 text-xs font-semibold ${
                    badge.tone === 'out'
                      ? 'bg-ink text-surface'
                      : 'bg-surface text-ink border-border border'
                  }`}
                >
                  {badge.label}
                </span>
              )}
            </div>
          )}

          {/*
            With no plate there is no photograph to sit a badge ON, so the badge
            moves inline. Dropping it instead would be the real failure: a sold-out
            bag of cocopeat that looks available.
          */}
          {!image && badge && (
            <span
              className={`rounded-sm px-2 py-1 text-xs font-semibold ${
                badge.tone === 'out'
                  ? 'bg-ink text-surface'
                  : 'bg-surface text-ink border-border border'
              }`}
            >
              {badge.label}
            </span>
          )}

          {/*
            `px-md py-base`, not `p-base`.

            The image above is FULL BLEED — it touches both card edges — so with
            16px of horizontal padding on the text the title, the care line and
            the price all sat 16px inside a picture that went edge to edge, and
            the text read as floating rather than as part of the card. Measured at
            a 248px card: the image ran the full 246px and the text occupied
            216px of it.

            12px horizontally is enough to keep the text off the card border at
            this width while letting it align far more closely with the edge of
            the photograph above it. Vertical padding stays at 16px because that
            one is doing real work — it separates the name from the image and
            from the care spec.
          */}
          <div className="px-md py-base flex flex-1 flex-col">
            <span className="text-label-caps text-clay block">
              {isPlant ? (
                <>
                  {item.sizeTier} · {humanise(item.care.light)}
                </>
              ) : (
                /*
                 * "consumable" is a schema value, not a word a customer uses.
                 * The net quantity is on the statutory block and is the honest
                 * label for a bag of soil anyway.
                 */
                <>{item.legal.netQuantity ?? 'Soil, feed & tools'}</>
              )}
            </span>

            <span className="mt-xs block text-[1.1rem] leading-tight font-semibold">
              {item.commonName}
            </span>
            {item.botanicalName && (
              <span className="text-ink-muted block text-sm italic">{item.botanicalName}</span>
            )}

            {/*
              The summary is the reason to buy, in one line, in our voice. It
              sits ABOVE the care spec on purpose: care facts answer "can I keep
              it", the summary answers "why this one", and a card that leads with
              a number is a spec sheet.
            */}
            {item.summary && <span className="mt-sm block text-sm">{item.summary}</span>}

            {isPlant ? (
              <>
                <span className="text-ink-muted mt-sm block text-sm">
                  Water every {item.care.waterIntervalDays} days · keep soil at{' '}
                  {item.care.soilMoistureTargetPct}%
                </span>
                <span className="mt-xs block text-sm">
                  {item.care.toxicity === 'safe' ? (
                    <span className="text-success">Safe around pets &amp; kids</span>
                  ) : (
                    <span className="text-ink-muted">Toxic if eaten — keep it up high</span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-ink-muted mt-sm block text-sm">
                Refunded in money within 24 hours — no guarantee needed.
              </span>
            )}

            {/*
              `mt-auto` pins the price to the bottom of the card so a grid row of
              different-length titles still lines its prices up. Without it the
              price floats and the grid reads as ragged.
            */}
            <span className="pt-sm mt-auto block text-[1.05rem] font-semibold">
              {item.ladder[0]!.isEntryOption && item.planters.length > 0 ? 'from ' : ''}
              {formatPaise(item.ladder[0]!.totalPaise)}
            </span>

            {item.rating.count > 0 && (
              <span className="text-ink-muted mt-xs block text-xs">
                {item.rating.average.toFixed(1)} from {item.rating.count}{' '}
                {item.rating.count === 1 ? 'review' : 'reviews'}
              </span>
            )}
          </div>
        </Link>
      </article>
    </li>
  )
}

/** `/plant/[slug]` for a plant, `/plant/[sku]` for everything else. */
export function itemHref(item: CatalogueItem): string {
  return `/plant/${item.slug}${item.itemClass === 'plant' ? `?tier=${item.sizeTier}` : ''}`
}

function humanise(value: string): string {
  return value.replace(/_/g, ' ')
}
