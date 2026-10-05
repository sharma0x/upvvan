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
    description:
      'Global plant catalogue with care profiles. Written once, sold in every city.',
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