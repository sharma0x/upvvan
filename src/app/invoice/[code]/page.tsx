import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { formatPaise } from '@/lib/catalogue/pricing'
import { db, loadOrderVerified, normaliseCode } from '@/lib/orders/db'
import { hsnFor, taxInvoice } from '@/lib/orders/invoice'
import { authoriseOrderAccess } from '@/lib/orders/access'
import { loadBusinessSettings } from '@/lib/settings/server'
import PrintButton from './PrintButton'

/**
 * `/invoice/<code>` — the printable tax invoice.
 *
 * ── WHY THIS IS A SEPARATE PAGE AND NOT A PRINT STYLESHEET ──────────────────
 *
 * Two reasons, one practical and one legal.
 *
 * Practical: the order page is a screen. An invoice is a document — A4, no
 * navigation, no cookie banners, nothing that moves between page 1 and page 2 while
 * someone is reading a total. Printing a web page means fighting the site's own
 * layout with print CSS, which is a losing game the moment anyone adds a sticky
 * header.
 *
 * Legal, and the reason that decides it: the invoice has to be able to stand alone
 * as a document. It carries the supplier's legal name and principal address (the
 * Consumer Protection (E-Commerce) Rules 2020 r.4(2) disclosures), the GSTIN, the
 * HSN per line, and the tax-inclusive total. None of that is navigation, and none of
 * it should depend on the state of the page it was linked from.
 *
 * ── AUTHORISATION ───────────────────────────────────────────────────────────
 *
 * The signed order cookie OR a customer session that owns the order. See
 * `src/lib/orders/access.ts`.
 *
 * This page used to accept the cookie only, and `/account` had no link to it, so
 * the tax invoice was reachable by exactly one route: the guest who had done the
 * code+phone lookup. A signed-in customer — who had already proved ownership of
 * the same phone number with an OTP, and whose own order list sits one click away
 * — could not reach the document for a plant they had already paid for.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tax invoice — Upvvan',
  robots: { index: false, follow: false },
}

function indianDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(d)
}

export default async function InvoicePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalised = normaliseCode(code)

  const jar = await cookies()
  const access = await authoriseOrderAccess(
    normalised,
    (await headers()).get('cookie') ?? undefined,
  )
  if (!access) notFound()
  void jar

  const found = await loadOrderVerified(db(), normalised)
  if (!found) notFound()

  const { order, items } = found
  const invoice = taxInvoice(order.orderCode)
  /*
   * The statutory block on a tax invoice comes from the settings ROW, not from
   * the environment.
   *
   * Six customer-facing surfaces read `config.compliance` directly, so correcting
   * a misspelt registered address in the admin panel fixed the footer and nothing
   * else — while the invoice, `/contact`, `/grievance` and the legal policies kept
   * printing the old one. Those four are exactly what a Legal Metrology or
   * Consumer Protection (E-Commerce) Rules r.4(2) inspection reads.
   */
  const settings = await loadBusinessSettings()

  return (
    <main className="px-base py-2xl mx-auto max-w-[720px]">
      <PrintButton invoiceNumber={invoice.invoiceNumber} />

      <header className="border-border pb-base mt-4 border-b">
        <h1 className="mt-0 mb-1">Tax invoice</h1>
        <p className="m-0 text-sm">
          <strong>{settings.legalEntityName || 'Upvvan'}</strong>
          <br />
          {settings.principalAddress}
          <br />
          {invoice.gstinMissing ? (
            <span className="text-warning">
              GSTIN not configured — set it in Business settings before issuing this invoice.
            </span>
          ) : (
            `GSTIN: ${invoice.gstin} · State code ${invoice.gstStateCode}`
          )}
        </p>
      </header>

      <dl className="mt-base m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-muted">Invoice no.</dt>
        <dd className="m-0 font-semibold">{invoice.invoiceNumber}</dd>

        <dt className="text-ink-muted">Invoice date</dt>
        <dd className="m-0">{indianDateTime(order.createdAt)}</dd>

        <dt className="text-ink-muted">Order no.</dt>
        <dd className="m-0">{order.orderCode}</dd>

        <dt className="text-ink-muted">Payment</dt>
        <dd className="m-0">
          {order.paymentState === 'captured'
            ? `Prepaid, captured ${indianDateTime(order.capturedAt ?? order.updatedAt)}${
                order.paymentReference ? ` · ref ${order.paymentReference}` : ''
              }`
            : 'Prepaid — NOT YET CAPTURED'}
        </dd>

        <dt className="text-ink-muted">Deliver to</dt>
        <dd className="m-0">
          {order.customerName}
          <br />
          {order.address?.line1}
          {order.address?.line2 ? (
            <>
              <br />
              {order.address.line2}
            </>
          ) : null}
          <br />
          {[order.address?.city, order.address?.state].filter(Boolean).join(', ')} {order.pincode}
        </dd>
      </dl>

      <table className="mt-base w-full border-collapse text-sm">
        <thead>
          <tr className="border-border border-b text-left">
            <th scope="col" className="py-1 pr-2 font-semibold">
              Item
            </th>
            <th scope="col" className="py-1 pr-2 font-semibold">
              HSN
            </th>
            <th scope="col" className="py-1 pr-2 font-semibold">
              Qty
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-border border-b">
              <td className="py-1 pr-2">
                {item.commonName ?? 'Plant'}
                {item.sizeTier ? ` · ${item.sizeTier}` : ''}
                {item.planterName ? ` · ${item.planterName}` : ''}
              </td>
              <td className="py-1 pr-2">{hsnFor(item.itemClass)}</td>
              <td className="py-1 pr-2">{item.quantity}</td>
              <td className="py-1 text-right">{formatPaise(item.pricePaise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-1 text-right font-semibold">
              Total (inclusive of GST)
            </td>
            <td className="pt-1 text-right font-semibold">{formatPaise(order.revenuePaise)}</td>
          </tr>
        </tfoot>
      </table>

      {/*
        The GST split.

        Prices are tax-INCLUSIVE (Legal Metrology r.6(1)(e)), so the tax is extracted
        backwards from the total rather than added on top. Shown on the invoice because
        a GST invoice is expected to state the taxable value and the tax separately —
        and because a customer who can see ₹35.60 of GST inside a ₹198.00 total is
        being told the truth about where their money went.

        Integer paise throughout, with the remainder assigned to SGST so the two halves
        always sum exactly to the tax. Assigning both halves the same floor value is
        the classic bug here: it loses a paisa on every odd-rupee invoice, and a
        receipt whose tax columns do not add up to the tax is a receipt nobody trusts.
      */}
      <TaxBreakdown revenuePaise={order.revenuePaise} rateBp={settings.gstRateBp} />

      <p className="text-ink-muted mt-lg text-xs">
        Prices are inclusive of all taxes. Plants are replaced, not refunded; consumables and
        planters are settled in money within 24 hours. This is a computer-generated invoice and does
        not require a signature.
      </p>
      <p className="text-ink-muted mt-1 text-xs">
        Grievance officer: {settings.grievanceOfficerName || '—'} ·{' '}
        {settings.grievanceOfficerEmail || settings.customerCareEmail} ·{' '}
        {settings.customerCarePhone}
      </p>
    </main>
  )
}

/**
 * Split an inclusive total into taxable value and tax.
 *
 * `taxable = floor(total / (1 + rate))`, then `tax = total - taxable` — the tax is
 * the REMAINDER, not a rounded-up figure, so the three numbers always reconcile.
 * Then the tax is split into CGST and SGST with the odd paisa going to SGST.
 *
 * The rate is a PROP, read from `business_settings.gst_rate_bp`. It used to be
 * read here through a structural cast of `config.business.defaultTaxRateBp` with a
 * hardcoded `?? 1800` — a fifth copy of a number an owner can change in the admin
 * panel, and the one copy that printed on the document an auditor reads.
 */
function TaxBreakdown({ revenuePaise, rateBp }: { revenuePaise: number; rateBp: number }) {
  const taxablePaise = Math.floor((revenuePaise * 10_000) / (10_000 + rateBp))
  const taxPaise = revenuePaise - taxablePaise
  const cgstPaise = Math.floor(taxPaise / 2)
  const sgstPaise = taxPaise - cgstPaise

  return (
    <dl
      className="mt-base m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
      data-testid="tax-breakdown"
    >
      <dt className="text-ink-muted">Taxable value</dt>
      <dd className="m-0">{formatPaise(taxablePaise)}</dd>

      <dt className="text-ink-muted">CGST @ {rateBp / 200}%</dt>
      <dd className="m-0">{formatPaise(cgstPaise)}</dd>

      <dt className="text-ink-muted">SGST @ {rateBp / 200}%</dt>
      <dd className="m-0">{formatPaise(sgstPaise)}</dd>

      <dt className="font-semibold">Total tax</dt>
      <dd className="m-0 font-semibold">{formatPaise(taxPaise)}</dd>
    </dl>
  )
}
