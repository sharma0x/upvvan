import Link from 'next/link'

import type { CollectionDef } from '@/lib/catalogue/collections'
import { collectionSize } from '@/lib/catalogue/collections'
import { formatPaise } from '@/lib/catalogue/pricing'
import type { Facetable } from '@/lib/catalogue/facets'

/**
 * Tiles linking to the collection pages.
 *
 * ── WHY A COLLECTION WITH ZERO RESULTS IS NOT LINKED ────────────────────────
 *
 * Every audited competitor links to collections that are empty. Kyari's own
 * sitemap carries `/pages/tesing`, `/pages/deal-test` and `gift-box-builder-2`;
 * Ugaoo's mega-menu links four pages that 404. It is free at authoring time
 * and it costs crawl budget, a customer's time, and the appearance of a shop
 * that does not know what it stocks.
 *
 * So `collectionSize` returning null means the tile is not rendered at all. That
 * is the difference between a nav and a wishlist.
 *
 * ── WHY THE TILE SHOWS A PRICE ──────────────────────────────────────────────
 *
 * A tile that says "Pet safe plants · 4" is a category. A tile that says "Pet
 * safe plants · 4 · from ₹299" is a price comparison, and the whole reason a
 * shopper browses by benefit is to know whether it is affordable. Kyari's
 * headline "₹199/unit · MOQ 30" is exactly this, and it is the single most
 * effective line on any B2C page in the dataset.
 */
export default function CollectionTiles({
  items,
  collections,
  heading,
  headingLevel = 'h2',
  description,
}: {
  items: readonly Facetable[]
  collections: readonly CollectionDef[]
  heading: string
  headingLevel?: 'h2' | 'h3'
  description?: string
}) {
  const live = collections
    .map((def) => ({ def, size: collectionSize(items, def) }))
    .filter(
      (x): x is { def: CollectionDef; size: NonNullable<ReturnType<typeof collectionSize>> } =>
        x.size !== null,
    )

  const Heading = headingLevel

  if (live.length === 0) return null

  return (
    <section>
      <Heading className="mb-0">{heading}</Heading>
      {description && <p className="text-ink-muted mt-xs mb-base">{description}</p>}

      <ul className="gap-sm m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {live.map(({ def, size }) => (
          <li key={def.handle}>
            <Link
              href={`/collections/${def.handle}`}
              className="border-border bg-surface-card hover:border-clay p-base text-ink flex h-full flex-col rounded-md border no-underline"
            >
              <span className="text-label-caps text-clay block">
                {size.count} plant{size.count === 1 ? '' : 's'}
              </span>
              <span className="mt-xs block text-[1.05rem] leading-tight font-semibold">
                {def.label}
              </span>
              <span className="text-ink-muted mt-xs block text-sm">{def.headline}</span>
              <span className="text-ink-muted pt-sm mt-auto block text-sm">
                from {formatPaise(size.minPaise)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
