import 'server-only'

import { leadImagesForExcluding, type PlantImage } from '@/lib/catalogue/images'
import type { PostSummary } from '@/lib/content/posts.server'

/**
 * Art for content cards, resolved from the related species.
 *
 * ── WHY THIS LIVES HERE AND NOT IN THE CARD COMPONENT ───────────────────────
 * `images.ts` probes the filesystem with `node:fs`, so it cannot be imported
 * into anything that might reach the client bundle. Keeping the resolution in a
 * `server-only` module means `PostCard` stays a plain presentational component
 * that takes a map, and a future client-side use of the card cannot accidentally
 * pull `fs` into the bundle and fail the build in a way that looks unrelated.
 *
 * ── WHY THE RESOLUTION IS ONE CALL FOR THE WHOLE LIST ───────────────────────
 * `leadImagesForExcluding` walks forward from a per-species hash until it lands
 * on an index nothing else has claimed. That de-duplication only works across a
 * SET: called per card it sees one species, has nothing to avoid, and a grid of
 * six shows the same ZZ plant three times.
 *
 * ── WHY THE SPECIES PHOTOGRAPH IS THE RIGHT COVER ──────────────────────────
 * A problem page about brown ZZ tips should look like a ZZ plant. An article
 * about repotting should look like the plants you would be repotting. Using a
 * generic stock image instead would be both less useful and less honest — the
 * photograph is not decoration, it is which plant this page is about.
 */
export type PostArtMap = Map<string, PlantImage>

export function resolvePostArt(posts: readonly PostSummary[]): PostArtMap {
  const wanted = new Set<string>()
  for (const post of posts) {
    for (const slug of post.speciesSlugs) wanted.add(slug)
  }
  if (wanted.size === 0) return new Map()
  return leadImagesForExcluding([...wanted], new Set())
}
