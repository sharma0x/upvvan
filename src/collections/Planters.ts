import type { CollectionConfig } from 'payload'

/**
 * Planters — the AOV lever, as data.
 *
 * The planter is the strongest proven mechanic in the category: +29% to +121%
 * uplift, largest at the small end, because the pot has near-zero mortality and
 * barely moves freight. Ugaoo runs one Money Plant from ₹199 to ₹1,099 across
 * 2 sizes × 14 pot styles × 17 colours.
 *
 * `upliftBp` is bounded to the PROVEN band (2900–12100). Above that we would be
 * inventing a number no competitor has demonstrated — and an invented price on
 * a live PDP carrying Legal Metrology declarations is a compliance problem, not
 * a revenue opportunity. The bound is enforced here and again in SQL.
 */
export const Planters: CollectionConfig = {
  slug: 'planters',
  admin: {
    useAsTitle: 'name',
    group: 'Catalogue',
    defaultColumns: ['name', 'upliftBp', 'costPaise', 'material', 'isActive'],
    description:
      'Pot styles and colours. Uplift is the primary AOV mechanic and is bounded to the proven band.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description:
          'Shown to the customer verbatim, e.g. "Handmade terracotta, unglazed". The rider-facing band label follows the same rule: no hiding a formula.',
      },
    },
    {
      name: 'upliftBp',
      type: 'number',
      required: true,
      admin: {
        description:
          'Uplift over the size-tier price, in BASIS POINTS. 2900 = +29%, 12100 = +121%. Bounded to the proven band.',
      },
      validate: (value: number | null | undefined) => {
        if (value == null) return 'An uplift is required — 0 means "the honest entry option".'
        if (!Number.isInteger(value)) return 'Uplift must be whole basis points.'
        if (value < 0) return 'A planter cannot reduce a price. Use 0 for a no-premium option.'
        if (value > 12100) {
          return 'Uplift above +121% is outside the proven band — no competitor has demonstrated it.'
        }
        return true
      },
    },
    {
      name: 'costPaise',
      type: 'number',
      required: true,
      admin: { description: 'Our cost, in paise. Pot margins are where the money is.' },
    },
    {
      name: 'material',
      type: 'text',
      admin: { description: 'e.g. terracotta · ceramic · coir' },
    },
    {
      name: 'colour',
      type: 'text',
      admin: {
        description:
          'e.g. terracotta · white · sage. One of 17 colour axes at Ugaoo. Kept as a single variant axis on purpose — product-design.md §2.3: planter/colour is a 1-D axis on an item already decided, to avoid choice paralysis.',
      },
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
  ],
  timestamps: true,
}