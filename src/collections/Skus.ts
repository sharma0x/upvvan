import type { CollectionConfig } from 'payload'

/**
 * SKU — species × size tier, sold in a per-city nursery.
 *
 * THE COMPLIANCE-CRITICAL COLLECTION. Legal Metrology (Packaged Commodities)
 * Rules 2011 r.6(1), extended to online listings by the 2017 Amendment r.6(10),
 * requires seven declarations ON THE LISTING ITSELF. Only month-and-year-of-packing
 * is exempt online.
 *
 * This is a TEMPLATE constraint, not a per-listing task. "Build this into the PDP
 * template before you have 200 SKUs" — retrofitting it across 200 listings is
 * exactly how it gets missed on one.
 *
 * Note which declaration is conditional: DIMENSIONS are required where size is
 * relevant, which is EVERY plant in this category. A soil bag does not need
 * dimensions; a plant does. That conditionality is why this is a CMS field group
 * with validation rather than a flat commerce attribute.
 */
export const Skus: CollectionConfig = {
  slug: 'skus',
  labels: {
    /*
     * Explicit, because Payload pluralised the SLUG and produced "Skuses".
     *
     * A naive `+ 'es'` on `skus` is not an English word, and it was sitting at the
     * top of the Catalogue group in the sidebar where the owner reads it every
     * day. The label is what a person recognises the collection by, so it is worth
     * one line rather than a lifetime of "is that a typo?".
     *
     * Singular "Product" is chosen over "SKU" deliberately: the collection also
     * holds consumables — a bag of cocopeat has a SKU and is not a SKU in the
     * everyday sense, and this is the screen where somebody adds one.
     */
    singular: 'Product',
    plural: 'Products',
  },
  admin: {
    useAsTitle: 'skuCode',
    group: 'Catalogue',
    defaultColumns: ['skuCode', 'species', 'city', 'sizeTier', 'basePricePaise', 'isPublished'],
    description:
      'Sellable unit. Carries the seven Legal Metrology declarations and a traceable batch.',
  },
  access: {
    read: () => true, // public: the storefront lists live SKUs without auth
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'skuCode', type: 'text', required: true, unique: true, index: true },
    {
      name: 'species',
      type: 'relationship',
      relationTo: 'species',
      /*
       * NULLABLE, and that is load-bearing.
       *
       * A consumable — cocopeat, fertiliser, a pot — is not a variety of plant.
       * Forcing one in means either faking a species record for a bag of soil, or
       * making the schema lie about what the SKU is. The right shape is: a
       * `plant` SKU names its species, everything else does not.
       *
       * The structural guarantee that matters for traceability is enforced in
       * the DATABASE instead — see `20261005_000004_traceability_and_audit_fixes.ts`,
       * which requires a batch on every published SKU and requires a species for
       * plants specifically. Application-level `required: true` would be the
       * weaker version of the same rule, and would not apply to a raw insert.
       */
      required: false,
      index: true,
      admin: {
        description: 'Required for plants. Null for consumables and planters.',
      },
    },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      required: true,
      index: true,
    },
    {
      name: 'nursery',
      type: 'relationship',
      relationTo: 'zones',
      admin: { description: 'Which nursery holds this stock.' },
    },
    {
      name: 'sizeTier',
      type: 'select',
      required: true,
      options: [
        { label: 'XS', value: 'XS' },
        { label: 'MD', value: 'MD' },
        { label: 'LG', value: 'LG' },
        { label: 'XL', value: 'XL' },
      ],
    },
    {
      name: 'itemClass',
      type: 'select',
      required: true,
      defaultValue: 'plant',
      options: [
        { label: 'Live plant', value: 'plant' },
        { label: 'Planter / pot', value: 'planter' },
        { label: 'Consumable (soil, feed)', value: 'consumable' },
      ],
      admin: {
        description:
          'Drives remedy rules. A PLANT is replacement-only, never refunded. Consumables refund in money within 24h.',
      },
    },
    {
      name: 'basePricePaise',
      type: 'number',
      required: true,
      admin: {
        description:
          'Bare-plant price in PAISE. The planter ladder is DERIVED from this — never enter a variant price by hand.',
      },
      validate: (value: number | null | undefined) => {
        if (value == null) return 'A price is required.'
        if (!Number.isInteger(value)) return 'Price must be whole paise — no decimals, no rupees.'
        if (value < 0) return 'Price cannot be negative.'
        return true
      },
    },

    // ── Legal Metrology declarations, r.6(1) + 2017 Amendment r.6(10) ───────
    {
      type: 'group',
      name: 'legalMetrology',
      label: 'Legal Metrology declarations (PC Rules 2011 r.6(1), r.6(10))',
      admin: {
        description: 'Mandatory on the listing. Only month-and-year-of-packing is exempt online.',
      },
      fields: [
        {
          name: 'manufacturerName',
          type: 'text',
          required: true,
          admin: { description: 'Name of manufacturer / packer.' },
        },
        {
          name: 'manufacturerAddress',
          type: 'textarea',
          required: true,
          admin: { description: 'Full address of the manufacturer / packer.' },
        },
        {
          name: 'countryOfOrigin',
          type: 'text',
          required: true,
          defaultValue: 'India',
          admin: {
            description:
              'We do not import (Post Entry Quarantine is disproportionate for a startup), so this is India — but it is declared, not assumed.',
          },
        },
        {
          name: 'commonNameDeclared',
          type: 'text',
          required: true,
          admin: { description: 'Common/generic name as it appears on the listing.' },
        },
        {
          name: 'netQuantity',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "1 plant", "5 kg", "1 pot".' },
        },
        {
          name: 'mrpPaise',
          type: 'number',
          required: true,
          admin: {
            description:
              'MRP INCLUSIVE OF ALL TAXES, in paise. This is the price the customer pays — it must equal basePricePaise plus the selected planter, never a bare-plant figure.',
          },
          validate: (value: number | null | undefined) =>
            value == null || !Number.isInteger(value) ? 'MRP must be whole paise.' : true,
        },
        {
          name: 'bestBefore',
          type: 'text',
          admin: {
            description:
              'Only where the commodity can become unfit. NOT applicable to a live plant; required for consumables.',
          },
        },
        {
          name: 'packedMonthYear',
          type: 'text',
          admin: {
            description:
              'Month and year of packing — EXEMPT from the online declaration requirement, but kept for the physical package.',
          },
        },
        {
          name: 'dimensions',
          type: 'group',
          label: 'Dimensions (required where size is relevant — every plant)',
          admin: {
            description:
              'Height × pot diameter × spread, DECLARED. And measured from the bench photo against a ruler, not from a batch record: publishing a height range the grower misses converts a shortfall into a provable breach.',
          },
          fields: [
            {
              name: 'heightCm',
              type: 'number',
              // NOT `required`. Payload would emit a column-level NOT NULL, which
              // would make dimensions mandatory for a bag of cocopeat — wrong.
              // The conditionality belongs in the SQL CHECK (plants only), which
              // is the layer that can actually express "required for plants".
              admin: { description: 'Plant height, cm, measured with a ruler at the bench.' },
              validate: (value: number | null | undefined) =>
                value == null || value <= 0
                  ? 'Height must be a positive number of centimetres.'
                  : true,
            },
            {
              name: 'potDiameterCm',
              type: 'number',
              admin: { description: 'Grow-pot diameter, cm.' },
              validate: (value: number | null | undefined) =>
                value == null || value <= 0 ? 'Pot diameter must be positive.' : true,
            },
            {
              name: 'spreadCm',
              type: 'number',
              admin: { description: 'Canopy spread, cm.' },
              validate: (value: number | null | undefined) =>
                value == null || value <= 0 ? 'Spread must be positive.' : true,
            },
          ],
        },
      ],
    },

    // ── Description for non-species items ───────────────────────────────────
    {
      name: 'description',
      type: 'textarea',
      maxLength: 600,
      admin: {
        description:
          'For CONSUMABLES AND PLANTERS ONLY. A plant takes its description from its species — two tiers of a jade plant must not be able to disagree about what a jade plant is. A bag of cocopeat has no species, so this is where its description lives; a CHECK constraint refuses it on a plant.',
      },
    },

    // ── Traceability ────────────────────────────────────────────────────────
    {
      name: 'batch',
      type: 'relationship',
      relationTo: 'supplier-batches',
      admin: {
        description:
          'REQUIRED before publishing. "Never list a species you cannot trace to a bill."',
      },
    },
    {
      name: 'benchPhotoUrl',
      type: 'text',
      admin: {
        description:
          'Photo of the ACTUAL plant against a ruler. The declared dimensions are measured from this, not from a batch record.',
      },
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Cannot be true without a traceable batch — enforced by a database trigger, not by this panel.',
      },
    },
  ],
  timestamps: true,
}
