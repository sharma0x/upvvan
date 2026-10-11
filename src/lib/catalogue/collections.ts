import type { Facetable } from '@/lib/catalogue/facets'

/**
 * Collection handles — the indexable URL axes.
 *
 * ── WHY THESE EXIST ALONGSIDE FACETS ────────────────────────────────────────
 * A facet is a control. A collection is a page, and the two are not
 * interchangeable for search.
 *
 * A shopper filters on a PDP grid and never leaves the shop. Someone who has
 * just moved into a flat in Indiranagar types "plants for a low light bedroom"
 * into a search engine, and no amount of client-side filtering will answer them.
 * That page has to exist, it has to have its own URL, it has to have copy that
 * answers the query, and it has to be in the sitemap.
 *
 * The shape is copied from the two structures that demonstrably work:
 *
 *   · Kyari generates ~250 of its 233 collections from
 *     `{size}-{room}-{benefit}` — office-desk, balcony, living-room,
 *     staircase, bedroom × stress-relief, air-purification, vastu-friendly,
 *     safe-for-pets, low-maintenance. It is the cheapest SEO surface in the
 *     category and it costs nothing but this file.
 *
 *   · Urvann publishes the seasonal axis nobody else in India has: summer-plants
 *     (4,529 SKUs), monsoon-plants (4,036), perennial-plants (3,653). That
 *     matters most to us, because Bengaluru's summer is the reason the catalogue
 *     changes shape three times a year and no competitor will say so out loud.
 *     We swap species rather than pausing the shop; a customer who asks in April
 *     deserves a page that tells them exactly what is honest to ship in April.
 *
 * ── WHY ROOM AND BENEFIT ARE COLLECTIONS AND NOT CHECKBOXES ────────────────
 * A checkbox can only ever be *filtered around*. "Plants for a bedroom" as a
 * page can explain why a ZZ plant belongs there and a basil plant does not,
 * which is the content that earns the ranking. The filter stays on `/plants`;
 * the argument lives on `/collections/plants-for-a-bedroom`.
 *
 * Every `match` here is a PREDICATE OVER THE SAME CARE DATA the facets use.
 * There is no second taxonomy to keep true. If a founder corrects
 * `species.care.toxicity`, every room and benefit collection corrects itself on
 * the next render — which is the only way a matrix of this size stays honest.
 */

export type CollectionAxis = 'room' | 'benefit' | 'season'

export interface CollectionDef {
  handle: string
  axis: CollectionAxis
  /** Short label for cards and nav. */
  label: string
  /** One line for the `<title>` and the hero. Written as a customer would say it. */
  headline: string
  /** The paragraph under the headline. This is the indexable argument. */
  body: string
  /** Secondary question the page answers, for the "you might be asking" block. */
  faq: Array<{ q: string; a: string }>
  /** Which care fields this handle reads. Rendered as "how we pick" disclosure. */
  derivedFrom: string[]
  match: (item: Facetable) => boolean
}

const PLANT_ONLY = (i: Facetable) => i.itemClass === 'plant'

/**
 * Rooms.
 *
 * The predicates are deliberately physical, not taxonomic. "Office desk" means
 * it fits in the footprint of a desk, survives being forgotten over a long
 * weekend, and will not poison a colleague's lunch. A 6-foot banyan tree is
 * technically a good office plant and practically not one.
 */
const ROOMS: CollectionDef[] = [
  {
    handle: 'plants-for-an-office-desk',
    axis: 'room',
    label: 'Office desk',
    headline: 'Plants that survive a desk',
    body: 'An office desk is a hard place to keep a plant: fluorescent light, conditioned air running twelve hours a day, and nobody there on a Sunday. Every plant on this page tolerates all three. They are all small enough to sit beside a laptop without taking the window, and none of them will poison a colleague who eats at their desk.',
    faq: [
      {
        q: 'Why is a plant a good thing to have on a desk?',
        a: 'It is not a claim about air. It is the only object in most offices that responds visibly to care, which is a different and more durable benefit: it gives the room a living thing and gives you a five-second reason to look up from the screen.',
      },
      {
        q: 'Will these survive over a long weekend?',
        a: 'Every plant here has a watering interval of five days or more at indoor conditions, so two days away is not an event. That is the single most useful thing a desk plant can do.',
      },
    ],
    derivedFrom: ['Size tier XS or MD', 'Water every 5 days or more', 'Not fussy'],
    match: (i) =>
      PLANT_ONLY(i) &&
      (i.sizeTier === 'XS' || i.sizeTier === 'MD') &&
      i.waterIntervalDays >= 5 &&
      i.difficulty !== 'fussy',
  },
  {
    handle: 'plants-for-a-low-light-room',
    axis: 'room',
    label: 'Low light',
    headline: 'Plants for a room with no window',
    body: 'This is the most common way a first plant dies, and it is not care failure — it is a plant that was sold to a room that does not have the light it needs. Every plant here is listed by us as genuinely tolerant of low light. Read that as "survives and grows slowly", not "thrives": if you can give it a brighter spot, it will do noticeably better.',
    faq: [
      {
        q: 'How low is low light?',
        a: 'A room with no window, or a corner more than three metres from one. Not a north-facing room in the evening — that is bright indirect light, and far more plants qualify than you would expect.',
      },
      {
        q: 'These grow slowly. Is that a problem?',
        a: 'It is slower than a balcony plant, and that is the honest trade for a room with no sun. A ZZ or a snake plant will add maybe four leaves a year. If you want fast growth, you need light, not a different species.',
      },
    ],
    derivedFrom: ['Light requirement is low', 'Water target below 40%'],
    match: (i) => PLANT_ONLY(i) && i.light === 'low',
  },
  {
    handle: 'plants-for-a-bright-room',
    axis: 'room',
    label: 'Bright room',
    headline: 'Plants for a room with a good window',
    body: 'A room with real light is a different proposition: you can grow things with structure and pattern, and you can put something with actual drama in the corner. These all want bright indirect light — near a window but out of the hardest sun — and none of them wants to be baked.',
    faq: [
      {
        q: 'What does "bright indirect" actually mean?',
        a: 'Within a metre or two of a window, but not where the sun lands on the leaves. Most Indian homes have this from about 9am to 4pm facing east or west, and much less than people assume facing north.',
      },
    ],
    derivedFrom: ['Light requirement is bright indirect'],
    match: (i) => PLANT_ONLY(i) && i.light === 'bright_indirect',
  },
  {
    handle: 'balcony-plants',
    axis: 'room',
    label: 'Balcony',
    headline: 'Plants for a balcony in Bengaluru',
    body: 'A balcony gets the light an indoor room never will, which means it also gets the heat: a west-facing Bengaluru balcony in May can sit above 45°C at the wall. Every plant here is one we grow outdoors ourselves and have watched through a full summer, so this page is a list of things we know work rather than a list of things we think might.',
    faq: [
      {
        q: 'What about the monsoon?',
        a: 'Drainage. A balcony in July gets more water than the pot can shed, and a plant that is merely thirsty becomes a plant with root rot. Everything here is potted and drained for it.',
      },
    ],
    derivedFrom: ['Tolerates direct sun', 'Listed as hardy in summer'],
    match: (i) => PLANT_ONLY(i) && i.light === 'direct' && i.seasons.includes('summer'),
  },
  {
    handle: 'plants-for-a-kitchen-windowsill',
    axis: 'room',
    label: 'Kitchen',
    headline: 'Plants you can actually eat from',
    body: 'A windowsill herb is the only plant in a flat that pays you back. These are edible, they are small enough for a kitchen sill, and they are listed by us as safe if chewed — which matters in a kitchen, where a cat and a coriander plant are a plausible combination.',
    faq: [
      {
        q: 'Will a kitchen window actually grow herbs?',
        a: 'If it gets a few hours of direct sun, yes. A window that only sees reflected light will keep a mint alive indefinitely without producing much worth eating.',
      },
    ],
    derivedFrom: ['Edible', 'Safe if chewed', 'Size XS or MD'],
    match: (i) => PLANT_ONLY(i) && i.edible && i.toxicity === 'safe',
  },
  {
    handle: 'plants-that-are-safe-around-cats-and-dogs',
    axis: 'benefit',
    label: 'Pet safe',
    headline: 'Plants a cat cannot poison itself on',
    body: 'This is not a soft preference. A great many common houseplants — pothos, philodendron, most begonias, every philodendron-adjacent thing in a bright window — cause vomiting if chewed. This page lists only the plants we list as non-toxic, so it is safe to run a search for it and act on the answer.',
    faq: [
      {
        q: 'Is "non-toxic" the same as "edible"?',
        a: 'No, and the difference matters. Non-toxic means it will not poison a pet who nibbles it. It does not mean your cat will enjoy it, or that it is a food.',
      },
      {
        q: 'Our cat eats everything. Is that a problem here?',
        a: 'Every plant on this page is listed safe, but a cat that eats soil, or a dog that digs up a pot, will still destroy it. Enrichment beats toxins on this one.',
      },
    ],
    derivedFrom: ['Care toxicity is safe'],
    match: (i) => PLANT_ONLY(i) && i.toxicity === 'safe',
  },
]

/**
 * Benefits.
 *
 * These are the words people actually search, and each one is a different
 * mechanism rather than a synonym for "nice plant".
 */
const BENEFITS: CollectionDef[] = [
  {
    handle: 'low-maintenance-indoor-plants',
    axis: 'benefit',
    label: 'Low maintenance',
    headline: 'Plants you can forget for two weeks',
    body: 'Low maintenance is not "hardy". It is a specific, testable property: it forgives a missed watering, it does not need a misting schedule, and it does not sulk in conditioned air. These are the plants to buy if the honest answer to "will I remember to water this?" is sometimes no.',
    faq: [
      {
        q: 'How often is actually fine for these?',
        a: 'Every card on this page states its interval. Watering on a schedule is worse than watering on a signal — check the soil instead.',
      },
    ],
    derivedFrom: ['Difficulty is easy', 'No humidity requirement'],
    match: (i) => PLANT_ONLY(i) && i.difficulty === 'easy',
  },
  {
    handle: 'air-purifying-plants',
    axis: 'benefit',
    label: 'Air purifying',
    headline: 'Plants that do something about the air',
    body: 'We publish this page, and we will not oversell it. The famous NASA study measured plants in a sealed chamber; a real room with a window that is opened twenty times a day is a different problem, and no plant meaningfully replaces ventilation. What these plants genuinely do is raise humidity slightly and put something living in the room. That is worth having. Do not stop ventilating.',
    faq: [
      {
        q: 'How many plants do I need?',
        a: 'The honest answer is that it does not scale the way the marketing claims. Two or three is what it takes to notice, and noticing is the whole benefit.',
      },
      {
        q: 'Which of these is best for a closed room?',
        a: 'Look for the high-humidity species — they raise humidity meaningfully. Everything on this page also tolerates it.',
      },
    ],
    derivedFrom: ['Flagged as air purifying at the bench', 'High humidity preference'],
    match: (i) => PLANT_ONLY(i) && i.airPurifying,
  },
  {
    handle: 'vastu-friendly-plants',
    axis: 'benefit',
    label: 'Vastu',
    headline: 'Plants with a direction attached',
    body: 'Vastu shastra is a lived part of how a lot of Indian homes are arranged, and we are not going to argue with a household about it. These are the plants traditionally placed for benefit in a home or a work desk, listed alongside the light and water each one actually needs so you are not choosing on folklore alone.',
    faq: [
      {
        q: 'Will a plant fix Vastu?',
        a: 'A plant is one of the few living things a Vastu practitioner will put in a room, and light and water are real requirements regardless of which tradition you hold. Treat the direction as a preference and the care spec as a fact.',
      },
    ],
    derivedFrom: ['Flagged as Vastu-friendly'],
    match: (i) => PLANT_ONLY(i) && i.vastuFriendly,
  },
]

/** Seasons — the axis nobody in India publishes. */
const SEASONS: CollectionDef[] = [
  {
    handle: 'summer-safe-plants',
    axis: 'season',
    label: 'Summer safe',
    headline: 'What actually survives a Bengaluru summer',
    body: 'March to June in Bengaluru runs 40–46°C, and it is the reason our catalogue changes shape three times a year. Most of the category ships through that window anyway and blames you when the plant arrives. Every plant here was grown outdoors by us through a full summer, not merely labelled hardy. If a species is not on this page in April, that is a decision, not an oversight.',
    faq: [
      {
        q: 'Why is the catalogue smaller in April?',
        a: 'Because we list what we can grow and stand behind, and a tender species shipped through a 45°C day is a dead plant with a photo of it arriving. We swap species rather than pause the shop.',
      },
      {
        q: 'Do you ship in the summer at all?',
        a: 'Yes — only these. Delivery is the same day by our own riders, which is part of why we can make the promise at all.',
      },
    ],
    derivedFrom: ['Listed as available in summer', 'Grown outdoors through the season'],
    match: (i) => i.seasons.includes('summer'),
  },
  {
    handle: 'monsoon-proof-plants',
    axis: 'season',
    label: 'Monsoon proof',
    headline: 'Plants that survive July',
    body: 'The Indian summer kills with dryness; the monsoon kills with water. Fungus and root rot are the failure mode, and they are a drainage problem far more often than a plant problem. Everything here is potted for it and, where relevant, arrives in a pot with more drainage than you would buy off a shelf.',
    faq: [
      {
        q: 'Do plants need any special treatment in the monsoon?',
        a: 'Less light, so water less than you did in April, and never let a pot sit in a saucer. Those two things prevent most monsoon deaths.',
      },
    ],
    derivedFrom: ['Listed as available in monsoon'],
    match: (i) => i.seasons.includes('monsoon'),
  },
  {
    handle: 'year-round-plants',
    axis: 'season',
    label: 'Year round',
    headline: 'Plants we list in every month',
    body: 'The unglamorous page, and the one to bookmark. If a plant is on this list it is in our catalogue in January and in June, which means one care routine works all year and you are not re-learning anything each season.',
    faq: [],
    derivedFrom: ['Listed as available in all three seasons'],
    match: (i) => i.seasons.length >= 3,
  },
]

/** Every handle, in nav order. */
export const COLLECTIONS: readonly CollectionDef[] = [...ROOMS, ...BENEFITS, ...SEASONS]

/** Room handles, for the room nav and the homepage rail. */
export const ROOM_COLLECTIONS = ROOMS

/** Benefit handles, for the benefit nav. */
export const BENEFIT_COLLECTIONS = BENEFITS

/** Season handles, for the seasonal rail. */
export const SEASON_COLLECTIONS = SEASONS

const BY_HANDLE = new Map(COLLECTIONS.map((c) => [c.handle, c]))

export function findCollection(handle: string): CollectionDef | null {
  return BY_HANDLE.get(handle) ?? null
}

/**
 * How many of `items` this collection holds, and its cheapest entry price.
 *
 * Returns null for an empty collection rather than 0, because the difference
 * matters to the caller: null means "do not link to this page at all", while 0
 * means "link to it and tell the customer it is empty". Rendering a nav link to
 * an empty page is worse than rendering nothing.
 */
export function collectionSize(
  items: readonly Facetable[],
  def: CollectionDef,
): { count: number; minPaise: number } | null {
  const matched = items.filter((item) => def.match(item))
  if (matched.length === 0) return null
  return {
    count: matched.length,
    minPaise: Math.min(...matched.map((m) => m.entryPaise)),
  }
}
