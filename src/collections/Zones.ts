import type { CollectionConfig } from 'payload'

/**
 * Zones are DERIVED FROM BANDS, not the other way round.
 *
 * The intuitive shape is pincode → zone → band, with the band looked up from
 * the zone. That ordering is backwards for our failure mode: it makes band
 * assignment a matter of picking a zone name, so an operator who creates "Zone
 * 4" and forgets to attach bands has silently unbanded every pincode in it.
 *
 * Here a distance DETERMINES a band (src/lib/geo/bands.ts), and a zone is the
 * named, capacitated grouping of the bands that share a delivery geography.
 * `bandCodes` is therefore derived data: it exists so the ops console can talk
 * about "the far zone", not so an operator can assign a band by hand.
 *
 * A pincode with a band but no zone is loudly wrong at check-in. A pincode with
 * a zone but no band cannot exist, because bands are computed from distance.
 */
export const Zones: CollectionConfig = {
  slug: 'zones',
  admin: {
    useAsTitle: 'name',
    group: 'Geo',
    defaultColumns: ['name', 'city', 'bandCodes', 'isActive', 'maxDailyDrops'],
    description:
      'A capacitated delivery geography within one city. Derived from distance bands, never the source of them.',
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
      name: 'bandCodes',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          'Derived: the band codes whose ranges this zone covers. Maintained by the band configuration, not authored here.',
      },
    },
    {
      name: 'maxDailyDrops',
      type: 'number',
      admin: {
        description:
          'Rider capacity. Drives the density index and the bulk enable/disable decision (A-07).',
      },
    },
    { name: 'isActive', type: 'checkbox', required: true, defaultValue: true },
    {
      name: 'serviceablePincodeCount',
      type: 'number',
      admin: { readOnly: true },
    },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
}
