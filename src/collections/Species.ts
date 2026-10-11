import type { CollectionConfig } from 'payload'

/**
 * Species — the GLOBAL plant record, written once and reused in every city.
 *
 * This is the collection that decided the stack. `STACK-DECISION.md` R1: our
 * product record is content-and-compliance-shaped, not commerce-shaped. The care
 * profile, the symptom graph and the declaration block are first-class fields
 * here, not custom fields bolted onto a commerce variant.
 *
 * Care data is the durable asset. Bloomscape's app died and its 117 guides + 175
 * symptom-first pages survived and compounded — the container is disposable, the
 * content is not. So care fields are as first-class as price.
 */
export const Species: CollectionConfig = {
  slug: 'species',
  admin: {
    useAsTitle: 'commonName',
    group: 'Catalogue',
    defaultColumns: ['commonName', 'botanicalName', 'difficulty', 'toxicity', 'light'],
    description: 'Global plant catalogue with care profiles. Written once, sold in every city.',
  },
  access: {
    read: () => true, // public: the storefront renders species without auth
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'commonName', type: 'text', required: true },
    {
      name: 'botanicalName',
      type: 'text',
      admin: { description: 'Genus species. e.g. Epipremnum aureum.' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'summary',
      type: 'text',
      admin: {
        description:
          "One line, the benefit, in the seller's voice. Sits under the botanical name on the card and the PDP. Ugaoo's is 'Designers’ favourite statement plant' — a reason, not a restatement of the name.",
      },
    },
    {
      name: 'benchNote',
      type: 'textarea',
      admin: {
        description:
          'What actually arrives in the parcel, measured at the bench. THIS is the field the audit says matters most: the single most-complained-about failure in the category is the plant being smaller than the photo, and the fix is a sentence that says what you will really get.',
      },
    },

    // ── The three filter flags the collection pages are generated from ──────
    //
    // Each one exists because a URL needs to be derivable from data rather than
    // maintained by hand. `/collections/air-purifying-plants` and
    // `/collections/plants-that-are-safe-around-cats-and-dogs` are indexable
    // pages; if they were maintained as hand-written lists they would drift out
    // of the catalogue within a week and start selling plants we do not stock.
    {
      name: 'edible',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Edible — powers the kitchen-windowsill collection.' },
    },
    {
      name: 'airPurifying',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Meaningfully raises humidity / filters particulates. Deliberately NOT claimed by default: the copy on that page says plainly that no plant replaces ventilation.',
      },
    },
    {
      name: 'vastuFriendly',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Traditionally placed for benefit in a home or work desk.' },
    },

    // ── Care profile ────────────────────────────────────────────────────────
    // Copied verbatim from the best-transferred mechanic in the research: a
    // soil-moisture-% watering spec. Sellers who publish it get fewer "why is my
    // plant dying" tickets, which on a WhatsApp-first support model is margin.
    {
      type: 'group',
      name: 'care',
      admin: { description: 'Care profile — drives PDP, care engine and support.' },
      fields: [
        {
          name: 'light',
          type: 'select',
          required: true,
          options: [
            { label: 'Low light', value: 'low' },
            { label: 'Bright indirect', value: 'bright_indirect' },
            { label: 'Direct sun', value: 'direct' },
          ],
        },
        {
          name: 'waterIntervalDays',
          type: 'number',
          required: true,
          admin: { description: 'Days between waterings at average indoor conditions.' },
        },
        {
          name: 'soilMoistureTargetPct',
          type: 'number',
          required: true,
          admin: {
            description:
              'Target soil moisture %. The single most useful number on the PDP for a first-time plant owner.',
          },
        },
        {
          name: 'difficulty',
          type: 'select',
          required: true,
          options: [
            { label: 'Easy', value: 'easy' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'Fussy', value: 'fussy' },
          ],
        },
        {
          name: 'toxicity',
          type: 'select',
          required: true,
          options: [
            { label: 'Toxic to pets', value: 'pets' },
            { label: 'Toxic to children', value: 'children' },
            { label: 'Safe', value: 'safe' },
          ],
          admin: {
            description:
              'Drives the pet-safe filter. Wrong here is a safety issue, so it is required rather than defaulted.',
          },
        },
      ],
    },

    // ── The long-form care guide ────────────────────────────────────────────
    //
    // Structured, not a blob of rich text, and the field names are the seven
    // headings Bloomscape ships as an ACF group: LIGHT · WATER · HUMIDITY ·
    // TEMPERATURE · FOOD · TOXICITY · ADDITIONAL CARE. Toxicity is derived from
    // `care.toxicity` above so it cannot contradict the safety filter, which is
    // why it is not repeated here.
    //
    // Structured because each of these paragraphs is a merchandising surface:
    // the WATER paragraph is what makes the soil-moisture figure credible, and
    // a blob of prose cannot be linked to a bag of cocopeat. Bloomscape
    // cross-links every care paragraph to a purchasable accessory and that is
    // the cheapest upsell in the category.
    {
      type: 'group',
      name: 'careGuide',
      admin: {
        description: 'Long-form care guide, field by field. Powers /care/[slug].',
      },
      fields: [
        {
          name: 'light',
          type: 'textarea',
          admin: { description: 'What light it wants, in words. Not the dropdown value.' },
        },
        {
          name: 'water',
          type: 'textarea',
          admin: {
            description:
              'As a soil-moisture instruction, not a calendar. "Water when the top 50% is dry" is testable; "water weekly" is not.',
          },
        },
        { name: 'humidity', type: 'textarea' },
        { name: 'temperature', type: 'textarea' },
        {
          name: 'feeding',
          type: 'textarea',
          admin: { description: 'What to feed it, and when to feed it nothing.' },
        },
        {
          name: 'additional',
          type: 'textarea',
          admin: { description: 'Dust, stake, prune, repot.' },
        },
      ],
    },

    // ── The witness for a safety claim ──────────────────────────────────────
    //
    // `care.toxicity = 'safe'` is a claim that a household with a cat will act
    // on, and it drives an entire indexable collection page. It is therefore
    // the one boolean in this collection that cannot be set by optimism: a
    // migration CHECK refuses `safe` without a date, so somebody has to have
    // gone to the bench and checked it against a reference.
    //
    // Deliberately a date rather than a boolean. "We checked it at some point"
    // is not a durable fact; a date is, and a stale one is visible.
    {
      name: 'toxicityWitnessedAt',
      type: 'date',
      admin: {
        description:
          'When the non-toxic claim was verified at the bench. REQUIRED before `care.toxicity` may be set to "Safe" — a database CHECK enforces it.',
      },
    },

    // ── Seasonal availability ───────────────────────────────────────────────
    // March–June at 40–46°C is lethal in most of India. We substitute hardy
    // SKUs rather than pausing, so availability is a MATRIX (per city), not a
    // boolean on the species. See product-design.md §1: "Bangalore's summer
    // catalogue is not Delhi's."
    {
      type: 'array',
      name: 'seasonalAvailability',
      admin: {
        description:
          'Per-city seasonal availability. A species absent for a city is simply not listed there.',
      },
      fields: [
        {
          name: 'city',
          type: 'relationship',
          relationTo: 'cities',
          required: true,
        },
        {
          name: 'seasons',
          type: 'select',
          hasMany: true,
          required: true,
          options: [
            { label: 'Summer (Mar–Jun, 40–46°C)', value: 'summer' },
            { label: 'Monsoon (Jul–Sep)', value: 'monsoon' },
            { label: 'Perennial (Oct–Feb)', value: 'perennial' },
          ],
        },
        {
          name: 'hardy',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Can this species survive the lethal window? Only hardy species are listed in summer.',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
