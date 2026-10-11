import type { CollectionConfig } from 'payload'

/**
 * Quote requests — the corporate gifting funnel.
 *
 * ── WHY THIS IS A COLLECTION AND NOT A MAILTO ───────────────────────────────
 *
 * The audit's sharpest finding about this category: **every single competitor
 * handles B2B by telephone.** Kyari runs five separate corporate landing pages
 * and a microsite, all ending in a phone number. FNP runs a four-step *human*
 * funnel — enquiry form, then a call, then a catalogue download, then a call
 * again. IGP says outright that you cannot place a bulk order on the website.
 *
 * Not one of them publishes a price. So a procurement manager comparing three
 * suppliers has to make three phone calls before they can write a budget
 * proposal, and procurement people do not make phone calls. The one business in
 * this dataset that publishes an itemised GST-inclusive tier sheet and a
 * quantity-based quote flow is a small operator, and it is the clearest
 * whitespace in the whole category.
 *
 * A `mailto:` cannot do this: a procurement query arrives with a quantity, a
 * budget per unit, a delivery date and a list of office addresses, and it has to
 * be a ROW so that the next one can be quoted in minutes instead of an hour.
 *
 * ── WHAT IS DELIBERATELY NOT CAPTURED ──────────────────────────────────────
 * No card details, no GSTIN verification, no login. A quote is not a purchase;
 * nothing here is a commitment, and the confirmation copy says so. This is also
 * why the form is postable by an anonymous visitor rather than gated behind
 * better-auth: a procurement manager is not going to create an account before
 * finding out whether we are in their budget.
 *
 * ── MOQ IS ENFORCED IN A TRIGGER ───────────────────────────────────────────
 * `minimumQuantity` is validated against the configured floor in the database, so
 * "MOQ 10" on the page and "MOQ 10" in the schema cannot disagree.
 */
export const QuoteRequests: CollectionConfig = {
  slug: 'quote-requests',
  labels: { singular: 'Quote request', plural: 'Quote requests' },
  admin: {
    group: 'Commercial',
    useAsTitle: 'organisation',
    defaultColumns: [
      'organisation',
      'contactName',
      'minimumQuantity',
      'occasion',
      'deliveryDate',
      'status',
      'createdAt',
    ],
    description:
      'Corporate and bulk gifting enquiries. Not an order — nothing here commits anyone.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    // Writable by the public form. This is a lead capture endpoint, not a vault:
    // it holds no payment data and no credentials, and gating it behind an
    // account is the single surest way to lose the enquiry.
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'organisation', type: 'text', required: true, index: true },
    { name: 'contactName', type: 'text', required: true },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: { description: 'Work email. Gmail addresses get asked for a work domain.' },
    },
    { name: 'phone', type: 'text', required: true },
    {
      name: 'minimumQuantity',
      type: 'number',
      required: true,
      min: 1,
      admin: { description: 'Total units. A trigger refuses anything under the configured MOQ.' },
    },
    {
      name: 'occasion',
      type: 'select',
      required: true,
      options: [
        { label: 'Employee onboarding / welcome', value: 'onboarding' },
        { label: 'Employee birthday or anniversary', value: 'employee_occasion' },
        { label: 'Client or business gifting', value: 'client' },
        { label: 'Diwali / festive', value: 'festive' },
        { label: 'Office greenery refresh', value: 'office_refresh' },
        { label: 'Event or return gifts', value: 'event' },
        { label: 'Something else', value: 'other' },
      ],
      index: true,
    },
    {
      name: 'budgetPerUnitPaise',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Optional target per unit, in paise. Knowing the budget up front is the difference between a quote and a negotiation.',
      },
    },
    { name: 'deliveryDate', type: 'date' },
    {
      name: 'deliveryAddresses',
      type: 'array',
      admin: {
        description:
          'Split delivery. Procurement WILL need plants to many addresses, and asking a rider to carry 300 plants to one desk is how the other competitor got its 1.4/5.',
      },
      fields: [
        { name: 'recipientName', type: 'text', required: true },
        { name: 'addressLine1', type: 'text', required: true },
        { name: 'addressLine2', type: 'text' },
        { name: 'city', type: 'text', required: true },
        { name: 'pincode', type: 'text', required: true },
        {
          name: 'isOffice',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Office delivery is allowed on a weekday; a home is not.' },
        },
      ],
    },
    {
      name: 'personalisation',
      type: 'textarea',
      maxLength: 1000,
      admin: {
        description:
          'Message per pot, logo, colour preference. Our own limitation: pot printing needs 10 working days at minimum quantity 50 — state that in the quote, do not discover it later.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      maxLength: 2000,
      admin: { description: 'Anything else. Read before replying.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Quote sent', value: 'quoted' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Declined', value: 'declined' },
      ],
      index: true,
    },
    {
      name: 'quoteSentAt',
      type: 'date',
      admin: { description: 'Set when the quote goes out. Drives the response-time SLA.' },
    },
  ],
  timestamps: true,
}
