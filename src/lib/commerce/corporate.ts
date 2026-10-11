/**
 * Corporate / bulk gifting — the published commercial terms.
 *
 * ── WHY THIS PAGE SET IS THE STRATEGIC BET ──────────────────────────────────
 *
 * The audit's sharpest B2B finding is that every competitor handles bulk by
 * telephone and not one of them publishes a price:
 *
 *   · Kyari runs five landing pages plus a microsite, every one of them ending
 *     in a phone number, and its corporate MOQ contradicts itself across three
 *     pages — 30, 40, 50. Its own volume ladder works out at ₹564–₹825 per
 *     unit against a ₹199 headline claim.
 *   · FNP: MOQ 50, a downloadable catalogue rather than a live one, and a
 *     four-step human funnel (enquiry form → overview call → choose → deliver).
 *     List prices on site, "attractive discounts on bulk" with no tiers.
 *   · IGP: "You cannot place a bulk order at the IGP website directly."
 *     Will transact at 5–20 units on campaign pages while its FAQ says 50.
 *
 * The one operator that publishes an itemised GST-inclusive tier sheet AND a
 * quantity-based quote flow is a small business, and the audit calls that the
 * benchmark nobody occupies. So the proposition here is not "cheap plants". It
 * is that a procurement manager can compare three suppliers without making three
 * phone calls — and the only way that is true is if the numbers are on the page.
 *
 * ── WHY MOQ 10 AND NOT 50 ───────────────────────────────────────────────────
 *
 * 10 is the number in the `quote_requests_meets_published_moq` CHECK constraint
 * and in `CORPORATE_MOQ` in `/api/contact`. It is deliberately at the low end of
 * the credible range: FNP refuses below 50, and a company buying 20 plants for a
 * team of twenty is a real order that our competitors will simply lose. The cost
 * of being wrong in this direction is one small order; the cost of the other
 * direction is the whole segment.
 *
 * ── WHY THIS MODULE IS PURE ─────────────────────────────────────────────────
 *
 * No React, no `server-only`, no database. That is what lets the landing page, the
 * quote form and the API route all read the SAME table: the price a customer
 * reads on `/corporate` is literally the price the route writes down, and the
 * client-side live estimate is computed by the identical function rather than
 * reimplemented in a component. Three copies of a price ladder is three
 * opportunities to publish one number and charge another.
 *
 * MONEY IS INTEGER PAISE THROUGHOUT. Every figure a customer sees is GST-inclusive
 * per-unit paise, matching `formatPaise` and the `quote_requests_budget_is_paise`
 * CHECK. There is no rupees field anywhere in this file.
 */

/**
 * The published minimum order quantity.
 *
 * Duplicated in two other places on purpose, and the tie is enforced rather than
 * imported: `quote_requests_meets_published_moq` in
 * `20261005_000012_storefront_invariants.ts` (migrations do not import
 * application code) and `CORPORATE_MOQ` in `/api/contact`. Three places, one
 * number, one deliberate decision — a CHECK that silently accepted a different
 * MOQ than the page advertises is the whole failure this avoids.
 */
export const CORPORATE_MOQ = 10

/**
 * Above this many units we will not quote.
 *
 * Not a stock limit. It is the point at which "one nursery, one bench, own
 * riders in one city" stops being true of the operation and the conversation
 * becomes about contract manufacturing, which we have never done. Publishing the
 * ceiling is cheaper than taking an order we cannot honestly fulfil.
 */
export const MAX_QUOTE_QUANTITY = 5_000

export interface VolumeTier {
  /** Lowest quantity this tier applies to, inclusive. */
  from: number
  /** Human range, e.g. "10–24 plants". Shown in the published table. */
  label: string
  /** Effective per-unit price, INTEGER PAISE, GST-inclusive. */
  perUnitPaise: number
  /** What you actually get at this tier, in words. Never "up to X% off". */
  includes: string[]
}

/**
 * The published ladder.
 *
 * ── THE ARITHMETIC IS THE ARGUMENT ──────────────────────────────────────────
 *
 * `perUnitPaise` falls strictly at every step — 89500, 79500, 69500, 59500,
 * 49900 — and the landing page asserts it rather than trusting it, because a
 * ladder that goes UP somewhere is a page that lies about the only thing it is
 * for. Each step is a real cost that genuinely falls with volume:
 *
 *   · packing labour per parcel falls, because a bench can work a batch rather
 *     than one order at a time;
 *   · the delivery leg falls, because one rider does a floor-by-floor drop in an
 *     office instead of N separate doorstep journeys;
 *   · the logo and pot-printing setup amortises, which is why printing is
 *     *included* from 100 units and merely *available* from 50.
 *
 * ── WHERE THE NUMBERS SIT AGAINST THE MARKET ────────────────────────────────
 *
 * The research band for nursery/trade plants is ₹150–₹800 per unit and the
 * specialist entry price is ₹110–₹199; Kyari's effective volume price is
 * ₹564–₹825 and its SEO page claims ₹199. So the top tier lands at ₹499 — under
 * Kyari's floor and inside the "Under INR 500" budget band FNP itself publishes —
 * and the entry tier sits at ₹895, above the trade band because at ten units a
 * hand-written card, a printed care card and a GST invoice genuinely cost more
 * per parcel.
 *
 * Alternative rejected: publishing a discount off a list price ("up to 44% off").
 * A strike-through is a merchandising fiction (see `pricing.ts`), and a
 * percentage invites the question "off what?", which is a phone call.
 */
export const VOLUME_TIERS: readonly VolumeTier[] = [
  {
    from: 10,
    label: '10–24 plants',
    perUnitPaise: 89_500,
    includes: [
      'One plant per person, in a grow pot, with a printed care card in every parcel',
      'A handwritten gift card. No prices printed on it, and no logo you did not ask for',
      'One delivery slot to one office address, weekday mornings',
      'An itemised GST invoice you can hand to accounts',
    ],
  },
  {
    from: 25,
    label: '25–49 plants',
    perUnitPaise: 79_500,
    includes: [
      'Everything in 10–24',
      'A printed ribbon carrying your logo, at no extra charge',
      'A named person at the bench for this order, reachable by phone',
    ],
  },
  {
    from: 50,
    label: '50–99 plants',
    perUnitPaise: 69_500,
    includes: [
      'Everything in 25–49',
      'A free 20-minute care workshop on a video call for the people receiving the plants — Bloomscape and The Sill both give this away in the US and nobody in India does',
      'Split delivery across up to 10 addresses in one slot',
    ],
  },
  {
    from: 100,
    label: '100–199 plants',
    perUnitPaise: 59_500,
    includes: [
      'Everything in 50–99',
      'Your logo printed on the pot, after you approve a mockup — included, not billed',
      'Split delivery across up to 50 addresses in one slot',
    ],
  },
  {
    from: 200,
    label: '200 plants and above',
    perUnitPaise: 49_900,
    includes: [
      'Everything in 100–199',
      'A reserved production slot, so your order is planned into the bench rather than into a gap',
      'Split delivery at up to 50 addresses per delivery day',
    ],
  },
]

/** The occasion a customer picks, and what it means commercially. */
export interface OccasionOption {
  /** Customer-facing slug. What the form posts and what we validate against. */
  value: string
  /** What the select shows. */
  label: string
  /** Honest guidance about this occasion — lead times, what to book, what to avoid. */
  note: string
}

/**
 * The values the `enum_quote_requests_occasion` Postgres type holds.
 *
 * Kept as a literal union rather than a bare `string` so that a typo in the
 * mapping below is a type error rather than an `invalid input value for enum`
 * thrown by the database at the worst possible moment — in front of a procurement
 * manager, on their one attempt.
 */
export type PipelineOccasion =
  'onboarding' | 'employee_occasion' | 'client' | 'festive' | 'office_refresh' | 'event' | 'other'

/**
 * Customer slug → the enum label we store.
 *
 * ── WHY THEY ARE NOT THE SAME STRING ────────────────────────────────────────
 *
 * The database vocabulary is a reporting vocabulary: `festive`, `client`,
 * `employee_occasion`. A form vocabulary is a buying vocabulary, and for the
 * single most common order in this category — Diwali — a customer does not think
 * "festive", they think "Diwali". Every Diwali order in the pipeline being filed
 * under a generic label is fine for reporting; every *form* that says "festive"
 * and leaves the buyer guessing whether their festival is in scope is how the
 * competitor's telephone funnel wins.
 *
 * So the form speaks the customer's word and the mapping is explicit and total:
 * all seven enum values are reachable, which is what keeps the admin list
 * usable. Adding an occasion means adding a row to `OCCASION_OPTIONS` AND a
 * mapping here; the validator refuses a slug with no mapping, so the two cannot
 * silently drift.
 */
export const OCCASION_STORAGE: Readonly<Record<string, PipelineOccasion>> = {
  diwali: 'festive',
  employee: 'employee_occasion',
  onboarding: 'onboarding',
  client: 'client',
  'office-refresh': 'office_refresh',
  event: 'event',
  other: 'other',
}

export const OCCASION_OPTIONS: readonly OccasionOption[] = [
  {
    value: 'diwali',
    label: 'Diwali, or another festival',
    note: 'Our busiest two weeks of the year, and the one place we ask for the most notice. Book before the festival is announced internally, not after.',
  },
  {
    value: 'employee',
    label: 'An employee occasion — birthday, work anniversary, appreciation',
    note: 'Easiest of the lot. We hold plants aside for a named person rather than growing to a date.',
  },
  {
    value: 'onboarding',
    label: 'Onboarding or joining gifts',
    note: 'Tell us the joining date and we work backwards from it. Most new joiners get theirs the same week they land.',
  },
  {
    value: 'client',
    label: 'Client or customer gifting',
    note: 'We can write the card to a person rather than to a company, which is usually the point of the gift.',
  },
  {
    value: 'office-refresh',
    label: 'Refreshing an office or meeting space',
    note: 'The one where you tell us the light, not the room. A north-facing floor and a windowless cabin need completely different plants.',
  },
  {
    value: 'event',
    label: 'An event — a conference, a stall, a visit',
    note: 'We can stage plants and collect them again. Collection is quoted separately because it is a second trip, not a free extra.',
  },
  {
    value: 'other',
    label: 'Something else',
    note: 'Say what it is in the notes. If we cannot do it we will tell you in the first reply instead of after you have placed an order.',
  },
]

/**
 * Pot printing becomes possible at this quantity.
 *
 * Below it the print setup cannot be amortised over enough units, and the honest
 * thing is to say so on the page rather than take the order and then discover the
 * maths. The lab charges per run, not per pot.
 */
export const POT_PRINTING_MIN_QUANTITY = 50

/**
 * Working days that printing adds.
 *
 * This is the constraint the landing page publishes as a limitation, and it is
 * the reason a festive order is a conversation rather than a checkout. Nobody in
 * this category states it: Kyari engraves logos above 30 units and says nothing
 * about how long it takes.
 */
export const POT_PRINTING_EXTRA_DAYS = 10

/**
 * Lead-time bands, in WORKING days, from an accepted quote to delivery.
 *
 * Working days, not calendar days, because a procurement manager is counting
 * working days in their own plan. The bands step on the same quantity
 * thresholds as `VOLUME_TIERS` because the constraint is the same one: how much
 * of the batch exists on the bench versus how much has to be finished first.
 *
 * The 7-day floor is the retail promise. Bulk is never faster than single-unit
 * — the reason it is CHEAPER here is that the bench amortises the work, not that
 * we ship before we have grown the plant.
 */
const LEAD_TIME_BANDS: readonly { upTo: number; days: number }[] = [
  { upTo: 24, days: 7 },
  { upTo: 49, days: 10 },
  { upTo: 99, days: 14 },
  { upTo: 199, days: 18 },
  { upTo: Number.MAX_SAFE_INTEGER, days: 21 },
]

/**
 * The shortest notice we can work to, in calendar days.
 *
 * Used by the validator to refuse a delivery date in the past or inside the same
 * week, which is the request that produces a phone call — the exact interaction
 * this page set exists to remove.
 */
export const MINIMUM_BOOKING_DAYS = 10

/** The first date we will accept, as an ISO calendar date (YYYY-MM-DD), in IST. */
export function earliestDeliveryDate(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return isoDateInIst(new Date(ist.getTime() + MINIMUM_BOOKING_DAYS * 86_400_000))
}

/** The most recent date that is still in the past — the `max` on a date input. */
export function latestDeliveryDate(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return isoDateInIst(ist)
}

/** Calendar date of a moment, in IST (UTC+05:30 — India observes no DST). */
function isoDateInIst(at: Date): string {
  const shifted = new Date(at.getTime() + 5.5 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

/** Lead time in working days for a quantity. Quantity alone. */
export function leadTimeDays(quantity: number): number {
  const q = normaliseQuantity(quantity)
  for (const band of LEAD_TIME_BANDS) {
    if (q <= band.upTo) return band.days
  }
  // Unreachable: the final band runs to MAX_SAFE_INTEGER. Returned rather than
  // thrown so a stray Infinity degrades to the slowest promise rather than to an
  // error page in front of a customer.
  return LEAD_TIME_BANDS[LEAD_TIME_BANDS.length - 1]!.days
}

/**
 * Lead time including printing, which is the number a festive or branded order
 * actually needs.
 *
 * Kept separate from `leadTimeDays` because printing is a CHOICE, not a property
 * of the quantity. Folding it into the quantity-driven figure would mean every
 * unbranded order quoted 10 days it will never need, which is how a published
 * lead time stops being believed.
 */
export function leadTimeForOrder(quantity: number, wantsPrinting: boolean): number {
  const base = leadTimeDays(quantity)
  const printingApplies = wantsPrinting && normaliseQuantity(quantity) >= POT_PRINTING_MIN_QUANTITY
  return printingApplies ? base + POT_PRINTING_EXTRA_DAYS : base
}

/**
 * The tier a quantity falls into.
 *
 * Below the MOQ it returns the ENTRY tier rather than refusing. That is
 * deliberate: the live estimate on the form has to be able to say "this is under
 * our minimum" while still showing what ten units would cost, which is the most
 * persuasive thing the page can say to someone who typed 6.
 */
export function tierFor(quantity: number): VolumeTier {
  const q = normaliseQuantity(quantity)
  let match = VOLUME_TIERS[0]!
  for (const tier of VOLUME_TIERS) {
    if (tier.from <= q) match = tier
  }
  return match
}

/**
 * Order value in integer paise. Exact; no rounding, because there is nothing to
 * round — two integers multiplied.
 *
 * Throws on fractional paise rather than rounding it. A caller that has produced
 * a fractional rupee amount has a bug in a money conversion, and quietly rounding
 * it here is exactly how a float eventually reaches a paise column.
 */
export function estimatedTotalPaise(quantity: number, perUnitPaise: number): number {
  if (!Number.isInteger(perUnitPaise) || perUnitPaise < 0) {
    throw new Error(
      `Corporate per-unit price must be whole paise, received ${perUnitPaise}. No floats.`,
    )
  }
  const q = normaliseQuantity(quantity)
  if (!Number.isSafeInteger(q * perUnitPaise)) {
    throw new Error(
      `Corporate order value overflows a safe integer at ${q} units. Refusing a total we cannot represent exactly.`,
    )
  }
  return q * perUnitPaise
}

/**
 * Convert a rupee amount typed by a human into integer paise.
 *
 * ── WHY THIS IS NOT `Math.round(x * 100)` ───────────────────────────────────
 *
 * `695.5 * 100` is 69550.00000000001, and `0.1 + 0.2 * 100` is 30.000000000000004.
 * Rounding hides that; this does not. The digits are split as STRINGS and
 * recombined, so a rupee figure can never become a fractional paise figure by
 * the way in.
 *
 * `parseFloat` is banned outright in this project (see `eslint.config.mjs`), and
 * for money it is also wrong on its own terms: it accepts "1,299", "₹1299" and
 * "12abc". A procurement manager typing from a spreadsheet produces exactly those
 * shapes, so this accepts them and rejects the rest with copy.
 *
 * @returns integer paise, or `null` when the input is not a rupee amount.
 */
export function rupeesToPaise(input: string | number): number | null {
  const raw = (typeof input === 'number' ? numberToPlainString(input) : input)
    .trim()
    // A budget copied out of a spreadsheet arrives with a currency symbol and
    // thousands separators on it. Both are unambiguous noise, not information.
    .replace(/^₹/, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')

  if (raw === '') return null

  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(raw)
  if (!match) return null

  const whole = match[1]!
  const paiseDigits = (match[2] ?? '').padEnd(2, '0')
  const paise = Number(whole) * 100 + (paiseDigits === '00' ? 0 : Number(paiseDigits))
  return Number.isSafeInteger(paise) ? paise : null
}

/**
 * Render a number as the digits a person would have typed.
 *
 * Needed because `String(695.5)` is fine but `String(1e21)` is `'1e+21'` and a
 * scientific-notation budget would be rejected by `rupeesToPaise` for a reason
 * nobody could act on.
 */
function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** A validated quote request, as the API writes it. */
export interface QuoteRequest {
  organisation: string
  contactName: string
  email: string
  phone: string
  minimumQuantity: number
  /** A value from `OCCASION_OPTIONS`, NOT a `PipelineOccasion`. */
  occasion: string
  budgetPerUnitPaise: number | null
  /** ISO calendar date, YYYY-MM-DD. Null when the buyer has no date yet. */
  deliveryDate: string | null
  personalisation: string | null
  notes: string | null
}

/** Field-length ceilings. Generous, and enforced rather than silently trimmed. */
export const MAX_ORGANISATION = 120
export const MAX_CONTACT_NAME = 120
export const MAX_PERSONALISATION = 1_000
export const MAX_NOTES = 2_000
/** A sanity ceiling on a stated budget — above this it is not a plant budget. */
export const MAX_BUDGET_PER_UNIT_PAISE = 1_000_000

/**
 * Validate a quote request.
 *
 * ── THE ERRORS ARE COPY, NOT DIAGNOSTICS ────────────────────────────────────
 *
 * `/api/contact` sets the rule and this follows it: a validation message is the
 * sentence the customer reads, so it is written as a sentence, here, rather than
 * produced by a schema library. "invalid input" tells a procurement manager
 * nothing they can act on. "Pick the occasion that fits best" tells them exactly
 * what to do, and the form can show it under the right box.
 *
 * It returns the message; it never throws and never returns an internal error.
 * There is no path out of this function that reveals a stack, a column name or a
 * constraint.
 *
 * Order matters: the cheapest, most-frequently-wrong fields are checked first, so
 * the customer is told about the one thing that is actually blocking them rather
 * than the first field in the form.
 */
export function validateQuoteRequest(
  input: unknown,
): { ok: true; value: QuoteRequest } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return fail('That did not arrive in a form we recognise. Reload the page and try again.')
  }

  const body = input as Record<string, unknown>

  const organisation = readText(body.organisation)
  if (organisation === null || organisation.length < 2) {
    return fail('Which organisation is this for? We put the name on the quote.')
  }
  if (organisation.length > MAX_ORGANISATION) {
    return fail(
      `That organisation name is over ${MAX_ORGANISATION} characters. Shorten it to the trading name.`,
    )
  }

  const contactName = readText(body.contactName)
  if (contactName === null || contactName.length < 2) {
    return fail('Add your name — it is who we reply to.')
  }
  if (contactName.length > MAX_CONTACT_NAME) {
    return fail(`That name is over ${MAX_CONTACT_NAME} characters. Just the name is enough.`)
  }

  const email = readText(body.email)
  if (email === null || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail(
      'That e-mail does not look complete. We send the quote to it, so it has to be the one you read.',
    )
  }
  if (email.length > 200) {
    return fail('That e-mail address is too long to be real. Check for a stray paste.')
  }

  const phone = readText(body.phone)
  if (phone === null || digitsOf(phone).length < 10 || digitsOf(phone).length > 15) {
    return fail(
      'Add a mobile number we can reach you on. A procurement WhatsApp number is the one that gets answered fastest.',
    )
  }

  /*
   * MOQ next, and it is the rule with a schema constraint behind it, so the copy
   * has to match the CHECK rather than argue with it. A four-plant order is not a
   * corporate order — it is four plants, and the honest answer is the shop.
   */
  const minimumQuantity = parseQuantity(body.minimumQuantity)
  if (minimumQuantity === null) {
    return fail('How many plants do you need? A whole number, please.')
  }
  if (minimumQuantity < CORPORATE_MOQ) {
    return fail(
      `Our minimum for a corporate order is ${CORPORATE_MOQ} plants, so a parcel of that size is priced for a single customer instead. Below that, the shop is cheaper for you and for us.`,
    )
  }
  if (minimumQuantity > MAX_QUOTE_QUANTITY) {
    return fail(
      `We work up to ${MAX_QUOTE_QUANTITY.toLocaleString('en-IN')} plants from one bench in one city. Above that we are a different business, and we would rather say so now.`,
    )
  }

  const occasion = readText(body.occasion)
  if (occasion === null || !OCCASION_STORAGE[occasion]) {
    return fail(
      'Pick the occasion that fits best — it decides who at the bench handles your order.',
    )
  }

  /*
   * Budget is OPTIONAL and deliberately so. A buyer who has not been given a
   * budget must be able to ask without inventing one, and a required budget
   * field is where half of a procurement funnel is abandoned.
   */
  let budgetPerUnitPaise: number | null = null
  const budgetRaw = readOptionalText(body.budgetPerUnitRupe)
  if (budgetRaw !== null) {
    budgetPerUnitPaise = rupeesToPaise(budgetRaw)
    if (budgetPerUnitPaise === null) {
      return fail(
        'That budget per plant did not read as a rupee amount. Enter rupees — 695, or 695.50 for paise.',
      )
    }
    if (budgetPerUnitPaise < 100) {
      return fail(
        'A budget of nothing is not a budget. Leave the box empty if you have not settled on one.',
      )
    }
    if (budgetPerUnitPaise > MAX_BUDGET_PER_UNIT_PAISE) {
      return fail(
        'That budget per plant is above our whole price range. Leave it empty and put the number you have in mind in the notes — we will answer it directly.',
      )
    }
  }

  let deliveryDate: string | null = null
  const deliveryRaw = readOptionalText(body.deliveryDate)
  if (deliveryRaw !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryRaw) || !isRealCalendarDate(deliveryRaw)) {
      return fail('That delivery date is not a date we can read. Pick one from the calendar.')
    }
    if (deliveryRaw < earliestDeliveryDate()) {
      return fail(
        `We need at least ${MINIMUM_BOOKING_DAYS} days' notice — the shortest run we work to is ${leadTimeDays(CORPORATE_MOQ)} working days, and pots printed with a logo take longer. Pick a date from ${formatDay(earliestDeliveryDate())}.`,
      )
    }
    deliveryDate = deliveryRaw
  }

  /*
   * The two long free-text fields are REJECTED when too long, not truncated.
   *
   * `/api/contact` slices its message to 2,000 characters and that is right
   * there: cutting the tail of a sentence loses nothing. Here the field is a
   * personalisation brief — half a spec is a build error, and the customer
   * believes we read all of it. Refusing is the only honest option.
   */
  const personalisation = readOptionalText(body.personalisation)
  if (personalisation !== null && personalisation.length > MAX_PERSONALISATION) {
    return fail(
      `That personalisation note is over ${MAX_PERSONALISATION} characters. Trim it and we will still get the point.`,
    )
  }

  const notes = readOptionalText(body.notes)
  if (notes !== null && notes.length > MAX_NOTES) {
    return fail(`That note is over ${MAX_NOTES} characters. Trim it and send the rest as a reply.`)
  }

  return {
    ok: true,
    value: {
      organisation,
      contactName,
      email,
      phone,
      minimumQuantity,
      occasion,
      budgetPerUnitPaise,
      deliveryDate,
      personalisation,
      notes,
    },
  }
}

/**
 * The enum label to store for a customer-facing occasion slug, or null when the
 * slug is not one of ours.
 *
 * Null rather than a fallback of `other`, because a silent fallback is how a
 * pipeline number becomes untrustworthy: two Diwali orders filed as "other" is
 * the kind of thing nobody notices for four months.
 */
export function pipelineOccasionFor(occasion: string): PipelineOccasion | null {
  return OCCASION_STORAGE[occasion] ?? null
}

/**
 * Fail-fast on a ladder that has stopped being a ladder.
 *
 * Runs once at import. A volume tier that does not fall in price is not a
 * cosmetic bug — it is the page contradicting the only claim it makes — and the
 * failure must be loud at development time, not discovered by a customer who
 * reads the table carefully.
 */
function assertLadderCoherent(): void {
  if (VOLUME_TIERS.length === 0)
    throw new Error('VOLUME_TIERS is empty; /corporate would publish no prices.')

  const entry = VOLUME_TIERS[0]!
  if (entry.from !== CORPORATE_MOQ) {
    throw new Error(
      `The first volume tier opens at ${entry.from} units but CORPORATE_MOQ is ${CORPORATE_MOQ}. The page and the database must agree on the minimum.`,
    )
  }
  if (!Number.isInteger(entry.perUnitPaise) || entry.perUnitPaise <= 0) {
    throw new Error(`Volume tier "${entry.label}" must carry whole, positive paise.`)
  }

  /*
   * Compares each tier against the one BELOW it, starting from the second — the
   * first tier has no predecessor and comparing it with itself is the failure
   * this function exists to catch, which is exactly what it did when it was
   * written.
   */
  let previous = entry
  for (let index = 1; index < VOLUME_TIERS.length; index++) {
    const tier = VOLUME_TIERS[index]!
    if (!Number.isInteger(tier.perUnitPaise) || tier.perUnitPaise <= 0) {
      throw new Error(`Volume tier "${tier.label}" must carry whole, positive paise.`)
    }
    if (tier.from <= previous.from) {
      throw new Error(
        `Volume tier "${tier.label}" starts at ${tier.from} units, which is not above "${previous.label}" at ${previous.from}. A ladder out of order cannot be looked up by quantity.`,
      )
    }
    if (tier.perUnitPaise >= previous.perUnitPaise) {
      throw new Error(
        `Volume tier "${tier.label}" (${tier.perUnitPaise}p) does not fall below "${previous.label}" (${previous.perUnitPaise}p). A ladder that rises is a page that lies.`,
      )
    }
    if (tier.includes.length === 0) {
      throw new Error(`Volume tier "${tier.label}" promises nothing. Say what is included.`)
    }
    previous = tier
  }

  if (entry.includes.length === 0) {
    throw new Error(`Volume tier "${entry.label}" promises nothing. Say what is included.`)
  }
}
assertLadderCoherent()

/** A quantity coerced to something we can compare, price and multiply safely. */
function normaliseQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0
  const floored = Math.floor(quantity)
  return floored < 0 ? 0 : floored
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

/** Trimmed string, or null when absent or blank. */
function readText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/** As `readText`, but null and "absent" are the same thing. */
function readOptionalText(value: unknown): string | null {
  return readText(value)
}

/**
 * A whole number from a form field or a JSON body.
 *
 * Strict on purpose. `Number.parseInt('50 pots')` returns 50, which is how a typed
 * mistake becomes a silent under-order; and `Number.parseInt(' 0755 ')` reads as
 * octal in some engines. A quantity either is a run of digits or it is not a
 * quantity.
 *
 * Exported because the quote form parses the same field to drive its live
 * estimate, and a quantity rule with two implementations is a quantity rule that
 * will eventually disagree with itself.
 */
export function parseQuantity(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '')
    if (!/^\d+$/.test(trimmed)) return null
    const parsed = Number(trimmed)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/** Rejects 2026-02-30, which `new Date()` would happily roll into March. */
function isRealCalendarDate(iso: string): boolean {
  const [year, month, day] = iso.split('-').map((part) => Number(part)) as [number, number, number]
  const at = Date.UTC(year, month - 1, day)
  const back = new Date(at)
  return (
    back.getUTCFullYear() === year && back.getUTCMonth() === month - 1 && back.getUTCDate() === day
  )
}

/** `2026-11-04` → `4 November 2026`. For copy that has to read as a date. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map((part) => Number(part)) as [number, number, number]
  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${day} ${MONTHS[month - 1]} ${year}`
}
