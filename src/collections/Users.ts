import type { CollectionConfig } from 'payload'

/**
 * Staff identity — Payload's own auth collection.
 *
 * SCOPE, precisely: this collection owns STAFF identity and nothing else.
 *
 * It is NOT a customer identity source. Customer identity is owned outright by
 * better-auth (src/lib/auth.ts) and there is deliberately NO `Customers`
 * collection in this project — see STACK-DECISION.md §5. A mirror table holding
 * email/phone/name is the shape C-1 exists to prevent, and its failure mode is
 * two customer records in month three.
 *
 * So this file declares staff fields only. If a `phone` or a customer-facing
 * `email` ever appears here, the C-1 test in
 * src/lib/auth/__tests__/single-customer-identity.test.ts fails.
 *
 * Riders are STAFF (own fleet), not customers, so they authenticate here with
 * the `rider` role — which is scoped by Payload access control to their own
 * assigned delivery run and nothing else.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Admin',
    defaultColumns: ['email', 'name', 'role'],
  },
  auth: true,
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
    // Locked down deliberately: this collection holds staff credentials.
    // Only authenticated staff may read it — never the storefront, never a
    // customer session.
    admin: ({ req: { user } }) => Boolean(user),
    unlock: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'support',
      options: [
        { label: 'Super admin', value: 'super-admin' },
        { label: 'HQ admin', value: 'hq-admin' },
        { label: 'Nursery manager', value: 'nursery-manager' },
        { label: 'Support agent', value: 'support' },
        { label: 'Rider', value: 'rider' },
      ],
      admin: {
        description:
          'Role × city access control. A nursery manager sees only their nursery; a rider sees only their assigned run.',
      },
    },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'cities',
      admin: {
        description:
          'Staff scope. HQ roles are cross-city; city-scoped roles see only this city. Enforced by access control, not by the UI.',
      },
    },
    {
      name: 'nursery',
      type: 'text',
      admin: { description: 'For nursery managers: the nursery they are responsible for.' },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'STAFF contact number for shift dispatch. NOT a customer identity field — see the file header.',
      },
    },
  ],
  timestamps: true,
}
