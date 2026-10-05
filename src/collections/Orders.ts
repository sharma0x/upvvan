import type { CollectionConfig } from 'payload'

/**
 * Orders.
 *
 * The state machine (use-cases.md §9) is the important part, and note what is
 * ABSENT from it:
 *
 *   PLACED → ROUTED → PACKING → PACKED → DISPATCHED → DELIVERED → RESOLVED
 *                                                        ↘ CLAIM_OPEN
 *
 * There is NO transition to REFUNDED for a plant. That is the single biggest
 * structural difference from every competitor in the research, and it is why
 * `itemClass` on the line item matters: a plant is replacement-only, while a pot
 * or a bag of cocopeat is refunded in money within 24 hours.
 *
 * `payment_mode` exists as a field so the database can REFUSE the wrong value —
 * the `orders_no_cod` CHECK rejects 'cod' outright. There is no code path that
 * writes it, and no code path that could.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderCode',
    group: 'Orders',
    defaultColumns: ['orderCode', 'status', 'paymentMode', 'revenuePaise', 'createdAt'],
    description:
      'Prepaid only. No COD path exists, and the database refuses one. Plants are replaced, never refunded.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => false, // created only by POST /api/orders
    update: ({ req: { user } }) => Boolean(user),
    delete: () => false, // an order is never deleted
  },
  fields: [
    { name: 'orderCode', type: 'text', required: true, unique: true, index: true },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'PLACED',
      options: [
        { label: 'Placed', value: 'PLACED' },
        { label: 'Routed', value: 'ROUTED' },
        { label: 'Packing', value: 'PACKING' },
        { label: 'Packed', value: 'PACKED' },
        { label: 'Dispatched', value: 'DISPATCHED' },
        { label: 'Delivered', value: 'DELIVERED' },
        { label: 'Resolved', value: 'RESOLVED' },
        { label: 'Claim open', value: 'CLAIM_OPEN' },
        { label: 'Claim rejected', value: 'CLAIM_REJECTED' },
        { label: 'Replacement queued', value: 'REPLACEMENT_QUEUED' },
      ],
      admin: {
        description:
          'No REFUNDED state exists for a plant. Legal transitions only — enforced by the delivery-proof gate in Phase 3.',
      },
    },
    {
      name: 'paymentMode',
      type: 'select',
      required: true,
      defaultValue: 'prepaid',
      options: [{ label: 'Prepaid', value: 'prepaid' }],
      admin: {
        description:
          'One option, by design. The database CHECK rejects "cod" so this cannot be widened by accident.',
      },
    },
    {
      name: 'pincode',
      type: 'text',
      required: true,
      admin: {
        description:
          'The delivery pincode. An order cannot exist for a pincode outside the serviceable set — enforced by a database constraint.',
      },
    },
    { name: 'zone', type: 'relationship', relationTo: 'zones' },
    {
      name: 'revenuePaise',
      type: 'number',
      required: true,
      admin: { description: 'Re-derived server-side from the SKU. The client total is ignored.' },
    },
    {
      name: 'contributionPaise',
      type: 'number',
      required: true,
      admin: {
        description:
          'The number the city P&L view groups on. A losing city must be visible as losing, which is what makes it killable.',
      },
    },
    {
      name: 'customerId',
      type: 'text',
      admin: {
        description:
          'better-auth user id. A plain column with a real FK, NOT a Payload relationship to a Customers collection — there is no such collection. See STACK-DECISION.md §5 (C-1).',
        readOnly: true,
      },
    },
    {
      name: 'guaranteeTier',
      type: 'select',
      required: true,
      defaultValue: 'T0',
      options: [
        { label: 'T0 — 48 hours', value: 'T0' },
        { label: 'T1 — 30 days', value: 'T1' },
        { label: 'T2 — 90 days', value: 'T2' },
      ],
      admin: {
        description:
          'Snapshot of what the customer was actually SOLD. Promotion to a longer window is a data decision gated on measured DOA, never a calendar one.',
      },
    },

    /*
     * Line items.
     *
     * Declared here as an array so Payload generates the `order_items` table. The
     * first version had the API writing to `order_items` directly without
     * declaring the field, so the table never existed — and the failure surfaced
     * to a CUSTOMER as `relation "order_items" does not exist`.
     *
     * That is the right shape anyway: Payload owns the table, so the FK to skus
     * and the index come from the schema rather than from a hand-written
     * migration that could drift.
     */
    {
      type: 'array',
      name: 'items',
      labels: { singular: 'Item', plural: 'Items' },
      admin: {
        description:
          'Price per line is RE-DERIVED server-side from the SKU. The client total is display-only.',
      },
      fields: [
        {
          name: 'sku',
          type: 'relationship',
          relationTo: 'skus',
          required: true,
        },
        {
          name: 'pricePaise',
          type: 'number',
          required: true,
          admin: { description: 'Integer paise, derived from base price × size tier + planter uplift.' },
        },
        {
          name: 'planter',
          type: 'relationship',
          relationTo: 'planters',
          admin: { description: 'Null = the grow-pot entry option.' },
        },
      ],
    },
  ],
  timestamps: true,
}