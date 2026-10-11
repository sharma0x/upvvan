import type { CollectionConfig } from 'payload'

/**
 * The outbound mail ledger, as something a person can read.
 *
 * ── WHY THE OWNER NEEDS TO SEE THIS ─────────────────────────────────────────
 *
 * The whole support model rests on a number we publish — "we answer in 15
 * minutes" — and on the belief that when somebody pays us, they hear from us.
 * Neither is checkable from inside a request. nodemailer returns the moment the
 * SMTP server accepts a message, which says nothing about whether it arrived,
 * and a customer who never received their confirmation will describe that as
 * "nobody contacted me" whether or not we tried.
 *
 * So the queue has to be visible to a human, sorted so that the failures are the
 * first thing seen rather than the last. That is the whole design: `status` is
 * the first default column, so the screen opens on "did anything break" instead
 * of on a chronological firehose.
 *
 * ── WHY RE-SEND IS A CUSTOM ENDPOINT RATHER THAN A DUPLICATE ROW ─────────────
 *
 * Because a re-send is a new ATTEMPT against an existing claim. Duplicating the
 * row would make "how many times did we tell this customer" unanswerable, which
 * is exactly the question a support inbox gets asked. The retry is a second
 * `sent` attempt recorded against the same message id, so the history stays one
 * line and the outcome stays auditable.
 */
export const EmailLog: CollectionConfig = {
  slug: 'email-log',
  labels: { singular: 'Email', plural: 'Emails' },
  admin: {
    group: 'Operations',
    useAsTitle: 'subject',
    defaultColumns: ['status', 'kind', 'recipient', 'subject', 'created_at', 'sent_at'],
    description:
      'Every message the site tried to send. Failures are at the top — that column is first for a reason.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    /*
     * Staff may never EDIT a sent message.
     *
     * An editable record of what we said to a customer is worthless as evidence:
     * the next person can quietly fix an awkward sentence and nobody can tell it
     * was ever sent. Re-sending (below) is the only sanctioned correction.
     */
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  endpoints: [
    {
      path: '/:id/resend',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Forbidden' }, { status: 403 })

        const id = Number(req.routeParams?.id)
        if (!Number.isInteger(id)) {
          return Response.json({ error: 'Bad id' }, { status: 400 })
        }

        /*
         * Imported HERE, not at the top of the file.
         *
         * `@/lib/email/send` begins with `import 'server-only'`, and that module
         * throws by design outside a Next server bundle. A top-level import here
         * pulls it into `payload.config.ts`, which means it also loads for the
         * Payload CLI and for every script under `scripts/` — so `pnpm
         * seed:staff` and `migrate:create` both crashed with a message about
         * Client Components.
         *
         * A collection config is a schema description and must stay importable
         * from anywhere; anything that genuinely needs the request runtime goes
         * inside the handler.
         */
        const { resendEmail } = await import('@/lib/email/send')
        const ok = await resendEmail(id)
        // 502 rather than 500: the SMTP hop failed, and saying so is what lets a
        // human decide whether to try again or use the phone.
        return Response.json(
          { ok, message: ok ? 'Re-sent' : 'The mail server rejected it — check the log.' },
          { status: ok ? 200 : 502 },
        )
      },
    },
  ],
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Order confirmation (customer)', value: 'order_confirmation' },
        { label: 'Order receipt (customer)', value: 'order_receipt' },
        { label: 'New order alert (owner)', value: 'order_admin_alert' },
        { label: 'Dispatch (rider)', value: 'dispatch_rider' },
        { label: 'Claim acknowledgement (customer)', value: 'claim_ack' },
        { label: 'Claim alert (owner)', value: 'claim_admin_alert' },
        { label: 'Quote acknowledgement (customer)', value: 'quote_ack' },
        { label: 'Quote alert (owner)', value: 'quote_admin_alert' },
        { label: 'Contact acknowledgement (customer)', value: 'contact_ack' },
        { label: 'Contact alert (owner)', value: 'contact_admin_alert' },
      ],
    },
    { name: 'recipient', type: 'text', required: true, index: true },
    { name: 'recipient_name', type: 'text' },
    { name: 'subject', type: 'text', required: true },
    {
      name: 'from_address',
      type: 'text',
      required: true,
      admin: { description: 'The From address this went out as.' },
    },
    {
      name: 'body_text',
      type: 'textarea',
      required: true,
      admin: { description: 'Kept so it can be re-sent without being rewritten.' },
    },
    {
      name: 'internal_only',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Owner/rider mail — not customer correspondence.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'provider_message_id',
      type: 'text',
      admin: { description: "The SMTP server's id. Grep this in the provider's logs." },
    },
    { name: 'error', type: 'textarea', admin: { readOnly: true } },
    {
      name: 'sent_at',
      type: 'date',
      admin: {
        readOnly: true,
        description:
          'Set by the transport, never by a caller — "we tried" and "it went" are different claims.',
      },
    },
  ],
  timestamps: true,
}
