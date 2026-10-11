import { Pool } from 'pg'
import { betterAuth } from 'better-auth'
import { phoneNumber as phoneNumberPlugin } from 'better-auth/plugins'

import { config } from '@/lib/config'
import { deliverOtp } from '@/lib/auth/otp-delivery'

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

  /*
   * The CSRF defence, and the reason a port mismatch is fatal rather than cosmetic.
   *
   * better-auth rejects any request whose `Origin` is not in this list, so with
   * `NEXT_PUBLIC_SERVER_URL` pinned to :3100 and the app actually on :3000, every
   * `sendOtp` died with "Invalid origin" and the customer was told our SMS gateway
   * was down.
   *
   * The list comes from configuration, never from the request — trusting the
   * incoming header would disable the check entirely.
   */
  trustedOrigins: [...config.server.origins],

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
    additionalFields: {
      /*
       * ── WHY THE CUSTOMER'S REAL EMAIL IS NOT `user.email` ─────────────────
       *
       * `user.email` is NOT NULL UNIQUE and carries a synthetic
       * `phone-<digits>@identity.invalid` placeholder (see `getTempEmail`). It is
       * a UNIQUENESS TOKEN, not a contact address, and the account page must
       * never render it as one.
       *
       * The obvious fix — let the customer update `user.email` — is refused by
       * better-auth outright: `updateUser` throws `EMAIL_CAN_NOT_BE_UPDATED`
       * (dist/api/routes/update-user.mjs:52), and `changeEmail` requires an
       * email-verification round trip with a `sendVerificationEmail` callback
       * that does not exist in a phone-first business where the OTP already
       * proved who they are.
       *
       * So the address a customer actually gives us lives in its own column.
       * It is NEVER used to authenticate anything: the phone remains the only
       * credential (C-1), this address only ever receives order updates, and it
       * is deliberately NOT flagged verified — so nothing in the product can
       * claim we have confirmed it. A customer who mistypes it gets fewer
       * e-mails, and a stranger cannot sign in with it because there is no
       * password flow to sign in with.
       */
      contactEmail: {
        type: 'string',
        required: false,
        input: true,
      },
    },
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
      //
      // Delivered over SMTP to Mailpit in dev so the code is actually READABLE
      // by the developer (http://localhost:58025), and logged for the terminal.
      // Phase 4 swaps `deliverOtp` for the WhatsApp Business API; the hook shape
      // does not change.
      sendOTP: deliverOtp,

      // The phone number IS the identifier, so it must be verified before use.
      // An unverified number is precisely how two records get created for one
      // human — which is the failure C-1 exists to prevent.
      requireVerification: true,

      expiresIn: config.auth.otpExpiresIn,

      // ── WHY THIS BLOCK IS LOAD-BEARING ────────────────────────────────────
      //
      // `/sign-in/phone-number` is a PASSWORD endpoint. It looks up the user,
      // then requires `findCredentialAccount(user.id)` to return a password
      // hash. With `emailAndPassword.enabled: false` (above) no credential
      // account is ever created, so that endpoint CANNOT succeed here — it
      // throws INVALID_PHONE_NUMBER_OR_PASSWORD for every correct OTP. This
      // project is passwordless; that endpoint is simply the wrong tool.
      //
      // The flow that actually works, and the one the sign-in page drives:
      //
      //   1. POST /phone-number/send-otp  { phoneNumber }  → stores the code
      //   2. POST /phone-number/verify   { phoneNumber, code } → session
      //
      // Step 2 handles BOTH cases in one call: an existing user is looked up and
      // marked verified; an unknown number is CREATED here. Without this option,
      // step 2 on an unknown number throws FAILED_TO_UPDATE_USER and a brand-new
      // customer can never sign up — sign-in works only for numbers that already
      // exist, which is a signup flow that silently does not exist.
      signUpOnVerification: {
        /*
         * `user.email` is NOT NULL UNIQUE, so better-auth cannot create a user
         * without one even when email auth is disabled. We synthesise a stable,
         * deterministic placeholder derived from the phone number.
         *
         * Deterministic, not random: `+9198XXXXXXXX` always maps to the same
         * address, so a re-verification cannot collide with the UNIQUE index and
         * create a SECOND identity row for one human — the exact failure C-1
         * exists to prevent. `.invalid` is RFC 2606 reserved and can never be
         * delivered to, so this can never collide with a real person's inbox or
         * receive mail. This is a uniqueness token, NOT a contact address, and
         * must never be rendered to a customer as one.
         */
        getTempEmail: (phoneNumber) => `phone-${phoneNumber.replace(/\D/g, '')}@identity.invalid`,
        /*
         * Until onboarding collects a name we have none, so the phone number is
         * the display name. Naming it here — rather than letting better-auth
         * default to the raw number — documents that this is a placeholder.
         */
        getTempName: (phoneNumber) => phoneNumber,
      },
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
    /*
     * REMOVED: `requestOTPOnSignIn: true`.
     *
     * That key does not exist anywhere in better-auth 1.7.7 — grepped across the
     * published dist. It was silently doing nothing while its comment claimed it
     * prevented "any client POSTing an arbitrary number to receive a challenge
     * for someone else's account".
     *
     * That claim is worth preserving, because it is TRUE, but it is enforced by
     * the client flow rather than this flag: the sign-in page calls
     * `/phone-number/send-otp` explicitly, so a code is only ever generated in
     * response to the customer asking to sign in. The protection was real; the
     * switch that appeared to provide it was not.
     *
     * A config key that does nothing but read like a security control is worse
     * than no key at all — the next reader trusts it.
     */
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.env === 'production',
    },
  },
})

export type Auth = typeof auth
