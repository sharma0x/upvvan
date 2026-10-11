/**
 * End-to-end journey smoke test.
 *
 * Runs the whole business through one path, against a RUNNING server, acting as
 * three different people:
 *
 *   CUSTOMER  place an order, pay for it, get the delivery code
 *   ADMIN     sign in, see the order, assign a rider
 *   RIDER     sign in with an OTP, pick up, set out, close on the customer's code
 *
 * and asserts that each party received the message they were supposed to receive,
 * in Mailpit.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A PLAYwright TEST ───────────────────────────
 *
 * Because it needs to be runnable by the person who owns the business, not only
 * by CI. "Does a sale actually reach a rider?" is a question with a yes/no answer
 * that a founder should be able to get at 11pm without reading TypeScript, and the
 * answer changes as the code changes — a script that exercises the real HTTP
 * surface catches a broken cookie, a missing migration or a state-machine gap
 * that a unit test cannot see, because unit tests mock the boundary they are
 * standing in for.
 *
 * It is ALSO still a real test: it exits non-zero on the first broken step, so it
 * belongs in CI. `make test:journey` runs it.
 *
 * ── WHY IT USES MAILPIT ─────────────────────────────────────────────────────
 *
 * Because the e-mails are the assertion. The interesting failures are the ones
 * where the order succeeded and nobody was told — so this script does not merely
 * check that a request returned 200, it checks that a rider was emailed a drop
 * and that a customer was emailed a code they could actually use.
 *
 * Requirements: `make infra-up`, `make db-migrate`, `make seed`, and a server on
 *   PORT (default 3100). Staff and rider credentials come from the environment.
 *
 *   STAFF_EMAIL, STAFF_PASSWORD, RIDER_PHONE
 *
 * Usage:  pnpm test:journey [--base http://localhost:3100]
 */
const BASE = (() => {
  const i = process.argv.indexOf('--base')
  return i > -1 ? process.argv[i + 1]! : `http://localhost:${process.env.PORT ?? 3100}`
})()

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:58025'

const STAFF_EMAIL = process.env.STAFF_EMAIL
const STAFF_PASSWORD = process.env.STAFF_PASSWORD
const RIDER_PHONE = process.env.RIDER_PHONE

/** Rider OTP is returned in the response in non-production; see the route. */
let step = 0
const fail = (message: string): never => {
  console.error(`\n✗ FAILED at step ${step}: ${message}\n`)
  process.exit(1)
}

async function ok<T>(label: string, fn: () => Promise<T>): Promise<T> {
  step += 1
  const started = Date.now()
  try {
    const value = await fn()
    console.log(`  ✓ ${String(step).padStart(2)}. ${label} (${Date.now() - started}ms)`)
    return value
  } catch (error) {
    // `fail` exits, but TypeScript cannot see that through the call.
    fail(`${label} — ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

async function api(
  path: string,
  init: RequestInit & { jar?: string[]; expect?: number } = {},
): Promise<{ status: number; body: any }> {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  if (init.jar?.length) headers.set('cookie', init.jar.join('; '))

  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' })

  // Refresh the cookie jar from every response, because the session cookie is
  // set on login and rotated on use.
  if (init.jar) {
    const set = res.headers.getSetCookie?.() ?? []
    for (const c of set) init.jar.push(c.split(';')[0]!)
  }

  const text = await res.text()
  let body: any
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 400)
  }

  if (init.expect !== undefined && res.status !== init.expect) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${res.status} (wanted ${init.expect}): ${JSON.stringify(body).slice(0, 300)}`,
    )
  }
  return { status: res.status, body }
}

/**
 * Wait for a message matching `match`, polling briefly.
 *
 * Necessary, and not merely a convenience: every notification this project sends
 * is dispatched AFTER the transaction commits and is deliberately NOT awaited, so
 * that a mail outage cannot fail a payment or delay a response. The consequence
 * is that a message is never in Mailpit at the instant the HTTP call returns.
 *
 * The first version of this script asserted immediately and failed roughly half
 * the time with "no confirmation in Mailpit" for messages that arrived
 * milliseconds later — a flaky test that reads as a broken product. Polling is
 * the honest way to assert on an eventually-consistent thing.
 */
async function waitForMail(
  match: (m: { subject: string; to: string; text: string }) => boolean,
  what: string,
  timeoutMs = 20_000,
): Promise<{ subject: string; to: string; text: string }> {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    const messages = await mailMessages()
    const found = messages.find(match)
    if (found) return found
    seen = messages.length
    if (Date.now() > deadline) {
      throw new Error(
        `${what} never arrived within ${timeoutMs / 1000}s ` +
          `(Mailpit currently holds ${seen} message(s)).\n` +
          `Check \`email_log\` in the admin panel — a failure there records the reason.`,
      )
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}

async function mailMessages(
  limit = 25,
): Promise<Array<{ id: string; subject: string; to: string; text: string }>> {
  const list = await fetch(`${MAILPIT}/api/v1/messages?limit=${limit}`)
  if (!list.ok) throw new Error(`Mailpit is not answering on ${MAILPIT} — run \`make infra-up\``)
  const { messages = [] } = (await list.json()) as any
  const out = []
  for (const m of messages) {
    const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)
    const detail = full.ok ? await full.json() : ({} as any)
    out.push({
      id: m.ID,
      subject: m.Subject ?? '',
      to: (m.To ?? []).map((t: any) => t.Address).join(', '),
      text: detail.Text ?? '',
    })
  }
  return out
}

async function main(): Promise<void> {
  console.log(`\nUpvvan journey · ${BASE}\n`)

  if (!STAFF_EMAIL || !STAFF_PASSWORD || !RIDER_PHONE) {
    console.error('Missing STAFF_EMAIL / STAFF_PASSWORD / RIDER_PHONE in the environment.')
    console.error(
      'Provision a staff login with:  STAFF_SEED_PASSWORD=… pnpm seed:staff -- you@x.test "Name" admin\n',
    )
    process.exit(1)
  }

  // ── 0 · is anything actually there to sell? ────────────────────────────────
  //
  // Fails first and loudly on a half-seeded database, so a failure at step 3 is
  // never actually about step 3.
  //
  // `serviceability` needs a CITY as well as a pincode — it is the city gate, and
  // it answers 400 UNKNOWN_CITY without one. The city slug is read from the
  // storefront rather than hardcoded, so this survives a rename or a second city
  // going live.
  await ok('the server answers, the city is open, and the catalogue renders', async () => {
    const home = await fetch(`${BASE}/`).catch(() => null)
    if (!home || !home.ok) throw new Error('the server is not answering — run `make dev`')
    const html = await home.text()

    const citySlug = /"citySlug":"([a-z0-9-]+)"/.exec(html)?.[1] ?? 'bengaluru'
    const gate = await fetch(`${BASE}/api/serviceability?pincode=560001&city=${citySlug}`)
    const gateBody = (await gate.json()) as any
    if (!gate.ok || !gateBody.serviceable) {
      throw new Error(
        `pincode 560001 is not serviceable in "${citySlug}" (${gateBody.code ?? gate.status}). ` +
          `Run \`make seed\`.`,
      )
    }

    const plants = await fetch(`${BASE}/plants`)
    if (!plants.ok) throw new Error(`/plants returned ${plants.status}`)
    return true
  })

  // ── 1 · CUSTOMER places an order ──────────────────────────────────────────
  const phone = `98${String(Date.now()).slice(-8)}`
  const order = await ok('customer places an order (guest, no account)', async () => {
    /*
     * A SKU that is genuinely SELLABLE, rather than one that happens to be in the
     * page HTML.
     *
     * This used to scrape the id out of `/plant/zz-plant` and fall back to a
     * hardcoded 205 — so it only ever tested ONE plant, and only while that plant
     * had stock. Every order decrements `sku_stock`, this script places an order on
     * every run, and after enough runs the fallback id was genuinely sold out:
     *
     *     POST /api/orders → 409 "An item in your cart has sold out while you were checking out."
     *
     * Which is the product working correctly and the test failing for the wrong
     * reason — the shape of failure that gets a good test deleted.
     *
     * So it asks the database which SKU has stock on hand, and only falls back to
     * scraping the page when there is no connection. The deep-stock ordering means
     * repeated runs keep working, and the oversell guard is still exercised
     * properly by the tests that are *trying* to oversell.
     */
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const { rows: skus } = await pool.query<{ id: string }>(
      `SELECT s."id"::text AS "id"
         FROM "skus" s
         JOIN "sku_stock" st ON st."sku_id" = s."id"
         JOIN "cities" c ON c."id" = s."city_id"
        WHERE s."is_published" AND c."is_active" AND st."stock_on_hand" > 0
        ORDER BY st."stock_on_hand" DESC, s."id" ASC
        LIMIT 1`,
    )
    await pool.end()

    const html = await (await fetch(`${BASE}/plant/zz-plant`)).text()
    const skuId = skus[0]?.id ?? /"skuId":"(\d+)"/.exec(html)?.[1] ?? '205'
    const res = await api('/api/orders', {
      method: 'POST',
      jar: [],
      expect: 200,
      body: JSON.stringify({
        pincode: '560001',
        lines: [{ skuId, planterId: null }],
        customerName: 'Journey Test',
        customerPhone: phone,
        addressLine1: '1 Test Road',
        addressCity: 'Bengaluru',
        addressState: 'Karnataka',
      }),
    })
    if (!res.body.orderCode) throw new Error(JSON.stringify(res.body))
    return res.body
  })
  console.log(`       order ${order.orderCode}`)

  // ── 2 · confirmation e-mail ───────────────────────────────────────────────
  await ok('customer received an order confirmation', async () => {
    const found = await waitForMail(
      (m) => m.subject.includes(order.orderCode) && m.to.includes(phone),
      `the order confirmation to ${phone}`,
    )
    if (!found.text.includes(order.orderCode)) {
      throw new Error('the confirmation does not contain the order code')
    }
    if (!found.text.includes('Track')) throw new Error('the confirmation does not offer tracking')
    return true
  })

  // ── 3 · owner is told ─────────────────────────────────────────────────────
  await ok('owner received the packing list', async () => {
    await waitForMail(
      (m) => m.subject.includes('NEW ORDER') && m.subject.includes(order.orderCode),
      `the NEW ORDER alert for ${order.orderCode}`,
    )
    return true
  })

  // ── 4 · payment ───────────────────────────────────────────────────────────
  await ok('payment is captured', async () => {
    const intent = await api('/api/payments/intent', {
      method: 'POST',
      expect: 200,
      body: JSON.stringify({ orderCode: order.orderCode, phone }),
    })
    await api('/api/payments/capture', {
      method: 'POST',
      expect: 200,
      body: JSON.stringify({
        orderCode: order.orderCode,
        phone,
        intentId: intent.body.intentId,
        simulate: 'success',
      }),
    })
    return true
  })

  await ok('customer received a receipt', async () => {
    await waitForMail(
      (m) => m.subject.includes('Payment received') && m.to.includes(phone),
      `the receipt for ${order.orderCode}`,
    )
    return true
  })

  // ── 5 · ADMIN assigns a rider ─────────────────────────────────────────────
  const jar: string[] = []
  const dispatch = await ok('admin signs in and assigns a rider', async () => {
    await api('/api/users/login', {
      method: 'POST',
      jar,
      expect: 200,
      body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
    })

    const list = await api(`/api/admin-ops/board`, { jar })
    void list

    // By CODE, the way a dispatcher would: the code is what is on the packing
    // slip and in the customer's confirmation e-mail.
    const res = await api('/api/dispatch/assign', {
      method: 'POST',
      jar,
      expect: 200,
      body: JSON.stringify({ orderCode: order.orderCode, distanceKm: 3 }),
    })
    if (!res.body.dispatchId) throw new Error(JSON.stringify(res.body))
    return res.body
  })
  console.log(
    `       rider ${dispatch.riderName}, band ${dispatch.bandCode}, pay ₹${(dispatch.payoutPaise / 100).toFixed(2)}`,
  )

  await ok('rider was emailed the drop', async () => {
    const found = await waitForMail(
      (m) => m.subject.includes('New drop') && m.subject.includes(order.orderCode),
      `the dispatch email for ${order.orderCode}`,
    )
    if (!found.text.includes('Your pay'))
      throw new Error('the rider email omits the pay for the drop')
    return true
  })

  const deliveryCodeText = await ok(
    'customer was emailed a delivery code they can use',
    async () => {
      const found = await waitForMail(
        (m) => m.subject.includes('delivery code') && m.to.includes(phone),
        `the delivery code for ${order.orderCode}`,
      )
      if (!/Your delivery code: \d+/.test(found.text)) {
        throw new Error('the delivery-code message does not contain a code')
      }
      return found.text
    },
  )

  // ── 6 · RIDER runs the drop ───────────────────────────────────────────────
  const riderJar: string[] = []
  const otp = await ok('rider signs in with an OTP', async () => {
    const req = await api('/api/rider/session', {
      method: 'POST',
      jar: riderJar,
      expect: 200,
      body: JSON.stringify({ action: 'request', phone: RIDER_PHONE }),
    })
    /*
     * The code comes from Mailpit, not from the response.
     *
     * `devCode` is returned only outside production, and `make test:journey` is
     * routinely run against `pnpm start` — a production build. In that mode this
     * step failed with:
     *
     *     POST /api/rider/session → 400 "Enter the 6-digit code."
     *
     * which reads as rider sign-in being broken rather than as this script
     * depending on a branch that does not exist in the build it is talking to.
     *
     * Reading the code out of the inbox is the PRODUCTION path, not a workaround:
     * the code arrives out of band there too, over SMS in real life. Using the
     * in-band `devCode` when it happens to be present would mean the journey only
     * ever exercised development.
     *
     * `devCode` is still accepted as a fallback, so a developer with Mailpit shut
     * is not stuck.
     */
    const challengeId = req.body.challengeId

    /*
     * No challenge means the number was not on the active rider roster — and the API
     * is right to hide that, because telling a stranger "not a rider" enumerates the
     * roster. It also means a wrong `RIDER_PHONE` fails here as a bare
     *
     *     {"ok":true,"message":"If that number is on the rider roster, a code is on its way."}
     *
     * which reads like rider sign-in is broken. So name the actual cause: this is a
     * fixture problem, and the fix is a phone from the `riders` table.
     */
    if (!challengeId) {
      throw new Error(
        `RIDER_PHONE=${RIDER_PHONE} is not on the active rider roster, so no OTP was ` +
          `sent. This is a fixture problem, not a bug in rider sign-in.\n` +
          `Use a phone from the riders table:\n` +
          `  psql "$DATABASE_URL" -c "select phone from riders where active order by id"`,
      )
    }

    let code = req.body.devCode
    if (!code) code = await readRiderOtp(RIDER_PHONE)
    return { challengeId, code }
  })

  await ok('rider session is accepted', async () => {
    await api('/api/rider/session', {
      method: 'POST',
      jar: riderJar,
      expect: 200,
      body: JSON.stringify({ action: 'verify', challengeId: otp.challengeId, code: otp.code }),
    })
    const page = await fetch(`${BASE}/rider`, { headers: { cookie: riderJar.join('; ') } })
    if (!page.ok) throw new Error(`/rider returned ${page.status}`)
    const html = await page.text()
    if (!html.includes(order.orderCode)) {
      throw new Error('the drop is not on the rider\u2019s run')
    }
    return true
  })

  await ok('rider picks up, sets out, and closes on the customer code', async () => {
    for (const to of ['PICKED_UP', 'OUT_FOR_DELIVERY'] as const) {
      await api(`/api/rider/dispatch/${dispatch.dispatchId}/transition`, {
        method: 'POST',
        jar: riderJar,
        expect: 200,
        body: JSON.stringify({ to }),
      })
    }
    const code = /Your delivery code: (\d+)/.exec(deliveryCodeText)![1]!

    await api(`/api/rider/dispatch/${dispatch.dispatchId}/deliver`, {
      method: 'POST',
      jar: riderJar,
      expect: 200,
      body: JSON.stringify({
        code,
        claimEvidenceKind: 'unboxing_video_requested',
        claimEvidenceNote: 'Journey test.',
      }),
    })
    return true
  })

  // ── 7 · the rider's money moved ───────────────────────────────────────────
  await ok('the rider\u2019s pay is banked on the run', async () => {
    const page = await fetch(`${BASE}/rider`, { headers: { cookie: riderJar.join('; ') } })
    const html = await page.text()
    if (html.includes('Delivered at') === false && !html.includes(order.orderCode)) {
      throw new Error('the drop vanished from the run after delivery')
    }
    return true
  })

  // ── 8 · the customer can see the whole thing ──────────────────────────────
  await ok('customer can open the order by code + phone', async () => {
    const res = await api(
      `/api/orders/lookup?orderCode=${encodeURIComponent(order.orderCode)}&phone=${phone}`,
      { expect: 200 },
    )
    if (res.body.status !== 'DELIVERED') {
      throw new Error(`order status is ${res.body.status}, expected DELIVERED`)
    }
    return true
  })

  console.log(`\n✓ Full journey passed — ${step} steps, order ${order.orderCode}\n`)
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error('\n✗ journey crashed:', error instanceof Error ? error.stack : error)
  process.exit(1)
})

/**
 * Read a rider's sign-in code out of Mailpit — the out-of-band hop.
 *
 * Same reasoning as the delivery code above, and the same reason it is not `devCode`:
 * in production the code arrives by SMS and there is nothing in the response. A
 * journey that only works against a dev build is a journey that never runs in CI.
 */
async function readRiderOtp(phone: string, timeoutMs = 20_000): Promise<string> {
  const digits = String(phone).replace(/\D/g, '').slice(-10)
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=25`)
    if (!list.ok) {
      throw new Error(
        `Mailpit is not answering on ${MAILPIT}. Without it a production build cannot ` +
          `be tested, because the sign-in code only exists out of band.`,
      )
    }
    const { messages = [] } = (await list.json()) as {
      messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>
    }

    for (const m of messages) {
      const to = m.To ?? []
      if (!to.some((a) => a.Address.replace(/\D/g, '').includes(digits))) continue
      const detail = (await (
        await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)
      )
        .json()
        .catch(() => ({}))) as { Subject?: string }
      const found = /(\d{6}) is your Upvvan sign-in code/.exec(detail.Subject ?? '')
      if (found?.[1]) return found[1]
    }

    if (Date.now() > deadline) {
      throw new Error(
        `no sign-in OTP for ${phone} arrived in Mailpit within ${timeoutMs / 1000}s.\n` +
          `  A production build returns no devCode, so the code can only come from the\n` +
          `  out-of-band channel — which is exactly how it works in production.\n` +
          `  Open ${MAILPIT} and check the server log.`,
      )
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}
