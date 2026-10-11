import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * Grievance redressal — Consumer Protection (E-Commerce) Rules 2020.
 *
 * r.4(4): the entity shall appoint a grievance officer and display the name,
 * contact details and designation.
 * r.4(5): the officer shall acknowledge a complaint within FORTY-EIGHT HOURS and
 *         make efforts to redress it within THIRTY DAYS.
 * r.4(6)(b): a complaint lodged through the grievance channel shall be given a
 *         TICKET NUMBER, which must be conveyed to the complainant.
 *
 * The footer already links here, so the page cannot go missing without a failed
 * link. It deliberately shows the 48-hour acknowledgement commitment, because
 * that is a promise the business has to be able to keep — support is
 * WhatsApp-first with a <15 minute SLA, so 48 hours is not the binding constraint.
 */
export const metadata = {
  title: 'Grievance redressal',
}

/*
 * This page read `config.compliance` and NOTHING else — no database at all. So the
 * one screen a Legal Metrology or Consumer Protection (E-Commerce) Rules r.4(4)
 * inspection reads was the one screen the owner could not correct from the admin
 * panel. A misspelt registered address here is a compliance defect, not a typo.
 *
 * `force-dynamic` alongside it, because a page that reads a database row and
 * declares itself static serves the value it had at build time until a redeploy.
 */
export const dynamic = 'force-dynamic'

export default async function GrievancePage() {
  const c = await loadBusinessSettings()

  return (
    <main id="main" tabIndex={-1} className="px-base py-2xl mx-auto max-w-[640px]">
      <h1 className="mt-0">Grievance redressal</h1>

      <p className="text-ink-muted">
        If something has gone wrong, we would rather hear it than have you work out whether it is
        worth raising. WhatsApp is fastest; email is recorded.
      </p>

      <h2 className="mt-xl mb-xs">Raise a complaint</h2>
      <dl className="gap-x-md gap-y-xs m-0 grid grid-cols-[auto_1fr]">
        <dt className="font-semibold">Grievance officer</dt>
        <dd className="m-0">{c.grievanceOfficerName}</dd>

        <dt className="font-semibold">Designation</dt>
        <dd className="m-0">{c.grievanceOfficerDesignation}</dd>

        <dt className="font-semibold">E-mail</dt>
        <dd className="m-0">
          <a href={`mailto:${c.grievanceOfficerEmail}`}>{c.grievanceOfficerEmail}</a>
        </dd>

        <dt className="font-semibold">Telephone</dt>
        <dd className="m-0">
          <a href={`tel:${c.grievanceOfficerPhone}`}>{c.grievanceOfficerPhone}</a>
        </dd>

        <dt className="font-semibold">Customer care</dt>
        <dd className="m-0">
          <a href={`mailto:${c.customerCareEmail}`}>{c.customerCareEmail}</a> ·{' '}
          <a href={`tel:${c.customerCarePhone}`}>{c.customerCarePhone}</a>
        </dd>
      </dl>

      <h2 className="mt-xl mb-xs">What we commit to</h2>
      <ul className="gap-xs pl-md text-ink-muted mt-0 flex list-disc flex-col">
        <li>
          <strong className="text-ink">Acknowledged within {c.grievanceResponseHours} hours</strong>
          , with a ticket number you can quote.
        </li>
        <li>
          <strong className="text-ink">Resolved within {c.replacementWindowDays} days</strong>, or
          you are told why it is taking longer and what happens next.
        </li>
        <li>
          A plant that arrives damaged or dead is{' '}
          <strong className="text-ink">replaced, not refunded</strong> — see our policies.
        </li>
        <li>
          Consumables (pots, soil, fertiliser) are{' '}
          <strong className="text-ink">refunded in money within 24 hours</strong> with no mortality
          risk involved.
        </li>
      </ul>

      <h2 className="mt-xl mb-xs">If we do not resolve it</h2>
      <p className="text-ink-muted mt-0">
        Consumers are also free to approach the National Consumer Disputes Redressal Commission. We
        would rather you came to us first — but that is your right, not a favour.
      </p>
    </main>
  )
}
