import type { CollectionConfig } from 'payload'

import { isValidPayPaise } from '@/lib/dispatch/pay'

/**
 * Dispatches.
 *
 * ── WHAT THIS COLLECTION IS FOR ─────────────────────────────────────────────
 *
 * An order says a plant was bought. A dispatch says WHO is carrying it, WHAT
 * they are paid for it, and WHAT PROVES it arrived. Those are different facts
 * with different lifetimes, and the single loudest failure in this category —
 * "order marked delivered but not received" — is what happens when the second
 * set of facts is not recorded anywhere.
 *
 * ── THE THREE FIELDS THAT ARE NOT EDITABLE ─────────────────────────────────
 *
 * The pay snapshot and the OTP state exist because the alternative is a status
 * column that anybody can set to any value:
 *
 *  1. `bandCode` / `bandPayPaise` / `payMultiplierBp` / `payoutPaise`
 *     A dispatch records the RATE THE RIDER WAS PROMISED when the drop was handed
 *     to them. Ops editing a band an hour later is a normal, legitimate thing to
 *     do — and it must not move what riders have already earned.
 *     `trg_dispatch_pay_snapshot_immutable` refuses any UPDATE that touches them,
 *     for every writer including a direct psql session. Application-code-only
 *     enforcement is bypassable, which is precisely how the reference operator
 *     ended up needing a penalty clause.
 *
 *  2. `deliveryOtpVerifiedAt` — there is deliberately no boolean.
 *     `trg_dispatch_delivered_requires_otp` refuses status='DELIVERED' unless
 *     this timestamp is set. The OTP goes to the CUSTOMER's phone, so closing a
 *     drop requires the customer to confirm receipt rather than the rider to
 *     press a button. See `src/lib/dispatch/otp.ts`.
 *
 *  3. The status itself is append-only in EFFECT: legal transitions are enforced
 *     by `trg_dispatch_transition_is_legal`, and DELIVERED/FAILED/CANCELLED are
 *     terminal. Every change also writes a row to `dispatch_events`, which is NOT
 *     a collection and whose UPDATE and DELETE are refused unconditionally.
 *
 * There is NO PENALTY FIELD anywhere in this schema, and that is the design
 * rather than an omission. Urvann carries a ₹100 penalty for fake delivery
 * marking and a 2.1/5 rating, because a penalty only exists where lying is
 * cheaper than delivering. Make honesty the cheap action and there is nothing
 * left to fine.
 */
export const Dispatches: CollectionConfig = {
  slug: 'dispatches',
  admin: {
    useAsTitle: 'order',
    group: 'Operations',
    defaultColumns: ['order', 'rider', 'status', 'bandCode', 'payoutPaise', 'assignedAt'],
    description:
      'One row per drop. The pay is snapshotted at assignment and cannot be rewritten; a delivery cannot be closed without the customer\'s code.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    // Created ONLY by the allocation path, which snapshots the pay and writes the
    // ASSIGNED event in one transaction. Allowing a create here would allow a
    // dispatch with no assignment event, which is a plant on a bike with no
    // record of who was told to take it.
    create: () => false,
    // Payload's update path is closed for the same reason: it would let anyone
    // set `status` without an event. Dispatch changes go through the API routes,
    // which write the ledger.
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'One dispatch per order. Unique — this is what makes "unassigned" computable.' },
    },
    {
      name: 'rider',
      type: 'relationship',
      relationTo: 'riders',
      required: true,
      index: true,
    },
    {
      name: 'zone',
      type: 'relationship',
      relationTo: 'zones',
      admin: {
        readOnly: true,
        description: "The rider's zone AT ASSIGNMENT, not a live join. Yesterday's dispatch says where the drop actually ran from.",
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'ASSIGNED',
      options: [
        { label: 'Assigned', value: 'ASSIGNED' },
        { label: 'Picked up', value: 'PICKED_UP' },
        { label: 'Out for delivery', value: 'OUT_FOR_DELIVERY' },
        { label: 'Delivered', value: 'DELIVERED' },
        { label: 'Failed', value: 'FAILED' },
        { label: 'Cancelled', value: 'CANCELLED' },
      ],
      admin: {
        readOnly: true,
        description:
          'Legal transitions only, and the last three are terminal — there is no path backwards, because un-delivering is what a mutable status column is for.',
      },
    },

    /*
     * ── THE PAY SNAPSHOT ──────────────────────────────────────────────────
     *
     * FLAT FIELDS, DELIBERATELY. This was a `group` named `paySnapshot` and that
     * was wrong in a way only a generated-schema diff would have caught: Payload
     * prefixes a group's columns with the group name, so it generated
     * `pay_snapshot_band_code`, `pay_snapshot_band_pay_paise` and
     * `pay_snapshot_payout_paise` — while the migration in `schema.sql` and every
     * query in `store.server.ts` use `band_code`, `band_pay_paise`,
     * `payout_paise`.
     *
     * Both would have been "correct" on their own and entirely incompatible, and
     * the failure mode is the nasty kind: the table creates cleanly, a trigger
     * silently stops firing on a renamed column, and the anti-fraud control
     * quietly stops applying. AGENTS.md records the same class of surprise for
     * array fields (table named after the PARENT slug, no timestamps, varchar id
     * with no default); groups have their own version of it.
     *
     * So the shape is chosen to make the generated DDL and the hand-written
     * invariant DDL agree column-for-column. If this is ever regrouped, run
     * `pnpm payload generate:db-schema` and diff it against `schema.sql` first.
     *
     * (The `deliveryOtp` group below IS safe to keep grouped: it generates
     * `delivery_otp_hash`, `delivery_otp_sent_at`, `delivery_otp_verified_at` —
     * which is exactly what the migration uses.)
     */
    {
      name: 'bandCode',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Which distance band this drop fell in AT ASSIGNMENT. Frozen.',
      },
    },
    {
      name: 'bandPayPaise',
      type: 'number',
      required: true,
      admin: {
        readOnly: true,
        description: 'The band rate in PAISE at assignment. Integer. Frozen.',
      },
      validate: (value: number | null | undefined) => isValidPayPaise(value, 'Band pay'),
    },
    {
      name: 'payMultiplierBp',
      type: 'number',
      required: true,
      admin: {
        readOnly: true,
        description:
          'The rider\'s multiplier in force at assignment. Stored so the arithmetic behind a payout is reproducible from this row alone. Frozen.',
      },
    },
    {
      name: 'payoutPaise',
      type: 'number',
      required: true,
      admin: {
        readOnly: true,
        description: 'What the rider actually earns: ceil(band × multiplier). Frozen.',
      },
      validate: (value: number | null | undefined) => isValidPayPaise(value, 'Payout'),
    },

    { name: 'assignedAt', type: 'date', required: true, admin: { readOnly: true } },
    { name: 'pickedUpAt', type: 'date', admin: { readOnly: true } },
    { name: 'outForDeliveryAt', type: 'date', admin: { readOnly: true } },
    { name: 'deliveredAt', type: 'date', admin: { readOnly: true } },

    /* ── DELIVERY OTP ───────────────────────────────────────────────────── */
    {
      type: 'group',
      name: 'deliveryOtp',
      label: 'Delivery code',
      admin: {
        readOnly: true,
        description:
          'The customer\'s code. Only the scrypt hash is stored — six digits have a million possibilities and this table is one SELECT away.',
      },
      fields: [
        { name: 'hash', type: 'text', admin: { readOnly: true } },
        { name: 'salt', type: 'text', admin: { readOnly: true } },
        { name: 'sentAt', type: 'date', admin: { readOnly: true } },
        { name: 'expiresAt', type: 'date', admin: { readOnly: true } },
        {
          name: 'attempts',
          type: 'number',
          admin: {
            readOnly: true,
            description:
              'Wrong codes tried. Capped server-side; six digits is brute-forceable otherwise, and a brute-forceable close-out defeats the entire mechanism.',
          },
        },
        {
          name: 'verifiedAt',
          type: 'date',
          admin: {
            readOnly: true,
            description:
              'THE field. `DELIVERED` is refused by the database unless this is set. There is no boolean here on purpose.',
          },
        },
      ],
    },

    /* ── PROOF + CLAIM EVIDENCE ──────────────────────────────────────────── */
    {
      name: 'proofPhotoUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'S3/RustFS object key for the handover photo. Capture is a follow-up; the slot is reserved now so the audit trail has somewhere to put it.',
      },
    },
    { name: 'proofCapturedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'claimEvidenceKind',
      type: 'select',
      required: true,
      defaultValue: 'not_requested',
      options: [
        { label: 'Nothing asked', value: 'not_requested' },
        { label: 'Unboxing video requested', value: 'unboxing_video_requested' },
        { label: 'Photo at handover', value: 'photo_at_handover' },
        { label: 'Customer declined', value: 'customer_declined' },
      ],
      admin: {
        readOnly: true,
        description:
          'research/concept.md §7 — an uncut same-day unboxing video yields claim evidence AND fraud filtering from one artefact. "Customer declined" is recorded honestly rather than collapsed into success.',
      },
    },
    { name: 'claimEvidenceNote', type: 'textarea', admin: { readOnly: true } },
    { name: 'claimEvidenceAt', type: 'date', admin: { readOnly: true } },
    { name: 'claimOpenedAt', type: 'date', admin: { readOnly: true } },
    { name: 'failureReason', type: 'textarea', admin: { readOnly: true } },
  ],
  timestamps: true,
}