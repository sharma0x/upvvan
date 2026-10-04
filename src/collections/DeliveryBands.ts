import type { CollectionConfig } from 'payload'
import { assertBandsAreMonotonic, type DistanceBand } from '@/lib/geo/bands'

/**
 * Delivery bands — the per-city rider pay configuration.
 *
 * This collection is the reason the whole business model works, so it is a
 * first-class entity with its own invariant rather than a price field on the
 * price book.
 *
 * THE INVARIANT: longer route ⇒ strictly more pay.
 *
 * Urvann pays ₹65/order regardless of distance and penalises staff ₹100 for
 * marking an order delivered without delivering it. That penalty exists only
 * because the pay structure makes lying rational — it is a symptom, not a fix.
 * We invert it: pay rises with distance, so a longer drop is worth more, and
 * there is nothing left to penalise.
 *
 * Enforced in THREE layers, because the failure mode is silent — a bad band set
 * sits in the admin panel looking fine until riders start routing around it:
 *
 *   1. `assertBandsAreMonotonic` in src/lib/geo/bands.ts — pure and unit-tested
 *      (src/lib/geo/__tests__/rider-pay-bands.test.ts, seen red first)
 *   2. the `beforeChange` hook below, so the admin panel cannot save a bad set
 *   3. a PostgreSQL trigger in src/migrations, so a direct SQL write cannot
 *      create one either
 *
 * Layer 3 is the one that matters most. Application-code-only enforcement is
 * bypassable by a direct write or by a bug in a different code path — which is
 * exactly how the reference operator ended up needing a penalty clause.
 *
 * Money is integer paise. Never a float, never rupees.
 */
export const DeliveryBands: CollectionConfig = {
  slug: 'delivery-bands',
  admin: {
    useAsTitle: 'label',
    group: 'Geo',
    defaultColumns: ['code', 'city', 'minKm', 'maxKm', 'payPaise', 'label'],
    description:
      'Rider pay per drop, by distance band. Longer routes MUST pay strictly more — this is the incentive inversion that separates us from a flat-per-order operator.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      required: true,
      index: true,
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      admin: { description: 'Unique within a city. Launch default: A, B, C.' },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description:
          'Shown to the rider verbatim, including the amount. product-design.md §4.4 forbids hiding banding behind an internal formula.',
      },
    },
    {
      name: 'minKm',
      type: 'number',
      required: true,
      admin: { description: 'Inclusive lower bound, km.' },
    },
    {
      name: 'maxKm',
      type: 'number',
      required: true,
      admin: {
        description:
          'Exclusive upper bound, km. Half-open [minKm, maxKm) so adjacent bands share a boundary unambiguously. NOT Infinity — how far we actually ride is an operational fact.',
      },
    },
    {
      name: 'payPaise',
      type: 'number',
      required: true,
      admin: {
        description: 'Per-drop pay in PAISE. Integer. 4500 = ₹45. Never a float, never rupees.',
      },
      validate: (value: number | null | undefined) => {
        if (value == null) return 'Per-drop pay is required.'
        if (!Number.isInteger(value)) {
          return 'Pay must be a whole number of paise — no decimals, no rupees.'
        }
        if (value < 0) return 'Pay cannot be negative.'
        return true
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!data?.city) return data

        const cityId =
          typeof data.city === 'object' && data.city !== null
            ? String(data.city.id)
            : String(data.city)

        const proposed: DistanceBand = {
          code: String(data.code ?? ''),
          minKm: Number(data.minKm),
          maxKm: Number(data.maxKm),
          payPaise: Number(data.payPaise),
          label: String(data.label ?? ''),
        }

        // Monotonicity is a property of the whole SET — it cannot be checked one
        // row at a time. So every write validates the proposed row against its
        // persisted siblings.
        const siblings = await req.payload.find({
          collection: 'delivery-bands',
          where: { city: { equals: cityId } },
          limit: 200,
          overrideAccess: true,
        })

        const set: DistanceBand[] = [
          ...siblings.docs
            .filter((doc) => doc.id !== data.id)
            .map((doc) => ({
              code: doc.code,
              minKm: doc.minKm,
              maxKm: doc.maxKm,
              payPaise: doc.payPaise,
              label: doc.label,
            })),
          proposed,
        ]

        try {
          assertBandsAreMonotonic(set)
        } catch (err) {
          const verb = operation === 'create' ? 'Create' : 'Update'
          throw new Error(`[delivery-bands] ${verb} rejected — ${(err as Error).message}`)
        }

        return data
      },
    ],
  },
  timestamps: true,
}
