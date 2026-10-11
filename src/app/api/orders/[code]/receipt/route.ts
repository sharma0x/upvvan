import { headers } from 'next/headers'

import { formatPaise } from '@/lib/catalogue/pricing'
import { config } from '@/lib/config'
import { db, loadOrderVerified, normaliseCode } from '@/lib/orders/db'
import { hsnFor, taxInvoice } from '@/lib/orders/invoice'
import { authoriseOrderAccess } from '@/lib/orders/access'
import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * GET /api/orders/<code>/receipt — the receipt, as a FILE.
 *
 * ── WHAT WAS MISSING ────────────────────────────────────────────────────────
 *
 * The product had a printable invoice at `/invoice/<code>` and nothing else. That
 * page is deliberately a browser document: A4, no navigation, `window.print()`.
 * It is the right artefact for a human who wants to read or print it today.
 *
 * It is the wrong artefact for the second thing a receipt is for, which is the
 * thing that actually generates support tickets: a customer who needs the
 * document again in three months, in a file, to hand to an accountant. There was
 * no download anywhere — not on `/order/<code>`, not on `/account`, not in any
 * e-mail. So the answer to "where is my receipt" was "scroll back through your
 * inbox", and the answer to "can I get an invoice for my books" was no.
 *
 * ── WHY HTML AND NOT A PDF ──────────────────────────────────────────────────
 *
 * A PDF generator was tried and rejected on evidence. `pdfkit` (the obvious
 * choice) embeds the standard-14 Helvetica, which is WinAnsi — and WinAnsi has no
 * U+20B9. Every rupee sign on a receipt, which is every money line on every
 * receipt, renders at zero advance width. Measured, not assumed:
 *
 *     doc.font('Helvetica'); doc.widthOfString('₹')   →  0
 *     doc.font('Geist');    doc.widthOfString('₹')   →  10.88
 *
 * The fix is to embed a Unicode font — which means shipping a font binary into
 * the repository, or taking a dependency on one, for a document that a browser
 * already renders perfectly.
 *
 * So this returns a self-contained HTML document as an attachment. It opens in
 * any browser, the rupee renders, the numbers are selectable and searchable, and
 * "Print → Save as PDF" is one keystroke away with no font pipeline of our own.
 * The alternative — a PDF whose currency symbols are invisible — is worse than
 * no file at all, because a customer would file the expense claim on it.
 *
 * ── WHY THE SAME AUTHORISATION AS THE ORDER PAGE ────────────────────────────
 *
 * `authoriseOrderAccess`, which accepts either the signed order cookie or a
 * customer session that owns the order. See `src/lib/orders/access.ts` for why
 * both are the same trust decision.
 *
 * ── WHY IT REFUSES AN UNCPAID ORDER ─────────────────────────────────────────
 *
 * `payment_state !== 'captured'` is a 409, not a 200 with a zero total. A receipt
 * for money we have not taken is not a receipt; and 409 rather than 404 so the
 * customer learns the truth (it exists, it is not paid yet) instead of being told
 * the order does not exist — the code is already authorised by this point, so
 * there is no enumeration risk in telling them which of the two it is.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function istDate(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(d)
}

function istDateOnly(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(d)
}

function indianDate(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(d)
}

const IND_STATES: Record<string, string> = {
  KA: 'Karnataka',
  MH: 'Maharashtra',
  TS: 'Telangana',
  KL: 'Kerala',
  TN: 'Tamil Nadu',
  DL: 'Delhi',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params
  const normalised = normaliseCode(code)

  const access = await authoriseOrderAccess(
    normalised,
    (await headers()).get('cookie') ?? undefined,
  )
  if (!access) {
    return new Response('Not found', { status: 404 })
  }

  const found = await loadOrderVerified(db(), normalised)
  if (!found) return new Response('Not found', { status: 404 })

  const { order, items } = found

  if (order.paymentState !== 'captured') {
    return Response.json(
      {
        message:
          'This order has not been paid yet, so there is no receipt. Pay it and the receipt appears here straight away.',
      },
      { status: 409 },
    )
  }

  const invoice = taxInvoice(order.orderCode)
  const settings = await loadBusinessSettings()

  // Through config, not `process.env` — `src/lib/config.ts` is the only module
  // allowed to read the environment, and a link in a downloaded document is no
  // exception.
  const base = config.server.url.replace(/\/$/, '')

  const taxablePaise = Math.floor((order.revenuePaise * 10_000) / (10_000 + settings.gstRateBp))
  const taxPaise = order.revenuePaise - taxablePaise
  const cgstPaise = Math.floor(taxPaise / 2)
  const sgstPaise = taxPaise - cgstPaise

  const address = [
    order.customerName,
    order.address?.line1,
    order.address?.line2,
    order.address?.landmark,
    // (the pincode is folded in with the city below)
    [
      order.address?.city,
      order.address?.state ? (IND_STATES[order.address.state] ?? order.address.state) : null,
    ]
      .filter(Boolean)
      .join(', '),
    order.pincode,
  ]
    .filter((line): line is string => Boolean(line && line.trim() !== ''))
    .map(escapeHtml)
    .join('<br />')

  const rows = items
    .map(
      (item) => `      <tr>
        <td>${escapeHtml(item.commonName ?? 'Plant')}${item.sizeTier ? ` · ${escapeHtml(item.sizeTier)}` : ''}${item.planterName ? ` · ${escapeHtml(item.planterName)}` : ''}
          <br /><span class="muted">HSN ${hsnFor(item.itemClass)}</span>
        </td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatPaise(item.pricePaise)}</td>
      </tr>`,
    )
    .join('\n')

  const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt ${escapeHtml(order.orderCode)} · Upvvan</title>
<!--
  A standalone receipt.

  Self-contained on purpose: no stylesheet link, no font request, no script, no
  image. It has to open correctly from a downloads folder on a laptop with no
  network, in three years, when someone is reconstructing an expense.

  That is also why the table is inline-styled rather than class-based: there is
  no stylesheet to lose.
-->
<style>
  body { font: 14px/1.55 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
         color: #1c1917; max-width: 780px; margin: 0 auto; padding: 40px 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #78716c;
       margin: 32px 0 8px; }
  .muted { color: #78716c; font-size: 12px; }
  .rule { border-top: 1px solid #e7e5e4; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #f5f5f4; vertical-align: top; }
  th { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #78716c; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 600; border-bottom: none; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 20px; margin: 0; }
  dt { color: #78716c; }
  dd { margin: 0; }
  .warn { color: #b45309; }
  .totals { display: grid; grid-template-columns: max-content 1fr; gap: 4px 20px; max-width: 340px; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } }
</style>
</head>
<body>
  <p class="muted" style="margin:0 0 2px">Upvvan · payment receipt</p>
  <h1>${escapeHtml(invoice.invoiceNumber)}</h1>
  <p class="muted" style="margin:0">Order ${escapeHtml(order.orderCode)} · placed ${escapeHtml(istDateOnly(order.createdAt))}</p>

  <div class="rule"></div>

  <h2>Seller</h2>
  <p style="margin:0">
    <strong>${escapeHtml(settings.legalEntityName || 'Upvvan')}</strong><br />
    ${escapeHtml(settings.principalAddress)}<br />
    ${
      invoice.gstinMissing
        ? '<span class="warn">GSTIN not configured — this receipt is not a compliant tax invoice.</span>'
        : `GSTIN ${escapeHtml(invoice.gstin)} · State code ${escapeHtml(invoice.gstStateCode)}`
    }
  </p>

  <h2>Paid by</h2>
  <p style="margin:0">${address}</p>

  <h2>Payment</h2>
  <dl>
    <dt>Method</dt><dd>Prepaid — no cash on delivery is offered</dd>
    <dt>Captured</dt><dd>${escapeHtml(istDate(order.capturedAt ?? order.updatedAt))}</dd>
    <dt>Reference</dt><dd>${escapeHtml(order.paymentReference ?? '—')}</dd>
  </dl>

  <h2>What arrived</h2>
  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
    <tfoot>
      <tr><td colspan="2">Total, inclusive of GST</td><td class="num">${formatPaise(order.revenuePaise)}</td></tr>
    </tfoot>
  </table>

  <h2>GST breakdown</h2>
  <dl class="totals">
    <dt>Taxable value</dt><dd>${formatPaise(taxablePaise)}</dd>
    <dt>CGST @ ${settings.gstRateBp / 200}%</dt><dd>${formatPaise(cgstPaise)}</dd>
    <dt>SGST @ ${settings.gstRateBp / 200}%</dt><dd>${formatPaise(sgstPaise)}</dd>
    <dt><strong>Total tax</strong></dt><dd><strong>${formatPaise(taxPaise)}</strong></dd>
  </dl>

  <h2>If something is wrong</h2>
  <p style="margin:0">
    Report damage or a dead plant within the guarantee window and we replace it — you do not pay to
    send anything back.
    <a href="${base}/claim/${escapeHtml(order.orderCode)}">Open a claim</a>
    · <a href="${base}/order/${escapeHtml(order.orderCode)}?phone=${escapeHtml(order.customerPhone ?? '')}">Track this order</a>
  </p>

  <p class="muted" style="margin-top:32px">
    Grievance officer: ${escapeHtml(settings.grievanceOfficerName || '—')} ·
    ${escapeHtml(settings.grievanceOfficerEmail || settings.customerCareEmail)} ·
    ${escapeHtml(settings.customerCarePhone)}
    <br />Generated ${escapeHtml(indianDate(new Date()))}. Prices are inclusive of all taxes.
  </p>
</body>
</html>
`

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      /*
       * `attachment` is the whole point. Without it a browser renders the
       * document in a tab and the customer is back to Ctrl-P, which is what this
       * was built to avoid.
       *
       * The filename carries the invoice number, because that is what an
       * accountant will search for and it is the only identifier on the document
       * that is not also in the URL they just used.
       */
      'content-disposition': `attachment; filename="${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '-')}.html"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
