import Link from 'next/link'

import type { CatalogueItem } from '@/lib/catalogue/loader.server'
import { resolveArt } from '@/components/catalogue/ItemGrid'
import PagedItemGrid from '@/components/catalogue/PagedItemGrid'
import { BATCH_SIZE } from '@/lib/catalogue/paging'
import { firstBatch } from '@/lib/catalogue/grid.server'

/**
 * The seasonal catalogue grid.
 *
 * ── WHAT IS ON A CARD, AND WHY ──────────────────────────────────────────────
 * That reasoning lives on `PlantCard`, which is the single implementation used
 * by the homepage, the PLP, the collection pages, search results and the cart.
 * It used to live here, in a private card component, which meant the second grid
 * to be written would not know about it — and the second grid (the PLP) is
 * already here.
 *
 * ── WHY CONSUMABLES ARE SEPARATED ───────────────────────────────────────────
 * Freight is a fixed cost per parcel, so a 450g pack of neem cake ships at the
 * same courier rate as a 5ft mango plant — supplies are structurally
 * higher-margin at any distance, and both TrustBasket and Paudhewale have quietly
 * made supplies the business. They get their own rail, in ochre, because the
 * goods are soil and fertiliser and not living things.
 *
 * That rail used to be dead code: the loader INNER-JOINed `species`, so a
 * consumable — which has no species row — was dropped before this component ever
 * saw it. It now works, and the three seeded soil-and-feed SKUs have pages again.
 */
export default function Catalogue({
  plants,
  consumables,
  seasonNote,
  cityName,
}: {
  plants: CatalogueItem[]
  consumables: CatalogueItem[]
  seasonNote: string
  cityName: string
}) {
  /*
   * One art resolution for both rails, threaded so the second rail does not lead
   * with a photograph the first one already showed.
   */
  const plantArt = resolveArt(plants)
  const restArt = resolveArt(consumables, new Set([...plantArt.values()].map((i) => i.index)))

  return (
    <section id="catalogue" className="scroll-mt-lg px-base pt-3xl mx-auto max-w-[1120px]">
      <p className="text-label-caps text-clay m-0">
        {cityName} · {plants.length} listing{plants.length === 1 ? '' : 's'} in season
      </p>
      <h2 className="mt-xs mb-0">What we can honestly sell you right now</h2>
      <p className="text-ink-muted mt-xs mb-lg max-w-[62ch]">{seasonNote}</p>

      {plants.length === 0 ? (
        <p className="border-warning bg-surface-raised p-lg rounded-md border">
          Nothing is in season for {cityName} right now. We would rather say so than sell you
          something that will not survive the weather — we swap species in and out with the season
          rather than pausing the site.
        </p>
      ) : (
        <PagedItemGrid
          initial={firstBatch(plants, plantArt, BATCH_SIZE).first}
          params={{ set: 'home:plants' }}
          total={plants.length}
        />
      )}

      {/*
        The link to the full catalogue. A homepage grid capped at a rail is a
        summary; `/plants` is where the filters live, and a customer who has to
        scroll back up to find it is a customer who never finds it.
      */}
      <p className="mt-base mb-0">
        <Link href="/plants" className="text-primary underline">
          Filter all {plants.length + consumables.length} listings by light, room, difficulty and
          availability →
        </Link>
      </p>

      {consumables.length > 0 && (
        <div className="border-border bg-surface-raised mt-2xl p-lg rounded-lg border">
          <div className="gap-base flex flex-wrap items-baseline justify-between">
            <h3 className="m-0">Soil, feed &amp; tools</h3>
            <p className="text-ink-muted m-0 max-w-[52ch] text-sm">
              Cheaper than a plant to send and worth more to a plant that survives. Prepaid, and the
              only thing on this site we refund in money.
            </p>
          </div>
          <div className="mt-base">
            <PagedItemGrid
              initial={firstBatch(consumables, restArt, BATCH_SIZE).first}
              params={{ set: 'home:consumables' }}
              total={consumables.length}
              nounOne="product"
              nounMany="products"
            />
          </div>
        </div>
      )}
    </section>
  )
}
