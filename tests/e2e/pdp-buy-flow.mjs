/**
 * PDP buy-flow regression test.
 *
 * ── WHY THIS TEST EXISTS AND WHY IT NEEDS A REAL BROWSER ──────────────────────
 * This suite was written after a bug that every other gate missed.
 *
 * The bug: `next/image` with `fill` emits `position:absolute; inset:0`, which
 * positions against the nearest POSITIONED ancestor. The PDP's photo wrapper had
 * `overflow-hidden` and `aspect-[4/3]` but no `relative`, so the product photo
 * positioned against the viewport instead — rendering as a 1440x900 overlay
 * across the whole page, on top of the Add to cart button.
 *
 * What every other gate reported about that bug:
 *
 *   · `tsc --noEmit`      → clean. There is no type error in "missing relative".
 *   · `eslint`            → clean. It is not a lintable defect.
 *   · `next build`        → succeeded.
 *   · 161 unit tests      → passed.
 *   · a screenshot        → looked CORRECT, because `overflow-hidden` on the
 *                           static wrapper still visually clipped the image to
 *                           the right box. The damage was purely interactive.
 *
 * Only two things expose it: a real hit test (`document.elementFromPoint`) and an
 * actual click that changes state. Both need a browser, which is why this is a
 * Puppeteer script driven against a running server rather than a vitest file.
 *
 * ── HOW TO RUN ────────────────────────────────────────────────────────────────
 *   make start                      # in one shell
 *   node tests/e2e/pdp-buy-flow.mjs # in another
 *
 * Env: BASE_URL (default http://localhost:3000)
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

  console.log('\n▸ PDP buy flow —', BASE)

  await page.goto(`${BASE}/plant/jade-plant?tier=XS`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => sessionStorage.clear())

  // ── 1. The photo must be clipped to its wrapper, not the viewport ────────────
  const containment = await page.evaluate(() => {
    // Match on the aspect-ratio class ALONE, then take the image from within it.
    // The earlier version also required `d.querySelector('img')` on the same
    // element, which silently matched nothing once the wrapper and its child
    // were split differently — and a test that finds nothing reports "the wrapper
    // does not exist", which reads as a product bug rather than a stale selector.
    const wrap = [...document.querySelectorAll('div')].find((d) =>
      /aspect-\[/.test(d.className ?? ''),
    )
    const img = wrap?.querySelector('img')
    if (!wrap || !img) return { found: false }
    const wr = wrap.getBoundingClientRect()
    const ir = img.getBoundingClientRect()
    return {
      found: true,
      position: getComputedStyle(wrap).position,
      imgW: Math.round(ir.width),
      imgH: Math.round(ir.height),
      wrapW: Math.round(wr.width),
      wrapH: Math.round(wr.height),
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
    }
  })

  check('photo wrapper exists', containment.found)
  check(
    'photo wrapper is positioned (relative)',
    containment.position === 'relative',
    `computed position: ${containment.position}`,
  )
  check(
    'photo is NOT viewport-sized',
    containment.imgW < containment.viewportW / 2,
    `img ${containment.imgW}x${containment.imgH} vs viewport ${containment.viewportW}x${containment.viewportH}`,
  )

  // ── 2. Nothing may cover the Add to cart button ────────────────────────────
  const hitTest = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Add to cart'),
    )
    if (!btn) return { found: false }
    btn.scrollIntoView({ block: 'center' })
    const r = btn.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return {
      found: true,
      topTag: top?.tagName ?? 'null',
      reachable: top === btn || btn.contains(top),
    }
  })

  check('add-to-cart button found', hitTest.found)
  check(
    'add-to-cart is the topmost element at its own centre',
    hitTest.reachable,
    `topmost was <${hitTest.topTag.toLowerCase()}>`,
  )

  // ── 3. The click must actually work end to end ──────────────────────────────
  const before = await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add to cart'))
      ?.textContent.trim(),
  )

  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add to cart')).click(),
  )
  await new Promise((r) => setTimeout(r, 1200))

  const url = page.url()
  const cart = await page.evaluate(() => sessionStorage.getItem('upvvan.cart'))

  check('add-to-cart navigates to /cart', url.endsWith('/cart'), `landed on ${url}`)
  check('sessionStorage cart was written', Boolean(cart) && cart !== '[]', cart ?? 'null')

  // ── 4. Planter selection must move the price ────────────────────────────────
  await page.goto(`${BASE}/plant/jade-plant?tier=XS`, { waitUntil: 'networkidle2' })
  const prices = await page.evaluate(async () => {
    const label = () =>
      [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add to cart'))
        ?.textContent.trim()
    const pots = [...document.querySelectorAll('fieldset button')]
    const start = label()
    pots[1]?.click()
    await new Promise((r) => setTimeout(r, 300))
    return { start, after: label(), potCount: pots.length }
  })

  check(
    'selecting a planter updates the price',
    prices.start !== prices.after,
    `${prices.start} → ${prices.after}`,
  )

  console.log(
    failures === 0
      ? '\n✅ All PDP buy-flow checks passed.\n'
      : `\n❌ ${failures} check(s) FAILED.\n`,
  )
} finally {
  await browser.close()
}

process.exit(failures === 0 ? 0 : 1)