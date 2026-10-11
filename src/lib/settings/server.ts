import 'server-only'

import { cache } from 'react'

import { config } from '@/lib/config'
import { query } from '@/lib/db/pool'

/**
 * Business settings — the runtime view of the `business_settings` row.
 *
 * ── WHY THE ROW IS A CACHE AND ENV IS A FALLBACK, IN THAT ORDER ─────────────
 *
 * The rule the founder actually needs is simple: *what I type in the admin panel
 * is what the site says.* That only holds if the panel wins, always.
 *
 * So the resolution order is deliberately one-directional:
 *
 *   1. the database row, field by field;
 *   2. `config.compliance`, for any individual field still blank;
 *   3. nothing at all — the field renders as absent, and the footer says so.
 *
 * It is one-directional on purpose. The earlier failure mode was a dotfile
 * holding a value nobody could see, so a "correction" typed into the panel looked
 * like it had been ignored. Here, saving a field in the panel removes the env
 * value from consideration permanently — the panel cannot be overridden by a
 * deploy.
 *
 * ── WHY THE FALLBACK IS NOT DELETED ────────────────────────────────────────
 *
 * Because `assertConfigValid()` refuses to boot without the compliance values,
 * and that check is correct for a first deploy: a launch with no registered
 * address and no grievance officer is not a launch. If the row did not exist yet,
 * that boot check would fail and the site would be unopenable — so the values are
 * available from two places during the window between "migrated" and "configured
 * in the panel".
 *
 * Once the owner saves the panel, the env copy is inert. Nothing deletes it,
 * because deleting a secret's fallback to make a refactor tidier is how a staging
 * environment ends up unable to boot.
 *
 * ── WHY THIS READS `pg` DIRECTLY ──────────────────────────────────────────
 *
 * Payload's Local API would work, and would also mean booting the whole CMS
 * instance — plugin registration, the adapter pool, the config graph — to render
 * a footer. This is one `SELECT … LIMIT 1` on a table that is read on every page
 * view. `cache()` makes it once per request rather than once per component.
 */
export interface BusinessSettings {
  tradingName: string
  legalEntityName: string
  principalAddress: string
  supportingSince: string

  gstin: string
  gstinRequired: boolean
  gstRateBp: number
  cin: string

  customerCareEmail: string
  customerCarePhone: string
  whatsappNumber: string
  whatsappDigits: string
  businessHours: string

  grievanceOfficerName: string
  grievanceOfficerDesignation: string
  grievanceOfficerEmail: string
  grievanceOfficerPhone: string
  grievanceResponseHours: number

  instagramUrl: string
  facebookUrl: string
  youtubeUrl: string
  linkedinUrl: string
  xUrl: string
  pinterestUrl: string
  socialProofNote: string

  announcementEnabled: boolean
  announcementText: string
  announcementLinkLabel: string
  announcementLinkHref: string

  seoTitleTemplate: string
  defaultMetaDescription: string
  ogImageUrl: string

  sameDayCutoff: string
  supportResponseMinutes: number
  replacementWindowDays: number
}

interface SettingsRow {
  trading_name: string | null
  legal_entity_name: string | null
  principal_address: string | null
  supporting_since: string | null
  gstin: string | null
  gstin_required: boolean | null
  gst_rate_bp: number | string | null
  cin: string | null
  customer_care_email: string | null
  customer_care_phone: string | null
  whatsapp_number: string | null
  business_hours: string | null
  grievance_officer_name: string | null
  grievance_officer_designation: string | null
  grievance_officer_email: string | null
  grievance_officer_phone: string | null
  grievance_response_hours: number | string | null
  instagram_url: string | null
  facebook_url: string | null
  youtube_url: string | null
  linkedin_url: string | null
  x_url: string | null
  pinterest_url: string | null
  social_proof_note: string | null
  announcement_enabled: boolean | null
  announcement_text: string | null
  announcement_link_label: string | null
  announcement_link_href: string | null
  seo_title_template: string | null
  default_meta_description: string | null
  og_image_url: string | null
  same_day_cutoff: string | null
  support_response_minutes: number | string | null
  replacement_window_days: number | string | null
}

/**
 * First non-blank of the panel value and the env value.
 *
 * Blank is decided by `trim()`, not by falsiness, because the failure this guards
 * against is an admin who cleared a field — leaving the previous value in place
 * is how a "I removed our address" edit turns into "our address is still on the
 * site", which for a statutory disclosure is the worst possible outcome.
 */
function pick(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text !== '') return text
  }
  return ''
}

function pickNumber(
  fallback: number,
  ...values: Array<number | string | null | undefined>
): number {
  for (const value of values) {
    if (value === null || value === undefined || String(value).trim() === '') continue
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

async function readRow(): Promise<SettingsRow | null> {
  try {
    const { rows } = await query<SettingsRow>(`SELECT * FROM business_settings ORDER BY id LIMIT 1`)
    return rows[0] ?? null
  } catch (error) {
    // The table missing, or the database briefly unreachable. Either way the site
    // must still render: a footer is not worth a 500.
    //
    // Logged once per process rather than once per request, because a database
    // outage would otherwise fill the log with the same line thousands of times
    // and bury the error that caused it.
    if (!loggedDbFailure) {
      loggedDbFailure = true
      console.error(
        '[settings] business_settings unreadable; falling back to environment values.',
        error instanceof Error ? error.message : error,
      )
    }
    return null
  }
}

let loggedDbFailure = false

/**
 * The resolved settings for this request.
 *
 * `cache()` is React's per-request memo, not a global cache — settings change
 * when somebody saves them, and a process-lifetime cache would keep serving the
 * old phone number until a deploy. A request that renders the footer twice
 * still reads the row once.
 */
export const loadBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  const row = await readRow()
  const c = config.compliance

  const whatsapp = pick(row?.whatsapp_number, row?.customer_care_phone, c.customerCarePhone)

  return {
    tradingName: pick(row?.trading_name, config.email.fromName, 'Upvvan'),
    legalEntityName: pick(row?.legal_entity_name, c.legalEntityName),
    principalAddress: pick(row?.principal_address, c.principalAddress),
    supportingSince: pick(row?.supporting_since),

    gstin: pick(row?.gstin),
    // Defaults TRUE. An unregistered dealer must tick the box to say so; the
    // inverse default would print a blank GSTIN slot on every invoice, which
    // reads as a formatting mistake rather than an absence.
    gstinRequired: row?.gstin_required ?? true,
    gstRateBp: pickNumber(config.business.defaultTaxRateBp, row?.gst_rate_bp),
    cin: pick(row?.cin),

    customerCareEmail: pick(row?.customer_care_email, c.customerCareEmail),
    customerCarePhone: pick(row?.customer_care_phone, c.customerCarePhone),
    whatsappNumber: whatsapp,
    // Digits only, for wa.me. Computed here so no caller has to remember.
    whatsappDigits: whatsapp.replace(/\D/g, ''),
    businessHours: pick(row?.business_hours, 'Mon–Sat, 9am–7pm IST'),

    grievanceOfficerName: pick(row?.grievance_officer_name, c.grievanceOfficerName),
    grievanceOfficerDesignation: pick(
      row?.grievance_officer_designation,
      c.grievanceOfficerDesignation,
    ),
    grievanceOfficerEmail: pick(row?.grievance_officer_email, c.grievanceOfficerEmail),
    grievanceOfficerPhone: pick(row?.grievance_officer_phone, c.grievanceOfficerPhone),
    grievanceResponseHours: pickNumber(48, row?.grievance_response_hours),

    instagramUrl: pick(row?.instagram_url),
    facebookUrl: pick(row?.facebook_url),
    youtubeUrl: pick(row?.youtube_url),
    linkedinUrl: pick(row?.linkedin_url),
    xUrl: pick(row?.x_url),
    pinterestUrl: pick(row?.pinterest_url),
    socialProofNote: pick(row?.social_proof_note),

    announcementEnabled: row?.announcement_enabled ?? false,
    announcementText: pick(row?.announcement_text),
    announcementLinkLabel: pick(row?.announcement_link_label),
    announcementLinkHref: pick(row?.announcement_link_href),

    seoTitleTemplate: pick(row?.seo_title_template, '%s · Upvvan'),
    defaultMetaDescription: pick(row?.default_meta_description),
    ogImageUrl: pick(row?.og_image_url),

    sameDayCutoff: pick(row?.same_day_cutoff, '2pm'),
    supportResponseMinutes: pickNumber(15, row?.support_response_minutes),
    replacementWindowDays: pickNumber(30, row?.replacement_window_days),
  }
})

/** Social accounts that have been filled in. Never renders a dead icon. */
export async function socialLinks(): Promise<Array<{ label: string; href: string }>> {
  const s = await loadBusinessSettings()
  return [
    { label: 'Instagram', href: s.instagramUrl },
    { label: 'Facebook', href: s.facebookUrl },
    { label: 'YouTube', href: s.youtubeUrl },
    { label: 'LinkedIn', href: s.linkedinUrl },
    { label: 'X', href: s.xUrl },
    { label: 'Pinterest', href: s.pinterestUrl },
  ].filter((link) => link.href !== '')
}

/** `tel:` for a published number. Empty string when there is not one. */
export async function telHref(): Promise<string> {
  const s = await loadBusinessSettings()
  return s.customerCarePhone ? `tel:${s.customerCarePhone.replace(/[^\d+]/g, '')}` : ''
}

/**
 * Is the statutory disclosure complete?
 *
 * This is the check the compliance review asked for and the boot-time
 * `assertConfigValid` cannot do: env cannot tell you whether the admin panel has
 * been filled in. r.4(2)(a), r.4(2)(b), r.4(2)(d) and r.4(4) each map to a value
 * below, and the footer renders a visible warning rather than an empty gap — a
 * blank block in a compliance footer is indistinguishable from a bug.
 */
export async function disclosureGaps(): Promise<string[]> {
  const s = await loadBusinessSettings()
  const gaps: string[] = []
  if (!s.legalEntityName) gaps.push('Legal entity name (r.4(2)(a))')
  if (!s.principalAddress) gaps.push('Registered address (r.4(2)(b))')
  if (!s.customerCareEmail || !s.customerCarePhone) gaps.push('Customer care contact (r.4(2)(d))')
  if (!s.grievanceOfficerName) gaps.push('Grievance officer name (r.4(4))')
  if (!s.grievanceOfficerDesignation) gaps.push('Grievance officer designation (r.4(4))')
  if (!s.grievanceOfficerEmail) gaps.push('Grievance officer contact (r.4(4))')
  return gaps
}
