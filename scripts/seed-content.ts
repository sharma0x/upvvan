/**
 * Content seed — care articles and the symptom-first problem library.
 *
 * ── WHY THE PROBLEM LIBRARY IS THE PRIORITY ─────────────────────────────────
 *
 * Bloomscape built 175 symptom-first pages and the audit's read of them is that
 * they are "the single most under-appreciated tactic here": written for the
 * moment a customer is frightened and needs reassurance, they rank for high-intent
 * problem queries, and they "intercept the customer BEFORE they write a
 * complaint". Not one Indian competitor has any.
 *
 * So this file writes problems FIRST and articles second, and it writes real
 * answers — the cause, the fix, and the case where the honest answer is "write
 * to us".
 *
 * ── WHY THE URL IS THE CUSTOMER'S SENTENCE ─────────────────────────────────
 * A worried person types the whole question. "zz plant leaves brown tips" is what
 * gets searched, not "ZZ plant care". So the slug is the sentence, the H1 is the
 * sentence, and the excerpt is the answer — which makes each page a landing page
 * for a query that has enormous intent and almost no competition in India.
 *
 * ── WHY THE DIAGNOSIS FIELDS ARE REQUIRED IN SQL ────────────────────────────
 * `posts_problem_needs_a_fix` refuses a problem page with no cause and no fix.
 * A symptom page that ranks and then says nothing is worse than one that does not
 * rank: it teaches people that this site's answers are thin.
 *
 * ── LEXICAL IS WRITTEN DIRECTLY ────────────────────────────────────────────
 * The rich text is the jsonb shape Payload's Lexical editor produces, written by
 * hand because this is a seed and not a CMS editor. Every helper below builds
 * that shape, so the body renders through `renderRichText` exactly as an authored
 * post would — which is also what keeps that renderer honest.
 */
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

// ── Lexical builders ────────────────────────────────────────────────────────

type Node = Record<string, unknown>

/**
 * The Lexical editor state Payload stores in `posts.body`.
 *
 * The shape is the part of the Lexical contract that is stable and observable:
 * a single `root` whose `children` are block nodes. Every helper below builds a
 * block that `renderRichText` in `posts.server.ts` reads, which means the seed
 * and the renderer are checked against each other by `content-render.test.ts` —
 * a post authored here and a post authored in the admin panel travel the same
 * code path.
 */
function richText(nodes: Node[]): { root: LexRoot } {
  return {
    root: {
      type: 'root',
      children: nodes,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

interface LexRoot {
  type: 'root'
  children: Node[]
  direction: 'ltr'
  format: ''
  indent: number
  version: number
}

/**
 * Normalise loose content into Lexical inline nodes.
 *
 * A bare string is not a valid Lexical child — `children` holds nodes, and a
 * `text` node is `{type:'text', text, format, …}`. Writing the string directly
 * produces a document that JSON-serialises cleanly, passes every schema check
 * and renders as nothing, because the renderer reads `node.type` and finds
 * `undefined`.
 *
 * That exact shape shipped for one run and was caught by `renderRichText`'s
 * deliberate throw on an unrecognised node type — which is the whole argument for
 * a renderer that fails loudly instead of skipping what it does not understand.
 *
 * So the ergonomics stay (`p('some text', bold('and this')`) and the shape is
 * built here, once, rather than by every caller.
 */
function inline(content: Array<string | Node>): Node[] {
  return content.map((c) => (typeof c === 'string' ? text(c) : c))
}

function p(...content: Array<string | Node>): Node {
  return {
    type: 'paragraph',
    children: inline(content),
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function text(value: string, format = 0): Node {
  return { detail: 0, format, mode: 'normal', style: '', text: value, type: 'text', version: 1 }
}

function bold(value: string): Node {
  return text(value, 1)
}

function h2(value: string): Node {
  return {
    type: 'heading',
    children: [text(value)],
    tag: 'h2',
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function h3(value: string): Node {
  return {
    type: 'heading',
    children: [text(value)],
    tag: 'h3',
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function li(...content: Array<string | Node>): Node {
  return {
    type: 'listitem',
    value: 1,
    children: [p(...content)],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function ul(...items: Node[]): Node {
  return {
    type: 'list',
    children: items,
    listType: 'bullet',
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function ol(...items: Node[]): Node {
  return {
    type: 'list',
    children: items,
    listType: 'number',
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

/*
 * A Lexical LINK node builder used to live here. Nothing in the seeded content
 * links — the three articles and six problem pages cross-link by SPECIES rather
 * than by URL, which is the better structure anyway: a link written into the body
 * rots the moment a slug changes, whereas a species relation is a fact about the
 * content and re-resolves itself.
 *
 * Kept as a note rather than deleted silently, because "why is there no link
 * helper" is a reasonable question and the answer is a decision, not an
 * oversight.
 */

// ── Content ─────────────────────────────────────────────────────────────────

interface ProblemSeed {
  slug: string
  title: string
  excerpt: string
  symptom: string
  cause: string
  fix: string
  /** Species slugs this page is cross-linked from and to. */
  species: string[]
  body: Node[]
  daysAgo: number
}

interface ArticleSeed {
  slug: string
  title: string
  excerpt: string
  species: string[]
  daysAgo: number
}

/** An article's body lives in ARTICLE_BODIES, keyed by slug. */
type ArticleInput = Omit<ArticleSeed, 'body'>

/**
 * THE PROBLEM LIBRARY.
 *
 * Every `fix` is a sequence a customer can execute without buying anything, and
 * every `cause` says plainly when the answer is "that is us" — because the
 * category's worst habit is blaming the customer's watering for a plant that was
 * already dying when it was packed. If we caused it, saying so is the cheapest
 * possible way to keep the claim rate honest.
 */
const PROBLEMS: ProblemSeed[] = [
  {
    slug: 'why-are-the-leaves-on-my-zz-plant-turning-brown-at-the-tips',
    title: 'Why are the leaves on my ZZ plant turning brown at the tips?',
    excerpt:
      'Brown tips on a ZZ plant are almost always dry air or too much salt in the water, not thirst. Here is how to tell which, and what to do about it.',
    symptom: 'Leaf tips and edges going brown and crisp, while the rest of the leaf stays green.',
    cause:
      'Two causes, and they look identical from across the room. The first is dry air — a Bengaluru flat with an AC running produces air around 30% relative humidity, which is drier than almost anywhere the ZZ plant evolved. The second is fluoride and salt: most Indian tap water is hard, and a ZZ plant drinks very little so it accumulates salts over months and pushes them out through the leaf edges. Brown tips are also, occasionally, the plant being overwatered — but in that case the tips go soft and dark, not crisp and dry, and the soil stays wet.',
    fix: 'Cut the brown tips off with clean scissors, cutting just above the brown line so you leave green tissue. Then, in order: (1) move it away from the AC outlet and off the windowsill onto a shelf where the air moves but the draught does not; (2) fill a mug with pebbles and water and stand the pot on it, or put a bowl of water beside it, which raises local humidity without making the soil wet; (3) switch to water left out overnight, or to filtered or bottled water, so the fluoride does not keep accumulating. Do not repot — a ZZ plant resents that more than it resents dry air, and repotting while it is already stressed is how you lose it.',
    species: ['zz-plant'],
    body: [
      p(
        'Brown tips on a ZZ plant look like a watering problem and are almost never one. This is the most common thing people ask us about, and the answer is usually the room rather than the pot.',
      ),
      h2('Work out which of the three causes it is'),
      p('Three things brown a ZZ leaf tip, and they are distinguishable:'),
      ul(
        li(
          bold('Crisp and dry. '),
          'The tip is brown, papery and breaks if you press it. This is dry air, and it is by far the most common.',
        ),
        li(
          bold('Soft and dark. '),
          'The tip is dark brown or black and the leaf feels heavy. This is overwatering, and the soil is almost certainly still wet.',
        ),
        li(
          bold('A yellow ring around the brown. '),
          'The leaf is going yellow from the tip inward with a brown centre. This is salt or fluoride from the water, and it takes months to develop.',
        ),
      ),
      h2('If it is dry air'),
      p(
        'A Bengaluru apartment with an AC running sits around 30% humidity for most of the day. A ZZ plant is a West African rainforest plant that stores water in its rhizomes, which is why it forgives neglect — but forgiving neglect and thriving in dry air are different things.',
      ),
      p(
        'The fix is local humidity, not a humidifier. A mug of pebbles and water under the pot, or an open bowl of water beside it on the same shelf, raises the humidity immediately around the leaves, which is the only air the plant actually experiences. Moving it two feet away from an AC vent does more than anything else you can do for free.',
      ),
      h2('If it is salt from the water'),
      p(
        'Most tap water in Bengaluru is hard. A ZZ plant drinks so little that dissolved salts accumulate faster than it can flush them, and the plant pushes the excess out through the leaf margins — which is why the tips go brown and nothing else does.',
      ),
      p(
        'The fix is to change the water, not the plant. Leave tap water out overnight so some of it evaporates, or use filtered or bottled water. It takes a few months for new growth to come in clean, and the existing brown tips will not recover — trimming them off is cosmetic as much as anything, but it stops the plant putting energy into a dead section.',
      ),
      h2('What not to do'),
      ul(
        li(
          bold('Do not repot it. '),
          'A repot while it is stressed is the most common way to lose an otherwise healthy ZZ plant. Wait until it is growing again.',
        ),
        li(
          bold('Do not cut back to green if there is a lot of brown. '),
          'Cut above the brown line only. A leaf that is half brown is still photosynthesising for the plant.',
        ),
        li(
          bold('Do not water it more. '),
          'Almost nobody with brown ZZ tips is underwatering. It is the air, the water or the salt.',
        ),
      ),
      p(
        'If none of that stops new tips going brown, send us a photograph — a grower will look at it, and if the plant came out of our nursery in that state we would rather hear about it.',
      ),
    ],
    daysAgo: 6,
  },
  {
    slug: 'why-are-the-lower-leaves-of-my-money-plant-turning-yellow',
    title: 'Why are the lower leaves of my money plant turning yellow?',
    excerpt:
      'One yellow leaf at the bottom is normal. Several at once usually means overwatering — and the fix is to let it dry out further than you have been.',
    symptom: 'One or more lower leaves going yellow, softening and dropping.',
    cause:
      'Usually overwatering, though not always. When a lower leaf yellows on a money plant it is very often simply being retired — they do this from the bottom up as the plant ages, and one leaf at a time is nothing to worry about. Several within a fortnight is a signal. Overwatering blocks the roots, the roots stop taking up nitrogen, and the oldest leaves — the furthest from the root mass — are the first to go. Soil staying wet past a week in a plastic pot causes it; so does a pot with no drainage.',
    fix: 'Stop watering and let the soil dry out COMPLETELY, all the way to the bottom of the pot — not just the top half. Push a finger in to the base of the pot; if it is still damp, wait. Water again only when it is dry, and then thoroughly, until water runs out of the drainage hole, and empty any saucer afterwards. Check that the pot has a drainage hole at all, which is the single most common cause of this in an Indian home — decorative ceramic pots sold as planters frequently have none, and a plant in a pot with no hole is a plant being slowly drowned. If the soil smells sour or the roots are brown and mushy rather than white, the plant has root rot: repot into fresh cocopeat, cut the black roots away, and expect to lose some leaves in the recovery.',
    species: ['money-plant'],
    body: [
      p(
        'Yellow lower leaves on a money plant is the second-most-asked question we get, and the answer is usually one sentence: stop watering it for two weeks.',
      ),
      h2('Is it one leaf or several?'),
      p(
        'This distinction decides everything, and it is worth a minute of attention before doing anything at all.',
      ),
      ul(
        li(
          bold('One leaf, every few weeks, from the bottom. '),
          'Completely normal. Money plants retire their oldest leaves as they grow, and the oldest leaf is always the lowest one. Nothing to do.',
        ),
        li(bold('Several leaves within a fortnight. '), 'A problem. Almost always water.'),
        li(
          bold('Yellowing starting at the top. '),
          'Not this page — that is usually light or a nutrient issue. Look at the light requirement on the plant page.',
        ),
      ),
      h2('Why overwatering yellows the BOTTOM leaves first'),
      p(
        'It is a nutrient thing. The oldest leaves are the furthest from the root mass, so when the roots cannot take up nitrogen — because they are sitting in water and cannot breathe — the oldest leaves are the first to be starved of it. Nitrogen deficiency shows first in old growth. That is why the location of the yellowing is the diagnostic, and why a plant yellowing at the top is usually a different problem entirely.',
      ),
      h2('The fix, in order'),
      ol(
        li(
          'Stop watering. Do not water it again until the soil is completely dry all the way to the base of the pot.',
        ),
        li(
          'Check the drainage hole. Put a finger in from the bottom of the pot if you can — if nothing comes out of the hole, that is your problem.',
        ),
        li('If it has a saucer, empty it. A pot standing in water is a pot in a swamp.'),
        li(
          'Water properly when it is time: slowly, until it runs out of the hole, then let it drain fully before it goes back on anything.',
        ),
      ),
      p(
        'If the soil is sour-smelling or the roots are brown rather than white, it is root rot and repotting is the only option — into dry cocopeat, cutting away anything black. Expect to lose more leaves during recovery; that is the plant using reserves to grow new roots.',
      ),
    ],
    daysAgo: 11,
  },
  {
    slug: 'my-plant-arrived-with-yellow-leaves-is-it-dying',
    title: 'My plant arrived with yellow leaves. Is it dying?',
    excerpt:
      'Usually not. A plant that has spent a day in a box will drop or yellow a leaf or two — and it is worth knowing which yellow is normal transit stress and which means trouble.',
    symptom: 'One or two leaves yellow on a plant that arrived recently.',
    cause:
      'Transit stress, almost certainly. A plant spends a day in a closed box in a moving vehicle; it cannot photosynthesise, it is losing water faster than it can replace it, and at least one leaf will not survive that. This is why every plant page on this site says a slight droop or a yellowed leaf after a journey is not damage — and it is why "minor transit stress in live plants is not considered damage" appears in our own policy. What matters is whether NEW leaves come in healthy, not whether the leaf that travelled badly is still attached.',
    fix: 'Unbox it, put it in indirect light, and water it if the soil is dry to the touch. Then leave it alone for a week. Do not repot, do not feed it, do not move it to a new spot — a plant already stressed by transport is stressed again by every additional change you make, and most "I killed it in the first week" plants were killed by good intentions. After 7 to 10 days, look at the newest growth: if that is green and firm, the plant is fine. If more than a third of the leaves are yellow and dropping, or the stem is soft, send us a photograph on WhatsApp within the arrival window on your order and we will replace it.',
    species: ['money-plant', 'peace-lily', 'snake-plant', 'jade-plant'],
    body: [
      p(
        'This is the question we most want answered in a way that stops a customer filing a claim for a plant that is going to be fine — and the answer is usually reassuring.',
      ),
      h2('Which yellow is normal, and which is not'),
      ul(
        li(
          bold('One or two yellow leaves, soft, soon after delivery. '),
          'Normal. Transit stress. This is not a claim.',
        ),
        li(
          bold('A whole drooping plant that perks up within a day of watering. '),
          'Normal. It was thirsty in a box for twelve hours.',
        ),
        li(
          bold('Yellow spreading from the stem base upward over a week. '),
          'Not normal. Usually overwatering in the recovery period — customers water more when they are worried, and worry plus water kills more plants than the journey did.',
        ),
        li(bold('A soft or black stem. '), 'Not normal. That is rot and it needs help today.'),
      ),
      h2('The first week, done properly'),
      ol(
        li(
          'Unbox and check the stem is firm. Squeeze the stem just above the soil — soft means rot.',
        ),
        li(
          'Put it in bright indirect light. Not direct sun: a boxed plant has used up its light reserve.',
        ),
        li('Water only if the soil is dry to the touch. Do not water to "make up for it".'),
        li('Leave it in one place. Moving it is a change, and changes cost a stressed plant.'),
        li(
          'Do not feed for four weeks. Feeding a plant that has just been through a move burns roots.',
        ),
        li('Do not repot for at least a month, ideally two months.'),
      ),
      p(
        'After about ten days, the newest growth tells you everything. New leaves come in firm and correctly coloured, or they do not — and if they do not, that is when to message us.',
      ),
      h2('If it is genuinely wrong'),
      p(
        'A photograph on WhatsApp, with the order code, inside the arrival window on your order. We replace rather than refund, and you do not post anything back — a returned plant is a dead plant, so asking you to ship it would cost you a courier fee and cost us something we cannot sell.',
      ),
    ],
    daysAgo: 16,
  },
  {
    slug: 'why-is-my-snake-plant-bending-over-and-falling-over',
    title: 'Why is my snake plant bending over and falling out of its pot?',
    excerpt:
      'A snake plant leaning is almost always light, not water. It reaches for a window — and there is a cheaper fix than rotating it forever.',
    symptom: 'The plant leaning hard towards one side, or the base coming out of the pot.',
    cause:
      'Light, in the overwhelming majority of cases. A snake plant grows towards whatever light it can find, and if the only window is on one side it will commit to that direction permanently — the cells on the shaded side elongate and the plant does not spring back when you move it, so a leaning snake plant stays leaning. Two other causes are worth ruling out. If the base is loose in the pot and the roots are few and pale, it is root rot from overwatering — a snake plant is the most overwatered plant in the world, and the reason is that its watering advice everywhere says "monthly" without saying "let it dry out completely first". And if the leaves are curling inward into a tube, that is under-watering or salt damage rather than lean.',
    fix: 'For lean: give it more even light — a bright spot with light on more than one side, or rotate it a quarter turn every two weeks from now on, which fixes new growth but will not straighten what is already leaning. If the lean is severe the plant may need repotting at a 45-degree angle with the old growth held vertical, which is a real technique and takes an hour. For root rot: unpot it, cut away every brown or mushy root with a sterilised blade, repot into dry cocopeat, and then DO NOT water it for three weeks — a snake plant with no roots and wet soil dies, and the instinct to water it is what finishes it. For curled leaves: water thoroughly, let it drain completely, and switch to lower-mineral water.',
    species: ['snake-plant'],
    body: [
      p(
        'A leaning snake plant is nearly always a light problem, and the frustrating part is that a snake plant does not straighten once it has leaned. So the fix is about stopping it getting worse, not about correcting it.',
      ),
      h2('Rule out rot first'),
      p(
        'Push a finger into the soil. If it is damp, or sour-smelling, or the roots are brown and soft rather than white and firm, this is not a light problem — it is root rot, and no amount of light will fix it.',
      ),
      p(
        'If that is the case: unpot it, cut every brown root away with a sterilised blade, repot into dry cocopeat, and wait THREE WEEKS before watering. A snake plant with no roots and wet soil dies, and the instinct to water it immediately is what finishes it. This is not advice anyone expects and it is why the answer is worth writing down.',
      ),
      h2('If the roots are fine, it is light'),
      p(
        'A snake plant in one-sided light elongates the cells on its shaded side. That growth is permanent, which is why turning the pot does not undo a lean — it only prevents the next one. The practical answer is a brighter spot with light from more than one direction, and a quarterly-turn habit.',
      ),
      h2('Curled leaves mean something else'),
      p(
        'Leaves curling into a tube are a different symptom entirely: under-watering or salt accumulation. Give it a thorough soak until water runs out of the hole, let it drain fully, and if it happens repeatedly switch to water left out overnight or to filtered water — most Indian tap water is hard enough to cause this on a plant that drinks so rarely.',
      ),
      h2('What a snake plant actually wants'),
      p(
        'Bright indirect light. Genuinely tolerant of low light, but it will stop growing rather than decline, and low light is the most common reason a healthy-looking snake plant puts out no new leaves. Water only when the soil has dried out completely — all of it, not the top half — which in an Indian summer is about every three weeks and in winter closer to six. Do not repot unless the roots are visibly bursting out of the pot, and never into a pot more than one size larger: a big pot of wet soil is how snake plants die.',
      ),
    ],
    daysAgo: 24,
  },
  {
    slug: 'why-are-there-white-flies-or-small-bugs-on-my-plant',
    title: 'Why are there white flies or small bugs on my plant?',
    excerpt:
      'Pests three weeks after delivery are almost certainly not from the nursery. Here is how to identify the common four, and what actually kills them.',
    symptom:
      'Small white insects that fly when you disturb the plant, or fine webbing, or sticky residue on leaves.',
    cause:
      'Four pests account for almost everything, and they are identified by where they are and what they leave behind. Whiteflies cluster UNDER leaves and fly up in a cloud when disturbed; they also leave a sticky honeydew that goes black. Spider mites are tiny, are found on the undersides, and leave fine webbing; they thrive in dry, hot air, which is exactly what a conditioned Bengaluru flat provides. Scale insects are small brown or white bumps that do not move, and feel like a stuck-on speck. Mealybugs are white, cottony, and sit in leaf axils. All four explode in dry, still, warm air — which is why an air-conditioned room with no air movement is the highest-risk environment in an Indian flat.',
    fix: 'Identify it first, because the treatments differ. For whiteflies and mites: spray the UNDERSIDES of every leaf with a solution of one teaspoon of dish soap in a litre of water, covering the undersides specifically, and repeat every five days for three cycles — soap kills by suffocation and has to be reapplied as eggs hatch. For mealybugs and scale: physically remove them with a cotton bud dipped in alcohol, then wipe the leaf, then follow with the soap spray. In every case: isolate the plant away from the others immediately, because all four spread on contact and on a shared shelf. Then treat the conditions, not just the insects — the reason they arrived is dry still air, so move the plant somewhere with air movement and raise the humidity around it. A commercial neem spray works and is available on this site, but the honest answer is that neem is slower than soap and soap is nearly free.',
    species: ['money-plant', 'snake-plant', 'zz-plant', 'jade-plant', 'peace-lily'],
    body: [
      p(
        'Finding bugs three weeks after a plant arrives is alarming and, for the record, almost never means they came with it. Our plants are inspected at the bench and again before packing, and all four common pests are invisible at low numbers. What almost always happens is that the plant arrives healthy, sits in a still air-conditioned room for three weeks, and develops an infestation in conditions that suit it perfectly.',
      ),
      h2('Identify which one'),
      ul(
        li(
          bold('Whiteflies. '),
          'Under the leaves. Disturb the plant and a small cloud of white insects flies up. There will be sticky residue on the leaves, which goes black — that is honeydew and it is diagnostic.',
        ),
        li(
          bold('Spider mites. '),
          'Tiny moving dots, underside of leaves, fine silk webbing. Thrive in hot dry air. You often see the webbing before the mite.',
        ),
        li(
          bold('Scale. '),
          'Small brown or white fixed bumps that do not move and feel like a speck stuck on. Not on new growth, usually on older leaves and stems.',
        ),
        li(
          bold('Mealybugs. '),
          'White, cottony, in leaf axils and under leaves. Smear one between your fingers and it leaves a pinkish stain.',
        ),
      ),
      h2('What actually works'),
      p(
        'A soap spray, applied to the UNDERSIDES of every leaf, repeated three times at five-day intervals. Mix about one teaspoon of dish soap in a litre of water, put it in a spray bottle, and coat the undersides until they run slightly. Soap kills by suffocation and by dissolving the waxy coating, and it does nothing to eggs — which is why three applications five days apart, and not one, is the difference between working and not.',
      ),
      p('For mealybugs and scale, add a mechanical step first:'),
      ol(
        li('Isolate the plant from everything else on the shelf immediately.'),
        li('Wipe each mealybug or scale insect off with a cotton bud dipped in rubbing alcohol.'),
        li('Then do the soap spray three times at five-day intervals.'),
      ),
      h2('Treat the cause, not just the insects'),
      p(
        'All four of these pests need still, dry, warm air to thrive, and that is precisely what an air-conditioned Indian flat provides in season. If you only kill the insects and leave the plant in the same conditions, you will get them back inside two weeks. Move the plant somewhere with some air movement, keep humidity up around it, and check the undersides of leaves weekly — that habit catches an infestation at three bugs rather than three hundred.',
      ),
      p(
        'Neem spray is on the products page and it works, but it is slower than soap and it costs more than soap. If you are going to buy one thing for the shelf rather than for a single plant, buy the neem and make it a monthly preventative rather than treating an outbreak with it.',
      ),
    ],
    daysAgo: 33,
  },
  {
    slug: 'my-jade-plant-is-losing-its-leaves-from-the-bottom',
    title: 'My jade plant is dropping leaves from the bottom. Is it dying?',
    excerpt:
      'A jade plant that drops one or two thick leaves a month is doing the right thing. Several at once in autumn is also normal. Here is how to tell those from a problem.',
    symptom:
      'Thick, round leaves dropping from the bottom of the plant, or a bare stem at the base with growth only at the top.',
    cause:
      'A jade plant drops its oldest, thickest leaves constantly — it is a succulent that stores water in those leaves and reabsorbs them when it needs to, so shedding one is normal housekeeping. A healthy jade loses one or two a month from the bottom. Two things make it worse. Insufficient light is the big one: a jade NEEDS four to six hours of sun, and in a dim room it stretches, the stem lengthens and thins, and then drops the shaded lower leaves because the plant cannot afford to support them. Overwatering causes the same symptom but with soft, translucent leaves that come off with a pull, and it is the more urgent of the two to check.',
    fix: 'Check the leaves as they come off. If they are firm and heavy and shrivel slightly as they dry, that is normal. If they are soft, yellow and translucent, that is overwatering — let it dry out completely, all the way to the base of the pot, before watering again. If the leaves are firm and the plant is still dropping them fast, it is light: move it to the sunniest spot you have. A west or south window in India will make a visible difference within a month, and a jade in a north-facing room will live but never be right. Do not repot to fix either problem — a jade in a too-large pot with wet soil is a jade with root rot, and root rot in a succulent is terminal.',
    species: ['jade-plant'],
    body: [
      p(
        'Jade plants drop leaves. It is what they do, and a customer who has just bought their first succulent frequently reads the first one as a sign of impending death.',
      ),
      h2('Normal shedding, and what it looks like'),
      p(
        'One or two thick leaves a month, from the bottom. The leaf comes away cleanly. Left on a windowsill for a day it shrinks slightly and its skin wrinkles a little as it gives back the water the plant reabsorbed. A healthy jade does this forever without any intervention.',
      ),
      h2('Light starvation, and what it looks like'),
      p(
        'Faster shedding, AND a stem that is visibly elongating and thinning. The plant has put its energy into reaching for light it cannot get, and the shaded lower leaves get dropped because it cannot afford to hold them. This is the cause that responds to a change.',
      ),
      p(
        'A jade wants four to six hours of direct sun. In Bengaluru that means a west or south window, and it is the difference between a compact tree and a leggy one with a bare trunk. If you only have a north window, the honest answer is that a jade will survive there and never look right, and something else would suit it better.',
      ),
      h2('Overwatering, and what it looks like'),
      p(
        'Soft leaves, yellow or translucent, that come away with the slightest pull and leave a smear on your finger. Jade leaves are designed to be firm. Soft ones mean the cells have taken on too much water and burst.',
      ),
      p('If that is what you are seeing:'),
      ol(
        li('Stop watering until the soil is bone dry, all the way to the base of the pot.'),
        li('Check the drainage hole. A jade in a pot without one dies slowly and confusingly.'),
        li('Next time you water, soak it thoroughly and let it drain completely.'),
      ),
      p(
        'Never repot a jade to fix a watering problem. It resents repotting badly, and a succulent sitting in a large volume of wet soil is the textbook case of root rot. If you must repot, do it in spring, go one pot size up rather than two, and wait a week before watering.',
      ),
    ],
    daysAgo: 41,
  },
]

/**
 * THE ARTICLES.
 *
 * Fewer, and each one earns its place by being the thing somebody searches with a
 * live plant and no plant-specific page to land on. "How to repot", "what to do
 * in April", "why is my plant growing towards the window" — the questions that
 * cross species, and therefore the ones a per-species care guide cannot answer.
 */
const ARTICLES: ArticleInput[] = [
  {
    slug: 'how-to-repot-a-houseplant-without-killing-it',
    title: 'How to repot a houseplant without killing it',
    excerpt:
      'Repotting kills more houseplants than neglect does, and almost always in the same three ways. What to do, when to do it, and the one question to ask before you start.',
    species: ['money-plant', 'peace-lily', 'jade-plant'],
    daysAgo: 9,
  },
  {
    slug: 'what-to-do-with-your-plants-in-a-bengaluru-april',
    title: 'What to actually do with your plants in a Bengaluru April',
    excerpt:
      'Forty-six degrees, conditioned air, and a west window. Four things that change in April, and the two that do not.',
    species: ['snake-plant', 'zz-plant', 'peace-lily'],
    daysAgo: 20,
  },
  {
    slug: 'the-finger-test-how-to-water-without-a-schedule',
    title: 'The finger test: how to water a plant without a schedule',
    excerpt:
      '"Water weekly" is the single most common cause of houseplant death in India, because in an air-conditioned flat a plant in April and a plant in August need completely different amounts. Here is the test that works in both.',
    species: ['money-plant', 'snake-plant', 'zz-plant', 'jade-plant', 'peace-lily', 'tulsi'],
    daysAgo: 3,
  },
]

/**
 * ARTICLE BODIES.
 *
 * Kept separate from the metadata so the shape of each article is obvious: a
 * heading, the reason, the steps, and a link out. No article here is longer than
 * it needs to be, because the audit's finding on competitor content is that it is
 * long rather than useful.
 */
const ARTICLE_BODIES: Record<string, Node[]> = {
  'how-to-repot-a-houseplant-without-killing-it': [
    p(
      'Repotting kills more houseplants in India than neglect does, and it almost always happens the same three ways: too big a jump in pot size, repotting at the wrong time of year, and watering immediately afterwards.',
    ),
    h2('The one question to ask first'),
    p(
      'Before anything else: ',
      bold('is the plant root-bound? '),
      'Slide it out of its pot and look. Roots circling the bottom, or more roots than soil, or roots pushing out of the drainage hole — yes. If the root ball is comfortably smaller than the pot, or the plant has been in that pot under two years, leave it alone. A plant repotted for no reason is a plant stressed for no reason.',
    ),
    h2('When to do it, in India'),
    p(
      'In an air-conditioned flat, repot in March or April, before the summer. Second best is October, after the monsoon. Do not repot in the weeks either side of a heatwave or a cold snap, and never during a flowering period you care about — a peace lily that has just flowered is holding resources it would rather put into new roots.',
    ),
    h2('How to do it'),
    ol(
      li('Water the day before. A dry root ball crumbles; a slightly damp one stays together.'),
      li(
        'One pot size up. This is the big one. Going up two sizes leaves a large volume of wet soil around a small root mass, which is root rot with extra steps.',
      ),
      li('Slide the plant out and tease the outer roots loose with your fingers. Do not cut them.'),
      li(
        'Check the roots. White or pale cream is healthy. Brown, black or mushy is rot — cut it away and repot into fresh mix.',
      ),
      li(
        'Use dry cocopeat-based mix. We sell it, and it is what every plant on this site arrives in, so repotting into it changes nothing about how your plant behaves.',
      ),
      li('Set the plant at the same depth it was at. Planting deeper invites stem rot.'),
      li(
        'Do NOT water immediately. This is the second big one. Wait five to seven days, so any damaged root calluses rather than rotting in wet soil.',
      ),
    ),
    h2('Aftercare for the first month'),
    p(
      'Bright indirect light, no feeding at all, and no attempt to move it around. A repotted plant has lost root hairs and spends a month rebuilding them, and every additional stress — a new position, a feed, a cold night — comes out of that reserve.',
    ),
    p(
      'If a plant has to be repotted at all in the first thirty days after it arrives from us, tell us before you do rather than after. Repotting inside the guarantee window is the one thing that voids cover, not because we do not trust you, but because a failure afterwards genuinely tells us nothing about the plant we sent.',
    ),
  ],
  'what-to-do-with-your-plants-in-a-bengaluru-april': [
    p(
      'April in Bengaluru is 40–46°C, most flats have air conditioning running sixteen hours a day, and a west-facing window is a wall of radiant heat after two in the afternoon. Three things about plant care change, and two common pieces of advice do not.',
    ),
    h2('What changes'),
    h3('1. Plants dry out faster than any schedule'),
    p(
      'An air-conditioned room is warm AND dry AND has moving air from the ceiling unit. All three increase transpiration, so a plant in an air-conditioned flat in April can need water four days after an identical plant in a humid unconditioned room needed seven. The watering interval on a plant page is an average; the finger test is the answer.',
    ),
    h3('2. West windows become dangerous'),
    p(
      'Two to five in the afternoon, a west window in April can exceed 45°C at the glass. That is above the threshold at which broad leaves scorch, and scorch looks exactly like drought to somebody who has not seen it before. If you have a west window, move flowering and broad-leaved plants 30–40cm back from the glass, and out of the afternoon beam entirely.',
    ),
    h3('3. Humidity matters more, not less'),
    p(
      'The instinct is to close everything up against the heat. That is what makes the indoor humidity in a Bengaluru summer so low. A mug of pebbles and water under each pot costs nothing and measurably raises the humidity immediately around the leaves, which is the only air the plant actually feels.',
    ),
    h2('What does NOT change'),
    h3('Feeding. Stop entirely.'),
    p(
      'A plant in an air-conditioned room in April is barely growing — it is in near-dormancy because of the heat, regardless of the light it gets. Feeding a resting plant is the most reliable way to burn its roots. No feed from roughly March to September in a conditioned flat.',
    ),
    h3('And the humidity myth'),
    p(
      'Higher humidity does not compensate for overwatering. Every houseplant death attributed to dry air in India is, on inspection, a plant that was watered on a schedule while the air was blamed. Fix the water first. Fix the air second.',
    ),
    h2('The plants that do least well'),
    p(
      'Anything that needs consistently moist soil. A Peace Lily is out of our catalogue for exactly this reason — it drops its flowers above about 32°C, and holding it in the summer would be selling a plant that looks wrong for three months. It comes back in September.',
    ),
    p(
      'The ones that do best are the succulents and the water-storing plants — snake plant, ZZ, jade — precisely because they already have the answer to the question April asks. If your flat is hot and air-conditioned and you want ONE thing that works in it, start there.',
    ),
  ],
  'the-finger-test-how-to-water-without-a-schedule': [
    p(
      '"Water every seven days" is the most common piece of plant-care advice in India and it is wrong in both directions. It is the cause of most overwatered houseplants in this country, and it causes some underwatered ones too, because the same plant in the same pot needs five days in April and eleven in August.',
    ),
    h2('The test'),
    ol(
      li('Push a finger into the soil, about two knuckles deep — roughly 3–4cm.'),
      li('Pull it out and look at it. Wet and dark with soil clinging to it: wait.'),
      li('Barely damp, with maybe one grain of soil on the finger: water now.'),
      li('Bone dry: water now, and note the interval — you have found this plant’s rhythm.'),
    ),
    h2('The variant for succulents'),
    p(
      'For snake plants, ZZ plants, jade and any other water-storing plant, the test is different: it is not "is the top damp", it is "is ANY of it damp". Water only when the soil is dry all the way to the base of the pot, and then wait another week. These plants store water in their tissues precisely so they can survive long gaps, and the reason so many die is that they are given water before they have used the store.',
    ),
    h2('Why a schedule fails, in a conditioned flat'),
    p(
      'Three variables move together and none of them is the calendar. Air conditioning gives you moving air, a set temperature and low humidity, all of which increase transpiration — so a plant in a conditioned flat in April is drinking several times faster than the same plant in a humid unconditioned room in August. The pot matters too: a terracotta pot in July dries at a completely different rate from a plastic one in an air-conditioned room in April, and a plant two sizes up in its pot holds moisture for weeks.',
    ),
    h2('What to do instead of keeping a schedule'),
    p(
      'Write the interval on a note in your phone and then treat it as a prompt to CHECK, not as an instruction to water. The check takes five seconds. Watering by calendar regardless of the check is what kills plants, because the calendar cannot know that you went away for four days.',
    ),
    p(
      'If you travel, water thoroughly the day you go, move the plant out of any window and away from the AC outlet, and do not water again while you are away. A snake plant or ZZ in a dim corner will be completely fine for three weeks. An emptied watering can is not, which is the actual reason people come back to dead plants.',
    ),
  ],
}

// ── Seeding ─────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const speciesRows = await client.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM species`,
    )
    const speciesId = new Map(speciesRows.rows.map((r) => [r.slug, r.id]))

    /*
     * Wipe the content tables.
     *
     * Delete-then-insert rather than upsert, for the same reason the catalogue seed
     * rebuilds seasonal availability: `posts` has a `body` jsonb column that an
     * ON CONFLICT update would have to replace wholesale anyway, and the
     * relationship table has no natural key. So a deterministic rebuild is the
     * honest idempotent approach — and the rows are content, not transactions, so
     * nothing of record is lost.
     */
    await client.query(`DELETE FROM posts_rels WHERE "parent_id" IN (SELECT id FROM posts)`)
    await client.query(`DELETE FROM posts`)

    let articleCount = 0
    let problemCount = 0

    const insert = async (
      kind: 'article' | 'problem',
      seed: ArticleInput | ArticleSeed | ProblemSeed,
    ) => {
      const isProblem = kind === 'problem'
      const problem = seed as ProblemSeed
      const body = 'body' in seed ? seed.body : []

      const publishedAt = new Date(Date.now() - seed.daysAgo * 86_400_000)

      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO posts (kind, title, slug, excerpt, body,
                            diagnosis_symptom, diagnosis_cause, diagnosis_fix,
                            is_published, published_at)
         VALUES ($1::"enum_posts_kind", $2, $3, $4, $5::jsonb, $6, $7, $8, true, $9)
         RETURNING id`,
        [
          kind,
          seed.title,
          seed.slug,
          seed.excerpt,
          JSON.stringify(richText(body)),
          isProblem ? problem.symptom : null,
          isProblem ? problem.cause : null,
          isProblem ? problem.fix : null,
          publishedAt.toISOString(),
        ],
      )
      const postId = rows[0]!.id

      /*
       * The relationship rows.
       *
       * `posts_rels` has an `id` serial, a nullable `_order`, and a NOT NULL
       * `path` — three of the surprises AGENTS.md documents, and the reason a raw
       * SQL seed that guesses the shape fails with a NOT NULL violation rather
       * than with a helpful message. `path` is `species` because that is the
       * relationship field name on the Posts collection.
       */
      for (const [index, slug] of seed.species.entries()) {
        const id = speciesId.get(slug)
        if (!id) {
          console.warn(`  ! skipping unknown species "${slug}" on ${seed.slug}`)
          continue
        }
        await client.query(
          `INSERT INTO posts_rels ("order", "parent_id", path, species_id)
           VALUES ($1, $2, 'species', $3)`,
          [index + 1, postId, id],
        )
      }

      if (isProblem) problemCount++
      else articleCount++
    }

    for (const article of ARTICLES) {
      await insert('article', { ...article, body: ARTICLE_BODIES[article.slug] ?? [] })
    }
    for (const problem of PROBLEMS) {
      await insert('problem', problem)
    }

    await client.query('COMMIT')

    console.log('✓ Content seeded')
    console.log(`  ${articleCount} care articles`)
    console.log(`  ${problemCount} problem pages (symptom-first, cause + fix above the fold)`)
    console.log(`  ${speciesId.size} species cross-linked`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('✗ Content seed failed:', (err as Error).message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
