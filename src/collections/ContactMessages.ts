import type { CollectionConfig } from 'payload'

/**
 * Contact messages — the inbox behind the `/contact` form.
 *
 * ── WHY THE INBOX IS A COLLECTION AND NOT A MAILBOX ─────────────────────────
 *
 * The whole strategic argument for `/contact` is that a published address nobody
 * reads is what every competitor in this category has. Kyari sits at Trustpilot
 * 1.4/5 with a "ghost customer service" complaint cluster; Urvann runs one
 * WhatsApp line that is also its published phone number for a claimed 12–15 lakh
 * customers; IGP's escalation path produced "ZERO response".
 *
 * A `mailto:` cannot be triaged, cannot be measured, and cannot prove to anybody
 * — least of all to ourselves — that the response-time number on the page is
 * real. So the form writes rows, the rows are in the admin panel, and
 * `firstResponseAt` is a column somebody fills in. The promise on the page is
 * then a thing we can be shown to have kept or broken.
 *
 * ── WHY THE FORM CAPTURES AN IP ─────────────────────────────────────────────
 *
 * Not for advertising, and not for a marketing list. It is the key for the rate
 * limiter and it is the only way to correlate a burst of spam with a source. It
 * is stored, not used, and the retention note on the column says so.
 *
 * ── WHY `firstResponseAt` IS WRITTEN BY A PERSON ────────────────────────────
 *
 * Because a computed column would make the number unfalsifiable, which is the
 * opposite of what this table is for. It is a timestamp a human sets when they
 * actually reply, and the difference between "we answered" and "we answered
 * fast" is the entire value of the page.
 */
export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  labels: { singular: 'Contact message', plural: 'Contact messages' },
  admin: {
    group: 'Commercial',
    useAsTitle: 'name',
    defaultColumns: ['topic', 'name', 'orderCode', 'status', 'receivedAt', 'firstResponseAt'],
    description:
      'Everything sent through the contact form. The response time we publish is measured from receivedAt to firstResponseAt.',
  },
  access: {
    // Public write happens through /api/contact, which is where the rate limit and
    // the validation live. The panel is read-and-respond, never create-and-edit:
    // an editable customer message is a message that can be edited.
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'topic',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'A plant I have received', value: 'plant' },
        { label: 'My order or delivery', value: 'order' },
        { label: 'Do you deliver to my area?', value: 'coverage' },
        { label: 'Is something in stock?', value: 'stock' },
        { label: 'Corporate or bulk enquiry', value: 'corporate' },
        { label: 'Advice on a struggling plant', value: 'care' },
        { label: 'Something else', value: 'other' },
      ],
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'contactDetail',
      type: 'text',
      required: true,
      admin: {
        description:
          'Whatever the customer gave us — a mobile or an e-mail. Whichever, it replies.',
      },
    },
    {
      name: 'orderCode',
      type: 'text',
      index: true,
      admin: { description: 'Optional. Makes this a lookup instead of a conversation.' },
    },
    { name: 'message', type: 'textarea', required: true, maxLength: 2000 },
    {
      name: 'ip',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Rate-limit key and spam correlation only. Retention: 90 days, then cleared. Never sold, never used for marketing.',
      },
    },
    {
      name: 'optIn',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Asked to hear about restocks. The only consent this site ever takes.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Answered', value: 'answered' },
        { label: 'Escalated to grievance officer', value: 'escalated' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Spam', value: 'spam' },
      ],
    },
    { name: 'receivedAt', type: 'date', required: true, index: true },
    {
      name: 'firstResponseAt',
      type: 'date',
      index: true,
      admin: {
        description:
          'Set when you actually reply. This is what the published response-time promise is measured against — so it is written by a person, never computed.',
      },
    },
    {
      name: 'replyNote',
      type: 'textarea',
      maxLength: 2000,
      admin: {
        description: 'What you said and what you concluded. Kept for the pattern, not the person.',
      },
    },
  ],
  timestamps: true,
}
