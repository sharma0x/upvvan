/**
 * A shared kit for the business simulation and the journey script.
 *
 * ── WHY THIS EXISTS AND WHY IT IS NOT `scripts/journey.ts` ───────────────────
 *
 * `journey.ts` answers one question — "does a sale reach a rider?" — and it does it
 * in nine steps against one happy path. That is a smoke test with a founder's
 * ergonomics, and it is worth keeping exactly as it is.
 *
 * This is the other thing: a harness that can act as FIVE different people
 * against the same running server, in any order, with the database open, and can
 * also inject faults and assert that the system refuses them. `simulate.ts` uses
 * it; nothing else should need to.
 *
 * The two rules that make it useful:
 *
 *   1. IT TALKS HTTP. Every call goes through the real router, the real
 *      middleware, the real cookies. A unit test with a mocked boundary cannot see
 *      a missing Set-Cookie, a redirect loop, or a page that renders a raw enum.
 *   2. IT ALSO TALKS SQL. Assertions are made against the database, not against
 *      what an API said. A route can return 200 and write nothing; only the row
 *      settles that.
 */
import { Pool } from 'pg'

export const BASE = (() => {
  const i = process.argv.indexOf('--base')
  return i > -1 ? process.argv[i + 1]! : `http://localhost:${process.env.PORT ?? 3100}`
})()

export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:58025'

/* ── cookie jar ─────────────────────────────────────────────────────────────── */

/**
 * A browser-shaped cookie jar.
 *
 * Hand-rolled rather than pulled from a library, because the behaviour that
 * matters here is the behaviour a browser actually has and a test double usually
 * does not: cookies ACCUMULATE across a whole session rather than being replaced
 * per request. A jar that only remembers the last `Set-Cookie` passes tests that
 * a real browser would fail, because a real sign-in writes several cookies and
 * losing the earlier ones produces a 401 that looks like a bug in the app.
 */
export class Jar {
  private readonly cookies = new Map<string, string>()

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  get size(): number {
    return this.cookies.size
  }

  name(fragment: string): string | undefined {
    for (const [k, v] of this.cookies) if (k.includes(fragment)) return v
    return undefined
  }

  absorb(response: Response): void {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';')
      const eq = pair?.indexOf('=') ?? -1
      if (!pair || eq === -1) continue
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      // An empty value with an expiry in the past is a deletion. Honouring it is
      // what makes "sign out" testable: without this the old cookie survives in
      // the jar and the next request is still authenticated.
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(raw)) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }
}

/* ── http ───────────────────────────────────────────────────────────────────── */

export interface CallOptions {
  jar?: Jar
  /** Expected status. Absent means "just tell me what happened". */
  expect?: number | number[]
  /** Sent as a plain form body, to exercise the no-JS path. */
  form?: Record<string, string | undefined>
  headers?: Record<string, string>
}

export interface CallResult {
  status: number
  /** Parsed JSON when the body was JSON, otherwise the text. */
  body: any
  text: string
  headers: Headers
  /** Where a `manual` redirect pointed, if anywhere. */
  location: string | null
}

export async function call(
  path: string,
  init: RequestInit & CallOptions = {},
): Promise<CallResult> {
  const headers = new Headers(init.headers)
  const method = init.method ?? 'GET'

  let body = init.body
  if (init.form) {
    headers.set('content-type', 'application/x-www-form-urlencoded')
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(init.form)) if (v !== undefined) params.set(k, v)
    body = params.toString()
  } else if (body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  if (init.jar && init.jar.size > 0) headers.set('cookie', init.jar.header())

  const res = await fetch(`${BASE}${path}`, { ...init, body, headers, redirect: 'manual' })
  init.jar?.absorb(res)

  const text = await res.text()
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }

  const result: CallResult = {
    status: res.status,
    body: parsed,
    text,
    headers: res.headers,
    location: res.headers.get('location'),
  }

  if (init.expect !== undefined) {
    const wanted = Array.isArray(init.expect) ? init.expect : [init.expect]
    if (!wanted.includes(res.status)) {
      throw new Error(
        `${method} ${path} → ${res.status} (wanted ${wanted.join('|')})\n` +
          `  ${text.replace(/\s+/g, ' ').slice(0, 400)}`,
      )
    }
  }

  return result
}

/* ── database ───────────────────────────────────────────────────────────────── */

let pool: Pool | null = null

export function db(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set. Run via `node --env-file=.env`.')
    pool = new Pool({ connectionString: url })
  }
  return pool
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

/** Read something straight out of the database. The authority on every assertion. */
export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const { rows } = await db().query(sql, params)
  return (rows[0] as T) ?? null
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await db().query(sql, params)
  return rows as T[]
}

/**
 * Run deliberately illegal SQL and report WHY it was refused.
 *
 * ── WHY THIS IS THE MOST USEFUL FUNCTION IN THE FILE ────────────────────────
 *
 * Every business invariant this project has is a trigger or a CHECK rather than
 * an `if` in a route handler. That claim is only worth something if something
 * actually tries to violate it.
 *
 * So `expectRefused` does not check the API. It goes straight at Postgres with a
 * write no application code would ever make, and asserts that the DATABASE says
 * no. If a constraint ever gets dropped, or a migration that should have created
 * a trigger quietly does nothing, this is what notices — because the application
 * is not in the loop to give a false pass.
 *
 * Returns the error message rather than asserting on a substring, so a failure
 * report shows what the database actually said.
 */
export async function expectRefused(
  label: string,
  sql: string,
  params: unknown[] = [],
): Promise<string> {
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    await client.query(sql, params)
    await client.query('ROLLBACK')
    throw new Error(
      `${label}: the database ACCEPTED a write that must be impossible.\n  ${sql.trim().slice(0, 160)}`,
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('the database ACCEPTED')) throw error
    await client.query('ROLLBACK').catch(() => {})
    return (error as { message?: string }).message ?? String(error)
  } finally {
    client.release()
  }
}

/* ── mail ──────────────────────────────────────────────────────────────────── */

export interface Mail {
  id: string
  subject: string
  to: string
  text: string
}

/**
 * Wait for a message.
 *
 * Polling, not asserting immediately. Every notification in this project is
 * dispatched AFTER the transaction commits and is deliberately not awaited, so a
 * mail outage cannot fail a payment or delay a response. The consequence is that
 * a message is never in Mailpit at the instant the HTTP call returns.
 *
 * The first version of the journey script asserted immediately and failed about
 * half the time with "no confirmation in Mailpit" for mail that arrived
 * milliseconds later — a flaky test that reads as a broken product. Asserting on
 * an eventually-consistent thing requires actually polling it.
 */
export async function waitForMail(
  match: (m: Mail) => boolean,
  what: string,
  timeoutMs = 20_000,
): Promise<Mail> {
  const deadline = Date.now() + timeoutMs
  let count = 0
  for (;;) {
    const messages = await allMail()
    count = messages.length
    const found = messages.find(match)
    if (found) return found
    if (Date.now() > deadline) {
      throw new Error(
        `${what} never arrived within ${timeoutMs / 1000}s (Mailpit holds ${count} message(s)).\n` +
          `  Check the email_log table — a failure there records the reason.`,
      )
    }
    await sleep(300)
  }
}

export async function allMail(limit = 40): Promise<Mail[]> {
  const list = await fetch(`${MAILPIT}/api/v1/messages?limit=${limit}`)
  if (!list.ok) throw new Error(`Mailpit is not answering on ${MAILPIT} — run \`make infra-up\``)
  const { messages = [] } = (await list.json()) as any

  const out: Mail[] = []
  for (const m of messages) {
    const detail = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json().catch(() => ({}))
    out.push({
      id: m.ID,
      subject: m.Subject ?? '',
      to: (m.To ?? []).map((t: any) => t.Address).join(', '),
      text: detail.Text ?? '',
    })
  }
  return out
}

export async function clearMail(): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => {})
}

/**
 * Read a six-digit sign-in code out of Mailpit.
 *
 * ── THIS IS THE PRODUCTION PATH, SIMULATED ──────────────────────────────────
 *
 * Outside development, `/phone-number/verify` accepts only what the customer
 * received out of band: there is no `devCode` in the response and no console log
 * to scrape. The operator reads the code off the phone.
 *
 * So a simulation that uses `devCode` is testing a path that does not exist in
 * production, and it will happily pass while the real flow is broken. This reads
 * the code from the customer's inbox — the same out-of-band hop the production SMS
 * provider replaces — and every sign-in in the simulation goes through it.
 *
 * The regex deliberately matches the SUBJECT, which is where the code is
 * deliberately placed. See `lib/auth/otp-delivery.ts` for why.
 */
export async function readSignInCode(phone: string, timeoutMs = 15_000): Promise<string> {
  const digits = phone.replace(/\D/g, '')
  const mail = await waitForMail(
    (m) =>
      m.to.replace(/\D/g, '').includes(digits) && /is your Upvvan sign-in code/.test(m.subject),
    `the sign-in OTP for ${phone}`,
    timeoutMs,
  )
  const code = /(\d{6}) is your Upvvan sign-in code/.exec(mail.subject)?.[1]
  if (!code) throw new Error(`The sign-in e-mail for ${phone} carried no code in its subject.`)
  return code
}

/**
 * Read the delivery code a customer was sent for an order.
 *
 * Also the production path: this is the message that proves a parcel really
 * arrived, and in production it arrives over WhatsApp. Reading it from the inbox
 * is the closest honest equivalent available in dev.
 */
export async function readDeliveryCode(orderCode: string, timeoutMs = 15_000): Promise<string> {
  const mail = await waitForMail(
    (m) => m.subject.includes(orderCode) && /your delivery code is/i.test(m.subject),
    `the delivery code for ${orderCode}`,
    timeoutMs,
  )
  const code = /your delivery code is (\d+)/i.exec(mail.subject)?.[1]
  if (!code) throw new Error(`The delivery-code message for ${orderCode} carried no code.`)
  return code
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ── staff + rider credentials ──────────────────────────────────────────────── */

export interface Staff {
  email: string
  password: string
}

export interface Rider {
  id: number
  name: string
  phone: string
}

export async function staffCredentials(): Promise<Staff> {
  const email = process.env.SIM_STAFF_EMAIL ?? process.env.STAFF_EMAIL
  const password =
    process.env.SIM_STAFF_PASSWORD ?? process.env.STAFF_PASSWORD ?? process.env.STAFF_SEED_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Staff credentials are required for the simulation.\n' +
        "  Provision one with:  STAFF_SEED_PASSWORD='…' pnpm seed:staff -- ops@upvvan.test 'Ops Person' ops\n" +
        '  then export SIM_STAFF_EMAIL / SIM_STAFF_PASSWORD.',
    )
  }
  return { email, password }
}

/** Sign staff in through Payload and return a jar holding the session cookie. */
export async function signInStaff(staff: Staff): Promise<Jar> {
  const jar = new Jar()
  await call('/api/users/login', {
    method: 'POST',
    jar,
    expect: 200,
    body: JSON.stringify({ email: staff.email, password: staff.password }),
  })
  return jar
}

/** An active rider in the operational city, in a deterministic order. */
export async function pickRider(): Promise<Rider> {
  const rider = await one<{ id: number; name: string; phone: string }>(
    `SELECT r."id", r."name", r."phone"
       FROM "riders" r
       JOIN "cities" c ON c."id" = r."city_id"
      WHERE r."active" AND c."is_active"
      ORDER BY r."id" ASC
      LIMIT 1`,
  )
  if (!rider) throw new Error('No active rider in a live city. Run `pnpm seed:staff` / the seeds.')
  return rider
}

/**
 * Sign a rider in by OTP — through the same two calls a rider makes.
 *
 * The code is read from Mailpit, never from the `devCode` the API returns outside
 * production. See `readSignInCode`.
 */
export async function signInRider(phone: string): Promise<{ jar: Jar; challengeId: number }> {
  const jar = new Jar()
  const requested = await call('/api/rider/session', {
    method: 'POST',
    jar,
    expect: 200,
    body: JSON.stringify({ action: 'request', phone }),
  })

  const challengeId = requested.body.challengeId
  if (!challengeId) {
    throw new Error(
      `The rider sign-in request for ${phone} returned no challenge. ` +
        `That is the anti-enumeration behaviour for an unknown number — is this rider seeded?`,
    )
  }

  const code = await readSignInCode(phone)

  await call('/api/rider/session', {
    method: 'POST',
    jar,
    expect: 200,
    body: JSON.stringify({ action: 'verify', challengeId, code }),
  })

  return { jar, challengeId }
}

/* ── catalogue + city ───────────────────────────────────────────────────────── */

export interface Catalogue {
  skuId: string
  slug: string
  pincode: string
  citySlug: string
}

export async function pickCatalogueItem(): Promise<Catalogue> {
  const row = await one<{ skuId: string; slug: string; pincode: string; citySlug: string }>(
    /*
     * `species.slug`, not `skus.slug` — a SKU has no slug of its own; the product
     * URL is `/plant/<species-slug>` and the size tier is a query parameter. The
     * stock column is `stock_on_hand`.
     */
    `SELECT s."id"::text                                  AS "skuId",
            sp."slug"                                     AS "slug",
            p."pincode",
            c."slug"                                      AS "citySlug"
       FROM "skus" s
       JOIN "sku_stock" st ON st."sku_id" = s."id"
       JOIN "species" sp   ON sp."id" = s."species_id"
       JOIN "cities" c     ON c."id" = s."city_id"
       JOIN "pincodes" p
         ON p."is_serviceable"
        AND p."city_id" = s."city_id"
      WHERE s."is_published" AND c."is_active" AND COALESCE(st."stock_on_hand", 0) > 2
      -- Deepest stock first. Every check that buys something decrements it, and
      -- the simulation buys eight or nine times, so the SKU with the most on hand
      -- is the one that survives the most runs. Picking by id meant the third run
      -- against a fresh database exhausted the first SKU and the fourth failed with
      -- a genuine oversell — which reads as a product bug and is a fixture bug.
      ORDER BY st."stock_on_hand" DESC, s."id" ASC
      LIMIT 1`,
  )
  if (!row) {
    throw new Error(
      'No sellable SKU with stock in a serviceable pincode of a live city.\n' +
        '  Run:  make db-migrate && make seed && make seed:catalogue',
    )
  }
  return row
}

/* ── money ─────────────────────────────────────────────────────────────────── */

export const rupees = (paise: number): string => {
  if (!Number.isInteger(paise)) throw new Error(`Not whole paise: ${paise}`)
  const r = Math.floor(paise / 100)
  const rem = paise % 100
  const s = String(r)
  const grouped =
    s.length > 3 ? `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}` : s
  return rem === 0 ? `₹${grouped}` : `₹${grouped}.${String(rem).padStart(2, '0')}`
}

/**
 * Put a SKU's stock ledger back, and say so.
 *
 * ── WHY A TEST MAY TOUCH STOCK AT ALL ────────────────────────────────────────
 *
 * Every order decrements `sku_stock`, in the same transaction as the order. Eight
 * or nine orders per run is eight or nine real decrements, so after a few runs the
 * catalogue is measurably smaller than when it was seeded — and the simulation then
 * fails on a genuine oversell message, which is a fixture problem reported as a
 * product one.
 *
 * So the simulation tops the SKU back up before it runs, rather than after. That
 * ordering matters: a restore AFTER the run would let the last check of one run and
 * the first check of the next see different numbers, and a suite that hides a
 * failure by resetting state is a suite that hides failures.
 *
 * It prints what it moved. A fixture that silently changes the database is exactly
 * the thing this harness exists to criticise in the application.
 */
export async function ensureStock(skuId: string, atLeast: number): Promise<number> {
  const row = await db().query<{ onHand: number }>(
    `SELECT "stock_on_hand" AS "onHand" FROM "sku_stock" WHERE "sku_id" = $1`,
    [skuId],
  )
  const current = Number(row.rows[0]?.onHand ?? 0)
  if (current >= atLeast) return current

  await db().query(
    `UPDATE "sku_stock" SET "stock_on_hand" = $1, "updated_at" = now() WHERE "sku_id" = $2`,
    [atLeast, skuId],
  )
  return atLeast
}
