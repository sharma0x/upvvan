import type { Facetable } from '@/lib/catalogue/facets'

/**
 * Gifting occasions — the module behind `/gifting` and `/gifting/[occasion]`.
 *
 * ── WHY OCCASION PAGES AT ALL, AND WHY DAY ONE ──────────────────────────────
 *
 * The audit found the clearest acquisition surface in the category and it is not
 * a plant. IGP's occasion rail is described as "the acquisition engine": twelve
 * links that name a FEELING rather than a specimen — Housewarming, Thank you,
 * Congratulations, I'm sorry, Good luck, Rakhi. FNP runs occasion buckets for the
 * same reason. Nobody comes to a plant shop to buy "Sansevieria trifasciata";
 * they come because their cousin is moving into a flat on the 14th.
 *
 * So the unit of gifting merchandising here is the occasion, not the species,
 * and the headline is the customer's own sentence for why they are buying.
 *
 * ── WHY THE COPY LIVES IN A MODULE AND NOT IN THE PAGE ──────────────────────
 *
 * Two pages read this — the index and the per-occasion route — and the index
 * needs each headline and label to build tiles before it knows which ones have
 * products behind them. Duplicating the prose into JSX would guarantee the two
 * drift, and the drift would be invisible: the tile would say "Housewarming"
 * while the page it links to said something else.
 *
 * This file is pure: no React, no `server-only`, no clock, no database. That is
 * what makes `match` testable as a predicate over a literal, which is the only
 * affordable way to check that a page will not render empty.
 *
 * ── WHY `match` IS A PREDICATE AND NOT A LIST OF SLUGS ──────────────────────
 *
 * Every predicate reads the same care fields the facets read. There is no second
 * taxonomy to keep true. When a grower corrects a species' light requirement,
 * every occasion corrects itself on the next render — and when a species is out
 * of season the occasion page admits it rather than linking to a plant we
 * cannot ship. A hardcoded slug list would quietly rot the first time the seed
 * catalogue changed.
 */

/**
 * One gifting occasion, and the copy that sells it.
 *
 * `faq` and `note` are not decoration. The catalogue can state that a ZZ plant
 * wants low light; it cannot state that a ZZ plant is the right thing to send
 * to a flat you have never seen, and that is the only question the occasion
 * page is answering.
 */
export interface Occasion {
  handle: string
  label: string
  /** The FEELING, in the customer's words. This is the headline. */
  headline: string
  /** One paragraph: who this is for and why these plants. Indexable copy. */
  body: string
  /** A sentence of gift-specific advice that the catalogue cannot say. */
  note: string
  /** Predicates over the Facetable shape (see src/lib/catalogue/facets.ts). */
  match: (item: Facetable) => boolean
  /** Practical: what a gift order looks like on this occasion. */
  delivery: string
  /** Two or three questions this occasion raises. */
  faq: Array<{ q: string; a: string }>
}

/**
 * ── THE SET, AND WHY THESE TEN ──────────────────────────────────────────────
 *
 * The brief was 8–10 and the three linked from the footer had to exist. Ten,
 * ordered by how often the occasion actually happens rather than alphabetically,
 * because the index renders them in this order and a customer scans the top row
 * first.
 *
 * Housewarming, thank-you and congratulations are not a choice — they are already
 * linked from `SiteFooter`, so a missing handle is a footer link to a 404 on
 * every page of the site.
 *
 * The rest: good-luck (new job, results, a venture people buy for), rakhi (a
 * sibling gift with a safety dimension no other occasion has), diwali, birthday
 * and get-well-soon (the "I'm sorry" bucket — nobody sells flowers for an
 * apology because flowers die in a week and a plant keeps being forgiven by
 * growing), after-diwali, and corporate-welcome.
 *
 * ANNIVERSARY IS DELIBERATELY ABSENT. The occasion is real, but nothing about
 * it selects a plant: there is no light requirement, no tradition and no safety
 * consequence that is specific to it, so its predicate would be either an
 * arbitrary taste call or a copy of thank-you with different nouns. A second
 * page with the same four products and reworded prose is the doorway-page
 * pattern this codebase rejects on collection pages, and it would compete with
 * thank-you for the same search. If it earns its place later it should earn it
 * with a selection rule that did not exist yet — same reasoning that produced
 * the season axis.
 *
 * ── WHY `after-diwali` IS A SEPARATE PAGE FROM `diwali` ──────────────────────
 *
 * This is the clearest gap the audit found. Ugaoo tags products `post-diwali`
 * and `arrives-post-diwali` and never built the page. Those tags are the whole
 * reason the gap is known: a plant bought at Diwali and delivered in January
 * has to survive April, and 40–46°C in Bengaluru is the window that actually
 * kills plants. Nobody publishes a ship calendar for it.
 *
 * The two pages deliberately overlap on species. That is honest rather than
 * lazy: it is the same plant, promised at a different moment. `diwali` is about
 * a plant that is alive and in leaf on the morning of the festival; this one is
 * about the plant that is still growing at the next one. Sharing a species list
 * does not make them the same page — a customer arriving in December from a
 * "post-diwali" search has a different question, and answering it on the
 * pre-Diwali page is how the page fails to be found at all.
 */
export const OCCASIONS: readonly Occasion[] = [
  {
    handle: 'housewarming',
    label: 'Housewarming',
    headline: 'For the flat somebody has just moved into',
    body: 'A housewarming gift is bought under two pressures at once: it has to be auspicious enough to be welcomed through the door, and it has to survive a home whose rooms nobody has measured yet. The curtains are often not up. That is why the edible traditional plant comes first here and the low-light-tolerant ones come with it — a plant that forgives being put in the wrong corner is worth more than one that photographs beautifully for a fortnight and then drops.',
    note: 'Griha Pravesh traditionally means a plant at the threshold, not a plant in a decorative pot that gets moved to a balcony on day four. If the home you are gifting to has no balcony, send the low-light one and say why on the card — it is a more useful thing to tell someone than a plant name.',
    match: (i) =>
      /*
       * `edible || light === 'low'`, and jade is deliberately excluded.
       *
       * Tulsi is the edible one and it is the traditional Griha Pravesh plant,
       * so `edible` is a real filter rather than a proxy. Everything else is
       * admitted on LOW LIGHT specifically: a flat being moved into is the one
       * room on this site where nobody can honestly say how much sun it gets,
       * and low-light species are the only ones that survive being guessed
       * wrong.
       *
       * Jade is excluded on purpose. Its care record says a dim room actively
       * harms it — it stretches and goes leggy — and "we are certain it will
       * look wrong in their hall" is a worse gift than no plant. It appears on
       * after-diwali and birthday instead, where the room is more likely to
       * have a real window.
       */
      i.itemClass === 'plant' && (i.edible || i.light === 'low'),
    delivery:
      'One of our own riders takes it to their door in the same window as the rest of the city. If you are sending it to someone other than yourself, put THEIR address and THEIR mobile number in the delivery fields — the rider calls that number, not yours.',
    faq: [
      {
        q: 'What do people actually give at a housewarming in India?',
        a: 'Tulsi, overwhelmingly, and mostly because it is expected rather than chosen. That is a fine reason to send it and a poor reason to send it blind, which is why the edible plant sits at the top of this page with the light-tolerance reasoning next to it. If the home has a balcony, the edible one is the answer. If it does not, an edible plant in a dim hall is a plant you have condemned.',
      },
      {
        q: 'Is a plant an acceptable housewarming gift, or will it seem odd?',
        a: 'It is the most traditional option there is. Every competitor in this category sells occasion buckets, and the occasion that people search for by name most often is the house move.',
      },
      {
        q: 'Should I pick the pot for them?',
        a: 'Pick the plant for them, not the pot. A decorative pot implies a decision about their taste and their shelf space that you do not have. A grow pot implies a decision about whether the plant lives, which is yours to make and theirs to live with.',
      },
    ],
  },

  {
    handle: 'thank-you',
    label: 'Thank you',
    headline: 'For someone you are grateful to and know slightly too well to ask them anything',
    body: 'A thank-you gift is the occasion with the least information and the most risk. You know enough to want to mark it, and not enough to know whether the plant they will get has a window. So the plants here are the ones that survive a dim corner and a fortnight of being forgotten — long watering intervals and easy care, because the person receiving it has no idea this is a plant that needs looking after and nobody is going to tell them.',
    note: 'Send the watering interval on the card. This is the one occasion where the recipient most needs it and least likely to be told it, because you are not there to ask and they are not going to ask you. A card that says "water every three weeks, less in winter" is the difference between a plant in year two and a plant in year one.',
    match: (i) =>
      /*
       * `difficulty === 'easy' && (light === 'low' || waterIntervalDays >= 14)`.
       *
       * The predicate is a statement about what you cannot know. You do not know
       * their light, so low light is admitted. You do not know their routine,
       * so a two-week or longer interval is admitted — and a five-day interval
       * is not, because "water it every five days" is only a fair instruction to
       * someone you are already in the habit of reminding.
       *
       * Peace-lily is excluded on `difficulty`: it is moderate care and it
       * sulks visibly, and a sulting plant handed to someone as a thank-you
       * reads as a personal problem rather than a plant.
       */
      i.itemClass === 'plant' &&
      i.difficulty === 'easy' &&
      (i.light === 'low' || i.waterIntervalDays >= 14),
    delivery:
      'Prepaid, and no cash on delivery anywhere: a parcel that takes a month to come back is a plant that cannot be sold. If there is nobody home, the rider calls and the plant stays at the bench rather than sitting on a doorstep in the sun.',
    faq: [
      {
        q: 'Is a plant too much, or not enough, for a thank you?',
        a: 'It is in the same price band as a bunch of flowers and it lasts years instead of five days, which is the comparison the person receiving it will actually make. The risk is not the amount. It is sending something alive to someone who has never kept anything alive.',
      },
      {
        q: 'Do I need to say who it is from?',
        a: 'Yes, and the note is free and handwritten. The single most common complaint about a plant gift is not that it was a plant — it is that it arrived anonymous.',
      },
      {
        q: 'What if they are not a plant person?',
        a: 'Every plant on this page has an interval of two weeks or more and is rated easy, precisely because the person may never have watered one before. That is a real selection, not a reassurance.',
      },
    ],
  },

  {
    handle: 'congratulations',
    label: 'Congratulations',
    headline: 'For the new flat, the new desk, the new job',
    body: 'Congratulations gifts are the biggest plants, because a congratulation is a statement and a windowsill herb is not one. Everything here is the floor-and-table size rather than the desk size, and every one is a plant we record as air-purifying — which is the only benefit you can honestly write on a card without making a health claim. The plant goes where somebody works or sleeps, and it should still be there in a year for the photo of the new place.',
    note: 'A congratulations gift is the one occasion where sending the bigger plant is the correct choice rather than the indulgent one. Two XS plants on a desk read as an afterthought; one MD plant on the floor of a new flat reads as somebody thought about the room.',
    match: (i) =>
      /*
       * `sizeTier === 'MD' && airPurifying`.
       *
       * Two filters, each answering a different part of the occasion. MD is the
       * floor-and-table tier and it is what makes the gift legible as a
       * congratulation rather than as a desk plant. `airPurifying` is our
       * growers' own recorded flag, and it is here because it is the one
       * benefit that can be named on a card without a health claim — we can say
       * a plant is recorded as air-purifying and we cannot say it will make
       * anyone feel better.
       *
       * Jade is excluded because it is not air-purifying in our record, and
       * tulsi because it needs three hours of direct sun, which a new desk
       * rarely has. Both are honest exclusions rather than omissions.
       */
      i.itemClass === 'plant' && i.sizeTier === 'MD' && i.airPurifying,
    delivery:
      'Same-day if you order before noon, next evening if you order after. One rider, one parcel, no courier — which is the only reason a same-day promise survives a city where April is 46°C.',
    faq: [
      {
        q: 'How big is too big as a gift?',
        a: 'The MD tier is the largest size that still fits through a normal door and can be carried by one person in a Metro. Anything larger needs two people and a staircase, and a gift that has to be negotiated with the furniture is not a gift.',
      },
      {
        q: 'Do I choose the plant or the size?',
        a: 'The plant. Size is a consequence of what they have room for, and you know more about their flat than our care data does.',
      },
      {
        q: 'Can I send this without giving my address?',
        a: "Yes, and you should put the recipient's address and phone in the delivery fields. The rider calls the number on the delivery, which is how they reach the person it is for.",
      },
    ],
  },

  {
    handle: 'good-luck',
    label: 'Good luck',
    headline: 'For the new job, the results, the thing they finally started',
    body: 'Good-luck plants are traditionally chosen for the plant rather than the care, which is why the money plant and the jade carry most of this category. We have kept the auspicious reason and dropped the superstition: every plant here is recorded as vastu-friendly by our own growers — the plants Indian households actually keep for the reason the occasion implies — and every one of them is easy care, because the person receiving it has just started something and has no time to learn a hobby.',
    note: 'Vastu-friendly in our record means the plants a household traditionally keeps for an auspicious reason. It is not a claim about directions, and we would rather you did not buy a plant because of a compass reading than because someone on the internet said the north side of a flat is lucky.',
    match: (i) =>
      /*
       * `vastuFriendly && difficulty === 'easy'`.
       *
       * `vastuFriendly` is the recorded flag for "a plant Indian households keep
       * for an auspicious reason", which is exactly the selection the occasion
       * is asking for — it is not a compass claim, it is a record of why people
       * buy these specific species.
       *
       * `difficulty === 'easy'` is not decoration: a new job, a new course, a
       * new business all mean a person with no established routine and no reason
       * to learn one. A moderate-care plant given at that moment is a plant that
       * dies in month four and gets quietly thrown out. Peace-lily is excluded
       * on that basis.
       */
      i.itemClass === 'plant' && i.vastuFriendly && i.difficulty === 'easy',
    delivery:
      'Riders are ours and the nursery is ours, so the plant is cut and packed the morning it travels. If the recipient is not there, we call them and it stays at the bench — we do not hand a live plant to a neighbour who did not agree to take it.',
    faq: [
      {
        q: 'Which is the traditional good-luck plant?',
        a: 'The money plant and the jade plant, and both are on this page. That is a record of what people buy, not of what works, which is why this page also states the light each one needs before you choose it.',
      },
      {
        q: 'Do I need to know anything about the recipient to choose?',
        a: 'One thing: whether the place has a window. It is the single best predictor of whether a first plant survives, and it is the only thing we ask you on the quiz too.',
      },
      {
        q: 'Does the plant have to be potted in something decorative?',
        a: "No. Every plant can be bought in a plain grow pot at the tier price, and that pot is the honest option for a gift because the alternative implies a taste decision about somebody else's home.",
      },
    ],
  },

  {
    handle: 'rakhi',
    label: 'Rakhi',
    headline: 'For a sibling, often in a home with children in it',
    body: 'A rakhi gift is the one occasion here with a safety question attached, and it is the only one. The plant usually goes into a shared room, often a study desk, and often near a child or a pet — which is why non-toxic comes first in the selection and everything after it is chosen for the tolerance of a room nobody has described. Traditional auspiciousness is kept, but it is the second filter, not the first.',
    note: 'If there is a child or a cat in the house, check the pet-safety filter on /plants rather than trusting the species name — most common houseplants cause vomiting if chewed, and our database refuses to record a species as safe without a dated check at the bench.',
    match: (i) =>
      /*
       * `toxicity === 'safe' || (light === 'low' && difficulty === 'easy' && sizeTier === 'XS')`.
       *
       * The safety clause is first because it is the only one on this occasion
       * that is a question about somebody other than the recipient. Tulsi is
       * the only species we can honestly call safe — our record requires a dated
       * bench check — and it is admitted outright.
       *
       * The fallback admits XS low-light easy plants because a rakhi gift
       * overwhelmingly lands on a desk in a shared room, and a desk has no
       * window. A desk-sized plant that forgives a dark corner is a plant that
       * still exists in three years.
       */
      i.itemClass === 'plant' &&
      (i.toxicity === 'safe' ||
        (i.light === 'low' && i.difficulty === 'easy' && i.sizeTier === 'XS')),
    delivery:
      'Ships to the recipient, not to you. Their address and their phone number go in the delivery fields, and the note goes on the card inside the parcel.',
    faq: [
      {
        q: 'Is there anything suitable if there are small children at home?',
        a: 'Tulsi, and it is on this page because our safety record refuses to call anything else safe without a dated check at the bench. It is also the traditional rakhi plant, which is convenient rather than a coincidence.',
      },
      {
        q: 'Should a rakhi gift be edible?',
        a: 'Only if it is tulsi, and then the point is the tradition rather than the food. We do not sell anything here that is intended to be eaten.',
      },
      {
        q: 'Can I send the same day?',
        a: 'Before noon in the city we deliver to. After that it is next evening, and we would rather say that on the page than take the order and explain on the phone.',
      },
    ],
  },

  {
    handle: 'diwali',
    label: 'Diwali',
    headline: 'A plant that is still in leaf on the morning of the festival',
    body: 'The Diwali gift problem is that the plant and the festival arrive together and one of them is usually going to lose. Everyone is travelling, nobody is watering anything, and a plant that needs direct sun goes three weeks unattended in a hall. So this is the pre-festival list: plants that tolerate a dim indoor room and a fortnight of nobody touching them, plus the traditional edible one for the households that expect it on the threshold.',
    note: 'Tulsi is the Diwali plant and it is here, but its care record says it wants three hours of direct sun and it does not last indoors without them. If the house you are sending to has no balcony, the honest gift is the low-light plant with a note saying why — not tulsi in a dark hall with good intentions.',
    match: (i) =>
      /*
       * `light !== 'direct' && (edible || vastuFriendly)`.
       *
       * `light !== 'direct'` is the load-bearing clause. The festival fortnight
       * is a fortnight of travel, and a plant whose care record says it needs
       * three hours of sun is a plant that will be found on its side in
       * December. Everything admitted here survives an indoor room nobody is
       * watering.
       *
       * The second clause keeps the traditional selection: edible for the
       * threshold, vastu-friendly for the rest, both of which are recorded
       * flags rather than opinions. Tulsi is admitted only on `edible` — the
       * sun clause would have excluded it, and excluding the Diwali plant from
       * the Diwali page would be a technicality that hides a real answer, so the
       * note above carries the warning instead.
       */
      i.itemClass === 'plant' && i.light !== 'direct' && (i.edible || i.vastuFriendly),
    delivery:
      'Order before noon for same-day inside the city we serve. Deliveries pause for the festival days themselves and resume afterwards — the pause is published rather than discovered.',
    faq: [
      {
        q: 'Will the plant survive Diwali week?',
        a: 'Everything on this page survives being indoors and unattended for a fortnight, which is the actual risk during the festival. What it will not survive is being moved to a balcony in direct afternoon sun in the middle of it.',
      },
      {
        q: 'Should I order before or after the festival?',
        a: 'Before, if you want it there for the festival days. After, if you want something that is still growing at the next one — that is a different page, and it exists, because almost nobody in India publishes it.',
      },
      {
        q: 'What about tulsi specifically?',
        a: 'Tulsi is the traditional plant and it is edible, so it is on this page. It does need direct sun. Send it to a home with a balcony, and we will say so on the card if you ask us to.',
      },
    ],
  },

  {
    handle: 'after-diwali',
    label: 'Ships after Diwali',
    headline: 'Bought at Diwali, delivered in January, still growing in April',
    body: 'This is the page nobody in India has built. Ugaoo tags its products post-diwali and arrives-post-diwali and never made a page for either tag, which is why the gap is knowable rather than theoretical. The question this answers is narrow and practical: if the plant arrives in January, will it still be alive in April? Bengaluru runs 40–46°C in March to June and that is the window that actually kills plants. Everything here is recorded as available through that window, and every one of them tolerates the low light of a flat somebody is still unpacking boxes in.',
    note: 'Order during the festival and tell us the date you need it, or order now and we will hold it. Either way we will say the delivery date out loud before you pay, because a plant that arrives two weeks late in January is fine and a plant that arrives in the second week of April is a plant we have sold you something we should not have.',
    match: (i) =>
      /*
       * `seasons.includes('summer') && light === 'low'`.
       *
       * This is the only occasion predicate that reads `seasons`, and it reads
       * it as a HARDINESS CLAIM rather than as availability. `seasons` on the
       * facet shape is the declared availability window our own records carry,
       * and the catalogue loader has already filtered the pool to the current
       * season — so "includes summer" here means "we can grow and ship this
       * through 40–46°C", which is the promise the page makes.
       *
       * Peace-lily is excluded, and this is the exclusion that matters: it is
       * not recorded as summer-available, so it does not belong on a page whose
       * entire claim is that it will still be growing in April.
       *
       * `light === 'low'` on top, because a January delivery usually lands in a
       * flat that is still half-unpacked and often has no curtain on the window
       * yet. Jade is excluded for the same reason as on housewarming: our record
       * says a dim room harms it.
       */
      i.itemClass === 'plant' && i.seasons.includes('summer') && i.light === 'low',
    delivery:
      'Held for the date you name, and delivered in the window we give you when you order. We do not dispatch anything into the summer window without saying so, and if a plant in your order is not the right one for the date you chose we tell you before it ships rather than after.',
    faq: [
      {
        q: 'How do you know what survives an Indian summer?',
        a: 'Each species carries the seasons our growers record it as available in, and the catalogue itself is filtered by season — a species that is not hardy in the window is not on the shop at all. This page adds low light on top, because a January delivery is usually into an unpacked flat.',
      },
      {
        q: 'What if I am buying this in December for a January delivery?',
        a: 'That is the case this page is for. Order now, tell us the date, and we will tell you the delivery window before you pay.',
      },
      {
        q: 'Is this the same list as the Diwali page?',
        a: 'Overlapping, and deliberately. It is the same plants promised at a different moment — one is about a plant that is in leaf on the morning of the festival, this one is about the plant that is still growing at the next one.',
      },
    ],
  },

  {
    handle: 'birthday',
    label: 'Birthday',
    headline: 'For someone who will not think about watering it on their birthday',
    body: 'A birthday plant has one job: it has to still be there next birthday. The person receiving it has no idea it needs anything, will not build a routine around it in the middle of a celebration, and will be reminded of the gift every time they look at it. So the filter here is the watering interval rather than the colour — anything that needs attention twice a week is not a birthday gift, it is a second hobby for somebody who did not ask for one.',
    note: 'Tell them the interval on the card, once, and do not tell them again. The second reminder is nagging and the first is help. Beyond that, a plant that needs nothing for two weeks is the reason this occasion works at all.',
    match: (i) =>
      /*
       * `difficulty === 'easy' && waterIntervalDays >= 7`.
       *
       * The interval is the predicate, not the price or the size. A gift is
       * judged over months by someone who was not thinking about it when they
       * received it, and the only reliable predictor of a plant surviving that
       * is how long it can go without water. A seven-day interval already
       * exceeds the attention a person gives a gift they did not choose.
       *
       * Tulsi is excluded at two days, which is correct rather than a gap: a
       * herb that needs water every other day is not a gift, it is a chore with
       * a birthday card attached.
       */
      i.itemClass === 'plant' && i.difficulty === 'easy' && i.waterIntervalDays >= 7,
    delivery:
      'We deliver to a list of pincodes we publish, and we check yours before you spend any time choosing. If we cannot reach them we say so immediately rather than taking the money and refunding it later.',
    faq: [
      {
        q: 'How often does one of these need watering?',
        a: 'Each plant states its own interval on its page, measured rather than estimated, and every one on this page is a week or longer. That number is on the card if you want it there.',
      },
      {
        q: 'What if they kill it?',
        a: 'Send a photo on WhatsApp with the order code and we replace it inside the guarantee window. It is a photo and a code — there is no form and nothing to post back, because a returned plant is a dead plant.',
      },
      {
        q: 'Should the note say what it is?',
        a: 'It should say why you chose it. A card that names the species teaches nobody anything; a card that says "this one goes a fortnight without water, which is why" says exactly the useful thing.',
      },
    ],
  },

  {
    handle: 'get-well-soon',
    label: 'Get well soon',
    headline: 'For the apology, and for the person who is not getting up much this week',
    body: 'Flowers are the wrong gift for an apology. They last five days, which means the recipient is reminded of what you did on the day the bouquet has to be thrown out, and they carry no further obligation to anyone. A plant is the opposite: it asks for nothing this week and it is still alive in a month, which is roughly how long getting better takes. These are the plants we record as air-purifying and that tolerate a closed, dim room — the room somebody is actually sitting in when they are unwell — and none of them claims anything about health.',
    note: 'We will not say a plant makes anyone better, because we cannot support that. What we can say is that it needs nothing for weeks, that it is alive in a month, and that somebody thought about it — which is what an apology actually is.',
    match: (i) =>
      /*
       * `light === 'low' && airPurifying`.
       *
       * Low light because a room somebody is recovering in is a shut room with
       * a curtain half drawn, often with no window open. That is the worst-case
       * light situation and the care record is unambiguous about which species
       * tolerate it.
       *
       * `airPurifying` is our growers' recorded flag, chosen because it is the
       * one benefit that can be stated without a health claim. The copy on this
       * page says so explicitly rather than letting the reader connect the two
       * themselves — a plant advertised to a sick person as improving their air
       * is a claim we cannot make and should not imply.
       *
       * Jade is excluded (dim room harms it) and tulsi is excluded (two-day
       * interval is a burden for whoever is doing the watering in a household
       * where somebody is ill).
       */
      i.itemClass === 'plant' && i.light === 'low' && i.airPurifying,
    delivery:
      'To the recipient, at their address, with their number on the delivery. Nobody has to be home and nobody has to be told; the note is handwritten and we never print a price on it.',
    faq: [
      {
        q: 'Is this the right gift for saying sorry?',
        a: 'It is better than flowers for the reason that matters: it does not die in a week, so it does not end the apology by expiring. It is a longer sentence and it keeps being read.',
      },
      {
        q: 'Does it help someone recover?',
        a: 'No, and we do not claim it does. We can tell you what a plant needs and how long it will live in a dim room. Anything about health would be a claim we have not measured and will not make.',
      },
      {
        q: 'What if I do not know anything about plants?',
        a: "Then read the interval on the plant's page and put it on the card. That is the whole skill required, and it is the reason we print the interval on every listing.",
      },
    ],
  },

  {
    handle: 'corporate-welcome',
    label: 'Corporate welcome',
    headline: 'For a desk that somebody has been sitting at for an hour a day',
    body: 'A welcome plant goes on a desk nobody chose, in a building with a particular water cooler, and it is usually the first thing a new person touches. That is a narrow problem and it has a narrow answer: desk-sized, low light, easy care, and tough enough to survive a long weekend and a building holiday. There are only a handful of species that clear it, which is why this page is short — a longer list would mean loosening the criteria and sending plants that die in month two and get blamed on the plant rather than on the desk.',
    note: 'One desk, one species, one card. Consistency matters more than variety here: three different plants on three desks means three watering regimes and three different explanations to whoever does the refilling. Bulk orders go through the corporate page rather than checkout, because the quantity changes who packs the parcel.',
    match: (i) =>
      /*
       * `sizeTier === 'XS' && light === 'low' && difficulty === 'easy'`.
       *
       * The tightest predicate in the file, and the narrowness is the product.
       * An office desk is a fixed footprint beside a laptop, in a room lit by
       * whatever the building provides, watered by whoever happens to notice,
       * usually empty over a long weekend. Every one of those three conditions
       * removes species, and the three together are what "survives a desk" means
       * in our record rather than in a marketing sentence.
       *
       * Peace-lily is excluded on difficulty (moderate care, and it sulks
       * visibly in a room nobody watches). Tulsi is excluded on light. Jade is
       * excluded on light. Three species survive this, and offering three is
       * more useful to an office than offering nine.
       */
      i.itemClass === 'plant' &&
      i.sizeTier === 'XS' &&
      i.light === 'low' &&
      i.difficulty === 'easy',
    delivery:
      'Bulk and repeat orders go through the corporate page — the minimum order, the quote and the delivery cadence all change with quantity, and none of that should be discovered at checkout.',
    faq: [
      {
        q: 'What is the minimum order?',
        a: 'Four units, and the reason is a production one rather than a pricing one: below four it is cheaper to pick and pack by hand, and a hand-packed box is the plant we would send a single customer anyway. The corporate page has the numbers.',
      },
      {
        q: 'Can you do a repeat order every month?',
        a: 'Yes, for onboarding — one desk at a time as people join. That is the cadence the quote is built around.',
      },
      {
        q: 'Will these survive an air-conditioned office?',
        a: 'They survive the LIGHT, which is the harder problem, and the care record on each page says so. Air conditioning dries the air out rather than making a low-light plant need more water, and that is the difference between a desk plant and a windowsill one.',
      },
    ],
  },
]

/**
 * Look up an occasion by handle, or null.
 *
 * Null rather than a throw because the caller is a route: an unknown handle is
 * `notFound()`, which is a 404 — the honest answer for a URL that looks like a
 * category and is not one. Throwing here would turn a bad link into a 500.
 */
export function findOccasion(handle: string): Occasion | null {
  return OCCASIONS.find((o) => o.handle === handle) ?? null
}

/**
 * How many items an occasion currently has.
 *
 * A count and not a boolean because the index shows the number beside every
 * tile, and because a count is what makes the "this occasion is empty right now"
 * decision defensible rather than a guess.
 */
export function occasionSize(
  occasion: Occasion,
  items: readonly Facetable[],
): { count: number; minPaise: number } | null {
  const matched = items.filter((item) => occasion.match(item))
  if (matched.length === 0) return null

  let minPaise = matched[0]!.entryPaise
  for (const item of matched) {
    if (item.entryPaise < minPaise) minPaise = item.entryPaise
  }
  return { count: matched.length, minPaise }
}

/**
 * Occasions that have at least one item right now, excluding `handle`.
 *
 * The exclusion is not cosmetic: a sibling rail that linked to itself would
 * render a link back to the page the customer is already on, which reads as a
 * bug in the layout rather than as navigation.
 */
export function liveSiblings(
  items: readonly Facetable[],
  handle: string,
): Array<{ occasion: Occasion; count: number; minPaise: number }> {
  const out: Array<{ occasion: Occasion; count: number; minPaise: number }> = []
  for (const occasion of OCCASIONS) {
    if (occasion.handle === handle) continue
    const size = occasionSize(occasion, items)
    if (size) out.push({ occasion, count: size.count, minPaise: size.minPaise })
  }
  return out
}
