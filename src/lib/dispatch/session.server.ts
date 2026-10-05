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

import { config } from '@/lib/config'
import { getPool } from './store.server'
import { generateOtp, hashOtp, verifyOtp } from './otp'

export const RIDER_COOKIE = 'upvvan_rider'

/**
 * Rider session length. Short by staff standards and long by OTP standards:
 * a rider signs in once at the start of a shift and then spends the day on
 * `outFor_delivery`, so a five-minute session would log them out mid-run.
 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

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

  await db.query(
    `INSERT INTO "outbox" ("channel", "to_number", "body", "kind")
     VALUES ('sms', $1, $2, 'rider_login')`,
    [phone, `Your Upvvan rider code is ${code}. It expires in a few minutes.`],
  )

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
export async function currentStaff(): Promise<{ id: number; email: string | null } | null> {
  const store = await cookies()
  // Payload's default session cookie name.
  const raw = store.get('payload-token')?.value
  if (!raw) return null

  const db = await getPool()
  // `users_sessions` is Payload's SESSIONS ARRAY FIELD, not its own auth
  // collection: `_parent_id` is the user, `id` IS the session token, and the
  // expiry is `expires_at` — not `expiresAt`, because `timestamps` does not
  // apply to an array field's table (AGENTS.md's third array surprise). Those
  // three details are load-bearing for staff auth, so the query is written out
  // rather than re-guessed at each call site.
  const { rows } = await db.query<{ parentId: number; email: string | null }>(
    `SELECT s."_parent_id" AS "parentId", u."email"
       FROM "users_sessions" s
       JOIN "users" u ON u."id" = s."_parent_id"
      WHERE s."id" = $1 AND s."expires_at" > now()`,
    [raw],
  )
  const row = rows[0]
  return row ? { id: Number(row.parentId), email: row.email } : null
}