import Link from 'next/link'

import { disclosureGaps, loadBusinessSettings, socialLinks } from '@/lib/settings/server'

/**
 * Site footer — navigation, and the mandatory E-Commerce Rules 2020 disclosures.
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
 *
 * ── ONE `<footer>`, ONE CONTAINER, ONE BACKGROUND ──────────────────────────
 *
 * The first version of this rewrite rendered the nav columns and the legal
 * block as two sibling bands: one at `max-w-[1120px]`, one at `max-w-[960px]`,
 * separated by a border, with a different background on each.
 *
 * There was only ever ONE `<footer>` element — the DOM was correct and a test
 * asserting exactly one `<footer>` per page passed. But it LOOKED like two
 * footers, because the eye reads "a band, a rule, a narrower band below it" as
 * two things stacked. The 240px of extra inset either side of the legal block
 * is what a person notices first.
 *
 * So: one background for the whole footer, one container width, and a hairline
 * INSIDE it rather than a border between two bands. The compliance text is
 * still on every page, in the same place, at the same legibility — which is
 * what r.4(2) asks for and all it asks for.
 *
 * ── WHY THE LINK COLUMNS EXIST AT ALL ──────────────────────────────────────
 *
 * A footer is the only place on a site where every page is reachable, and this
 * business's audited competitors are all failing on discoverability rather than
 * on product: Ugaoo's mega-menu links four pages that 404 and a live blog post
 * titled "TESTING PLANT CARE BLOG"; Kyari's sitemap carries `/pages/tesing`,
 * `/pages/deal-test` and two duplicate gift-box builders; Upvan ships a
 * collection called `plants-example-products` that is an un-renamed Shopify demo
 * handle.
 *
 * Every link below is a route that exists. There are no aspirational links here,
 * and `link-integrity.test.ts` walks this list and asserts it.
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

const COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Shop',
    links: [
      { href: '/plants', label: 'All plants in season' },
      { href: '/collections/summer-safe-plants', label: 'Summer safe' },
      { href: '/collections/plants-for-a-low-light-room', label: 'Low light' },
      { href: '/collections/plants-that-are-safe-around-cats-and-dogs', label: 'Pet safe' },
      { href: '/collections/plants-for-an-office-desk', label: 'Office desk' },
      { href: '/quiz', label: 'Not sure? Four questions' },
      { href: '/search', label: 'Search' },
    ],
  },
  {
    /*
     * The first link is NOT "Gifting". The column heading is already "Gifting",
     * and a heading repeated as its own first child reads as a mistake — which is
     * exactly what it looked like. This one leads with the page's purpose.
     */
    heading: 'Gifting',
    links: [
      { href: '/gifting', label: 'Every occasion' },
      { href: '/gifting/housewarming', label: 'Housewarming' },
      { href: '/gifting/thank-you', label: 'Thank you' },
      { href: '/gifting/congratulations', label: 'Congratulations' },
      { href: '/corporate', label: 'Corporate & bulk' },
      { href: '/corporate/request-quote', label: 'Request a quote' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { href: '/contact', label: 'Contact us' },
      { href: '/faq', label: 'Questions we get asked' },
      { href: '/track-order', label: 'Track an order' },
      { href: '/orders/lookup', label: 'Find an order without an account' },
      { href: '/claim', label: 'Report damage or a claim' },
      { href: '/grievance', label: 'Grievance redressal' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { href: '/blog', label: 'Care articles' },
      { href: '/problems', label: 'Something looks wrong' },
      { href: '/about', label: 'About us and the nursery' },
      { href: '/policies/guarantee', label: 'The guarantee' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/policies/shipping', label: 'Shipping & delivery' },
      { href: '/policies/refund', label: 'Refunds & replacements' },
      { href: '/policies/privacy', label: 'Privacy & DPDP notice' },
      { href: '/policies/terms', label: 'Terms of service' },
      { href: '/policies/legal', label: 'Legal notice' },
    ],
  },
]

export default async function SiteFooter() {
  /*
   * Every value below is read from the `business_settings` row, falling back to
   * the environment for any field nobody has filled in yet.
   *
   * It USED to read `config.compliance` alone, which meant the legal entity
   * name, the registered address, both phone numbers and the named grievance
   * officer were all a developer's problem: correcting a misspelt address needed
   * a commit and a redeploy, and the person who actually knew the right address
   * could not make the change. For the specific values that
   * Consumer Protection (E-commerce) Rules 2020 r.4(2) requires us to publish,
   * "the founder has to ask a developer" is not a compliance strategy.
   *
   * Everything now comes from a row an admin can edit, and the loader falls back
   * to the environment only for fields still blank — so a clone boots compliant
   * and an edit in the panel wins immediately and permanently.
   */
  const c = await loadBusinessSettings()
  const socials = await socialLinks()
  const gaps = await disclosureGaps()

  /*
   * GSTIN is required on an invoice and is already the database's business, so it
   * is read from there and never from the environment.
   *
   * Per-city, deliberately: a second city is a second place of supply and
   * therefore a second GSTIN, so an env var would be wrong the moment there is
   * more than one. `business_settings.gstin` is the entity default and
   * `cities.gstin` overrides it for a city that has its own registration.
   *
   * A city GSTIN wins because a mismatched one is an invalid invoice; a missing
   * one falls through to the entity value rather than printing nothing.
   */
  let gstin: string | null = null
  try {
    const { loadGeo } = await import('@/lib/geo/loader.server')
    const geo = await loadGeo()
    gstin = geo.cities.find((x) => x.isActive && x.gstin)?.gstin ?? null
  } catch (err) {
    console.error('[footer] could not read GSTIN', err)
  }
  if (!gstin && c.gstinRequired) gstin = c.gstin || null
  const showGstin = c.gstinRequired

  return (
    <footer className="bg-surface-raised mt-3xl border-border border-t">
      <div className="text-ink-muted gap-lg px-base py-xl mx-auto flex max-w-[1120px] flex-col text-sm">
        {/* ── Navigation ── */}
        <nav aria-label="Footer" className="gap-lg grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-label-caps mt-0">{column.heading}</h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={`hover:text-ink no-underline ${TAPPABLE}`}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/*
          ── The legal block ──

          A hairline INSIDE the footer, not a border between two bands. This is
          the line that used to read as the top edge of a second footer.
        */}
        <div className="border-border gap-sm pt-lg flex flex-col border-t">
          {/*
            ── Missing disclosures, said out loud ──

            r.4(2) requires these values to be displayed. If one is blank, the
            options are a silent gap or a visible one. A silent gap is
            indistinguishable from a rendering bug, so it survives review after
            review; a visible one is a person going to Settings to fix it.

            Shown ONLY to a signed-in staff member, because the public footer must
            not advertise our own incomplete configuration — it should just carry
            the disclosure.
          */}
          {gaps.length > 0 && (
            <p
              role="status"
              className="border-warning bg-warning-soft px-sm py-xs m-0 rounded-sm border text-xs"
            >
              <strong>Not yet published:</strong> {gaps.join(' · ')}. Set these in{' '}
              <Link href="/admin/business-settings" className="underline">
                Settings
              </Link>
              .
            </p>
          )}

          <p className="m-0">
            {/*
              `text-ink`, NOT `text-foreground`. There is no `--color-foreground`
              token in theme.css, so `text-foreground` compiles to a class Tailwind
              never emits and the legal entity name silently rendered in the same
              muted grey as the address around it — the single most important string
              on the page for r.4(2)(a) was the least legible thing in the block.
            */}
            <strong className="text-ink">{c.legalEntityName || '—'}</strong>
            <br />
            {c.principalAddress}
            {showGstin && (
              <>
                <br />
                GSTIN: <span className="text-ink">{gstin || 'not set'}</span>
                {c.cin && (
                  <>
                    {' · '}
                    CIN: <span className="text-ink">{c.cin}</span>
                  </>
                )}
              </>
            )}
          </p>

          <p className="m-0">
            Customer care:{' '}
            {c.customerCareEmail && (
              <>
                <a href={`mailto:${c.customerCareEmail}`} className={`${TAPPABLE} underline`}>
                  {c.customerCareEmail}
                </a>
                {' · '}
              </>
            )}
            {c.customerCarePhone && (
              <a href={`tel:${c.customerCarePhone}`} className={`${TAPPABLE} underline`}>
                {c.customerCarePhone}
              </a>
            )}
            {c.whatsappDigits && (
              <>
                {' · '}
                <a
                  href={`https://wa.me/${c.whatsappDigits}`}
                  className={`${TAPPABLE} underline`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  WhatsApp
                </a>
              </>
            )}
            {c.businessHours && <span className="block text-xs">{c.businessHours}</span>}
          </p>

          {/*
            r.4(4) requires the officer's NAME, CONTACT DETAILS and DESIGNATION.
            All three, not just an email address — and the acknowledgement window is
            now the number the owner committed to rather than a hardcoded 48, so
            the site cannot promise more than the business has decided to owe.
          */}
          <p className="m-0">
            Grievance officer: <strong className="text-ink">{c.grievanceOfficerName || '—'}</strong>
            {c.grievanceOfficerDesignation && `, ${c.grievanceOfficerDesignation}`}
            <br />
            {c.grievanceOfficerEmail && (
              <a href={`mailto:${c.grievanceOfficerEmail}`} className={`${TAPPABLE} underline`}>
                {c.grievanceOfficerEmail}
              </a>
            )}{' '}
            {c.grievanceOfficerEmail && c.grievanceOfficerPhone && '· '}
            {c.grievanceOfficerPhone && (
              <a href={`tel:${c.grievanceOfficerPhone}`} className={`${TAPPABLE} underline`}>
                {c.grievanceOfficerPhone}
              </a>
            )}{' '}
            · we acknowledge every complaint within {c.grievanceResponseHours} hours and resolve it
            within 30 days.
          </p>

          {/*
            Social accounts, rendered only when they have been filled in.

            An icon that goes nowhere is worse than no icon: it reads as a broken
            site rather than as a business with no account, and it is the sort of
            thing that survives to launch because nobody clicks it in review.
          */}
          {socials.length > 0 && (
            <p className="gap-sm m-0 flex flex-wrap items-center">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className={`${TAPPABLE} underline`}
                >
                  {social.label}
                </a>
              ))}
              {c.socialProofNote && <span className="text-xs">{c.socialProofNote}</span>}
            </p>
          )}

          <p className="m-0 text-xs">
            Plants are sold pre-paid only; we do not offer cash on delivery. Plant guarantees are
            replacement-based; consumables are refunded in money within 24 hours. Prices include
            GST.
            {c.supportingSince && ` Serving since ${c.supportingSince}.`}
          </p>
        </div>
      </div>
    </footer>
  )
}
