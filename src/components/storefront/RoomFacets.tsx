import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'

/**
 * Room & light facets.
 *
 * ── WHY THIS BLOCK IS FACETS AND NOT A QUIZ ──────────────────────────────────
 * Bloomscape's hero is "What kind of plant parent are you?" and it converts,
 * because a quiz converts an unbounded decision ("which plant?") into a bounded
 * one. That reasoning holds — but a Typeform quiz is a dead end for a customer
 * on a patchly Bengaluru mobile connection, and it also delays the one question
 * that actually gates the sale: do we deliver to you.
 *
 * So the facets do the quiz's job synchronously. The four tiles below are the
 * same four Bloomscape uses, with one deliberate substitution:
 *
 *   Bloomscape "Low Light"      → "AC flat, no window"
 *   Bloomscape "Pet-Friendly"    → "Safe around pets & kids"
 *   Bloomscape "Statement"       → "Impossible to kill"
 *   Bloomscape "Easy Care"       → "Balcony & outdoor"
 *
 * The substitution is the India adaptation the research calls for. Lux-based light
 * measurement false-negatives most of the Indian market, because the defining fact
 * of an Indian rented flat is not low light — it is AC running all day and no
 * window at all. "Low Light" is a horticultural fact; "AC flat, no window" is the
 * same fact as the customer would say it, which is what makes it filterable.
 *
 * These link to the catalogue anchor, not to separate collection pages. We have
 * 12 seasonal listings, not 150 SKUs; building four dead-ended collection pages
 * for a dozen products would be worse than one honest grid.
 */
const FACETS = [
  {
    key: 'ac',
    label: 'AC flat, no window',
    body: 'No natural light. These hold up on an AC room and an LED tube.',
  },
  {
    key: 'safe',
    label: 'Safe around pets & kids',
    body: 'Non-toxic if it gets chewed. Filtered from the care data, not guessed.',
  },
  {
    key: 'easy',
    label: 'Impossible to kill',
    body: 'Forgive a missed watering. The honest choice for a first plant.',
  },
  {
    key: 'outdoor',
    label: 'Balcony & outdoor',
    body: 'Full sun and real weather. Only in season — we swap them out.',
  },
] as const

/**
 * Categorise a listing against the facet tiles, from care fields the database
 * already holds. Deliberately NOT a separate flag column: care data is the source
 * of truth (a plant that is non-toxic must never be sold as toxic, and the PDP
 * reads the same field), so the facets are derived from it rather than trusted
 * independently.
 */
export function facetFor(item: CatalogueItem): string[] {
  const f: string[] = []
  // `care.light` is the enum projected from Species.care.light.
  if (item.care.light === 'low' || item.care.light === 'medium') f.push('ac')
  if (item.care.toxicity === 'safe') f.push('safe')
  if (item.care.difficulty === 'easy') f.push('easy')
  if (item.itemClass !== 'plant') f.push('outdoor')
  return f
}

export default function RoomFacets({ items }: { items: CatalogueItem[] }) {
  const counts = Object.fromEntries(
    FACETS.map((f) => [f.key, items.filter((i) => facetFor(i).includes(f.key)).length]),
  ) as Record<string, number>

  return (
    <section className="mx-auto max-w-[1120px] px-base pt-3xl">
      <p className="text-label-caps text-clay m-0">Find your plant</p>
      <h2 className="mt-xs mb-0">Start from your room, not the species name</h2>
      <p className="text-ink-muted mt-xs mb-lg max-w-[60ch]">
        Most people kill their first plant by choosing something that needs a window they do not
        have. Answer for your actual room.
      </p>

      <ul className="m-0 grid list-none grid-cols-1 gap-base p-0 sm:grid-cols-2 lg:grid-cols-4">
        {FACETS.map((f) => {
          const count = counts[f.key] ?? 0
          const empty = count === 0

          /*
           * An empty facet is rendered as a NON-interactive element, not a dimmed
           * link. A link to an anchor with nothing behind it is a promise we
           * cannot keep, and "0 in season" behind an underline still looks
           * clickable. It also says why it is empty, which is more use than a
           * disabled tile would be.
           */
          const inner = (
            <>
              <span className="block text-[1.02rem] leading-snug font-semibold">{f.label}</span>
              <span className="text-ink-muted mt-xs block text-sm">{f.body}</span>
              <span className={`mt-sm block text-label-caps ${empty ? 'text-ink-muted' : 'text-clay'}`}>
                {empty ? 'None in season right now' : `${count} in season`}
              </span>
            </>
          )

          return (
            <li key={f.key}>
              {empty ? (
                <div
                  aria-disabled="true"
                  className="border-border bg-surface-raised block h-full rounded-md border border-dashed p-base opacity-70"
                >
                  {inner}
                </div>
              ) : (
                <Link
                  href="#catalogue"
                  className="border-border bg-surface-card hover:border-clay block h-full rounded-md border p-base text-ink no-underline"
                >
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Re-exported for the catalogue section, which needs the same price helper. */
export { formatPaise }