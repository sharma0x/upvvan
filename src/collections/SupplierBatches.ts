import type { CollectionConfig } from 'payload'

/**
 * Supplier batch — traceability, and the thing that gates publishing.
 *
 * "Never list a species you can't trace to a bill" is a COMPLIANCE requirement,
 * not a preference: CITES and the Wildlife (Protection) Act cover many traded
 * ornamentals, and an untraceable SKU is a species we cannot defend.
 *
 * So the batch is a first-class entity and publishing is STRUCTURALLY blocked
 * without one — see the `skus` collection and the DB trigger in
 * src/migrations. A checklist would be bypassable; a constraint is not.
 */
export const SupplierBatches: CollectionConfig = {
  slug: 'supplier-batches',
  admin: {
    useAsTitle: 'batchCode',
    group: 'Ops',
    defaultColumns: ['batchCode', 'supplierName', 'billId', 'dateReceived', 'quantityReceived'],
    description:
      'Traceability. A SKU cannot be published without one of these — enforced by the database.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'batchCode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Internal batch identifier, e.g. BATCH-2026-0042.' },
    },
    { name: 'supplierName', type: 'text', required: true },
    {
      name: 'billId',
      type: 'text',
      // `required: true` is deliberate and load-bearing: Payload emits a
      // column-level NOT NULL, so an untraceable batch CANNOT EXIST. That is a
      // stronger guarantee than the trigger on `skus` — traceability is
      // structural rather than conditional on publish.
      required: true,
      admin: {
        description:
          'The supplier bill number. This is the actual traceability artefact — "traceable to a bill" means literally this.',
      },
      validate: (value: string | null | undefined) =>
        value && value.trim().length >= 4
          ? true
          : 'A bill reference is required — never list what you cannot trace.',
    },
    {
      name: 'supplierGstin',
      type: 'text',
      admin: { description: 'Supplier GSTIN, where available.' },
    },
    {
      name: 'nurseryLocation',
      type: 'text',
      admin: { description: 'Where the stock physically is.' },
    },
    { name: 'dateReceived', type: 'date', required: true },
    { name: 'quantityReceived', type: 'number', required: true },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'CITES checks, species notes, anything a reviewer needs to know.' },
    },
  ],
  timestamps: true,
}
