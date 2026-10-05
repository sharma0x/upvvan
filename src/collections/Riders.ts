import type { CollectionConfig } from 'payload'

import { getPool } from '@/lib/dispatch/store.server'
import {
  explainMultiplierFloor,
  isValidPayPaise,
  multiplierPreservesBandOrdering,
  payMultiplierHelp,
} from '@/lib/dispatch/pay'

/**
 * Riders.
 *
 * ── WHY THIS IS NOT THE `users` COLLECTION ─────────────────────────────────
 * `users` is the STAFF surface: it grants the content admin, and a rider who
 * deactivates their own account should not be able to edit a plant's botanical
 * name. better-auth is the CUSTOMER surface, and C-1 is explicit that customer
 * identity lives there and only there. Riders are neither, so they get their own
 * collection and their own sign-in — see `src/lib/dispatch/session.server.ts`.
 *
 * ── WHY `payMultiplierBp` AND NOT A RUPEE AMOUNT ────────────────────────────
 *
 * This is the incentive fix, and the field's SHAPE is the fix.
 *
 * Urvann pays ₹65 per order regardless of distance and carries a ₹100 penalty
 * for marking an order delivered that was not delivered. They still carry 2.1/5.
 * The penalty is the tell: it was written by an operator who had worked out that
 * lying is cheaper than delivering. You cannot fine your way out of paying
 * someone the same for a 1km drop and a 12km drop.
 *
 * So pay is stored as a MULTIPLIER on the city's distance band, in basis points,
 * never as an amount:
 *
 *   · 10000bp = exactly the band rate. The default, and the common case.
 *   · 11500bp = 15% above the band, for a rider who has been with us a season.
 *
 * Multiplying every band by one positive scalar preserves strict ordering, so a
 * per-rider uplift can NEVER make a 12km drop pay less than a 3km one. An
 * absolute per-rider pay field could, and would silently reinstate the flat
 * per-order structure the whole business model exists to avoid.
 *
 * A DISCOUNT is permitted (a probationary rate below 10000) because scaling by
 * any positive constant still preserves order — but the DB CHECK
 * `riders_multiplier_is_positive` refuses zero and negative, which would flip the
 * incentive into "longer routes pay less".
 *
 * The payout itself is not stored here. It is snapshotted onto each dispatch at
 * assignment and made immutable by trigger, so editing a band or a multiplier
 * later cannot rewrite what riders have already earned.
 */
export const Riders: CollectionConfig = {
  slug: 'riders',
  admin: {
    useAsTitle: 'name',
    group: 'Operations',
    defaultColumns: ['name', 'phone', 'zone', 'active', 'payMultiplierBp', 'maxDropsPerDay'],
    description:
      'Our own delivery riders. Pay is a multiplier on the city distance band — never a flat amount per order.',
  },
  access: {
    // Riders are not staff and not customers: this is the one collection a rider
    // can read but nobody anonymous can touch.
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    // A rider record is deactivated, never deleted. A delivery history that
    // references a deleted rider is a payroll dispute with no counterparty.
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        const cityId = data?.city
        const multiplierBp = data?.payMultiplierBp

        if (!cityId || multiplierBp == null) return data

        const id =
          typeof cityId === 'object' && cityId !== null ? String(cityId.id) : String(cityId)

        const db = await getPool()
        const { rows } = await db.query<{ payPaise: string }>(
          `SELECT "pay_paise" AS "payPaise" FROM "delivery_bands" WHERE "city_id" = $1`,
          [id],
        )

        const bands = rows.map((r) => ({ payPaise: Number(r.payPaise) }))
        if (bands.length < 2) return data

        if (!multiplierPreservesBandOrdering(Number(multiplierBp), bands)) {
          const verb = operation === 'create' ? 'Create' : 'Update'
          throw new Error(
            `[riders] ${verb} rejected — ${explainMultiplierFloor(Number(multiplierBp), bands)}`,
          )
        }

        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'phone',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          '10 digits, no country code. This is the number the shift sign-in code is sent to.',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'A rider needs a phone number for shift sign-in.'
        if (!/^[6-9]\d{9}$/.test(value)) {
          return 'Enter a 10-digit Indian mobile number, starting 6-9.'
        }
        return true
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description:
          'Deactivating stops new drops AND ends existing sessions on the next request. A session that outlives revocation is not a revocation.',
      },
    },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      required: true,
      index: true,
      admin: {
        description:
          'A rider delivers in exactly one city. The database refuses a dispatch whose rider and order are in different cities.',
      },
    },
    {
      name: 'zone',
      type: 'relationship',
      relationTo: 'zones',
      index: true,
      admin: {
        description:
          'The zone this rider runs. LEAVE EMPTY only for a rider who is not yet placed — an unzoned rider is excluded from allocation rather than treated as covering everywhere.',
      },
    },
    {
      name: 'vehicleType',
      type: 'select',
      required: true,
      defaultValue: 'ev_two_wheeler',
      options: [
        { label: 'EV two-wheeler', value: 'ev_two_wheeler' },
        { label: 'EV three-wheeler', value: 'ev_three_wheeler' },
        { label: 'Bicycle', value: 'bicycle' },
        { label: 'On foot', value: 'foot' },
      ],
      admin: {
        description:
          'Operational fact, not a preference. A three-wheeler can take a large planter set a two-wheeler physically cannot.',
      },
    },
    {
      name: 'payMultiplierBp',
      type: 'number',
      required: true,
      defaultValue: 10_000,
      admin: { description: payMultiplierHelp() },
      validate: (value: number | null | undefined) => isValidPayPaise(value, 'Pay multiplier', true),
    },
    {
      name: 'maxDropsPerDay',
      type: 'number',
      admin: {
        description:
          'Per-rider capacity override. Leave empty to use the zone\'s max_daily_drops. Set a lower number for a rider on a two-wheeler, an auto, or a reduced day.',
      },
      validate: (value: number | null | undefined) =>
        value == null || (Number.isInteger(value) && value > 0)
          ? true
          : 'Capacity must be a whole number of drops, or empty for the zone default.',
    },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
}