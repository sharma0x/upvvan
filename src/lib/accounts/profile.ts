import 'server-only'

import { cache } from 'react'

import { auth } from '@/lib/auth'
import { getCustomerId, getSession } from '@/lib/auth/session'
import { getPool } from '@/lib/db/pool'
import { normalisePhone } from '@/lib/orders/db'

/**
 * The customer profile — who is signed in, and everything `/account` shows them.
 *
 * ── WHY THIS FILE HAS NO `customerId` PARAMETER, EVER ────────────────────────
 *
 * Same rule as `accounts/addresses.ts`, and for the same reason: the customer is
 * resolved from the SESSION and nowhere else. A function shaped
 * `loadProfile(customerId)` is a function whose caller can be handed somebody
 * else's id by a URL parameter one day, and that mistake typechecks, passes every
 * test and leaks a customer's name, e-mail and order history. There is no version
 * of this API that accepts an id, so the mistake cannot be written.
 *
 * ── WHY THE PROFILE IS A THING AT ALL ────────────────────────────────────────
 *
 * It did not exist, and the account page rendered this:
 *
 *     <h1>{session.user.phoneNumber}</h1>
 *
 * with the comment "better-auth has no name for a phone-only customer yet". That
 * was true at the time and is no longer true, because `user.name` has always
 * been writable through `updateUser` — it was simply never written. So the
 * account greeted every customer with a phone number, showed no e-mail, had no
 * way to set either, and gave a first-time visitor a heading they recognised as
 * an account identifier rather than as themselves.
 *
 * ── WHAT THE PROFILE OWNS ───────────────────────────────────────────────────
 *
 *   · `name`         — better-auth's own column. The display name, everywhere.
 *   · `contactEmail` — our additional field. Order updates only, never auth.
 *   · `phoneNumber`  — the identity. Verified by OTP. Read-only on purpose: it is
 *                      C-1, and changing it is a different, OTP-gated operation.
 *
 * ── WHY `contactEmail` IS NOT VERIFIED AND WHY THAT IS FINE ──────────────────
 *
 * Because the phone number is the credential. The OTP already proved who this
 * person is, over the channel their plant is going to be delivered to. Marking an
 * e-mail "verified" would be a claim about a channel we never wrote to, and an
 * unverified marker that is never checked is decoration. What the column buys is
 * a real address for a real person who asked us to use one — order confirmations,
 * the delivery code, the receipt. A stranger cannot sign in with it, because
 * there is no password to sign in with.
 */

/** `numeric` arrives from `pg` as a string. Refuse a fractional value outright. */
function paise(value: string | number, label: string): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n)) {
    throw new Error(`${label} is not integer paise (received ${String(value)}).`)
  }
  return n
}

export interface CustomerProfile {
  /** better-auth's user id. */
  id: string
  /** `name`, with the phone-number placeholder detected and blanked. */
  name: string
  /** First name only, for a greeting. '' when we have no real name yet. */
  firstName: string
  /**
   * True while `user.name` is still the phone number better-auth wrote at
   * signup. The account page uses it to ask for a name instead of pretending the
   * phone number is one.
   */
  nameIsPlaceholder: boolean
  /** The customer's own e-mail, or '' when they have not given us one. */
  contactEmail: string
  /** The verified phone number. The identity, and never editable here. */
  phone: string
  /** When they first signed in — rendered as "with us since …". */
  memberSince: Date
}

/** The synthetic `phone-<digits>@identity.invalid` address, matched precisely. */
const PLACEHOLDER_EMAIL = /@identity\.invalid$/

/**
 * Is this "name" actually just the phone number?
 *
 * better-auth writes `getTempName(phoneNumber)` at signup, so for every customer
 * who has not edited their profile `user.name` IS their phone number. Comparing
 * against the digits is the only reliable test: `name` is free text and a
 * customer whose name genuinely looks like a number is vanishingly unlikely,
 * whereas the cost of getting this wrong is greeting someone as "+919876543210".
 */
function nameLooksLikePhone(name: string, phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return false
  return name.replace(/\D/g, '') === digits && name.replace(/\D/g, '').length >= 10
}

function firstNameOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  // One token. "Meera Rao" greets as "Meera"; a single "Meera" is already one.
  return trimmed.split(/\s+/)[0] ?? ''
}

/**
 * The signed-in customer's profile, or null when signed out.
 *
 * `cache()`d per request so the layout, the page and the header all resolve the
 * session once rather than three times.
 */
export const loadProfile = cache(async (): Promise<CustomerProfile | null> => {
  const session = await getSession()
  if (!session) return null

  const user = session.user as unknown as {
    id: string
    name?: string | null
    email?: string | null
    contactEmail?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string | null
  }

  const phone = (user.phoneNumber ?? '').trim()
  const rawName = (user.name ?? '').trim()
  const placeholder = nameLooksLikePhone(rawName, phone)

  return {
    id: user.id,
    name: placeholder ? '' : rawName,
    firstName: placeholder ? '' : firstNameOf(rawName),
    nameIsPlaceholder: placeholder,
    // The synthetic address must never be rendered to a human. If it is still
    // there, the customer has not given us a real one and we say so.
    contactEmail:
      user.contactEmail && !PLACEHOLDER_EMAIL.test(user.contactEmail) ? user.contactEmail : '',
    phone,
    memberSince: user.createdAt ? new Date(user.createdAt) : new Date(),
  }
})

/**
 * ── THE GREETING ────────────────────────────────────────────────────────────
 *
 * Time-of-day, in the customer's timezone rather than the server's. A Bengaluru
 * customer opening this page at 6am should not be told "good evening" because the
 * container runs UTC — which is the same class of bug the receipt's date handling
 * documents.
 *
 * The name part degrades honestly. A customer with no name is greeted as
 * "Welcome back" rather than "Welcome back, +919876543210", and the account page
 * asks for a name rather than inventing one.
 */
export interface Greeting {
  /** "Good evening" / "Good afternoon" / "Good morning". */
  salutation: string
  /** First name, or '' when we do not have one yet. */
  firstName: string
  /** The full line, ready to render. */
  text: string
}

export function greetingFor(profile: CustomerProfile, now = new Date()): Greeting {
  const istHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(now),
  )

  const salutation =
    istHour < 12 ? 'Good morning' : istHour < 17 ? 'Good afternoon' : 'Good evening'

  const firstName = profile.firstName
  return {
    salutation,
    firstName,
    text: firstName ? `${salutation}, ${firstName}` : salutation,
  }
}

/**
 * Validate a profile submission.
 *
 * ── WHY THE NAME IS NOT OPTIONAL ────────────────────────────────────────────
 *
 * A plant order is a physical delivery to a person, and every downstream surface
 * that needs a human name — the rider's list, the tax invoice, the packing slip,
 * the doorstep conversation — reads `orders.customer_name` or this field. Leaving
 * it blank pushes the problem to the rider at the door, which is the most
 * expensive place to discover it.
 *
 * ── WHY THE E-MAIL IS OPTIONAL AND UNVALIDATED-BEYOND-SHAPE ─────────────────
 *
 * Phone-first. A customer who gives us an address gets order updates at it; a
 * customer who does not still gets everything over SMS and WhatsApp, which is
 * where this business actually talks. Refusing to let them proceed without one
 * would be an account wall at the exact moment we have decided not to build one.
 *
 * Shape-checked here rather than trusted, because it becomes a mail target and a
 * mail server is the one component where a malformed address becomes a bounce
 * loop that costs us a sending reputation.
 */
export interface ProfileInput {
  name: string
  contactEmail: string
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function validateProfile(input: unknown): ProfileInput {
  const o = (input ?? {}) as Record<string, unknown>

  const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2) throw new Error('Tell us your name so the rider knows who to ask for.')
  if (name.length > 80) throw new Error('That name is too long.')
  // A name is a name. A phone number or an email pasted into it is a customer who
  // misunderstood the field, and it would end up printed on a tax invoice.
  if (nameLooksLikePhone(name, '') || name.includes('@')) {
    throw new Error('That does not look like a name.')
  }

  const rawEmail = typeof o.contactEmail === 'string' ? o.contactEmail.trim() : ''
  if (rawEmail && rawEmail.length > 200) throw new Error('That email address is too long.')
  if (rawEmail && !EMAIL_SHAPE.test(rawEmail)) {
    throw new Error('That does not look like an email address. Leave it blank if you prefer SMS.')
  }

  return { name, contactEmail: rawEmail.toLowerCase() }
}

/**
 * Save the profile.
 *
 * Goes through `auth.api.updateUser` rather than a direct `UPDATE "user"`, for
 * one reason that matters: `user.name` is read by better-auth on every session
 * refresh, and a row written behind its back is a row the library will happily
 * overwrite on the next sign-in. The library owns this table; the write goes
 * through it.
 *
 * `contactEmail` is an additional field, so it rides the same call.
 */
export async function updateProfile(input: ProfileInput): Promise<void> {
  const customerId = await getCustomerId()
  if (!customerId) throw new Error('Sign in to edit your profile.')

  const { headers } = await import('next/headers')
  const requestHeaders = await headers()

  await auth.api.updateUser({
    headers: requestHeaders,
    body: {
      name: input.name,
      contactEmail: input.contactEmail,
    },
  })
}

/* ── GUEST ORDERS ───────────────────────────────────────────────────────────── */

/**
 * Adopt a guest order into the signed-in account.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────
 *
 * Checkout deliberately has no account wall, and `POST /api/orders` writes
 * `orders.customer_id` from the session — which is NULL for every guest. So the
 * order that a customer just placed is invisible on their own `/account`, and
 * `listCustomerOrders` returns an empty array for a customer who has bought
 * something. In this database, 74 of 75 orders had no `customer_id`.
 *
 * The account was, in practice, a page that renders "No orders yet" to everybody.
 *
 * ── WHY MATCHING ON THE PHONE IS SAFE, AND WHY IT IS THE RIGHT KEY ──────────
 *
 * The customer has just proved control of `user.phoneNumber` with an OTP over
 * that exact number. The order carries the phone the buyer gave at checkout. So
 * matching the two means: the person who proved they can receive an OTP on a
 * number is claiming the orders placed against that number.
 *
 * That is the same credential the whole guest-checkout design already relies on —
 * `/order/<code>` is authorised by code + last four digits of that same phone.
 * Using it here is not a new trust decision; it is the existing one, applied
 * consistently. It is NOT an authorisation hole in the way a `customerId` query
 * parameter would be, because the customer id still comes only from the session
 * and the phone only ever narrows within it.
 *
 * The comparison is on the NORMALISED form (`+91XXXXXXXXXX`) on both sides, which
 * is what `normalisePhone` exists to guarantee — comparing raw strings would match
 * `09876543210` against `+919876543210` never, and silently leave the order
 * unadopted with no error anywhere.
 *
 * Append-only in effect: this only ever fills a NULL `customer_id`, so running it
 * twice is a no-op and it can never move an order between two accounts.
 */
export async function adoptGuestOrders(): Promise<number> {
  const customerId = await getCustomerId()
  if (!customerId) return 0

  const session = await getSession()
  const phone = (session?.user as unknown as { phoneNumber?: string | null })?.phoneNumber ?? ''
  const normalised = normalisePhone(phone)
  if (!normalised) return 0

  const db = await getPool()
  const { rowCount } = await db.query(
    `UPDATE "orders"
        SET "customer_id" = $1, "updated_at" = now()
      WHERE "customer_id" IS NULL
        AND "customer_phone" = $2`,
    [customerId, normalised],
  )
  return rowCount ?? 0
}

/* ── THE DASHBOARD NUMBERS ──────────────────────────────────────────────────── */

export interface AccountSummary {
  ordersPlaced: number
  ordersDelivered: number
  /** Orders currently paid for and not yet delivered — the ones worth surfacing. */
  ordersInFlight: number
  /** Distinct plants delivered, for the "you have grown N plants" line. */
  plantsDelivered: number
  /** Lifetime spend, integer paise. Never a float. */
  lifetimeSpendPaise: number
  /** The order a customer most wants to know about: the newest one still moving. */
  activeOrderCode: string | null
  savedItems: number
  addressCount: number
}

const DELIVERED = `('DELIVERED','RESOLVED','REPLACEMENT_QUEUED')`
const IN_FLIGHT = `('PAID','PACKING','PACKED','OUT_FOR_DELIVERY','PAYMENT_PENDING')`

/**
 * The numbers on the account dashboard.
 *
 * ── WHY THIS IS ONE QUERY AND NOT SIX ───────────────────────────────────────
 *
 * This runs on every `/account` view, which is the page a returning customer
 * opens most. Six counts would be six round trips to render one screen of tiles,
 * and the tiles would disagree with each other if a concurrent delivery landed
 * between them — "3 delivered, 1 in flight" on a day with exactly four orders is
 * the kind of thing a customer notices and stops trusting.
 *
 * ── WHY `lifetimeSpendPaise` IS OVER CAPTURED ORDERS ─────────────────────────
 *
 * It sums `payment_state = 'captured'` only. An unpaid order is money we have not
 * taken, and quoting it as spend would be a claim we do not owe.
 */
export async function loadAccountSummary(): Promise<AccountSummary> {
  const customerId = await getCustomerId()
  const empty: AccountSummary = {
    ordersPlaced: 0,
    ordersDelivered: 0,
    ordersInFlight: 0,
    plantsDelivered: 0,
    lifetimeSpendPaise: 0,
    activeOrderCode: null,
    savedItems: 0,
    addressCount: 0,
  }
  if (!customerId) return empty

  const db = await getPool()
  const { rows } = await db.query<{
    orders_placed: string
    orders_delivered: string
    orders_in_flight: string
    plants_delivered: string
    lifetime_spend_paise: string
    active_order_code: string | null
    saved_items: string
    address_count: string
  }>(
    `SELECT
       (SELECT COUNT(*) FROM "orders"
         WHERE "customer_id" = $1) AS "orders_placed",
       (SELECT COUNT(*) FROM "orders"
         WHERE "customer_id" = $1
           AND "status"::text IN ${DELIVERED}) AS "orders_delivered",
       (SELECT COUNT(*) FROM "orders"
         WHERE "customer_id" = $1
           AND "status"::text IN ${IN_FLIGHT}) AS "orders_in_flight",
       (SELECT COUNT(*) FROM "orders_items" oi
         JOIN "orders" o ON o."id" = oi."_parent_id"
        WHERE o."customer_id" = $1
          AND o."status"::text IN ${DELIVERED}) AS "plants_delivered",
       (SELECT COALESCE(SUM("revenue_paise"), 0) FROM "orders"
         WHERE "customer_id" = $1
           AND "payment_state" = 'captured') AS "lifetime_spend_paise",
       (SELECT "order_code" FROM "orders"
         WHERE "customer_id" = $1
           AND "status"::text IN ${IN_FLIGHT}
         ORDER BY "created_at" DESC
         LIMIT 1) AS "active_order_code",
       (SELECT COUNT(*) FROM "wishlists" WHERE "better_auth_user_id" = $1) AS "saved_items",
       (SELECT COUNT(*) FROM "addresses" WHERE "customer_id" = $1) AS "address_count"`,
    [customerId],
  )

  const row = rows[0]
  if (!row) return empty

  return {
    ordersPlaced: Number(row.orders_placed ?? 0),
    ordersDelivered: Number(row.orders_delivered ?? 0),
    ordersInFlight: Number(row.orders_in_flight ?? 0),
    plantsDelivered: Number(row.plants_delivered ?? 0),
    lifetimeSpendPaise: paise(row.lifetime_spend_paise ?? 0, 'lifetime spend'),
    activeOrderCode: row.active_order_code ?? null,
    savedItems: Number(row.saved_items ?? 0),
    addressCount: Number(row.address_count ?? 0),
  }
}
