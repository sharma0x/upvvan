import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3100'
const browser = await chromium.launch()
const page = await browser.newPage()
const results = []

async function check(label, pincode, city, expectServiceable, expectText) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('#pincode', pincode)
  await page.selectOption('#city', city)
  await page.click('button[type=submit]')
  await page.waitForSelector('[role=status]', { timeout: 10000 })
  const status = (await page.innerText('[role=status]')).trim()
  const pass = status.includes(expectText)
  results.push({ label, pincode, city, status: status.replace(/\s+/g, ' '), pass })
}

// 1. A pincode we serve, in the live city
await check(
  'serviceable in our city',
  '560001',
  'bengaluru',
  true,
  'Yes — we deliver to 560001 in Bengaluru',
)
// 2. Per-pincode capacity switch (A-07)
await check('pincode switched off', '560048', 'bengaluru', false, 'do not deliver')
// 3. Coverage gap
await check('unknown pincode', '999999', 'bengaluru', false, 'do not deliver')
// 4. The city dropdown only offers cities that are OPEN — a city pending its
//    licence must not be selectable by a customer at all. Asserted directly,
//    because asking the API about a non-open city is not something the UI allows.
await page.goto(BASE, { waitUntil: 'networkidle' })
const options = await page.$$eval('select option', (els) => els.map((e) => e.value))
const hyderabadSelectable = options.includes('hyderabad')
results.push({
  label: 'pending city not selectable',
  status: hyderabadSelectable
    ? 'FAIL: hyderabad appears in the dropdown'
    : `options: ${options.join(', ')}`,
  pass: !hyderabadSelectable,
})

// 5. A Bengaluru pincode is refused when a Bengaluru shopper asks about a
//    pincode we genuinely do not have — the coverage-gap message.
await check('coverage gap message', '560099', 'bengaluru', false, 'do not deliver')

console.log('\n=== BROWSER CLICK-THROUGH (production build) ===')
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.label.padEnd(26)} ${r.pincode} → ${r.status}`)
}

// Screenshot for the record
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('#pincode', '560001')
await page.selectOption('#city', 'bengaluru')
await page.click('button[type=submit]')
await page.waitForSelector('[role=status]')
await page.screenshot({ path: '/tmp/phase0-coverage.png', fullPage: true })
console.log('\nscreenshot: /tmp/phase0-coverage.png')

// Admin panel reachable and serving the Payload app
const admin = await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
console.log('admin status:', admin.status())

const failed = results.filter((r) => !r.pass)
console.log(`\n${failed.length === 0 ? 'ALL BROWSER CHECKS PASSED' : `${failed.length} FAILED`}`)
await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
