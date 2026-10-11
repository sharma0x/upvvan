/**
 * Accessibility regression checks.
 *
 * ── WHY THIS IS A BROWSER SCRIPT AND NOT A VITEST FILE ────────────────────────
 * Every assertion here needs layout and computed style, which jsdom does not
 * provide: jsdom has no box model, so `getBoundingClientRect()` returns zeroes
 * and a tap-target check against it is meaningless. Contrast needs real cascade
 * resolution too. So this runs in Chrome.
 *
 * ── WHAT EACH CHECK IS ACTUALLY FOR ───────────────────────────────────────────
 *
 *  1. Tap targets ≥ 24px (WCAG 2.2 SC2.5.8). Measured at 390px because that is
 *     where the failures were: header links were 20px, footer links 17px. Under
 *     the floor and a real reason a thumb misses them.
 *
 *  2. Skip link present and `<main>` focusable. `tabIndex={-1}` on `<main>` is the
 *     part people forget — an anchor to `#main` scrolls but leaves focus on the
 *     link, so the next Tab walks the header again and the skip link achieves
 *     nothing for keyboard users.
 *
 *  3. Every image has a non-empty alt.
 *
 *  4. Every page has exactly one h1.
 *
 * ── RUN ───────────────────────────────────────────────────────────────────────
 *   make start                        # one shell
 *   node tests/e2e/a11y.mjs           # another
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const PAGES = ['/', '/cart', '/policies', '/grievance']

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage()

  // ── Tap targets at mobile width ────────────────────────────────────────────
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })

  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })

    const small = await page.evaluate(() => {
      const MIN = 24
      const out = []
      for (const el of document.querySelectorAll('a[href], button, input, select')) {
        const r = el.getBoundingClientRect()
        // Zero-size elements are hidden (display:none) — not a tap-target failure.
        if (r.width === 0 || r.height === 0) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') continue
        // The skip link is intentionally off-screen until focused.
        if (el.classList.contains('sr-only')) continue

        if (r.height < MIN || r.width < MIN) {
          out.push({
            text: (el.textContent || el.value || el.tagName).trim().slice(0, 32),
            tag: el.tagName.toLowerCase(),
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
        }
      }
      return out
    })

    check(
      `${path} — tap targets ≥ 24px at 390px`,
      small.length === 0,
      small.length
        ? small.map((s) => `<${s.tag}> "${s.text}" ${s.w}x${s.h}`).join(', ')
        : 'all pass',
    )
  }

  // ── Skip link + focusable main ──────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })

  const skip = await page.evaluate(() => {
    const link = document.querySelector('a[href="#main"]')
    const main = document.getElementById('main')
    return {
      linkExists: !!link,
      mainExists: !!main,
      // The critical bit: without tabindex=-1 the anchor scrolls but focus stays put.
      mainFocusable: main ? main.getAttribute('tabindex') === '-1' : false,
      linkText: link?.textContent?.trim() ?? null,
    }
  })

  check('skip link exists', skip.linkExists, skip.linkText ?? 'missing')
  check('<main id="main"> exists', skip.mainExists)
  check('<main> is focusable (tabindex=-1)', skip.mainFocusable)

  // Actually activate the skip link and confirm focus MOVES, not just scrolls.
  await page.keyboard.press('Tab')
  const focusedFirst = await page.evaluate(() => document.activeElement?.textContent?.trim())
  await page.keyboard.press('Enter')
  await new Promise((r) => setTimeout(r, 250))
  const focusedAfter = await page.evaluate(() => ({
    tag: document.activeElement?.tagName?.toLowerCase() ?? null,
    isMain: document.activeElement?.id === 'main',
  }))
  check(
    'activating skip link moves focus into <main>',
    focusedAfter.isMain,
    `first Tab landed on "${focusedFirst}", after Enter focus is <${focusedAfter.tag}>`,
  )

  // ── Per-page: alts and h1 count ─────────────────────────────────────────────
  for (const path of ['/', '/plant/money-plant?tier=XS', ...PAGES.slice(1)]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })

    const doc = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')]
      return {
        imgs: imgs.length,
        noAlt: imgs.filter((i) => !i.getAttribute('alt')?.trim()).length,
        h1: document.querySelectorAll('h1').length,
        title: document.title,
      }
    })

    check(`${path} — every img has alt`, doc.noAlt === 0, `${doc.imgs} imgs, ${doc.noAlt} without`)
    check(`${path} — exactly one h1`, doc.h1 === 1, `found ${doc.h1}`)
    check(`${path} — has a <title>`, Boolean(doc.title), doc.title || 'EMPTY')
  }

  // ── Catalogue imagery renders at a real size ────────────────────────────────
  //
  // Added after every product photograph on the homepage collapsed to a 1x1 box
  // and the grid looked like it had no photography at all. This is the third
  // time in this codebase that a ZERO-SIZE rendered element passed every
  // automated gate:
  //
  //   · the PDP photo missing `relative`   → images positioned against the viewport
  //   · this card wrapper missing `w-full`  → images painted into a 1px flex box
  //   · both would have been caught only by measuring a rendered box
  //
  // None of them are type errors, lint errors, build failures, or failing unit
  // tests. An `<img>` with `complete && naturalWidth > 0` is TRUE for an image
  // that is being painted into a 1-pixel div. Nothing short of geometry catches
  // this class of bug, which is why this assertion exists.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })

  /*
   * Scroll the WHOLE page, not just to the catalogue, and wait for images to
   * settle. The catalogue cards are `loading="lazy"`, so a single scrollIntoView
   * leaves most of them unfetched and `complete` is false — which is why an
   * earlier version of this check reported "4/12 downloaded" on a perfectly
   * healthy page. Asserting on lazy state measures the test harness, not the
   * product.
   */
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
    // Wait until no image is still in flight.
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const imgs = [...document.querySelectorAll('#catalogue img')]
      if (imgs.length && imgs.every((i) => i.complete)) break
      await new Promise((r) => setTimeout(r, 100))
    }
  })
  await new Promise((r) => setTimeout(r, 400))

  const art = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#catalogue img')]
    const sizes = imgs.map((i) => {
      const r = i.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })
    return {
      count: imgs.length,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      collapsed: sizes.filter((s) => s.w < 100 || s.h < 100).length,
      sample: sizes.slice(0, 3),
    }
  })

  check('catalogue has images', art.count > 0, `${art.count} img tags`)
  check('every catalogue image downloaded', art.loaded === art.count, `${art.loaded}/${art.count}`)
  check(
    'every catalogue image RENDERS at a real size (not collapsed)',
    art.collapsed === 0,
    `${art.collapsed} collapsed; sample ${JSON.stringify(art.sample)}`,
  )

  console.log(
    failures === 0
      ? '\n✅ All accessibility checks passed.\n'
      : `\n❌ ${failures} check(s) FAILED.\n`,
  )
} finally {
  await browser.close()
}

process.exit(failures === 0 ? 0 : 1)
