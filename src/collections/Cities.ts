import type { CollectionConfig } from 'payload'

/**
 * City — the root of every per-city entity.
 *
 * City selection is a LEGAL decision, not just a density decision: Telangana
 * (Act 2010), Haryana (Act 2025), West Bengal (Act XXXI 2001) and Uttarakhand
 * all require nursery registration to operate. That is kill-switch #1 in the
 * founder's checklist and it is modelled as a GATE here — `licenceStatus` must
 * be `approved` before `status` can be `live`, and that is enforced by a CHECK
 * constraint in the schema, not by a hook (see src/migrations, business
 * invariants).
 *
 * `isActive` is HQ's on/off switch and is deliberately separate from `status`:
 * status is lifecycle (pending → soft_launch → live → killed) and is a one-way
 * journey, while isActive is the daily operational switch used to bulk-pause a
 * city ahead of the March–June heat window.
 */
export const Cities: CollectionConfig = {
  slug: 'cities',
  admin: {
    useAsTitle: 'name',
    group: 'Geo',
    defaultColumns: ['name', 'state', 'status', 'isActive', 'licenceStatus'],
    description:
      'A delivery city. Every per-city entity carries city_id. Adding a city must be configuration only — no code change, no deploy.',
  },
  access: {
    read: () => true, // public: the storefront resolves serviceability by city
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Stable key used in URLs and config.' },
    },
    { name: 'state', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Soft launch', value: 'soft_launch' },
        { label: 'Live', value: 'live' },
        { label: 'Killed', value: 'killed' },
      ],
      admin: {
        description:
          'Lifecycle. A city can only be `live` once its licence is approved — enforced by a DB CHECK constraint.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: {
        description:
          'Daily operational on/off switch. Use to bulk-pause ahead of the March–June heat window.',
      },
    },
    {
      name: 'licence',
      type: 'group',
      admin: { description: 'State horticulture nursery registration (kill-switch #1).' },
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'not_filed',
          options: [
            { label: 'Not filed', value: 'not_filed' },
            { label: 'Filed', value: 'filed' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ],
        },
        { name: 'number', type: 'text' },
        {
          name: 'approvedAt',
          type: 'date',
          admin: { description: 'Required before status can become `live`.' },
        },
        { name: 'notes', type: 'textarea' },
      ],
    },
    {
      name: 'interstateMovementClearance',
      type: 'group',
      admin: {
        description:
          'Kill-switch #2 — UNRESOLVED in all nine research files. Must be confirmed in writing with the State Horticulture Directorate and PPQS before shipping anything interstate.',
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'unresolved',
          options: [
            { label: 'Unresolved', value: 'unresolved' },
            { label: 'Not required', value: 'not_required' },
            { label: 'Required + obtained', value: 'obtained' },
          ],
        },
        { name: 'reference', type: 'text' },
        { name: 'confirmedAt', type: 'date' },
      ],
    },
    { name: 'gstin', type: 'text' },
    {
      name: 'taxRateBp',
      type: 'number',
      admin: {
        description:
          'GST rate in basis points (1800 = 18%). Integer, to avoid float tax arithmetic.',
      },
    },
    {
      name: 'capacityPerDay',
      type: 'number',
      admin: { description: 'Max orders this city can fulfil per day.' },
    },
    {
      name: 'serviceablePincodeCount',
      type: 'number',
      admin: {
        readOnly: true,
        description:
          'Maintained by the pincode CSV importer. Read-only here so it cannot drift from the rows it counts.',
      },
    },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
}
