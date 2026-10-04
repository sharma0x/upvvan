import type { CollectionConfig } from 'payload'

/**
 * Pincodes — the unit of serviceability.
 *
 * An order cannot exist for a pincode outside this serviceable set, and a
 * serviceable pincode in a DIFFERENT city must also be rejected. Both halves
 * are enforced in src/lib/geo/serviceability.ts and, at order-placement time,
 * by a PostgreSQL constraint rather than by application code alone.
 *
 * `pincode` is TEXT, not a number. Indian pincodes are 6 digits and leading
 * zeros are legal — "012345" is a real pincode, and numeric coercion would
 * silently drop the zero and resolve the wrong district.
 *
 * `city` is NOT NULL on every row. That single NOT NULL is what makes
 * multi-city isolation a property of the schema: there is no way to write a
 * pincode that belongs to no city, so no query can leak one.
 */
export const Pincodes: CollectionConfig = {
  slug: 'pincodes',
  admin: {
    useAsTitle: 'pincode',
    group: 'Geo',
    defaultColumns: ['pincode', 'city', 'zone', 'isServiceable', 'postOfficeName'],
    description:
      'The serviceable set. Imported via CSV (A-07): pincode → zone → band → serviceable.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'pincode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: '6 digits, stored as TEXT so leading zeros survive.' },
      validate: (value: string | null | undefined) =>
        value && /^[0-9]{6}$/.test(value) ? true : 'A pincode is exactly 6 digits.',
    },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      required: true,
      index: true,
    },
    {
      name: 'zone',
      type: 'relationship',
      relationTo: 'zones',
      admin: {
        description:
          "Derived from the pincode's distance band. A pincode with no zone is loudly wrong at check-in rather than quietly mis-paid.",
      },
    },
    {
      name: 'isServiceable',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description:
          'Distinct from the city on/off switch. This is the per-pincode capacity/season decision (A-07 bulk enable/disable).',
      },
    },
    {
      name: 'postOfficeName',
      type: 'text',
      admin: { description: 'Shown to customers to build trust in the coverage area.' },
    },
    {
      name: 'serviceabilityNote',
      type: 'textarea',
      admin: {
        readOnly: true,
        description:
          'Why this pincode is currently unserviceable, if it is. Shown to support, never to the customer.',
      },
    },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
}
