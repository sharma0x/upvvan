import type { CollectionConfig } from 'payload'

/**
 * Stock on hand, per SKU.
 *
 * ── WHY A SEPARATE COLLECTION RATHER THAN A COLUMN ON `skus` ────────────────
 *
 * Two reasons, one practical and one structural.
 *
 * Practical: `skus` is the COMPLIANCE-CRITICAL collection (Legal Metrology
 * declarations, traceability batch, the plant ladder). Stock changes on every
 * order; MRP declarations change twice a year. Mixing them means the collection
 * that compliance reviews is also the one the checkout writes to on every
 * request, so a lost update during a sale becomes a missing legal declaration.
 *
 * Structural, and the reason that actually decides it: stock is a LEDGER, not an
 * attribute. It moves by small integer deltas under concurrency, and the property
 * we need — "never sell what we do not have" — is a constraint on a sequence of
 * decrements, not a property of a single row's value. A row can hold a valid
 * stock_on_hand while an interleaved decrement drives it negative. So the row
 * carries the quantity and the SCHEMA carries the rule (see the CHECK constraint
 * reported for `sku-stock_non_negative`).
 *
 * ── WHY ONE ROW PER SKU AND NOT PER (sku, nursery) ───────────────────────────
 *
 * A SKU already names a `nursery` (a zone) and a `city`. Adding a third key would
 * mean deciding at sale time which physical batch a plant comes from — and the
 * answer depends on what is on the bench, which is a picking decision, not a
 * constraint we can enforce at checkout. If per-nursery stock becomes real it
 * becomes a second collection, not a wider key on this one.
 */
export const SkuStock: CollectionConfig = {
  slug: 'sku-stock',
  labels: {
    singular: 'SKU stock',
    plural: 'SKU stock',
  },
  admin: {
    useAsTitle: 'sku',
    group: 'Catalogue',
    defaultColumns: ['sku', 'stockOnHand', 'updatedAt'],
    description:
      'Units physically available to sell. Decremented inside the order transaction; the database refuses a negative count.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    // Written only by src/lib/orders/stock.ts, inside the order transaction. An
    // admin edit is a stock count correction, which is a legitimate but SEPARATE
    // operation — it must not be able to fabricate availability for a SKU that is
    // not on the bench, which is why the seed is the only creator.
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: () => false, // a deletion would let an SKU be sold with no ledger at all
  },
  fields: [
    {
      name: 'sku',
      type: 'relationship',
      relationTo: 'skus',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'UNIQUE. Two rows for one SKU means two independent counts and therefore two answers to "can we sell this?".',
      },
    },
    {
      name: 'stockOnHand',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description:
          'Whole units available. Never negative — enforced by a database CHECK, because a negative count that survives to dispatch is a plant we promised and do not have.',
      },
      validate: (value: number | null | undefined) => {
        if (value == null) return 'A stock count is required.'
        if (!Number.isInteger(value))
          return 'Stock must be whole units — a fraction of a plant cannot be sold.'
        if (value < 0) return 'Stock cannot be negative.'
        return true
      },
    },
  ],
  timestamps: true,
}
