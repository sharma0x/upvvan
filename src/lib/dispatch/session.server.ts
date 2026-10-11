/**
 * Rider identity.
 *
 * ── WHY RIDERS GET THEIR OWN AUTH AND NOT better-auth's ─────────────────────
 *
 * AGENTS.md is explicit: better-auth owns CUSTOMER identity (C-1), and
 * `src/lib/auth/__tests__/single-customer-identity.test.ts` fails if anyone
 * adds a Customers collection. A rider is neither a customer nor staff.
 *
 * Putting riders in Payload's `users` would be the tempting shortcut, but
 * `users` is the STAFF surface: it grants the content admin, and a rider who
 * deactivates their account should not be able to edit the catalogue. Putting
 * them in better-auth would put riders inside customer identity, which is the
 * exact confusion C-1 exists to prevent — and the regression test would (rightly)
 * fail.
 *
 * So: a small challenge table plus an HMAC-signed, HttpOnly cookie. Same shape
 * as the rest of the auth in this codebase (opaque token, server-verified,
 * scrypt for secrets) and no new dependency.
 *
 * ── WHY THE SESSION IS CHECKED AGAINST THE RIDER ON EVERY REQUEST ───────────
 *
 * A stateless cookie with a 30-day expiry would keep a deactivated rider on the
 * board until the cookie expired. `requireRider` re-reads `active` every request,
 * so deactivating someone takes effect on their next tap — which matters when
 * "deactivate" is the control an operator reaches for the moment a rider is
 * found marking deliveries fraudulently. A session that survives revocation is
 * not a revocation.
 *
 * The cookie is SIGNED, not merely encoded. An unsigned base64 payload is
 * forgeable: a rider could edit `riderId` in their own cookie and read another
 * rider's drops. The signature is checked against `config.payload.secret` —
 * already required in production, already at least 32 characters, and never read
 * by a human.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPayload, type Payload } from 'payload'
import payloadConfig from '@payload-config'
import { config } from '@/lib/config'
import { getPool } from './store.server'
import { generateOtp, hashOtp, verifyOtp } from './otp'
import { deliverOtp } from '@/lib/auth/otp-delivery'

export const RIDER_COOKIE = 'upvvan_rider'

/**
 * Rider session length. Short by staff standards and long by OTP standards:
 * a rider signs in once at the start of a shift and then spends the day on
 * `out_for_delivery`, so a five-minute session would log them out mid-run.
 *
 * It is read from `config`, because "nothing operational is hardcoded" is a rule
 * this codebase keeps — and a session lifetime that cannot be changed without a
 * redeploy is the kind of value that gets baked in by accident and then defended
 * as if it were a decision. Twelve hours covers a shift.
 */
const SESSION_TTL_MS = config.auth.riderSessionTtlSeconds * 1000

export interface RiderSession {
  riderId: number
  name: string
  /** Unix seconds. */
  exp: number
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * `payload.secret` is the signing key because it is the one secret in this
 * codebase that is guaranteed present and long. A dedicated env var would be one
 * more thing an operator can forget, and an unsigned-cookie regression is
 * exactly the kind of failure that goes unnoticed until it is exploited.
 */
function sign(payload: string): string {
  return createHmac('sha256', config.payload.secret).update(payload).digest('base64url')
}

export function mintSession(riderId: number, name: string): { token: string; exp: number } {
  const exp = Math.floor((Date.now() + SESSION_TTL_MS) / 1000)
  const body = b64url(JSON.stringify({ riderId, name, exp }))
  return { token: `${body}.${sign(body)}`, exp }
}

/**
 * Verify and decode, or null.
 *
 * `timingSafeEqual` on the SIGNATURE, which is the part an attacker controls.
 * The payload comparison needs no constant-time path because a mismatch in the
 * payload means the signature already failed — there is nothing left to leak
 * incrementally.
 */
export function readSession(token: string | undefined): RiderSession | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null

  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  const expected = Buffer.from(sign(body))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RiderSession
    if (typeof parsed.riderId !== 'number' || typeof parsed.exp !== 'number') return null
    if (parsed.exp * 1000 < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Create a login challenge and queue the code.
 *
 * Returns the challenge id, plus the code itself in NON-PRODUCTION only.
 *
 * The dev code is returned from here rather than scraped back out of `outbox`
 * afterwards. Scraping means parsing a human-readable message body with a regex
 * to recover a value we already had in memory — which silently breaks the day
 * someone rewords the template, and fails open (returning an empty string) rather
 * than loudly. Handing back what we just generated cannot drift.
 *
 * Still the most dangerous line in this feature: it is gated at the point of
 * return, and it disappears entirely when a real SMS provider is wired.
 */
export async function createLoginChallenge(
  riderId: number,
  phone: string,
): Promise<{ challengeId: number; devCode: string | null }> {
  const db = await getPool()
  const code = generateOtp()
  const { hash, salt } = hashOtp(code)

  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO "rider_login_challenges" ("rider_id", "code_hash", "code_salt", "expires_at")
     VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)
     RETURNING "id"`,
    [riderId, hash, salt, String(config.auth.otpExpiresIn)],
  )

  /*
   * The outbox row is the audit trail, not the delivery.
   *
   * This function used to write ONLY here — and there is no SMS gateway wired, so
   * nothing ever drains `outbox`. Which left rider sign-in reachable through
   * exactly one path:
   *
   *     the `devCode` in the response, which is gated on NODE_ENV !== 'production'
   *
   * So in production NO RIDER COULD EVER SIGN IN. Not "sign-in is flaky" — the
   * feature did not exist. Riders would arrive at /rider, be redirected to
   * /rider/signin, press "Send code", see the request succeed, and wait for a
   * message that was never going to arrive. Nothing would be delivered, ever, and
   * no error would be raised anywhere: the row was written, the response was 200,
   * and the code went into a table nobody reads.
   *
   * Found by running the simulation against a production build with no `devCode`
   * to fall back on, and reading the code out of Mailpit the way a rider reads it
   * off their phone. The dev server had never found it, because on the dev server
   * the fallback branch is always there.
   *
   * The real SMS path stays in `deliverOtp` — one function, swapped for the
   * WhatsApp Business API in Phase 4. Same shape as the customer sign-in OTP, so
   * there is exactly one place where "how does a code reach a human" is decided.
   */
  const body = `Your Upvvan rider code is ${code}. It expires in a few minutes.`

  await db.query(
    `INSERT INTO "outbox" ("channel", "to_number", "body", "kind")
     VALUES ('sms', $1, $2, 'rider_login')`,
    [phone, body],
  )

  await deliverOtp({ phoneNumber: phone, code })

  return {
    challengeId: rows[0]!.id,
    devCode: process.env.NODE_ENV === 'production' ? null : code,
  }
}

export interface LoginResult {
  riderId: number
  name: string
  token: string
  exp: number
}

/**
 * Exchange a challenge id + code for a session token.
 *
 * The challenge is consumed in the SAME statement that validates it
 * (`consumed_at IS NULL` in the WHERE clause), so a code cannot be replayed even
 * by two concurrent requests — the second UPDATE matches zero rows.
 *
 * Throws with a GENERIC message on failure. A challenge id is guessable (a
 * serial), so telling an attacker whether the id was real would let them
 * enumerate riders; and "that code is wrong" vs "that challenge has expired" is
 * a distinction worth nothing to a legitimate rider.
 */
export async function completeLogin(challengeId: number, code: string): Promise<LoginResult> {
  const db = await getPool()
  const GENERIC = 'That code is not valid. Request a new one.'

  const { rows } = await db.query<{
    id: number
    riderId: number
    codeHash: string
    codeSalt: string
    expiresAt: Date
  }>(
    `SELECT "id", "rider_id" AS "riderId", "code_hash" AS "codeHash",
            "code_salt" AS "codeSalt", "expires_at" AS "expiresAt"
       FROM "rider_login_challenges"
      WHERE "id" = $1 AND "consumed_at" IS NULL`,
    [challengeId],
  )
  const challenge = rows[0]
  if (!challenge) throw new Error(GENERIC)
  if (challenge.expiresAt.getTime() < Date.now()) throw new Error(GENERIC)

  if (!verifyOtp(code, challenge.codeHash, challenge.codeSalt)) throw new Error(GENERIC)

  const consumed = await db.query<{ riderId: number; name: string; active: boolean }>(
    `UPDATE "rider_login_challenges" SET "consumed_at" = now()
      WHERE "id" = $1 AND "consumed_at" IS NULL
      RETURNING "rider_id" AS "riderId"`,
    [challengeId],
  )
  if (!consumed.rows[0]) throw new Error(GENERIC)

  const rider = await db.query<{ id: number; name: string; active: boolean }>(
    `SELECT "id", "name", "active" FROM "riders" WHERE "id" = $1`,
    [challenge.riderId],
  )
  const row = rider.rows[0]
  if (!row || !row.active) {
    throw new Error('This rider account is not active. Speak to the dispatcher.')
  }

  const { token, exp } = mintSession(row.id, row.name)
  return { riderId: row.id, name: row.name, token, exp }
}

/**
 * The rider behind the current request, or null.
 *
 * Re-reads `active` rather than trusting the cookie. See the module header: a
 * session that outlives revocation is not a revocation.
 */
export async function currentRider(): Promise<{ id: number; name: string } | null> {
  const store = await cookies()
  const session = readSession(store.get(RIDER_COOKIE)?.value)
  if (!session) return null

  const db = await getPool()
  const { rows } = await db.query<{ id: number; name: string }>(
    `SELECT "id", "name" FROM "riders" WHERE "id" = $1 AND "active"`,
    [session.riderId],
  )
  return rows[0] ?? null
}

export async function setRiderCookie(token: string, exp: number): Promise<void> {
  const store = await cookies()
  store.set(RIDER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // `secure` only in production: over plain http on localhost the cookie would
    // be dropped entirely and the rider surface would be untestable in dev.
    secure: config.env === 'production',
    path: '/',
    expires: new Date(exp * 1000),
  })
}

export async function clearRiderCookie(): Promise<void> {
  const store = await cookies()
  store.delete(RIDER_COOKIE)
}

// ── staff identity ───────────────────────────────────────────────────────────

/**
 * Staff session, read from Payload's own cookie.
 *
 * This is a best-effort identity check, NOT authorisation. The ops routes treat
 * "we could not identify the staff member" as "deny", and nothing in the ops
 * console mutates data without a resolvable actor — because every mutation
 * writes an event to the append-only ledger, and an unattributable event is not
 * an audit trail.
 *
 * Deliberately does NOT go through `getPayload()`. Instantiating Payload's
 * Local API inside a server component for a cookie read pulls the whole admin
 * bundle into the request path, and the session table is right there.
 */
/**
 * One Payload instance per server process, shared across requests.
 *
 * The original comment on `currentStaff` said it deliberately avoided `getPayload()`
 * because booting the CMS inside a server component "pulls the whole admin bundle
 * into the request path". That optimisation is what broke staff auth: the
 * hand-rolled HMAC cannot work, because Payload does not sign its session cookie
 * with `payload.secret` — it derives its own signing key — and reverse-engineering
 * that derivation would couple this file to an internal detail of the CMS.
 *
 * A module-level singleton is the answer to both concerns. The instance is built
 * once per process and reused, so the per-request cost is an auth lookup against a
 * warm connection pool, not a re-initialisation. That is what every Payload app
 * does in practice.
 */
let payloadInstance: Promise<Payload> | null = null
function payloadClient(): Promise<Payload> {
  if (!payloadInstance) {
    payloadInstance = getPayload({ config: payloadConfig }).catch((error: unknown) => {
      // Do not cache a failed boot: the next request should try again rather than
      // inherit a broken instance for the life of the process.
      payloadInstance = null
      throw error
    })
  }
  return payloadInstance
}

export async function currentStaff(): Promise<{ id: number; email: string | null } | null> {
  const store = await cookies()
  // Payload's default session cookie name.
  const raw = store.get('payload-token')?.value
  if (!raw) return null
  /*
   * ── STEP 1 · A CHEAP SHAPE CHECK, BEFORE ANY CMS WORK ─────────────────────
   *
   * Anonymous traffic is the common case for these endpoints — a bot hitting
   * `/api/dispatch/assign`, a customer's browser polling it. All this needs to do
   * is reject the obviously-not-ours before anything expensive happens, and it
   * rejects on SHAPE only: three segments, HS256, an unexpired `exp`.
   *
   * Deliberately no signature check here, because there is no key to check
   * against. This is a filter, not authentication — see step 2, which is what
   * actually decides.
   */
  if (!plausibleStaffCookie(raw)) return null

  /*
   * ── STEP 2 · ASK PAYLOAD, WHO OWNS THE CMS ────────────────────────────────
   *
   * `payload.auth()` is the single authority on "is this cookie a signed-in
   * member of collection X, and is that session still live". Implementing it
   * ourselves is not an option: the signature is produced with a key Payload
   * derives internally, and a hand-rolled check is either a forgery hole (decode
   * without verify) or a maintenance liability (mirror an internal detail).
   *
   * The `collection` test is the one that matters most. better-auth owns CUSTOMER
   * identity (C-1) and issues its own cookie. If that were accepted here, a
   * customer could sign in to their own account and then mutate the append-only
   * dispatch ledger — a customer becoming the ops console. Requiring
   * `collection === 'users'` makes the two session systems structurally
   * incapable of being confused for one another.
   *
   * `db: false` because nothing in the return value is used. It is not a
   * permission check either — `canSetHeaders` and the permission checks belong to
   * the routes that mutate, and those routes gate on this function's answer.
   */
  let user: { id: number | string; collection?: string; email?: string | null } | null
  try {
    const payload = await payloadClient()
    const { user: resolved } = await payload.auth({
      headers: new Headers({ cookie: `payload-token=${raw}` }),
      canSetHeaders: false,
    })
    // `collection` is present on the real user type; the narrower local type keeps
    // the `=== 'users'` check honest rather than silently undefined.
    user = resolved as typeof user
  } catch (error) {
    console.error('[dispatch] staff auth resolution failed:', (error as Error).message)
    return null
  }

  if (!user) return null
  if (user.collection !== 'users') return null

  const id = Number(user.id)
  if (!Number.isInteger(id)) return null

  return { id, email: user.email ?? null }
}

/**
 * Is this cookie even SHAPED like a Payload session token?
 *
 * Not authentication — a filter that keeps anonymous requests from booting the
 * CMS. Three segments, HS256, an unexpired `exp`, and a payload that claims to be
 * a `users` session.
 *
 * Exported for the test suite, because "does this reject the shapes it should"
 * is a property worth pinning independently of whether the real signature check
 * works. It must never be the ONLY thing between a request and the ops console.
 */
export function plausibleStaffCookie(raw: string): boolean {
  const segments = raw.split('.')
  if (segments.length !== 3) return false
  const [header, payload] = segments as [string, string, string]

  try {
    const alg = (JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string })
      .alg
    /*
     * `alg` MUST be HS256.
     *
     * A verifier that computes a signature but never compares it — which is what
     * `{"alg":"none"}` aims to provoke — is not a verifier. Pinning the algorithm
     * closes the downgrade at the cheapest possible point.
     */
    if (alg !== 'HS256') return false

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      collection?: unknown
      exp?: unknown
    }
    if (claims.collection !== 'users') return false
    if (typeof claims.exp !== 'number') return false
    return claims.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/**
 * Require a signed-in staff member, or redirect to the admin sign-in.
 *
 * ── WHY THE OPS READ PAGES NEED THIS AND THE WRITE ROUTES ALREADY DID ───────
 *
 * `/admin-ops` renders with a banner for an anonymous visitor: "You are not
 * signed in as staff, so you can look but not assign." That was a decision about
 * the DASHBOARD, and the dashboard is counts — six numbers and a table of order
 * codes.
 *
 * `/admin-ops/queue` and `/admin-ops/board` had no gate at all. They are not
 * dashboards; they are the operational record. Between them they render, to
 * anyone on the internet who types the URL:
 *
 *   · every order code placed today, with its pincode, zone and REVENUE
 *   · every rider name, their distance band and their PAYOUT, per drop
 *   · zone capacity against each zone's daily drop limit
 *   · the full append-only `dispatch_events` ledger, with actor labels
 *
 * `robots: noindex` is not access control — it is a polite request to a crawler
 * that has no reason to comply, and the pages were reachable in one guess from
 * the footer-adjacent nav. Only the write route (`/api/dispatch/assign`) was
 * gated, so the ledger's integrity argument ("nothing mutates without a
 * resolvable actor") held while its CONFIDENTIALITY did not.
 *
 * So: read pages are gated the same way write routes are. The redirect target is
 * the admin panel's own login, which is the one place a staff member already
 * knows how to authenticate, and `next` is preserved so they land back on the
 * queue they were trying to reach.
 *
 * This is a redirect rather than a 403 because every caller is a PAGE. An
 * operator whose admin session expired mid-shift gets the way to fix it instead
 * of a status code.
 */
export async function requireOpsStaff(
  nextPath: string,
): Promise<{ id: number; email: string | null }> {
  const staff = await currentStaff()
  if (!staff) {
    redirect(`/admin/login?redirect=${encodeURIComponent(nextPath)}`)
  }
  return staff
}
