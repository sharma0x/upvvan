import type { CollectionConfig } from 'payload'

/**
 * Reviews — the trust layer, and the one thing every audited competitor has.
 *
 * ── WHY THIS COLLECTION IS A COMPLIANCE SURFACE, NOT A FEATURE ─────────────
 *
 * The single most-cited failure mode in the whole category is "the plant is
 * smaller than the photo". Every serious seller answers that with a review wall,
 * because a wall is the only independent signal a first-time buyer has. Ugaoo
 * shows 4.8 from 440 on Peace Lily; Upvan has 845 real ratings on Flipkart and
 * surfaces ZERO of them on its own site, which is the anti-example.
 *
 * So we publish reviews, and the rules below exist to keep them worth reading.
 *
 * ── RULE 1: ONLY A DELIVERED LINE MAY BE REVIEWED ───────────────────────────
 * Enforced in a trigger, not in a route. A review of something nobody received
 * is not a review, and an application-code check is bypassable by a direct
 * INSERT — which is precisely the shape of thing this codebase's
 * non-negotiables exist to prevent.
 *
 * ── RULE 2: NO PHONE NUMBER, EVER ───────────────────────────────────────────
 * `authorName` is a display string like "Priya S." and there is no column that
 * could hold a number. A review wall is the most-scraped page on a plant site
 * and a contact list attached to it is a DPDP incident waiting to happen.
 *
 * ── RULE 3: RATING IS 1–5 AND REQUIRED ─────────────────────────────────────
 * Because the PDP renders "4.6 from 128" and that average has to mean
 * something. A wall with optional stars produces a 4.9 that nobody believes.
 *
 * ── RULE 4: THE MODERATION FLAG IS NOT A DELETION ──────────────────────────
 * `isPublished` hides a review without destroying it, so a moderation decision
 * is reversible and auditable. Deleting customer words because they are
 * inconvenient is exactly the "ghost customer service" complaint that took
 * Ugaoo to 1-star on the Play Store.
 */
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  labels: { singular: 'Review', plural: 'Reviews' },
  admin: {
    group: 'Catalogue',
    useAsTitle: 'title',
    defaultColumns: ['title', 'rating', 'sku', 'isPublished', 'createdAt'],
    description:
      'Customer reviews. A review can only exist against a DELIVERED order line — enforced by a database trigger, not by the form.',
  },
  access: {
    read: () => true,
    create: () => false, // written by the claim/dispatch flow, not the admin panel
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
      admin: { description: 'Which exact SKU — including the size tier.' },
    },
    {
      name: 'orderItemId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'The orders_items row this review is about. UNIQUE, so one line yields one review and the count on the card is a count of distinct opinions.',
      },
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      admin: { description: 'Whole stars, 1–5. No half stars: they are arithmetic theatre.' },
    },
    { name: 'title', type: 'text', required: true, maxLength: 120 },
    { name: 'body', type: 'textarea', required: true, maxLength: 2000 },
    {
      name: 'authorName',
      type: 'text',
      required: true,
      admin: {
        description:
          'Display name only, e.g. "Priya S." There is deliberately no field for a phone number or email anywhere in this collection.',
      },
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Moderated, not deleted. The customer can request removal; we retain the row.',
      },
    },
  ],
  timestamps: true,
}
