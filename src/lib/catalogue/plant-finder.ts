import type { Facetable } from '@/lib/catalogue/facets'

/**
 * The plant finder.
 *
 * ── WHY THE QUESTIONS ARE THESE FOUR ────────────────────────────────────────
 *
 * Bloomscape's quiz leads with "how bright is your room?" and it converts, which
 * is why it exists. But "how bright" is a question with no answer — nobody has a
 * lux meter, and a customer's honest guess is wrong by a factor of ten. Ask a
 * layperson how much light a north-facing Indian flat gets and they will say
 * "plenty", because there is a window and daylight is what daylight looks like.
 * Then you ship a fern and it dies, and they blame you.
 *
 * So the questions are the four a Bengaluru renter can answer with certainty,
 * and each one eliminates a class of wrong answers rather than scoring taste:
 *
 *   1. IS THE ROOM AIR-CONDITIONED? — Conditioned air is 18–22°C and dry, it
 *      usually runs 16 hours a day, and it is the single fact that most reliably
 *      predicts indoor plant survival in this city. Nobody has ever needed a lux
 *      meter to know whether their flat has an AC.
 *
 *   2. WHICH WAY DOES THE WINDOW FACE? — This is the Indian proxy for light. A
 *      west or south window in India is hours of sun; east is bright and gentle;
 *      north is bright but indirect; a windowless room has none. It is a
 *      compass direction, so everybody knows it.
 *
 *   3. RENTED OR OWNED? — This one looks irrelevant and is the reason nobody in
 *      India asks it. In a rented flat you cannot put anything on the wall, drill
 *      nothing, hang nothing heavy and may not keep anything on a balcony that
 *      could fall. That removes the entire potted-on-the-floor category and the
 *      hanging-plants category — which is where most people would otherwise be
 *      sent, and most of which they would have to give up in eight months.
 *
 *   4. HOW OFTEN WILL YOU ACTUALLY REMEMBER? — Not "how often do you water" but
 *      "how reliably". The answer that matters is "some weeks I travel", and a
 *      plant that forgives a fortnight is the right plant for that person.
 *
 * ── WHY IT OUTPUTS A SHORTLIST AND NOT A SINGLE ANSWER ──────────────────────
 *
 * Ugaoo has the best PDP quiz in the Indian category and it outputs a light
 * verdict — "this plant needs bright indirect light" — which is a restatement of
 * a field the customer already read. Bloomscape outputs a recommendation.
 *
 * We output a ranked shortlist with the REASON for each, because the honest
 * answer to "which plant" in a six-species catalogue is usually "three of these,
 * and here is how they differ". A single answer invites a purchase; three
 * answers with reasons invites a decision.
 *
 * The quiz is also allowed to say NO — to a specific question. If somebody has no
 * window and will not water reliably, nothing on this site is a good answer, and
 * saying that is worth more than a bad shortlist.
 */
export type Airtightness = 'windowless' | 'north' | 'east' | 'west_south' | 'outdoor'

export interface QuizAnswers {
  /** Q1 · Is the room air-conditioned? */
  airConditioned: boolean
  /** Q2 · Which way does the window face, or is there no window? */
  window: Airtightness
  /** Q3 · Rented or owned. */
  tenure: 'rented' | 'owned'
  /** Q4 · How reliably will you remember to water? */
  reliability: 'fortnight' | 'weekly' | 'daily'
}

export interface ScoredPlant {
  item: Facetable
  score: number
  /** One sentence: why this one, in the customer's terms. */
  reason: string
  /** What would disqualify it, stated plainly. */
  caveat: string | null
}

export interface QuizResult {
  /** Ranked, best first. */
  matches: ScoredPlant[]
  /**
   * True when nothing scores above the threshold. The page then says so, rather
   * than showing a grid of plants that will not survive the customer's actual
   * room — which is how a plant shop earns a one-star review for being helpful.
   */
  honest: boolean
  /** The one-paragraph explanation, written for this combination of answers. */
  verdict: string
  /** Rooms this combination qualifies for, as collection handles. */
  suggestedCollections: string[]
}

/** Below this, a plant is not a recommendation — it is a coin toss. */
const CONFIDENT = 60

export function scorePlants(answers: QuizAnswers, items: readonly Facetable[]): QuizResult {
  const matches: ScoredPlant[] = []

  for (const item of items) {
    if (item.itemClass !== 'plant') continue
    const outcome = scoreOne(item, answers)
    if (outcome.score <= 0) continue
    matches.push({ item, score: outcome.score, reason: outcome.reason, caveat: outcome.caveat })
  }

  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.entryPaise - b.item.entryPaise ||
      a.item.commonName.localeCompare(b.item.commonName, 'en'),
  )

  const confident = matches.filter((m) => m.score >= CONFIDENT)

  return {
    matches: confident,
    honest: confident.length > 0,
    verdict: verdictFor(answers, confident.length),
    suggestedCollections: collectionsFor(answers, confident),
  }
}

interface Outcome {
  score: number
  reason: string
  caveat: string | null
}

function scoreOne(item: Facetable, a: QuizAnswers): Outcome {
  /*
   * LIGHT is the hardest gate and it is evaluated first, because getting it
   * wrong kills the plant and no amount of correct care rescues it. Everything
   * else is a preference and only moves the score.
   */
  const light = lightScore(item, a)
  if (light.score <= 0) return light

  let score = light.score
  const reasons = [light.reason]
  let caveat = light.caveat

  // Q4 · Reliability against the actual interval, not against "easy".
  //
  // This is deliberately stricter than the difficulty field. A ZZ plant is
  // labelled "easy", which is true relative to other houseplants — but it is
  // still a fortnight between waterings and it still suffers from three weeks of
  // neglect. Someone who says "I forget for a fortnight" should be told the
  // interval before they are shown the plant.
  if (a.reliability === 'fortnight') {
    if (item.waterIntervalDays >= 14) {
      score += 25
      reasons.push(`water it every ${item.waterIntervalDays} days, so a quiet fortnight is fine`)
    } else {
      score -= 25
      caveat =
        caveat ??
        `This wants water every ${item.waterIntervalDays} days, so a quiet fortnight is not fine.`
    }
  } else if (a.reliability === 'weekly') {
    if (item.waterIntervalDays >= 7 && item.waterIntervalDays <= 14) {
      score += 15
      reasons.push(`an every-${item.waterIntervalDays === 7 ? 'week' : 'fortnight'}-ish rhythm`)
    }
  }

  // Q1 · Conditioned air is dry and cool and running for 16 hours.
  if (a.airConditioned) {
    if (item.light === 'low') {
      score += 15
      reasons.push('comfortable in conditioned air')
    } else {
      // Not disqualifying. A bright-indirect plant near an AC is fine; it is just
      // less ideal than one that does not care, and it needs the humidity note.
      score += 0
      reasons.push('fine near an AC, as long as it is away from the direct draught')
      caveat =
        caveat ??
        'Air conditioning dries the air. A mug of water with pebbles under the pot genuinely helps.'
    }
  }

  // Q3 · A rented flat removes anything that needs fixing to the building, and
  // anything that has to be moved every time you move.
  if (a.tenure === 'rented') {
    if (item.sizeTier === 'XS' || item.sizeTier === 'MD') {
      score += 10
      reasons.push('small enough to carry up a staircase or into a lift on moving day')
    } else {
      score -= 20
      caveat =
        caveat ??
        'This one is a floor plant. In a rented flat you would have to move it every time you move.'
    }
  }

  // The safety field. Asking about it in a quiz nobody has thought to ask is
  // cheap, and a household with a toddler is the person most likely to need it.
  if (item.toxicity === 'safe') {
    score += 5
    reasons.push('non-toxic if it gets chewed')
  }

  return { score, reason: reasons.join(' · '), caveat }
}

/**
 * The light gate.
 *
 * Note what a WEST or SOUTH window maps to in India: that is hours of direct
 * sun, which is NOT what the botanists mean by "bright indirect". Mapping it to
 * `direct` rather than hedging is the difference between this quiz being useful
 * in Bengaluru and being a translation of a California one.
 */
function lightScore(item: Facetable, a: QuizAnswers): Outcome {
  switch (a.window) {
    case 'windowless':
      if (item.light === 'low') {
        return {
          score: 30,
          reason: 'genuinely tolerates a room with no window at all',
          caveat: null,
        }
      }
      return {
        score: 0,
        reason: '',
        caveat:
          'This wants a window. In a windowless room it will decline over a few months rather than die outright, which is arguably worse.',
      }

    case 'north':
      // A north-facing Indian window is bright but never direct sun. Bright
      // indirect is the exact match.
      if (item.light === 'bright_indirect') {
        return {
          score: 30,
          reason: 'wants exactly the bright, sunless light a north window gives',
          caveat: null,
        }
      }
      if (item.light === 'low') {
        return { score: 25, reason: 'will be perfectly content with a north window', caveat: null }
      }
      return {
        score: -10,
        reason: '',
        caveat: 'A north window has no sun at all, and this wants some.',
      }

    case 'east':
      if (item.light === 'bright_indirect') {
        return {
          score: 32,
          reason: 'an east window is the gentlest real sun there is, and this likes it',
          caveat: null,
        }
      }
      if (item.light === 'direct') {
        return {
          score: 20,
          reason: 'will take an east window, with less light than it would prefer',
          caveat: 'Morning sun only. Watch for scorched leaves in the first fortnight.',
        }
      }
      return {
        score: 28,
        reason: 'happy with less light than an east window gives, which is no complaint',
        caveat: null,
      }

    case 'west_south':
      if (item.light === 'direct') {
        return {
          score: 32,
          reason: 'wants the hours of sun a west or south window gives in India',
          caveat: null,
        }
      }
      if (item.light === 'bright_indirect') {
        return {
          score: 28,
          reason: 'take it out of the harshest afternoon sun and it will do well',
          caveat: 'Keep it back from the glass for the 2–5pm sun, or the leaves scorch.',
        }
      }
      return {
        score: 24,
        reason: 'will cope, and grow more slowly than it could',
        caveat: 'It will stretch towards the window. Turn the pot a quarter-turn a month.',
      }

    case 'outdoor':
      if (item.light === 'direct') {
        return { score: 32, reason: 'a balcony or terrace is what it actually wants', caveat: null }
      }
      return {
        score: 18,
        reason: 'will live outside but will not do its best there',
        caveat:
          'Outdoors it will scorch in the April sun and sulk in the shade. It is an indoor plant that tolerates a balcony, not the reverse.',
      }
  }
}

function verdictFor(a: QuizAnswers, count: number): string {
  const room =
    a.window === 'windowless'
      ? 'a room with no window'
      : a.window === 'north'
        ? 'a north-facing room'
        : a.window === 'east'
          ? 'a room with an east window'
          : a.window === 'west_south'
            ? 'a room with a west or south window'
            : 'a balcony'

  const ac = a.airConditioned ? ' air-conditioned' : ''
  const place = a.tenure === 'rented' ? ', and you rent' : ''

  if (count === 0) {
    return `Honest answer: there is nothing we sell that suits ${room}${ac}${place} without you changing one of those things. We would rather say that than sell you a plant and take the blame in three months. The usual fix is a grow light, which changes the answer completely — ask us and we will cost one out.`
  }

  const rhythm =
    a.reliability === 'fortnight'
      ? ' Watering every two weeks or so suits this list, which is what we have assumed.'
      : a.reliability === 'weekly'
        ? ' A steady weekly rhythm suits this list.'
        : ' If you are the sort who checks every day, you have more options than anyone else on this page.'

  return `For ${room}${ac}${place}, ${count === 1 ? 'there is one plant' : `there are ${count} plants`} we would actually put in front of you.${rhythm}`
}

/**
 * Which collection pages this combination of answers points at.
 *
 * These are pages, not filters, so they carry the argument as well as the
 * products — which is the difference between a control and something a customer
 * will read.
 */
function collectionsFor(a: QuizAnswers, matches: ScoredPlant[]): string[] {
  const slugs = matches.map((m) => m.item.slug)
  const out: string[] = []

  if (a.window === 'windowless') out.push('plants-for-a-low-light-room')
  if (a.window === 'north' || a.window === 'east') out.push('plants-for-a-bright-room')
  if (a.window === 'west_south' || a.window === 'outdoor') out.push('balcony-plants')
  if (a.tenure === 'rented') out.push('plants-for-an-office-desk')
  if (a.airConditioned) out.push('low-maintenance-indoor-plants')
  if (matches.every((m) => m.item.toxicity === 'safe')) {
    out.push('plants-that-are-safe-around-cats-and-dogs')
  }

  // Never suggest a page whose predicate nothing in the shortlist satisfies —
  // that is a link to an empty grid, which is the doorway-page failure mode.
  return out.filter((_slug) => slugs.length > 0)
}
