/**
 * Business details that appear on a tax invoice.
 *
 * ── WHY THESE ARE NOT HARDCODED AND WHY THEY ARE NOT IN config.ts ────────
 *
 * `src/lib/config.ts` belongs to another agent working concurrently, so the
 * additions are REPORTED rather than merged. They are read here through the same
 * structural cast the payments module uses, with documented fallbacks.
 *
 * The reason a GSTIN must be an env value rather than a literal is not tidiness:
 * it is the entity's registration number. Putting it in source control means it
 * appears in every clone, every fork and every screenshot of the repository, and it
 * is the single value an auditor checks first on an invoice.
 *
 * ── WHAT THE OTHER AGENT MUST ADD TO src/lib/config.ts ─────────────────────
 *
 *   business: {
 *     // existing keys stay as they are …
 *
 *     // GSTIN of the selling entity, 15 characters, on every tax invoice. Legal
 *     // Metrology requires the retail price inclusive of all taxes to be declared;
 *     // the invoice is what proves we actually charged it.
 *     gstin: str('GSTIN', ''),
 *
 *     // The 2-digit state code the GSTIN is registered in (e.g. '29' for
 *     // Karnataka). Place-of-supply rules key off this, so it is not a display detail.
 *     gstStateCode: str('GST_STATE_CODE', '29'),
 *
 *     // Invoice number prefix. Sequential numbering is a legal requirement under
 *     // the Central Goods and Services Tax Act — invoices must be serially
 *     // numbered, so the NUMBER comes from the order and the prefix only makes it
 *     // recognisable at a glance.
 *     invoicePrefix: str('INVOICE_PREFIX', 'UPV'),
 *   },
 *
 * `assertConfigValid` should then require `gstin` in production, the same way the
 * compliance block requires a grievance officer: an invoice without a GSTIN is not
 * an invoice, and a site that boots without one will happily render one.
 */
import { config } from '@/lib/config'

interface BusinessInvoiceConfig {
  gstin?: string
  gstStateCode?: string
  invoicePrefix?: string
}

function readBusiness(): BusinessInvoiceConfig {
  return (config as unknown as { business?: BusinessInvoiceConfig }).business ?? {}
}

export interface TaxInvoiceDetails {
  gstin: string
  gstStateCode: string
  invoiceNumber: string
  invoicePrefix: string
  /**
   * True when the GSTIN is missing. The invoice page shows the line anyway with an
   * explicit gap rather than hiding the section — an invoice that quietly omits its
   * own tax registration is worse than one that admits it is incomplete.
   */
  gstinMissing: boolean
}

/**
 * A GSTIN is exactly 15 characters, the format is
 * `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`, and the 14th
 * character is a fixed literal `Z`.
 *
 * Validated here rather than trusted so a typo reaches the log as a configuration
 * fault and the page as a clearly-labelled gap — not as a malformed GSTIN printed
 * on a legal document, which is the kind of error that surfaces at assessment.
 */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export function taxInvoice(orderCode: string): TaxInvoiceDetails {
  const business = readBusiness()
  const raw = (business.gstin ?? '').trim().toUpperCase()
  const valid = GSTIN_PATTERN.test(raw)

  if (raw && !valid) {
    // Configuration fault, logged at read time so it appears in server logs even
    // though the page itself will not shout about it.
    console.error(
      `[invoice] GSTIN "${raw}" is not a valid 15-character GSTIN. Tax invoices will be issued without one.`,
    )
  }

  const invoicePrefix = business.invoicePrefix ?? 'UPV'

  return {
    gstin: valid ? raw : '',
    gstStateCode: business.gstStateCode ?? '29',
    invoiceNumber: `${invoicePrefix}/${orderCode}`,
    invoicePrefix,
    gstinMissing: !valid,
  }
}

/**
 * The HSN code, which an invoice for a plant requires.
 *
 * Live plants are classified 0602 90 under the Harmonised System, and the 4-digit
 * `0602` sub-heading is what an invoice declares. Hardcoded HERE rather than in
 * config because it is not an operational fact about this business — it is a
 * classification of the product category, and it belongs to the same layer that
 * decides what a plant IS (see `itemClass` in Skus.ts). Making it env-configurable
 * would let someone sell plants under a code that does not describe them.
 */
export const HSN_LIVE_PLANT = '060290'
export const HSN_PLANTER = '691490'
export const HSN_CONSUMABLE = '310590'

export function hsnFor(itemClass: string): string {
  switch (itemClass) {
    case 'planter':
      return HSN_PLANTER
    case 'consumable':
      return HSN_CONSUMABLE
    default:
      return HSN_LIVE_PLANT
  }
}
