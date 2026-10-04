import { Pool } from 'pg'
import { betterAuth } from 'better-auth'
import { phoneNumber as phoneNumberPlugin } from 'better-auth/plugins'

import { config } from '@/lib/config'

/**
 * CUSTOMER IDENTITY — the single owner. This is C-1.
 *
 * Read this file and the file header in src/collections/Users.ts together; they
 * are the two halves of one decision.
 *
 * ── WHAT LIVES HERE ────────────────────────────────────────────────────────
 * better-auth owns the `user` table outright: the customer's verified phone
 * number, their name, their session. There is exactly ONE customer identity in
 * this system and this file is it.
 *
 * ── WHAT DOES NOT LIVE HERE, AND WHY ───────────────────────────────────────
 * There is NO `Customers` collection in this project. That is a deliberate
 * divergence from the reference repo, which runs three identity surfaces
 * (better-auth's user model, Payload's `Users`, and a `Customers` collection
 * linked by `betterAuthUserId`).
 *
 * That third surface is the shape C-1 warns about. A mirror table holding
 * email/phone/name is a second copy of identity, kept in sync by a job — and
 * mirrors are permanent operational surface whose failure mode is two customer
 * records. The consequence is invisible at build time and shows up in month
 * three as a support agent who cannot tell which of two rows is the customer.
 *
 * So: no mirror, and therefore no sync job to fail. What Payload tables that
 * need customer context store is a plain `customer_id` text column with a real
 * foreign key to better-auth's `user.id` — created in our migrations, in the
 * same DDL history as everything else. See STACK-DECISION.md §5.
 *
 * ── WHY PHONE + OTP, NOT EMAIL + PASSWORD ─────────────────────────────────
 * The buyer is in a rented flat in one city, support is WhatsApp-first with a
 * <15 minute SLA, and DPDP consent has to attach at signup (substantial
 * provisions effective 13 May 2027). Email/password is the wrong primitive for
 * that customer. We do not build a password-reset flow we would then staff.
 *
 * A passwordless flow also removes an entire support ticket category, which
 * matters when the differentiator is that a human answers.
 *
 * ── STAFF ARE A DIFFERENT SUBJECT ──────────────────────────────────────────
 * Staff authenticate through Payload's own `Users` collection. The two systems
 * share a database and nothing else. Neither stores the other's identity
 * fields, and there is no projection between them. Because they are already
 * separate, swapping staff auth to an employer IdP later cannot touch customer
 * identity.
 */
export const auth = betterAuth({
  appName: 'Upvvan',

  secret: config.auth.secret,

  baseURL: config.auth.url,

  // Single source of truth, in the single Postgres 18 database (C-4). No second
  // datastore, no separate auth service — C-5.
  //
  // better-auth detects the database by SHAPING the `database` option, not by
  // reading `provider`. It checks for a `connect` method to infer Postgres and
  // wraps it in a PostgresDialect internally. So this must be the pg Pool
  // ITSELF:
  //
  //   database: new Pool(...)              ✅  ("connect" in db → PostgresDialect)
  //   database: { provider: 'pg', ... }    ❌  no `connect` → kysely is null
  //                                            → "Failed to initialize database adapter"
  //
  // The `provider` key is not consulted on this path. This cost an hour to find
  // by reading better-auth's dist, so it is recorded here for the next reader.
  database: new Pool({ connectionString: config.database.url }) as never,

  user: {
    modelName: 'user',
    // NOTE: the phone columns are contributed by `phoneNumberPlugin` below, NOT
    // declared here.
    //
    // An earlier draft declared `phoneNumber` inside `user.fields`. better-auth
    // does not accept per-field config in that shape — it produced a literal
    // column named `[object Object]`, which is a spectacularly quiet failure:
    // the migration succeeded, and the customer identity column did not exist.
    // The plugin owns `phoneNumber`, `phoneNumberVerified` and their UNIQUE
    // constraint, which is exactly the constraint C-1 depends on.
  },

  // Passwordless. Stated explicitly rather than left to default, because this
  // is a security decision, not an omission: there is no password to forget, no
  // password-reset flow to staff, and no phished credential to breach. A support
  // agent whose differentiator is answering in 15 minutes should not be
  // resetting passwords.
  emailAndPassword: {
    enabled: false,
  },

  plugins: [
    phoneNumberPlugin({
      otpLength: config.auth.otpLength,

      // `sendOTP` and `sendVerificationCode` are TOP-LEVEL options on the plugin,
      // not nested under an `otp` object. The callback receives
      // `{ phoneNumber, code }` — not `{ number, code }`. Getting this shape
      // wrong is a type error, which is the good kind of wrong.
      sendOTP: async ({ phoneNumber, code }) => {
        // Phase 4 wires this to the WhatsApp Business API. Until then it is
        // logged, so local development and tests can complete a login.
        console.log(`[auth] OTP for ${phoneNumber}: ${code}`)
      },

      // The phone number IS the identifier, so it must be verified before use.
      // An unverified number is precisely how two records get created for one
      // human — which is the failure C-1 exists to prevent.
      requireVerification: true,
    }),
  ],

  session: {
    expiresIn: config.auth.sessionExpiresIn,
    updateAge: config.auth.sessionUpdateAge,
    // A customer should not be silently signed out mid-checkout.
    freshAge: config.auth.freshAge,
  },

  // DPDP consent architecture is captured at signup (Act 2023, substantial
  // provisions effective 13 May 2027 — architect now, do not retrofit).
  // The consent LOG is a Payload collection with its own append-only shape; this
  // hook records the event, it does not become the record's owner.
  account: {
    accountLinking: {
      enabled: false,
    },
  },

  advanced: {
    // Request the OTP rather than trusting a caller-supplied phone number.
    // Without this, any client could POST an arbitrary number and receive a
    // challenge for someone else's account.
    requestOTPOnSignIn: true,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.env === 'production',
    },
  },
})

export type Auth = typeof auth
