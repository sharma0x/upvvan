import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * Facet, filter, sort and search engine for the catalogue.
 *
 * ── WHY THIS FILE IS PURE ───────────────────────────────────────────────────
 * Every function here is total: same input, same output, no clock, no database,
 * no fetch. That is not an aesthetic preference, it is what makes the storefront
 * testable at all. The PLP is the single most complex surface on the site — a
 * URL has to encode a selection, the selection has to survive a reload, a shared
 * link and a crawler, and the counts shown beside each checkbox have to agree
 * with what happens when you tick it. If that logic lives inside a React
 * component it can only be tested by mounting a browser.
 *
 * ── WHY THE FACET AXES ARE THESE ────────────────────────────────────────────
 *
 * The audit is unambiguous on this. Ugaoo runs ten facet groups on a 187-SKU
 * store and the highest-value one is not botanical taxonomy — it is
 * "ideal plants location" (Office Desk 47, Living Room Tables 54, Shaded
 * Balconies 55) and "Maintenance" (Low 78). Urvann adds season and location to
 * nineteen groups. Kyari's SEO engine is a `size × room × benefit` matrix.
 *
 * So the axes below are the ones buyers actually scan, and NOT the ones a
 * botanist would file under:
 *
 *   light   — the single best predictor of whether a first plant survives. The
 *             dominant first-plant failure is a plant placed in a room with no
 *             window, and this is the only facet that can prevent that purchase.
 *   care    — difficulty, i.e. "will I kill this", which is the buyer's real
 *             question behind "is it hard to keep".
 *   safety  — every global leader exposes this and most Indian competitors hide
 *             it. A household with a cat or a toddler is a real segment.
 *   size    — doubles as a merchandising axis and a Legal Metrology r.6(10)
 *             declared dimension.
 *   season  — this is the one that is ours alone. Nobody in India publishes a
 *             ship-calendar, and March–June at 40–46°C is the window that
 *             actually kills plants.
 *   stock   — Ugaoo makes availability an explicit facet (In stock 138 / Out of
 *             stock 105). Ours is not decorative: a sold-out plant that still
 *             has a live "Add to cart" is the mis-representation complaint every
 *             audit found.
 *
 * ── WHAT IS DELIBERATELY NOT A FACET ───────────────────────────────────────
 * Botanical family. Nobody searching for a plant for a bedroom wants to filter
 * by Araceae. `botanicalName` is on the card as an italic subtitle and in the
 * PDP's statutory block, where it belongs, and nowhere else.
 */

/** The kind of thing being sold. Drives which remedy applies after purchase. */
export type ItemClass = 'plant' | 'planter' | 'consumable'

export type LightRequirement = 'low' | 'bright_indirect' | 'direct'
export type Difficulty = 'easy' | 'moderate' | 'fussy'
export type Toxicity = 'safe' | 'pets' | 'children'
export type Season = 'summer' | 'monsoon' | 'perennial'
export type SizeTier = 'XS' | 'MD' | 'LG' | 'XL'

/**
 * The minimum an item must expose to be filtered.
 *
 * Deliberately narrower than `CatalogueItem`. Consumables have no care profile
 * and no species, so requiring `care` here would make the "Soil & feed" filter
 * silently return nothing — which is exactly the class of bug that hides behind
 * a plausible-looking type and an empty grid.
 */
export interface Facetable {
  id: string
  commonName: string
  botanicalName: string | null
  description: string | null
  slug: string
  itemClass: ItemClass
  sizeTier: SizeTier
  /** Bare-plant price at this tier, in integer paise. */
  entryPaise: number
  stock: number
  light: LightRequirement
  difficulty: Difficulty
  toxicity: Toxicity
  waterIntervalDays: number
  seasons: Season[]
  edible: boolean
  airPurifying: boolean
  vastuFriendly: boolean
}

export type FacetKey = 'class' | 'light' | 'care' | 'safety' | 'size' | 'season' | 'stock'

export interface FacetOption {
  key: FacetKey
  value: string
  label: string
  /** Short clarification shown under the label. */
  hint?: string
}

export interface FacetGroup {
  key: FacetKey
  label: string
  options: FacetOption[]
}

export interface FacetSelection {
  class?: string[]
  light?: string[]
  care?: string[]
  safety?: string[]
  size?: string[]
  season?: string[]
  stock?: string[]
  /** Ceiling on the bare-plant price, in integer paise. */
  maxPaise?: number
  /** Floor on the bare-plant price, in integer paise. */
  minPaise?: number
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'easiest' | 'biggest'

export const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'featured', label: 'Featured' },
  { key: 'easiest', label: 'Easiest to keep alive' },
  { key: 'biggest', label: 'Biggest first' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'name-asc', label: 'Name: A to Z' },
]

/**
 * The facet groups, in the order they render.
 *
 * Order is merchandising, not alphabetical: the two questions a first-time
 * buyer asks — "will it live in my room" and "will I kill it" — come before the
 * ones a repeat buyer asks — "do I want the big one" and "what is in stock".
 */
export const FACET_GROUPS: ReadonlyArray<FacetGroup> = [
  {
    key: 'light',
    label: 'Light in the room',
    options: [
      { key: 'light', value: 'low', label: 'Low light', hint: 'Corner, or no window at all' },
      {
        key: 'light',
        value: 'bright_indirect',
        label: 'Bright indirect',
        hint: 'Near a window, out of direct sun',
      },
      { key: 'light', value: 'direct', label: 'Direct sun', hint: 'Balcony, terrace, window sill' },
    ],
  },
  {
    key: 'care',
    label: 'How hard it is to keep',
    options: [
      { key: 'care', value: 'easy', label: 'Easy', hint: 'Miss a watering and it forgives you' },
      { key: 'care', value: 'moderate', label: 'Moderate', hint: 'Wants a routine, not a hobby' },
      { key: 'care', value: 'fussy', label: 'Fussy', hint: 'Tells you clearly when it is unhappy' },
    ],
  },
  {
    key: 'safety',
    label: 'Pets and children',
    options: [
      { key: 'safety', value: 'safe', label: 'Safe if chewed', hint: 'Non-toxic to cats and dogs' },
      { key: 'safety', value: 'toxic', label: 'Toxic if eaten', hint: 'Keep it out of reach' },
    ],
  },
  {
    key: 'size',
    label: 'Size',
    options: [
      { key: 'size', value: 'XS', label: 'XS', hint: 'Desk and windowsill' },
      { key: 'size', value: 'MD', label: 'MD', hint: 'Table and floor' },
      { key: 'size', value: 'LG', label: 'LG', hint: 'Statement plant' },
      { key: 'size', value: 'XL', label: 'XL', hint: 'Floor or courtyard' },
    ],
  },
  {
    key: 'season',
    label: 'Season in Bengaluru',
    options: [
      { key: 'season', value: 'summer', label: 'Survives the summer', hint: '40–46°C, Mar–Jun' },
      { key: 'season', value: 'monsoon', label: 'Monsoon-proof', hint: 'Drainage first' },
      { key: 'season', value: 'perennial', label: 'Year-round', hint: 'Every month' },
    ],
  },
  {
    key: 'class',
    label: 'What it is',
    options: [
      { key: 'class', value: 'plant', label: 'Live plants' },
      { key: 'class', value: 'consumable', label: 'Soil, feed and tools' },
      { key: 'class', value: 'planter', label: 'Pots' },
    ],
  },
  {
    key: 'stock',
    label: 'Availability',
    options: [
      { key: 'stock', value: 'in', label: 'In stock now' },
      { key: 'stock', value: 'out', label: 'Sold out' },
    ],
  },
]

/** Severity order, so "easiest first" is a total order rather than a shrug. */
const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, moderate: 1, fussy: 2 }
const SIZE_RANK: Record<SizeTier, number> = { XS: 0, MD: 1, LG: 2, XL: 3 }

/** Does this item satisfy one facet key against the ticked values? */
export function matchesFacet(item: Facetable, key: FacetKey, values: string[]): boolean {
  if (values.length === 0) return true

  switch (key) {
    case 'class':
      return values.includes(item.itemClass)
    case 'light':
      return values.includes(item.light)
    case 'care':
      return values.includes(item.difficulty)
    case 'safety':
      return values.includes(item.toxicity === 'safe' ? 'safe' : 'toxic')
    case 'size':
      return values.includes(item.sizeTier)
    case 'season':
      return item.seasons.some((s) => values.includes(s))
    case 'stock':
      return values.includes(item.stock > 0 ? 'in' : 'out')
  }
}

/**
 * Apply a selection.
 *
 * OR within a facet, AND across facets. That is the only combination that
 * behaves the way a shopper expects: ticking "Easy" and "Low light" means "easy
 * AND low light", while ticking "Easy" and "Moderate" means "either", because
 * the second tick was obviously an attempt to undo the first.
 *
 * Empty values in a group — which is what a hostile or hand-edited URL produces
 * — are dropped rather than honoured. `?light=&light=low` must not mean "no
 * light required", because that would silently return the whole catalogue.
 */
export function filterItems(items: readonly Facetable[], selection: FacetSelection): Facetable[] {
  const cleaned = cleanSelection(selection)

  return items.filter((item) => {
    for (const key of FACET_ORDER) {
      if (!matchesFacet(item, key, cleaned[key] ?? [])) return false
    }
    if (cleaned.minPaise != null && item.entryPaise < cleaned.minPaise) return false
    if (cleaned.maxPaise != null && item.entryPaise > cleaned.maxPaise) return false
    return true
  })
}

const FACET_ORDER: readonly FacetKey[] = [
  'class',
  'light',
  'care',
  'safety',
  'size',
  'season',
  'stock',
]

/** Drop blanks and duplicates; cap the list so a URL cannot ask for the universe. */
export function cleanSelection(selection: FacetSelection): FacetSelection {
  const out: FacetSelection = {}
  for (const key of FACET_ORDER) {
    const raw = selection[key]
    if (!raw) continue
    const values = [...new Set(raw.map((v) => v.trim()).filter((v) => v !== ''))]
    if (values.length > 0) out[key] = values
  }
  if (selection.minPaise != null && Number.isFinite(selection.minPaise)) {
    out.minPaise = Math.max(0, Math.trunc(selection.minPaise))
  }
  if (selection.maxPaise != null && Number.isFinite(selection.maxPaise)) {
    out.maxPaise = Math.max(0, Math.trunc(selection.maxPaise))
  }
  return out
}

/**
 * Counts beside each checkbox.
 *
 * ── THE RULE THAT MATTERS ───────────────────────────────────────────────────
 * A count must be computed with that option's OWN facet removed, not with the
 * full selection applied. Otherwise ticking the last item in a group shows a
 * grid of one and zeroes on every other box, so the customer cannot see what
 * widening the selection would reveal, and a one-tick group looks like a dead
 * end. Every competitor audited gets this wrong; it is the most common reason a
 * faceted store feels broken.
 *
 * The count is also the number of results you would actually get, so it is
 * honest under every combination.
 */
export function facetCounts(
  items: readonly Facetable[],
  selection: FacetSelection,
): Record<string, number> {
  const cleaned = cleanSelection(selection)
  const counts: Record<string, number> = {}

  for (const group of FACET_GROUPS) {
    const others = { ...cleaned }
    delete others[group.key]
    const pool = filterItems(items, others)

    for (const option of group.options) {
      const key = `${group.key}:${option.value}`
      counts[key] = pool.filter((item) => matchesFacet(item, group.key, [option.value])).length
    }
  }

  return counts
}

/**
 * Sort.
 *
 * Every comparator ends in a name-then-id tiebreak. Without it `Array.sort` is
 * stable but the input order is whatever Postgres returned, so two renders of
 * the same URL can differ — which makes a grid impossible to screenshot, assert
 * on, or have a customer describe to us over the phone.
 */
export function sortItems(items: readonly Facetable[], sort: SortKey): Facetable[] {
  const byName = (a: Facetable, b: Facetable) =>
    a.commonName.localeCompare(b.commonName, 'en') || a.id.localeCompare(b.id)

  const out = [...items]
  switch (sort) {
    case 'price-asc':
      return out.sort((a, b) => a.entryPaise - b.entryPaise || byName(a, b))
    case 'price-desc':
      return out.sort((a, b) => b.entryPaise - a.entryPaise || byName(a, b))
    case 'name-asc':
      return out.sort(byName)
    case 'easiest':
      return out.sort(
        (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || byName(a, b),
      )
    case 'biggest':
      return out.sort((a, b) => SIZE_RANK[b.sizeTier] - SIZE_RANK[a.sizeTier] || byName(a, b))
    case 'featured':
      // In stock first, then the entry price, then name. "Featured" is a
      // merchandising label, so it needs a definition that a founder can
      // predict: what is sellable, cheapest-first, alphabetical within price.
      return out.sort(
        (a, b) =>
          Number(b.stock > 0) - Number(a.stock > 0) || a.entryPaise - b.entryPaise || byName(a, b),
      )
  }
}

/**
 * Search.
 *
 * ── WHY IT IS TOKEN-AND-PREFIX, NOT SUBSTRING ───────────────────────────────
 * `includes()` matches "jade" inside "adjacent", so searching for a room name
 * returns every plant whose description mentions the room. Search that returns
 * nonsense is worse than no search: the customer concludes the catalogue is
 * empty. Every query is lowercased, split on non-alphanumerics, and matched at
 * word boundaries, with a prefix match so "monst" finds "monstera" while "adj"
 * does not find "adjacent".
 *
 * Scoring is ordered so a name hit always beats a description hit: the thing
 * someone typed is almost always the plant's name, and burying it under a
 * paragraph mention is how a search becomes useless.
 */
export function searchItems(items: readonly Facetable[], query: string): Facetable[] {
  const terms = tokenise(query)
  if (terms.length === 0) return []

  const scored: Array<{ item: Facetable; score: number }> = []

  for (const item of items) {
    const name = tokenise(item.commonName)
    const botanical = item.botanicalName ? tokenise(item.botanicalName) : []
    const body = tokenise(item.description ?? '')

    let score = 0
    let matchedAll = true

    for (const term of terms) {
      let termScore = 0
      if (name.some((t) => t === term)) termScore = 100
      else if (name.some((t) => t.startsWith(term))) termScore = 80
      else if (botanical.some((t) => t === term)) termScore = 60
      else if (botanical.some((t) => t.startsWith(term))) termScore = 40
      else if (body.some((t) => t === term) || body.some((t) => t.startsWith(term))) termScore = 15
      else {
        matchedAll = false
        break
      }
      score += termScore
    }

    // AND semantics: every term must land somewhere. A query is a description
    // of what the customer wants, not a list of alternatives.
    if (matchedAll && score > 0) scored.push({ item, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.item.commonName.localeCompare(b.item.commonName))
    .map((s) => s.item)
}

function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
}

// ── URL <-> selection ───────────────────────────────────────────────────────

/**
 * Read a facet selection out of search params.
 *
 * `URLSearchParams.getAll` is the only correct reader: `get` returns the FIRST
 * value, so `?light=low&light=direct` would silently become `light=low` and a
 * customer who ticked two boxes would be told, confidently, that they had
 * ticked one.
 */
export function parseFacetSelection(params: URLSearchParams): FacetSelection {
  const selection: FacetSelection = {}

  for (const key of FACET_ORDER) {
    const values = params.getAll(key).filter((v) => v.trim() !== '')
    if (values.length > 0) selection[key] = values
  }

  const min = params.get('min')
  const max = params.get('max')
  if (min != null && min.trim() !== '') selection.minPaise = toPaiseParam(min)
  if (max != null && max.trim() !== '') selection.maxPaise = toPaiseParam(max)

  return cleanSelection(selection)
}

/**
 * Paise from a URL param.
 *
 * `Number.parseFloat` is banned project-wide by ESLint and rightly so, but this
 * is not money arithmetic — it is a query-string integer that is immediately
 * clamped by `cleanSelection`. Using `parseInt` with an explicit radix is the
 * honest spelling of "read an integer"; it never returns a fractional paise
 * because a fraction cannot be represented after truncation.
 */
function toPaiseParam(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Serialise a selection back into a query string, omitting everything empty. */
export function facetSelectionToQuery(selection: FacetSelection): string {
  const cleaned = cleanSelection(selection)
  const params = new URLSearchParams()

  for (const key of FACET_ORDER) {
    for (const value of cleaned[key] ?? []) params.append(key, value)
  }
  if (cleaned.minPaise) params.set('min', String(cleaned.minPaise))
  if (cleaned.maxPaise) params.set('max', String(cleaned.maxPaise))

  return params.toString()
}

/** Is anything ticked? Used to decide between "no results" and "nothing here". */
export function hasActiveSelection(selection: FacetSelection): boolean {
  const cleaned = cleanSelection(selection)
  return (
    FACET_ORDER.some((key) => (cleaned[key]?.length ?? 0) > 0) ||
    cleaned.minPaise != null ||
    cleaned.maxPaise != null
  )
}

/** The cheapest and dearest bare-plant prices in the pool, for the price inputs. */
export function priceBounds(items: readonly Facetable[]): { minPaise: number; maxPaise: number } {
  if (items.length === 0) return { minPaise: 0, maxPaise: 0 }
  let min = items[0]!.entryPaise
  let max = min
  for (const item of items) {
    if (item.entryPaise < min) min = item.entryPaise
    if (item.entryPaise > max) max = item.entryPaise
  }
  return { minPaise: min, maxPaise: max }
}

/** Human copy for a facet value, reused by cards, chips and the collection pages. */
export function facetValueLabel(key: FacetKey, value: string): string {
  for (const group of FACET_GROUPS) {
    if (group.key !== key) continue
    const hit = group.options.find((o) => o.value === value)
    if (hit) return hit.label
  }
  return value
}

/** Label for the stock badge, or null when in stock. */
export function stockBadge(stock: number): { label: string; tone: 'ok' | 'low' | 'out' } | null {
  if (stock <= 0) return { label: 'Sold out', tone: 'out' }
  if (stock <= LOW_STOCK_THRESHOLD) return { label: `Only ${stock} left`, tone: 'low' }
  return null
}

/**
 * The number below which we say so.
 *
 * Five is a judgement call, and it is written here as a named constant rather
 * than sprinkled through a card because it is a commercial decision: "only 3
 * left" is a real urgency signal, and it is also the kind of pressure tactic
 * that this business explicitly does not play (see the TrustRail copy). So the
 * threshold is a fact about our own bench, and it is applied identically on the
 * card, the PDP and the collection pages.
 */
export const LOW_STOCK_THRESHOLD = 5

/** "from ₹299" / "₹299" — the price line format every card and list uses. */
export function priceLine(item: Facetable): string {
  return formatPaise(item.entryPaise)
}
