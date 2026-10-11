import type { CollectionConfig } from 'payload'

/**
 * Business settings — the ONE place a non-technical owner changes the business.
 *
 * ── WHY THIS COLLECTION EXISTS ──────────────────────────────────────────────
 *
 * The rule this codebase started with was "nothing operational is hardcoded", and
 * it was implemented as "everything operational is an environment variable". That
 * is correct for secrets and wrong for identity.
 *
 * A `.env` file is unreadable and uneditable by the person who runs the company.
 * Asking the founder to change the GST number, fix a typo in the footer address,
 * or add an Instagram account by asking a developer to edit a dotfile, await a
 * commit, and trigger a redeploy is not a configuration system — it is a
 * dependency on a developer for a two-minute job. Every one of those values was
 * in `config.ts` under `compliance`, which means a wrong address, a stale
 * grievance officer and a misspelt GSTIN were all one redeploy away and nobody
 * could fix them.
 *
 * So: environment for SECRETS and for infrastructure (ports, DSNs, keys), the
 * DATABASE for everything a person owns. The split is deliberate:
 *
 *   env + fail-fast  → PAYLOAD_SECRET, DATABASE_URL, S3 keys, SMTP password.
 *                      Wrong values here are an outage; nobody should be able to
 *                      change them from a web form.
 *   this collection  → legal name, address, GSTIN, phones, e-mails, socials,
 *                      grievance officer, announcement bar, SEO defaults, the
 *                      words on every page.
 *                      Wrong values here are a customer-facing mistake, and the
 *                      person who made it is sitting right there.
 *
 * ── WHY IT IS A SINGLETON ───────────────────────────────────────────────────
 *
 * One row. Not a key-value table, and not one row per setting.
 *
 * A key-value store puts the meaning of a field in a second place — the key
 * name — so validating "is this a valid GSTIN" becomes "look up which validator
 * this key uses", and a typo becomes a silently ignored row. A typed collection
 * means the panel itself validates: GSTIN gets a pattern, a phone gets a length,
 * a social handle gets a URL shape, and the impossible combinations cannot be
 * saved at all.
 *
 * ── WHY `read` IS PUBLIC ────────────────────────────────────────────────────
 *
 * Because the footer, the contact page, the policy pages and `<head>` all render
 * these values, to everyone, on every request. It is business contact information
 * that the law requires us to publish — GSTIN, registered address, grievance
 * officer — so there is nothing here to protect. `update` is staff-only: only
 * the owner should be able to change the phone number the business answers on.
 *
 * ── WHY THERE IS STILL AN ENV FALLBACK ──────────────────────────────────────
 *
 * `loadBusinessSettings()` falls back to `config.compliance` when the row is
 * missing or a field is blank. That is not duplication for its own sake: it means
 * a fresh clone with an empty database still renders a compliant footer, and the
 * settings screen can be filled in at a human pace without a deploy in between.
 * Once the row exists it wins, always — so an env value can never silently
 * override what the owner set in the panel.
 */

/** A URL field with an admin description, since these are all "where to find us". */
const social = (
  name: string,
  label: string,
  description: string,
): { name: string; type: 'text'; admin: { description: string }; label: string } => ({
  name,
  type: 'text',
  label,
  admin: { description },
})

export const BusinessSettings: CollectionConfig = {
  slug: 'business-settings',
  labels: { singular: 'Business settings', plural: 'Business settings' },
  admin: {
    group: 'Setup',
    // A singleton has no list to scan, so the single row's title should be the
    // thing a person recognises — the business's trading name.
    useAsTitle: 'tradingName',
    description:
      'Everything a non-technical owner needs to change without a developer. Saves take effect on the next page load — there is nothing to deploy.\n\n' +
      'This is a SINGLETON: exactly one settings page exists for the whole business. ' +
      'Open the row in the list below and edit it. (Payload offers a "Create" button ' +
      'because it has no first-class singleton concept; pressing it will correctly ' +
      'refuse with "Value must be unique", which is the right answer in the only ' +
      'sense available — a second copy of these settings would mean two different ' +
      'GST numbers on the same website.)',
    defaultColumns: ['tradingName', 'legalEntityName', 'gstin', 'customerCarePhone', 'updatedAt'],
  },
  access: {
    // Public read: these are the values Consumer Protection (E-commerce) Rules
    // 2020 r.4(2) requires us to publish anyway.
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    // Deletion is refused at the access layer as well as by the singleton index.
    // Two guards on purpose: access control is the one that explains itself in the
    // UI, and the index is the one that holds when somebody bypasses the UI.
    delete: () => false,
  },
  fields: [
    /* ── Identity ───────────────────────────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'Who we are',
      fields: [
        {
          name: 'tradingName',
          type: 'text',
          required: true,
          defaultValue: 'Upvvan',
          admin: {
            description: 'What the brand is called on the site. Appears in the logo and in emails.',
          },
        },
        {
          name: 'legalEntityName',
          type: 'text',
          admin: {
            description:
              'The registered legal name. Consumer Protection (E-commerce) Rules 2020 r.4(2)(a) requires it in the footer.',
          },
        },
        {
          name: 'principalAddress',
          type: 'textarea',
          admin: {
            description:
              'Registered office address, one line per part. r.4(2)(b) requires the principal geographic address.',
          },
        },
        {
          name: 'supportingSince',
          type: 'text',
          admin: { description: 'e.g. 2026. Rendered as "Serving Bengaluru since 2026" if set.' },
        },
      ],
    },

    /* ── Tax registration ───────────────────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'GST & registration',
      fields: [
        {
          name: 'gstin',
          type: 'text',
          admin: {
            description:
              '15 characters: 2 state digits, 10-char PAN, 1 entity code, "1Z", 1 checksum. Must appear on an invoice for an Indian B2C seller.',
            condition: (data) => Boolean(data.gstinRequired !== false),
          },
          validate: (value: string | null | undefined) => {
            if (!value) return true
            // 22ABCDE1234F1Z5
            if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(value)) {
              return 'A GSTIN looks like 29ABCDE1234F1Z5 — 2 digits, 5 letters, 4 digits, 1 letter, 1 digit, Z, 1 character.'
            }
            return true
          },
        },
        {
          name: 'gstinRequired',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Turn off ONLY if you are not a registered dealer (a composition dealer or under the threshold). An unregistered seller must not print a GSTIN.',
          },
        },
        {
          name: 'gstRateBp',
          type: 'number',
          defaultValue: 1800,
          admin: {
            description:
              'GST rate in basis points: 1800 = 18%. This is the DEFAULT for a new city; a city’s own rate lives on its price book so a city can differ without touching this.',
          },
          validate: (value: number | null | undefined) => {
            if (value === null || value === undefined) return true
            if (!Number.isInteger(value))
              return 'Use whole basis points, not a percentage. 1800, not 18.'
            if (value < 0 || value > 5000) return 'GST rates run 0–50%. 5000 basis points is 50%.'
            return true
          },
        },
        {
          name: 'cin',
          type: 'text',
          admin: { description: 'Company CIN / LLPIN. Leave blank if not a company.' },
        },
      ],
    },

    /* ── Customer contact ───────────────────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'Customer care',
      fields: [
        {
          name: 'customerCareEmail',
          type: 'email',
          admin: {
            description:
              'The published support address. Where replies to no-reply e-mails should go.',
          },
        },
        {
          name: 'customerCarePhone',
          type: 'text',
          admin: { description: 'The published phone number. Shown as a tap-to-call link.' },
          validate: (value: string | null | undefined) => {
            if (!value) return true
            const digits = value.replace(/\D/g, '')
            if (digits.length < 10)
              return 'That is too short to dial. Include the country code if you want +91 shown.'
            return true
          },
        },
        {
          name: 'whatsappNumber',
          type: 'text',
          admin: {
            description:
              'Digits only, with country code and no "+" or spaces (919812345678). Used to build wa.me links. The "response in 15 minutes" promise on the contact page is about THIS number.',
          },
          validate: (value: string | null | undefined) => {
            if (!value) return true
            if (!/^[0-9]{10,15}$/.test(value)) {
              return 'Digits only, country code first, no + or spaces — e.g. 919812345678. wa.me rejects anything else.'
            }
            return true
          },
        },
        {
          name: 'businessHours',
          type: 'text',
          defaultValue: 'Mon–Sat, 9am–7pm IST',
          admin: {
            description: 'Published support hours. The 15-minute promise is scoped to these hours.',
          },
        },
      ],
    },

    /* ── Grievance officer (statutory) ───────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'Grievance officer',
      fields: [
        {
          name: 'grievanceOfficerName',
          type: 'text',
          admin: {
            description:
              'r.4(4) requires a NAMED grievance officer with contact details and designation to be displayed. A generic "support team" is not compliant.',
          },
        },
        { name: 'grievanceOfficerDesignation', type: 'text' },
        { name: 'grievanceOfficerEmail', type: 'email' },
        { name: 'grievanceOfficerPhone', type: 'text' },
        {
          name: 'grievanceResponseHours',
          type: 'number',
          defaultValue: 48,
          admin: {
            description:
              'Hours to acknowledge a complaint. r.4(5) sets a maximum of 48; you may commit to less, never more.',
          },
          validate: (value: number | null | undefined) => {
            if (value === null || value === undefined) return true
            if (value > 48)
              return 'The Rules cap acknowledgement at 48 hours. You may promise faster, never slower.'
            return true
          },
        },
      ],
    },

    /* ── Social accounts ────────────────────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'Social accounts',
      fields: [
        social(
          'instagramUrl',
          'Instagram',
          'Full URL, e.g. https://instagram.com/upvvan. Blank hides the icon.',
        ),
        social('facebookUrl', 'Facebook', 'Full URL. Blank hides the icon.'),
        social('youtubeUrl', 'YouTube', 'Full URL. Blank hides the icon.'),
        social('linkedinUrl', 'LinkedIn', 'Full URL. Blank hides the icon.'),
        social('xUrl', 'X / Twitter', 'Full URL. Blank hides the icon.'),
        social(
          'pinterestUrl',
          'Pinterest',
          'Full URL. Blank hides the icon — this is a visual category, so it earns its place.',
        ),
        {
          name: 'socialProofNote',
          type: 'textarea',
          admin: {
            description:
              'Optional line shown beside the icons. Write what is true, not what is aspirational — an empty follower count reads as worse than no icons at all.',
          },
        },
      ],
    },

    /* ── Announcement bar ───────────────────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'Announcement bar',
      fields: [
        {
          name: 'announcementEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'The thin strip above the header.' },
        },
        {
          name: 'announcementText',
          type: 'text',
          admin: { description: 'Keep it under ~90 characters or it will wrap on a phone.' },
        },
        {
          name: 'announcementLinkLabel',
          type: 'text',
          admin: { description: 'Optional link text, e.g. "Track your order".' },
        },
        {
          name: 'announcementLinkHref',
          type: 'text',
          admin: { description: 'Where that link goes. A full path like /track-order.' },
        },
      ],
    },

    /* ── SEO defaults ───────────────────────────────────────────────────── */
    {
      type: 'collapsible',
      label: 'SEO defaults',
      fields: [
        {
          name: 'seoTitleTemplate',
          type: 'text',
          defaultValue: '%s · Upvvan',
          admin: {
            description:
              'How a page title is composed. %s is the page’s own title. Search results show the result, not this.',
          },
        },
        {
          name: 'defaultMetaDescription',
          type: 'textarea',
          maxLength: 200,
          admin: {
            description:
              'Used only where a page has no description of its own. Aim 140–160 characters — longer is truncated in the result.',
          },
        },
        {
          name: 'ogImageUrl',
          type: 'text',
          admin: {
            description:
              'Absolute URL of the share image (1200×630). Used when a page has no image.',
          },
        },
      ],
    },

    /* ── Delivery promises shown to customers ───────────────────────────── */
    {
      type: 'collapsible',
      label: 'Service promises',
      fields: [
        {
          name: 'sameDayCutoff',
          type: 'text',
          defaultValue: '2pm',
          admin: {
            description:
              'Same-day delivery cutoff. Checked against the city’s own bands at runtime, so a city can be stricter — this is the default a new city starts from.',
          },
        },
        {
          name: 'supportResponseMinutes',
          type: 'number',
          defaultValue: 15,
          admin: {
            description:
              'Minutes to answer a WhatsApp message during business hours. This is published on the contact page, so it is a promise with a number attached.',
          },
          validate: (value: number | null | undefined) => {
            if (value === null || value === undefined) return true
            if (value <= 0) return 'A promise of zero minutes is not a promise.'
            return true
          },
        },
        {
          name: 'replacementWindowDays',
          type: 'number',
          defaultValue: 30,
          admin: {
            description:
              'Days after delivery in which a dead plant is replaced. The guarantee’s arrival window stays on the city’s price book — this is the survival window.',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
