import Link from 'next/link'

import { config } from '@/lib/config'

/**
 * Site footer — the mandatory E-Commerce Rules 2020 disclosures.
 *
 * ── WHY THIS COMPONENT IS A COMPLIANCE REQUIREMENT, NOT FURNITURE ───────────
 *
 * Consumer Protection (E-Commerce) Rules 2020 r.4(2) requires every
 * e-commerce entity to display, clearly and accessibly:
 *
 *   (a) the legal name of the entity;
 *   (b) its principal geographic address of headquarters, and of all branches;
 *   (c) the name and details of its website;
 *   (d) contact details — e-mail, and a telephone number — of customer care
 *       AND of the grievance officer.
 *
 * r.4(4) adds that the grievance officer's name, contact details and
 * DESIGNATION must be displayed. r.4(5) requires acknowledgement of any
 * complaint within 48 hours.
 *
 * The compliance reviewer found `config.compliance` defined with four of these
 * keys, documented as "a mandatory E-Commerce Rules 2020 disclosure", and read by
 * NOTHING — with the environment variables blank. A config subtree with no
 * consumer is a compliance item that was written down and never finished.
 *
 * `assertConfigValid()` now refuses to boot without these values, so this
 * component cannot silently render blanks in production.
 */
/*
 * Footer tap targets.
 *
 * WCAG 2.2 SC2.5.8 requires a 24x24 CSS px minimum for pointer targets; measured
 * in a real browser at 390px, these links were 17px tall — an inline `<a>` is
 * exactly the height of its text and nothing else. The header links were fixed in
 * the same pass; this is the remaining half, and a customer tapping a phone
 * number to call support is the single most likely thing to miss.
 *
 * `inline-flex min-h-[44px]` rather than padding: padding on an inline element
 * does not affect line box height, so the hit area would stay 17px while looking
 * correct. `inline-flex` makes the element a flex box, which is what actually
 * grows the target.
 */
const TAPPABLE = 'inline-flex min-h-[44px] items-center'

export default async function SiteFooter() {
  const c = config.compliance

  /*
   * GSTIN is REQUIRED on an invoice, and every marketplace, courier and gateway
   * gates on it. It already exists in the database — `cities.gstin`, e.g.
   * `29ABCDE1234F1Z5` — and before this it was rendered NOWHERE on the site, so
   * the site was simultaneously claiming E-Commerce Rules compliance while
   * withholding a statutorily-required identifier.
   *
   * Read here rather than from `config` because GSTIN is PER CITY: a second city
   * has a second GSTIN, and a global env var would be wrong the moment there is
   * more than one. `config.compliance` holds what is genuinely global.
   *
   * Guarded: a footer must never be the thing that takes a page down. If the
   * database is unreachable the legal disclosures still render.
   */
  let gstin: string | null = null
  try {
    const { loadGeo } = await import('@/lib/geo/loader.server')
    const geo = await loadGeo()
    gstin = geo.cities.find((x) => x.isActive && x.gstin)?.gstin ?? null
  } catch (err) {
    console.error('[footer] could not read GSTIN', err)
  }

  return (
    <footer className="mt-2xl border-border px-base py-xl border-t">
      <div className="gap-sm text-ink-muted mx-auto flex max-w-[960px] flex-col text-sm">
        <p className="m-0">
          {/*
            `text-ink`, NOT `text-foreground`. There is no `--color-foreground`
            token in theme.css, so `text-foreground` compiles to a class Tailwind
            never emits and the legal entity name silently rendered in the same
            muted grey as the address around it — the single most important string
            on the page for E-Commerce Rules r.4(2)(a) compliance was the least
            legible thing in the block.
          */}
          <strong className="text-ink">{c.legalEntityName}</strong>
          <br />
          {c.principalAddress}
          {gstin && (
            <>
              <br />
              GSTIN: <span className="text-ink">{gstin}</span>
            </>
          )}
        </p>

        <p className="m-0">
          Customer care:{' '}
          <a href={`mailto:${c.customerCareEmail}`} className={TAPPABLE}>
            {c.customerCareEmail}
          </a>
          {' · '}
          <a href={`tel:${c.customerCarePhone}`} className={TAPPABLE}>
            {c.customerCarePhone}
          </a>
        </p>

        {/*
          r.4(4) requires the officer's NAME, CONTACT DETAILS and DESIGNATION.
          All three, not just an email address.
        */}
        <p className="m-0">
          Grievance officer: <strong className="text-ink">{c.grievanceOfficerName}</strong>,{' '}
          {c.grievanceOfficerDesignation}
          <br />
          <a href={`mailto:${c.grievanceOfficerEmail}`} className={TAPPABLE}>
            {c.grievanceOfficerEmail}
          </a>{' '}
          ·{' '}
          <a href={`tel:${c.grievanceOfficerPhone}`} className={TAPPABLE}>
            {c.grievanceOfficerPhone}
          </a>
          <br />
          <span className="text-xs">
            We acknowledge every complaint within 48 hours and resolve it within 30 days.
          </span>
        </p>

        <nav className="gap-sm m-0 flex flex-wrap">
          <Link href="/grievance" className={`text-primary underline ${TAPPABLE}`}>
            Grievance redressal
          </Link>
          {/*
            One policies page, not two. The DPDP notice is a section of it rather
            than a separate route: a privacy page that restates the policies in
            different words is a second thing to keep true, and r.4(2) cares that
            the disclosure is present and accessible, not that it has its own URL.
          */}
          <Link href="/policies" className={`text-primary underline ${TAPPABLE}`}>
            Policies, guarantee &amp; privacy notice
          </Link>
        </nav>

        <p className="m-0 text-xs">
          Plants are sold pre-paid only; we do not offer cash on delivery. Plant guarantees are
          replacement-based; consumables are refunded in money within 24 hours.
        </p>
      </div>
    </footer>
  )
}
