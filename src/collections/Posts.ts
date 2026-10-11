import type { CollectionConfig } from 'payload'

/**
 * Posts — one collection, two reader-facing shapes.
 *
 * ── WHY ONE COLLECTION AND NOT A BLOG AND A PROBLEM LIBRARY ────────────────
 *
 * Two products, one authoring model, one SEO surface, one moderation queue. A
 * separate `problems` collection would duplicate the title/slug/excerpt/body/
 * publish-date machinery and then diverge on it within a month.
 *
 * The two kinds serve genuinely different intents, and that is exactly what
 * `kind` records:
 *
 *   'article' — "how to repot a plant", "what to do in April". Someone with no
 *               plant and a question. Acquisition.
 *
 *   'problem' — "why are the leaves on my ZZ plant turning brown on the tips".
 *               Someone who HAS a plant and is frightened. This is the one that
 *               matters, and it is the highest-return content in the entire
 *                 category: Bloomscape built 175 of them, no Indian competitor
 *                 has any. It is written for the moment a customer is about to
 *                 write a WhatsApp complaint, which is why the field structure
 *                 below is `cause` + `fix` and not `intro` + `body` + `outro`.
 *
 * ── WHY `symptomFor` IS A SELECT AND NOT FREE TEXT ─────────────────────────
 * A symptom-first library works because it answers the phrase the customer
 * actually types. Free-text titles produce "Yellow leaves", which nobody
 * searches; the structured fields below are what let us build the
 * `/problems` index and the cross-links from every affected species page.
 */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'isPublished', 'publishedAt'],
    description:
      'Care articles and the symptom-first problem library. Same authoring model, two reader intents.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'article',
      options: [
        { label: 'Care article', value: 'article' },
        { label: 'Problem / symptom page', value: 'problem' },
      ],
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'For a problem page, write the whole question a customer would type. "why-are-the-leaves-on-my-zz-plant-turning-brown" beats "zz-leaf-browning" every time.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 320,
      admin: { description: 'Card text and meta description. The answer, in one sentence.' },
    },

    // ── Problem pages only ──────────────────────────────────────────────────
    {
      type: 'group',
      name: 'diagnosis',
      admin: {
        condition: (data) => data.kind === 'problem',
        description: 'Symptom → cause → fix. The structure that makes this rank.',
      },
      fields: [
        {
          name: 'symptom',
          type: 'text',
          admin: { description: 'What the customer sees. e.g. "Yellowing lower leaves".' },
        },
        {
          name: 'cause',
          type: 'textarea',
          admin: {
            description: 'What is actually wrong. Be specific and honest about our own role.',
          },
        },
        {
          name: 'fix',
          type: 'textarea',
          admin: { description: 'What to do, in order. The part they came for.' },
        },
      ],
    },
    {
      name: 'relatedSpecies',
      type: 'relationship',
      relationTo: 'species',
      hasMany: true,
      admin: {
        description:
          'Cross-links the article from each affected species page — the mechanism that turns a support answer into a page that ranks.',
      },
    },

    { name: 'body', type: 'richText', required: true },
    {
      name: 'coverImageUrl',
      type: 'text',
      admin: {
        description:
          'Optional path under /images. Defaults to the first related species’ artwork, so a post about the ZZ plant shows the ZZ plant and nobody has to upload anything twice.',
      },
    },

    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { description: 'Unpublished posts are 404 and absent from the sitemap.' },
    },
    { name: 'publishedAt', type: 'date', index: true },
    { name: 'seoTitle', type: 'text', maxLength: 70 },
    { name: 'seoDescription', type: 'textarea', maxLength: 180 },
  ],
  timestamps: true,
}
