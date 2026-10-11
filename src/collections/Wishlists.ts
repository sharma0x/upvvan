import type { CollectionConfig } from 'payload'

/**
 * Wishlists — a customer-side saved list.
 *
 * ── WHY THIS EXISTS AT ALL, GIVEN THE AUDIT FOUND NOBODY HAS ONE ────────────
 *
 * The word "wishlist" appears ZERO times across seven research files covering
 * ten competitors. Not one has one. That is either an enormous opening or a
 * signal that it does not move the metric, and the honest answer is probably
 * both.
 *
 * We build it for two concrete reasons, neither of which is "it is standard":
 *
 *  1. IT IS THE ONLY PLACE A "NOTIFY ME" REQUEST CAN GO. Ugaoo captures an
 *     email and a mobile for back-in-stock on a sold-out variant. Our catalogue
 *     is seasonal and thin — a species genuinely sells out and comes back with
 *     the season — so the waitlist is a real queue, not a hypothetical. And a
 *     waitlist is worth far more than a like, because it is a customer who has
 *     told us which plant they want and agreed to be contacted.
 *
 *  2. IT IS THE ONBOARDING HOOK FOR AN ACCOUNT WE DO NOT FORCE. The single
 *     documented account-wall in the category (IGP, which requires signup with
 *     name, email AND phone before checkout) has the worst complaint corpus of
 *     any competitor studied. So we never gate a purchase — but a wishlist is
 *     something an anonymous visitor wants *at the moment they want it*, and
 *     asking for a phone number at that moment is a fair trade rather than a
 *     toll gate.
 *
 * ── WHY THE PHONE IS REQUIRED HERE ──────────────────────────────────────────
 * better-auth owns customer identity (C-1) and there is deliberately no
 * `Customers` collection. `betterAuthUserId` is therefore a REFERENCES column
 * into better-auth's own `user` table — not into a table of ours — which keeps
 * a single source of truth for "who is this person" without duplicating it.
 *
 * The email/phone OTP flow signs the customer in, so attaching a wishlist entry
 * needs no new credential and no new identity store. That is the whole reason
 * the identity decision was worth making early.
 */
export const Wishlists: CollectionConfig = {
  slug: 'wishlists',
  labels: { singular: 'Wishlist item', plural: 'Wishlist' },
  admin: {
    group: 'Commercial',
    useAsTitle: 'sku',
    defaultColumns: ['sku', 'customerEmail', 'notifiedAt', 'createdAt'],
    description:
      'Saved plants, and the back-in-stock waitlist. The only thing in this file with no competitor equivalent.',
  },
  access: {
    /*
     * Read is staff-only.
     *
     * It was public, on the argument that "the waitlist is public in effect: the
     * PDP has to show '34 people are waiting for this'". That argument is right
     * about the COUNT and wrong about the collection: `read: true` serves every
     * column of every row, so an anonymous `GET /api/wishlists` returned
     * `better_authUserId`, `customerEmail` and `notifiedAt` for the entire list.
     *
     * The count does not need this collection to be readable at all. `/api/wishlists`
     * computes it from its own scoped query, and that route reads the table
     * directly with SQL — it does not go through Payload's access layer. So the
     * count is available and the identities are not.
     */
    read: ({ req: { user } }) => Boolean(user),
    /*
     * ── WAS `() => true` ─────────────────────────────────────────────────────
     *
     * An open write endpoint, on the same origin as the storefront: anybody could
     * `POST /api/wishlists` and insert a row, with no session, no validation and
     * no rate limit. It writes the one table whose entire purpose is to hold a
     * list of people who asked to be contacted — which makes it a spam list
     * generator as much as a bug.
     *
     * Writes go through our own route, which is session-scoped, validates the SKU
     * against the live catalogue, and is idempotent. `create: () => false` here
     * makes the CMS REST surface agree with that rather than contradict it.
     */
    create: () => false,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'sku',
      type: 'relationship',
      relationTo: 'skus',
      required: true,
      index: true,
    },
    {
      name: 'betterAuthUserId',
      type: 'text',
      index: true,
      admin: {
        description:
          "better-auth's own user.id. NOT a reference to a table of ours — C-1 means there is no Customers collection.",
      },
    },
    {
      name: 'customerEmail',
      type: 'email',
      admin: {
        description:
          'Set by the join code we email. Lets someone on a shared or work phone be told without an account.',
      },
    },
    {
      name: 'notifiedAt',
      type: 'date',
      admin: { description: 'When the back-in-stock message went out. One notification per row.' },
    },
    { name: 'note', type: 'text', maxLength: 140 },
  ],
  timestamps: true,
}
