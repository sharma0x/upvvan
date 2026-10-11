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
  return all[slugHash(slug) % all.length]!
}

/** Distinct images for a grid of slugs, so no two adjacent cards repeat. */
export function leadImagesFor(slugs: readonly string[]): Map<string, PlantImage> {
  return leadImagesForExcluding(slugs, new Set())
}

/**
 * The same, against images another part of the page has already claimed.
 *
 * A page that renders a hero, a rail AND a grid would otherwise show the money
 * plant three times, and a customer scrolling past the same photograph twice
 * reads it as a site with four products. So the "already used" set is threaded
 * through every call on a page rather than being local to each grid.
 *
 * The walk-forward is unchanged in shape: start at the slug's hash, step until
 * you land on an index nothing else has taken, and if the species' whole set is
 * exhausted, take the hash position again. Exhaustive exhaustion is possible
 * with 8 images and 9 cards, and a repeated image is the right outcome there —
 * a missing image is not.
 */
export function leadImagesForExcluding(
  slugs: readonly string[],
  taken: ReadonlySet<number>,
): Map<string, PlantImage> {
  const map = new Map<string, PlantImage>()
  const used = new Set(taken)

  for (const slug of slugs) {
    if (map.has(slug)) continue
    const all = imagesForSpecies(slug)
    if (all.length === 0) continue

    let pick = all[slugHash(slug) % all.length]!
    for (let step = 0; step < all.length && used.has(pick.index); step++) {
      pick = all[(all.indexOf(pick) + 1) % all.length]!
    }
    used.add(pick.index)
    map.set(slug, pick)
  }

  return map
}

/**
 * Distinct images for a grid of CATALOGUE ROWS, keyed by sku.
 *
 * ── WHY THIS EXISTS RATHER THAN `leadImagesForExcluding` ─────────────────────
 *
 * `leadImagesForExcluding` is keyed by SLUG. But two size tiers of one species are
 * two rows in the catalogue and one plant to a shopper, so a grid that lists "Jade
 * Plant XS" next to "Jade Plant MD" passes the same slug twice — and the function's
 * own `if (map.has(slug)) continue` then hands BOTH rows the same photograph.
 *
 * That is exactly the outcome the whole module exists to prevent, and it was
 * visible on the homepage: two identical photos side by side, which a shopper reads
 * as one product duplicated rather than as two sizes of the same plant.
 *
 * So the walk is keyed by `skuId`, and the starting index is hashed from the sku as
 * well as the slug. Two tiers of one species therefore start at different positions
 * in that species' image set and get different pictures, while each row's photo
 * stays deterministic — same row, same picture, every render. That determinism is
 * what makes the grid screenshot-able and testable.
 */
export function leadImagesForItems(
  rows: readonly { skuId: string; slug: string }[],
  taken: ReadonlySet<number> = new Set(),
): Map<string, PlantImage> {
  const map = new Map<string, PlantImage>()

  /*
   * `used` is keyed PER SPECIES, which is the whole point.
   *
   * `PlantImage.index` is the position within one species' set, so "index 3" means
   * money-plant's fourth photograph. A single flat `Set<number>` therefore treats
   * money-plant's fourth photo and jade-plant's fourth photo as the same image, and
   * the walk-forward spends its steps dodging a collision that does not exist.
   *
   * The first version did exactly that, and the symptom was measurable: with twelve
   * cards on the page, every index 0–8 was quickly "used", the walk-forward had
   * nothing left to dodge, and two tiers of the jade plant went back to sharing a
   * photograph even though the species has eight on disk.
   *
   * So `used` is `slug → Set<index>`. Within a species the guarantee is absolute —
   * two tiers of the jade plant can never share a photo while jade-plant has images
   * left. Across species it is meaningless, so it is not attempted.
   *
   * `taken` is still honoured, as a soft global hint, because that is what
   * `takenFrom` hands over and it costs nothing; it just no longer prevents a
   * species from using its own images.
   */
  const usedBySlug = new Map<string, Set<number>>()

  for (const row of rows) {
    if (map.has(row.skuId)) continue
    const all = imagesForSpecies(row.slug)
    if (all.length === 0) continue

    const used = usedBySlug.get(row.slug) ?? new Set<number>()
    usedBySlug.set(row.slug, used)

    const start = slugHash(`${row.slug}::${row.skuId}`) % all.length
    let pick = all[start]!

    // Within this species, avoid an index already used by another row — and, as a
    // lower-priority preference, one the rest of the page has already claimed.
    for (let step = 0; step < all.length; step++) {
      if (!used.has(pick.index) && !taken.has(pick.index)) break
      pick = all[(all.indexOf(pick) + 1) % all.length]!
    }

    used.add(pick.index)
    map.set(row.skuId, pick)
  }

  return map
}

/** Stable per-slug hash. Deterministic beats random: see `leadImageForSpecies`. */
function slugHash(slug: string): number {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  }
  return hash
}
