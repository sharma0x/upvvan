import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { imagesForSpecies, leadImageForSpecies, leadImagesFor } from '../images'

/**
 * Catalogue artwork resolution.
 *
 * ── WHY THIS NEEDS TESTS WHEN THERE IS NO DATABASE INVOLVED ──────────────────
 * The resolver reads the filesystem and returns nothing when a file is absent,
 * which makes it exactly the shape of function that fails quietly: no exception,
 * no error log, just a card with a missing image that still looks deliberate
 * enough to ship. Every assertion here is about the FAILURE path.
 */

const PLANTS_DIR = join(process.cwd(), 'public', 'images', 'plants')

/** Create `<slug>-NN.jpg` files, returning a cleanup fn. */
function seed(slug: string, count: number): () => void {
  const made: string[] = []
  for (let i = 1; i <= count; i++) {
    const file = join(PLANTS_DIR, `${slug}-${String(i).padStart(2, '0')}.jpg`)
    mkdirSync(PLANTS_DIR, { recursive: true })
    writeFileSync(file, 'x')
    made.push(file)
  }
  return () => made.forEach((f) => rmSync(f, { force: true }))
}

describe('imagesForSpecies', () => {
  it('returns nothing for a species with no downloaded art', () => {
    // The whole point: a missing file must degrade to a typographic fallback,
    // never to a broken <img>.
    expect(imagesForSpecies('definitely-not-a-real-species-xyz')).toEqual([])
  })

  it('finds numbered files and reports their order', () => {
    const cleanup = seed('zz-test-a', 3)
    try {
      const found = imagesForSpecies('zz-test-a')
      expect(found).toHaveLength(3)
      expect(found.map((f) => f.src)).toEqual([
        '/images/plants/zz-test-a-01.jpg',
        '/images/plants/zz-test-a-02.jpg',
        '/images/plants/zz-test-a-03.jpg',
      ])
      expect(found.map((f) => f.index)).toEqual([0, 1, 2])
    } finally {
      cleanup()
    }
  })

  it('ignores gaps in the numbering rather than truncating', () => {
    mkdirSync(PLANTS_DIR, { recursive: true })
    // 01 and 03 present, 02 missing. A `find`-style scan would return two files
    // and a naive `count` read would return zero; the loop must skip the hole.
    writeFileSync(join(PLANTS_DIR, 'zz-test-b-01.jpg'), 'x')
    writeFileSync(join(PLANTS_DIR, 'zz-test-b-03.jpg'), 'x')
    try {
      expect(imagesForSpecies('zz-test-b').map((f) => f.index)).toEqual([0, 2])
    } finally {
      rmSync(join(PLANTS_DIR, 'zz-test-b-01.jpg'), { force: true })
      rmSync(join(PLANTS_DIR, 'zz-test-b-03.jpg'), { force: true })
    }
  })
})

describe('leadImageForSpecies', () => {
  it('returns null when there is no art, so the caller can render a fallback', () => {
    expect(leadImageForSpecies('definitely-not-a-real-species-xyz')).toBeNull()
  })

  it('is DETERMINISTIC for the same slug', () => {
    const cleanup = seed('zz-test-c', 5)
    try {
      // A card whose photograph changes on every render cannot be screenshotted,
      // diffed, or regression-tested.
      const a = leadImageForSpecies('zz-test-c')
      const b = leadImageForSpecies('zz-test-c')
      expect(a).toEqual(b)
    } finally {
      cleanup()
    }
  })
})

describe('leadImagesFor', () => {
  it('does not hand two cards the same photograph when alternatives exist', () => {
    const cleanup = seed('zz-test-d', 6)
    try {
      const picks = leadImagesFor(['zz-test-d', 'zz-test-d', 'zz-test-d'])
      const indexes = [...picks.values()].map((p) => p.index)
      expect(new Set(indexes).size).toBe(indexes.length)
    } finally {
      cleanup()
    }
  })

  it('omits species with no art rather than inserting a broken entry', () => {
    const map = leadImagesFor(['definitely-not-a-real-species-xyz'])
    expect(map.has('definitely-not-a-real-species-xyz')).toBe(false)
  })

  it('still returns something when one species has a single image', () => {
    // Fewer options than cards is the normal case for a new seed species, so
    // this must not throw or silently drop every card.
    const cleanup = seed('zz-test-e', 1)
    try {
      const picks = leadImagesFor(['zz-test-e', 'zz-test-e', 'zz-test-e'])
      expect(picks.size).toBe(1)
      expect(picks.get('zz-test-e')).not.toBeNull()
    } finally {
      cleanup()
    }
  })
})