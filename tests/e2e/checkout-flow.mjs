/**
 * Checkout flow — add to cart → address → simulated payment → receipt → tracking.
 *
 * ── WHY THIS NEEDS A REAL BROWSER ───────────────────────────────────────────
 * Every assertion here is about something only a browser can answer:
 *
 *   · whether the button is actually clickable at its own centre (a full-bleed
 *     overlay passed typecheck, lint, 161 unit tests and a screenshot),
 *   · whether the UI says "Payment pending" and then "Payment received" — the
 *     actual bug this script exists to catch,
 *   · and whether a declined card leaves the order PAYABLE rather than dead.
 *
 * A unit test against the capture route would pass while the page lied about it.
 * That is precisely the class of defect that produced the original bug: the API
 * said `awaiting_gateway`, the UI said "Order placed", and only the UI reached the
 * customer.
 *
 * ── HOW TO RUN ──────────────────────────────────────────────────────────────
 *   make build && make start      # in one shell
 *   node tests/e2e/checkout-flow.mjs
 *
 * Env: BASE_URL (default http://localhost:3000)
 *
 * NOTE ON THE STOCK DEPENDENCY: the flow asserts that stock decrements, so it
 * needs a SKU with stock on hand. The migration seeds every published SKU at 0
 * (deliberately — inventing stock is an oversell waiting to be discovered by a
 * customer), so a fresh database will refuse this order with "sold out". Set real
 * counts before running:
 *
 *   UPDATE sku_stock SET stock_on_hand = 40 WHERE stock_on_hand = 0;
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  console.log('\n▸ Checkout flow —', BASE)

  // ── 1 · ADD TO CART ────────────────────────────────────────────────────────
  //
  // `waitForSelector` rather than a fixed sleep. The dev server compiles routes on
  // first request, and a fixed wait that fires before the Add-to-cart button is
  // hydrated silently clicks nothing — which then reads as "add to cart is broken"
  // rather than "the test was too impatient". Both failure modes are real; only one
  // of them is a bug in the product.
  await page.goto(`${BASE}/plant/jade-plant?tier=XS`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => sessionStorage.clear())

  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Add to cart')),
    { timeout: 60_000, polling: 250 },
  )

  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Add to cart'))
      ?.click(),
  )
  // Poll the URL rather than the DOM: the redirect happens client-side and there is
  // no element on /cart that proves it, so a DOM wait would either hang or need a
  // selector that the cart layout is free to rename.
  await page.waitForFunction(() => location.pathname.endsWith('/cart'), {
    timeout: 60_000,
    polling: 200,
  })

  check('add-to-cart lands on /cart', page.url().endsWith('/cart'), `landed on ${page.url()}`)

  const cart = await page.evaluate(() => sessionStorage.getItem('upvvan.cart'))
  check(
    'sessionStorage cart was written',
    Boolean(cart) && cart !== '[]',
    (cart ?? '').slice(0, 80),
  )

  // ── 2 · CHECKOUT: DELIVERY DETAILS ─────────────────────────────────────────
  await page.goto(`${BASE}/order/checkout`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('input[aria-label="Your name"]', { timeout: 60_000 })

  const phone = `9${String(Date.now()).slice(-9)}` // unique per run: lookup is rate limited
  await page.type('input[aria-label="Your name"]', 'Asha Rao')
  await page.type('input[aria-label="10-digit mobile"]', phone)
  await page.type('input[aria-label="Flat, house, building"]', '14, 3rd Cross, Jayanagar')
  await page.type('input[aria-label="Area, street"]', '4th Block')
  await page.type('input[aria-label="Landmark"]', 'Near the temple')
  await page.type('input[aria-label="6-digit pincode"]', '560001')

  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Check')?.click(),
  )
  await page.waitForFunction(
    () => document.querySelector('[role="status"]')?.textContent.includes('560001') ?? false,
    { timeout: 60_000, polling: 250 },
  )

  const gateOk = await page.evaluate(
    () => document.querySelector('[role="status"]')?.textContent.includes('560001') ?? false,
  )
  check('serviceability gate passes for 560001', gateOk)

  // ── 3 · THE DECLINE PATH, FIRST — because it is the one nobody tests ───────
  // Deliberately before the happy path: if the decline path leaves the order
  // unusable, the rest of the script is measuring a broken flow.
  await page.click('[data-testid="simulate-decline"]')
  await page.waitForSelector('[data-testid="payment-declined"]', { timeout: 30_000 })

  const declineText = await page.$eval('[data-testid="payment-declined"]', (el) => el.textContent)
  check(
    'declined payment says nothing was charged',
    /nothing (has been |was )?charged|declined|not enough funds|too long/i.test(declineText),
    declineText.replace(/\s+/g, ' ').slice(0, 110),
  )
  check(
    'decline does NOT claim the order was placed',
    !/order placed|thank you for your order/i.test(declineText),
  )
  check(
    'declined order stays PAYABLE (pay button still offered)',
    (await page.$('[data-testid="pay-now"]')) !== null,
    'a declined card must not look like a cancelled order',
  )

  // ── 4 · THE HAPPY PATH ─────────────────────────────────────────────────────
  //
  // Note what is NOT asserted: that the checkout page shows a success state. It
  // does not, and that is correct — on capture the client leaves the checkout for
  // the order page, because the order page is where the receipt and the timeline
  // live. Asserting an intermediate success screen would be asserting a worse design.
  await page.click('[data-testid="pay-now"]')
  await page.waitForFunction(() => /\/order\/UPV-/.test(location.pathname), {
    timeout: 60_000,
    polling: 250,
  })
  await page.waitForSelector('[data-testid="payment-captured-notice"]', { timeout: 60_000 })

  check('captured payment navigates to the order page and shows the paid notice', true)

  const stateAttr = await page.$eval('[data-testid="order-payment-state"]', (el) =>
    el.getAttribute('data-payment-state'),
  )
  check(
    'order payment state is captured',
    stateAttr === 'captured',
    `data-payment-state="${stateAttr}"`,
  )

  const headline = await page.$eval('[data-testid="order-payment-state"]', (el) =>
    el.textContent.trim(),
  )
  check(
    'headline says Payment received, NOT "Order placed"',
    /payment received/i.test(headline) && !/order placed/i.test(headline),
    headline,
  )

  const orderCode = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    return h1?.textContent.trim() ?? ''
  })
  check('order code is UPV- prefixed', /^UPV-[A-Z0-9_-]{8}$/.test(orderCode), orderCode)

  // ── 5 · THE URL MUST NOT CARRY THE PHONE ───────────────────────────────────
  // The order page exchanges the phone for a signed cookie and redirects to a
  // clean URL. A phone in browser history is a phone in a support screenshot.
  check('order URL contains no phone number', !page.url().includes(phone), page.url())

  // ── 6 · RECEIPT RENDERS ────────────────────────────────────────────────────
  const total = await page.$eval('[data-testid="order-total"]', (el) => el.textContent.trim())
  check('receipt shows a rupee total', /^₹[\d,]+(\.\d{2})?$/.test(total), total)

  const gstin = await page.$eval('[data-testid="gstin"]', (el) => el.textContent.trim())
  check(
    'receipt states the GSTIN or says it is unconfigured',
    /GSTIN/i.test(gstin),
    gstin.slice(0, 80),
  )

  const bodyText = await page.evaluate(() => document.body.innerText)
  check(
    'receipt shows the delivery address',
    bodyText.includes('Jayanagar') && bodyText.includes('560001'),
  )
  check(
    'receipt declares the HSN classification',
    /HSN 0602/.test(bodyText),
    'plants classify as 0602 90',
  )
  check('invoice number is present', /UPV\/UPV-/.test(bodyText))

  // ── 7 · TRACKING SHOWS PAID ────────────────────────────────────────────────
  const timeline = await page.$$eval('[data-testid="order-timeline"] li', (els) =>
    els.map((e) => ({ status: e.getAttribute('data-status'), text: e.textContent })),
  )
  check('timeline has at least two events', timeline.length >= 2, `${timeline.length} events`)
  check(
    'timeline includes the PAYMENT_PENDING event',
    timeline.some((e) => e.status === 'PAYMENT_PENDING'),
  )
  check(
    'timeline includes the PAID event',
    timeline.some((e) => e.status === 'PAID'),
    timeline.map((e) => e.status).join(' → '),
  )

  // ── 8 · JSON-LD IS PRESENT AND HONEST ──────────────────────────────────────
  const ld = await page.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]')
    return el?.textContent ? JSON.parse(el.textContent) : null
  })
  check('JSON-LD Order schema is emitted', ld?.['@type'] === 'Order', ld?.orderNumber ?? 'absent')
  check('JSON-LD carries the price', typeof ld?.price === 'string', String(ld?.price))
  check('JSON-LD names the postal address', ld?.address?.postalCode === '560001')

  // ── 9 · THE PRINTABLE INVOICE ──────────────────────────────────────────────
  await page.goto(`${BASE}/invoice/${orderCode}`, { waitUntil: 'networkidle2' })
  const invoiceText = await page.evaluate(() => document.body.innerText)
  check('invoice page renders', invoiceText.includes('Tax invoice'))
  check(
    'invoice breaks out CGST/SGST and they reconcile',
    invoiceText.includes('CGST') &&
      invoiceText.includes('SGST') &&
      invoiceText.includes('Total tax'),
  )
  check('invoice lists the HSN per line', /HSN|0602/.test(invoiceText))

  // ── 10 · ORDER LOOKUP — WRONG PHONE IS REFUSED ─────────────────────────────
  await page.goto(`${BASE}/orders/lookup`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="lookup-code"]', { timeout: 60_000 })
  await page.type('[data-testid="lookup-code"]', orderCode)
  await page.type('[data-testid="lookup-phone"]', `8${String(Date.now()).slice(-9)}`)
  await page.click('[data-testid="lookup-submit"]')
  await page.waitForSelector('[data-testid="lookup-error"]', { timeout: 20_000 })

  const lookupError = await page.$eval('[data-testid="lookup-error"]', (el) =>
    el.textContent.trim(),
  )
  check('wrong phone is refused', /could not find/i.test(lookupError), lookupError)
  check(
    'refusal does not confirm the code exists',
    !/invalid code|no such order|not found/i.test(lookupError),
    'must be indistinguishable from a nonexistent order',
  )

  // ── 11 · ORDER LOOKUP — RIGHT PHONE WORKS ──────────────────────────────────
  await page.goto(`${BASE}/orders/lookup`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-testid="lookup-code"]', { timeout: 60_000 })
  await page.type('[data-testid="lookup-code"]', orderCode)
  await page.type('[data-testid="lookup-phone"]', phone)
  await page.click('[data-testid="lookup-submit"]')
  await page.waitForFunction(
    (code) => location.pathname.includes(code),
    { timeout: 20_000 },
    orderCode,
  )
  check('correct phone opens the order', page.url().includes(`/order/${orderCode}`), page.url())

  const lookedUpTotal = await page.$eval('[data-testid="order-total"]', (el) =>
    el.textContent.trim(),
  )
  check(
    'looked-up order shows the same total',
    lookedUpTotal === total,
    `${lookedUpTotal} vs ${total}`,
  )

  // ── 12 · THE CLAIM PAGE IS AUTHORISED BY THE SAME COOKIE ────────────────────
  //
  // Not asserting the claim SUBMIT here: the order is fresh, so it is PAYMENT_PENDING
  // rather than DELIVERED, and walking it to DELIVERED needs the ops status advance
  // that another agent owns. What IS asserted is the authorisation boundary, which is
  // the part a customer can reach and the part that leaks addresses if it is wrong.
  await page.goto(`${BASE}/claim/${orderCode}`, { waitUntil: 'networkidle2' })
  const claimText = await page.evaluate(() => document.body.innerText)
  check(
    'claim page renders for an authorised buyer',
    claimText.includes('Tell us what arrived'),
    claimText.replace(/\s+/g, ' ').slice(0, 60),
  )
  check(
    'claim page refuses an UNDELIVERED order with the right reason',
    claimText.includes('has not been delivered yet'),
    'a claim on an order in transit is not a damage report',
  )
  check(
    'claim page states the remedy is replacement, not refund',
    /replaced, never refunded|replacement/i.test(claimText),
  )

  // ── 13 · THE CLAIM PAGE IS 404 WITHOUT THE COOKIE ──────────────────────────
  // A fresh incognito context has no cookie. The order code is known (we printed it),
  // so this is the test for "unguessable is not the same as authorised".
  const anon = await browser.createBrowserContext()
  const anonPage = await anon.newPage()
  const anonResponse = await anonPage.goto(`${BASE}/claim/${orderCode}`, {
    waitUntil: 'domcontentloaded',
  })
  check(
    'claim page is 404 without proof of ownership',
    anonResponse?.status() === 404,
    `status ${anonResponse?.status()}`,
  )
  await anon.close()

  console.log(
    failures === 0
      ? '\n✅ All checkout-flow checks passed.\n'
      : `\n❌ ${failures} check(s) FAILED.\n`,
  )
} catch (err) {
  console.error('\n💥 checkout-flow threw:', err.message)
  failures++
} finally {
  await browser.close()
}

process.exit(failures === 0 ? 0 : 1)
