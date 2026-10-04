import type { CollectionConfig } from 'payload'

/**
 * Price book — per-city commercial and policy configuration.
 *
 * THE GUARANTEE TIER LIVES HERE, NOT IN CODE.
 *
 * `concept.md` §3 and `product-design.md` §2.6 advertise a 90-day survival
 * guarantee. `use-cases.md` §11 (revised 4 Oct 2026, and therefore the later
 * document) replaces that with a tiered scheme, and explains why: the global
 * standard is 30 days, no competitor in any market we researched exceeds it,
 * and our 5% DOA input is the least-evidenced number in the entire
 * unit-economics model. Extending to 90 days while that number is a guess
 * converts a marketing promise into an unpriced liability.
 *
 * So: T0 = 48h at launch. T1 (30 days) and T2 (90 days) are behind flags that
 * DEFAULT OFF, and promotion is a data decision — reviewed against measured DOA
 * and claim rates — never a calendar decision. Shipping a 90-day promise into a
 * 46°C May is the exact contradiction this tiering exists to prevent.
 *
 * Because the tier is a row and not a constant, a customer is shown only the
 * window they were actually sold, and the per-order guarantee snapshot can
 * record what was promised at purchase.
 */
export const PriceBooks: CollectionConfig = {
  slug: 'price-books',
  admin: {
    useAsTitle: 'name',
    group: 'Geo',
    defaultColumns: ['name', 'city', 'activeGuaranteeTier', 'freeDeliveryThresholdPaise'],
    description:
      'Per-city pricing and policy. The guarantee tier is configuration here, never a hardcoded constant.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      required: true,
      index: true,
    },
    {
      name: 'activeGuaranteeTier',
      type: 'select',
      required: true,
      defaultValue: 'T0',
      options: [
        { label: 'T0 — Arrival health, 48 hours', value: 'T0' },
        { label: 'T1 — Survival, 30 days', value: 'T1' },
        { label: 'T2 — Extended, 90 days', value: 'T2' },
      ],
      admin: {
        description:
          'The window shown to customers. T1 requires ~500 delivered orders AND a measured DOA rate. T2 requires measured DOA and claim rate to support the cost. Promotion is a data decision, never a calendar one.',
      },
    },
    {
      name: 'guaranteeT1Enabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Feature flag for T1. Defaults OFF. Flipping it is a decision, not a deploy.',
      },
    },
    {
      name: 'guaranteeT2Enabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Feature flag for T2. Defaults OFF. Requires the March–June heat-window exclusion wording to be in place first.',
      },
    },
    {
      name: 'heatWindowExclusionWording',
      type: 'textarea',
      admin: {
        description:
          'REQUIRED before T1 can be enabled. A plant delivered in the 40–46°C window faces a death inside 30 days that is not a care failure.',
      },
    },
    {
      name: 'freeDeliveryThresholdPaise',
      type: 'number',
      admin: {
        description:
          '0 = free delivery with no minimum, which is our launch posture. Set deliberately as an AOV lever (AOV +₹100 = +₹45 contribution).',
      },
    },
    {
      name: 'deliveryFeePaise',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Applied above the free-delivery threshold. Integer paise.' },
    },
    {
      name: 'planterLadderMinUpliftBp',
      type: 'number',
      admin: {
        description:
          'Floor on planter uplift, basis points. Proven range is +29% to +121%, largest at the small end (Ugaoo: ₹199 → ₹1,099 on an identical plant).',
      },
    },
    {
      name: 'planterLadderMaxUpliftBp',
      type: 'number',
      admin: { description: 'Ceiling on planter uplift, basis points.' },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Why a value was chosen. This is the audit trail for pricing decisions.',
      },
    },
  ],
  timestamps: true,
}
