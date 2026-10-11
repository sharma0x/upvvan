import type { CatalogueItem } from '@/lib/catalogue/loader.server'
import { leadImagesForItems, type PlantImage } from '@/lib/catalogue/images'
import PlantCard from '@/components/catalogue/PlantCard'

/**
 * A grid of catalogue items.
 *
 * ── WHY ART IS RESOLVED HERE AND NOT PER CARD ───────────────────────────────
 *
 * `leadImagesForExcluding` de-duplicates across the whole set so two adjacent
 * cards do not show the same photograph. Calling it inside each card gives every
 * card an independently-hashed image and the grid repeats. So the caller passes
 * one resolved map, and a grid that forgets is visibly worse rather than
 * silently worse.
 *
 * The `taken` set threads through every grid on a page, so a hero, a rail and a
 * grid do not all lead with the same photograph.
 */
export type ArtMap = Map<string, PlantImage>

/**
 * Resolve lead art for a set of items, avoiding images already on the page.
 *
 * Keyed by `skuId`, not slug — see `leadImagesForItems`. Two size tiers of one
 * species are two rows and must not be handed the same photograph.
 */
export function resolveArt(
  items: readonly CatalogueItem[],
  taken: ReadonlySet<number> = new Set(),
) {
  return leadImagesForItems(items, taken)
}

/** The index numbers a resolved map has already claimed. */
export function takenFrom(art: ArtMap): Set<number> {
  return new Set([...art.values()].map((i) => i.index))
}

/**
 * The catalogue grid.
 *
 * `<ul>` of `<li>`, not a `<div>` of `<div>`s. A plant catalogue is a list of
 * products; the grid is a layout, and using the wrong element means a screen
 * reader announces "group" where it should say "3 items" — which is the only
 * thing a screen-reader user gets about how much choice they have.
 *
 * `priority` goes to the first `limit` cards only. `next/image` with `priority`
 * on twenty images tells the browser to preload twenty images before it renders
 * anything else, which is how a fast LCP becomes a slow one — the exact opposite
 * of what the flag is for.
 */
export default function ItemGrid({
  items,
  art,
  limit,
  heading,
  headingLevel = 'h3',
  emptyMessage,
}: {
  items: readonly CatalogueItem[]
  art: ArtMap
  /** Cap the grid. The PLP passes nothing; rails pass a number. */
  limit?: number
  heading?: string
  headingLevel?: 'h2' | 'h3'
  emptyMessage?: string
}) {
  const shown = typeof limit === 'number' ? items.slice(0, limit) : items
  const Heading = headingLevel

  if (shown.length === 0) {
    if (!emptyMessage) return null
    return (
      <section>
        {heading && <Heading className="mt-0">{heading}</Heading>}
        <p className="border-warning bg-surface-raised p-lg rounded-md border">{emptyMessage}</p>
      </section>
    )
  }

  return (
    <section>
      {heading && <Heading className="mt-0">{heading}</Heading>}
      <ul className="gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, index) => (
          <PlantCard
            key={item.skuId}
            item={item}
            image={art.get(item.skuId)}
            priority={index < 3}
          />
        ))}
      </ul>
    </section>
  )
}
