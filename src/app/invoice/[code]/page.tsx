import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { formatPaise } from '@/lib/catalogue/pricing'
import { config } from '@/lib/config'
import { db, loadOrderVerified, normaliseCode } from '@/lib/orders/db'
import { hsnFor, taxInvoice } from '@/lib/orders/invoice'
import { orderCookieName, verifyOrderSignature } from '@/lib/orders/cookie'
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
 * The signed cookie, same as the order page. This page renders an address and a
 * GSTIN-bearing invoice; it is not linkable.
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
  const signature = jar.get(orderCookieName(normalised))?.value
  if (!signature || !verifyOrderSignature(normalised, signature)) notFound()

  const found = await loadOrderVerified(db(), normalised)
  if (!found) notFound()

  const { order, items } = found
  const invoice = taxInvoice(order.orderCode)

  return (
    <main className="mx-auto max-w-[720px] px-base py-2xl">
      <PrintButton invoiceNumber={invoice.invoiceNumber} />

      <header className="border-border mt-4 border-b pb-base">
        <h1 className="mt-0 mb-1">Tax invoice</h1>
        <p className="m-0 text-sm">
          <strong>{config.compliance.legalEntityName || 'Upvvan'}</strong>
          <br />
          {config.compliance.principalAddress}
          <br />
          {invoice.gstinMissing ? (
            <span className="text-warning">
              GSTIN not configured — set GSTIN in the environment before issuing this invoice.
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
      <TaxBreakdown revenuePaise={order.revenuePaise} />

      <p className="text-ink-muted mt-lg text-xs">
        Prices are inclusive of all taxes. Plants are replaced, not refunded; consumables and planters
        are settled in money within 24 hours. This is a computer-generated invoice and does not
        require a signature.
      </p>
      <p className="text-ink-muted mt-1 text-xs">
        Grievance officer: {config.compliance.grievanceOfficerName || '—'} ·{' '}
        {config.compliance.grievanceOfficerEmail || config.compliance.customerCareEmail} ·{' '}
        {config.compliance.customerCarePhone}
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
 */
function TaxBreakdown({ revenuePaise }: { revenuePaise: number }) {
  // config.business.defaultTaxRateBp is 1800 = 18%. Read through the same cast the
  // invoice module uses, because config.ts is owned elsewhere and the key may not be
  // present yet.
  const rateBp = (
    config as unknown as { business?: { defaultTaxRateBp?: number } }
  ).business?.defaultTaxRateBp ?? 1800

  const taxablePaise = Math.floor((revenuePaise * 10_000) / (10_000 + rateBp))
  const taxPaise = revenuePaise - taxablePaise
  const cgstPaise = Math.floor(taxPaise / 2)
  const sgstPaise = taxPaise - cgstPaise

  return (
    <dl className="mt-base m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="tax-breakdown">
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
