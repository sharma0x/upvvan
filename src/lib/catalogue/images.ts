import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Catalogue artwork lookup.
 *
 * ── WHY THIS IS A FILESYSTEM PROBE AND NOT A DATABASE COLUMN ─────────────────
 * The right answer is a `media` upload field on `Species`. That is not built
 * yet, and until it is, the photographs in `public/images/plants` are keyed by
 * the species slug, which is the one identifier every layer already agrees on:
 * the seed script writes `Species.slug`, the PDP routes on it, and the card
 * hrefs are built from it.
 *
 * So the image path is DERIVED, not stored. That is a deliberate stopgap and it
 * has one honest limitation: it cannot express "this is the actual plant that
 * will ship in your parcel", which is the photograph the research says we
 * eventually need. A Pinterest image is a picture of a money plant; the bench
 * photo against a ruler is a picture of YOUR money plant. Those are not
 * interchangeable and the PDP must not imply the latter once real photography
 * lands.
 *
 * `existsSync` rather than an optimistic path, because a card that renders a
 * broken image box is worse than a card with no image. Every caller renders a
 * typographic fallback when this returns null, so adding a species to the seed
 * script without downloading its art degrades cleanly instead of looking broken.
 *
 * Files are named `<slug>-NN.jpg` by scripts/plant-image-dl.py, which is the
 * same slug vocabulary the seed script uses.
 */
const PUBLIC_DIR = join(process.cwd(), 'public', 'images', 'plants')

/** How many images we attempt per species. */
const PER_SPECIES = 9

export interface PlantImage {
  /** Web path, suitable for next/image. */
  src: string
  /** Zero-based index within the species' set. */
  index: number
}

/** Every image available for one species slug, in order. Empty if none. */
export function imagesForSpecies(slug: string): PlantImage[] {
  const out: PlantImage[] = []
  for (let i = 1; i <= PER_SPECIES; i++) {
    const file = `${slug}-${String(i).padStart(2, '0')}.jpg`
    if (existsSync(join(PUBLIC_DIR, file))) {
      out.push({ src: `/images/plants/${file}`, index: i - 1 })
    }
  }
  return out
}

/**
 * The image to lead a card with.
 *
 * Deterministic per slug rather than random: a card whose photo changes on every
 * render is un-screenshot-able, un-testable, and mildly unsettling. Hashing the
 * slug spreads species across the set so a grid is not six near-identical photos.
 */
export function leadImageForSpecies(slug: string): PlantImage | null {
  const all = imagesForSpecies(slug)
  if (all.length === 0) return null

  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  }
  return all[hash % all.length]!
}

/** Distinct images for a grid of slugs, so no two adjacent cards repeat. */
export function leadImagesFor(slugs: readonly string[]): Map<string, PlantImage> {
  const map = new Map<string, PlantImage>()
  const used = new Set<number>()

  for (const slug of slugs) {
    const all = imagesForSpecies(slug)
    if (all.length === 0) continue

    let hash = 0
    for (let i = 0; i < slug.length; i++) {
      hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
    }
    // Walk forward from the hash until we land on an index no earlier card took.
    let pick = all[hash % all.length]!
    for (let step = 0; step < all.length && used.has(pick.index); step++) {
      pick = all[(all.indexOf(pick) + 1) % all.length]!
    }
    used.add(pick.index)
    map.set(slug, pick)
  }

  return map
}