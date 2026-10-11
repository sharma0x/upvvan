/**
 * Application configuration.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * The rule this codebase follows: **nothing operational is hardcoded.**
 *
 * Every value that encodes a business decision — a port, a secret, a pincode
 * pattern, an OTP lifetime, a launch band — is read from the environment, with
 * an explicit default and a documented reason. The reason is not style. Two
 * concrete failures this prevents:
 *
 *   1. A per-city commercial decision baked into a module cannot be changed by
 *      the founder without a developer and a deploy. "Adding a new city must
 *      cost zero code changes" (product-design.md §1) is false the moment a band
 *      table lives in a source file.
 *   2. A value duplicated between code and environment drifts silently. The
 *      port that the Dockerfile exposes but the app ignores is a class of bug
 *      that only shows up in production.
 *
 * ── THE THREE TIERS ────────────────────────────────────────────────────────
 *
 *   required  — no default. The app refuses to start without it. A secret that
 *               silently defaults to '' is a security incident waiting for a
 *               deploy.
 *   defaulted — a sensible default with a documented reason. Dev ergonomics.
 *   derived   — computed from the environment, never set twice.
 *
 * ── WHY SECRETS ARE VALIDATED, NOT DEFAULTED ───────────────────────────────
 *
 * `PAYLOAD_SECRET = ''` would boot and then fail every session validation at
 * runtime, in front of a customer. Failing at startup is strictly better: it
 * fails on the developer's machine, where it is cheap.
 */

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly missing: string[] = [],
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

function str(name: string, fallback: string): string {
  const value = process.env[name]
  return value && value.trim() !== '' ? value : fallback
}

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`${name} must be an integer, received "${raw}".`)
  }
  return parsed
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

/**
 * In production a placeholder secret must never boot. The dev fallback exists so
 * `pnpm dev` works on a fresh clone; it is a hard failure in production, not a
 * warning, because a known secret in production is a known secret everywhere.
 */
function secret(name: string): string {
  const value = process.env[name]
  const PLACEHOLDERS = ['dev-only', 'change-me', 'placeholder']

  if (!value || value.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new ConfigError(
        `${name} is required in production. A secret with no default is a security incident waiting for a deploy.`,
        [name],
      )
    }
    return `insecure-dev-only-${name}-do-not-use-in-production`
  }

  if (
    process.env.NODE_ENV === 'production' &&
    PLACEHOLDERS.some((p) => value.toLowerCase().includes(p))
  ) {
    throw new ConfigError(
      `${name} still contains a development placeholder. Generate a real one: openssl rand -hex 32`,
      [name],
    )
  }

  if (value.length < 32) {
    throw new ConfigError(
      `${name} must be at least 32 characters, received ${value.length}. Generate one with: openssl rand -hex 32`,
    )
  }

  return value
}

export const config = {
  env: str('NODE_ENV', 'development'),

  server: {
    /** Derived so the port is set in exactly one place. */
    port: int('PORT', 3100),
    url: str('NEXT_PUBLIC_SERVER_URL', `http://localhost:${int('PORT', 3100)}`),

    /**
     * Origins the auth server will accept a request from.
     *
     * ── WHY THIS IS A LIST AND NOT `url` ───────────────────────────────────────
     *
     * `NEXT_PUBLIC_SERVER_URL` is the canonical, deployed origin and the one that
     * belongs in `baseURL`. But it is also the value a developer's `.env` copied
     * from `.env.example` carries forever, which means it can disagree with the port
     * the app is actually running on.
     *
     * better-auth checks the `Origin` header against its trusted origins and
     * refuses anything else — correctly, because that check is the CSRF defence.
     * So with `NEXT_PUBLIC_SERVER_URL=http://localhost:3100` and `PORT=3000`, every
     * auth call was rejected before it did anything:
     *
     *     [Better Auth]: Invalid origin: http://localhost:3000
     *
     * and the sign-in button reported "We could not send a code just now" — a
     * message about our SMTP failing, caused entirely by a port mismatch. No OTP
     * error, no 500, no failing test: the rejection is a clean 200 with an error
     * body.
     *
     * The fix is to trust every origin this deployment can actually be served from,
     * and to derive that list from CONFIG rather than from the incoming request. It
     * is deliberately not a wildcard, and nothing here reads a header: widening this
     * to "whatever the browser claims" would turn the CSRF defence off.
     */
    origins: [
      str('NEXT_PUBLIC_SERVER_URL', `http://localhost:${int('PORT', 3100)}`),
      `http://localhost:${int('PORT', 3100)}`,
      `http://127.0.0.1:${int('PORT', 3100)}`,
    ],
  },

  database: {
    url: process.env.DATABASE_URL ?? '',
    /**
     * Connections this process may open, for EVERY module.
     *
     * There is one pool in the application (`src/lib/db/pool.ts`) and this is its
     * ceiling. It used to be per-module — nine pools, one of them `max: 20` —
     * which is how `next build` came to fail with "sorry, too many clients
     * already" while prerendering.
     *
     * Config, not a constant, so an operator who knows their database can raise it
     * without touching code.
     */
    poolMax: int('DATABASE_POOL_MAX', 10),
  },

  payload: {
    secret: secret('PAYLOAD_SECRET'),
  },

  auth: {
    /**
     * better-auth owns CUSTOMER identity (STACK-DECISION.md §5). Staff identity
     * is Payload's own `users` collection.
     */
    secret: secret('BETTER_AUTH_SECRET'),
    url: str('BETTER_AUTH_URL', `http://localhost:${int('PORT', 3100)}`),
    /** OTP lifetime, seconds. Configurable because it is a commercial decision. */
    otpExpiresIn: int('AUTH_OTP_EXPIRES_IN', 300),
    otpLength: int('AUTH_OTP_LENGTH', 6),

    /**
     * The DELIVERY code's lifetime — the one a customer reads out at the door.
     *
     * ── WHY THIS IS NOT `otpExpiresIn` ────────────────────────────────────────
     *
     * It was, for as long as there was one. `otpExpiresIn` is 300 seconds, which
     * is correct for a sign-in OTP and catastrophically wrong for this one:
     *
     *   `createDispatch` stamped `delivery_otp_expires_at = now() + otpExpiresIn`
     *   at ASSIGNMENT.
     *
     * So the window to close a delivery began when a dispatcher clicked Assign —
     * possibly at 6pm for an 8pm drop — and lasted five minutes. After that,
     * `verifyDeliveryOtp` refused with `OTP_EXPIRED`, and the rider had exactly
     * one remedy: `reissueOtp`. Which had no route, no button and no caller
     * anywhere in the product, while three separate rider-facing error messages
     * instructed them to "ask the dispatcher to reissue it".
     *
     * The honest lifetime is a DELIVERY WINDOW, not an OTP window: long enough
     * to cover a run, short enough that a code found in a screenshot a week later
     * is worthless. Twelve hours covers a full shift with room to spare.
     *
     * Separate from `otpExpiresIn` rather than sharing a larger value, because
     * lengthening the sign-in OTP to twelve hours would be a real regression: a
     * code sitting in a WhatsApp bubble would still work at lunchtime.
     */
    deliveryOtpExpiresIn: int('DELIVERY_OTP_EXPIRES_IN', 60 * 60 * 12),

    /** A rider's shift. Long enough for a day, short enough to matter tomorrow. */
    riderSessionTtlSeconds: int('RIDER_SESSION_TTL_SECONDS', 12 * 60 * 60),
    sessionExpiresIn: int('AUTH_SESSION_EXPIRES_IN', 60 * 60 * 24 * 30),
    sessionUpdateAge: int('AUTH_SESSION_UPDATE_AGE', 60 * 60 * 24),
    /** A customer must not be silently signed out mid-checkout. */
    freshAge: int('AUTH_SESSION_FRESH_AGE', 60 * 5),
  },

  storage: {
    endpoint: str('S3_ENDPOINT', 'http://localhost:59000'),
    region: str('S3_REGION', 'us-east-1'),
    bucket: str('S3_BUCKET', 'upvvan-media'),
    accessKeyId: str('S3_ACCESS_KEY_ID', 'minioadmin'),
    secretAccessKey: str('S3_SECRET_ACCESS_KEY', 'minioadmin'),
  },

  email: {
    host: str('SMTP_HOST', 'localhost'),
    port: int('SMTP_PORT', 51025),
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from: str('EMAIL_FROM', 'hello@upvvan.local'),
    fromName: str('EMAIL_FROM_NAME', 'Upvvan'),

    /**
     * The domain customer-facing mail is addressed AT.
     *
     * Customers and riders do not have e-mail addresses — this is a phone-first
     * business and the identity is an OTP on a mobile. So their mailboxes are
     * synthesised: `meera.919000000001@mail.upvvan.local`, delivered over SMTP to
     * Mailpit in dev and, in production, to whatever catches that domain.
     *
     * Read from config rather than from `process.env` at the call site. It was
     * `process.env.CUSTOMER_EMAIL_DOMAIN` inside `lib/email/address.ts`, which is
     * the exact thing this file exists to prevent: four routes were also reading
     * `ORDER_ALERTS_EMAIL` directly, so there were five places in the application
     * that decided where mail goes, and no single one to change.
     */
    customerDomain: str('CUSTOMER_EMAIL_DOMAIN', 'mail.upvvan.local'),

    /**
     * Where the owner's "something needs a person" alerts go.
     *
     * `ORDER_ALERTS_EMAIL` was read directly in four routes — new order, claim,
     * contact message, quote request. All four are the messages that are worthless
     * if nobody sees them, so a typo in one env var name silently disarmed one of
     * them and nothing anywhere said so.
     *
     * Empty is allowed: `loadBusinessSettings().customerCareEmail` is the
     * fallback, so an unset value still delivers somewhere sensible.
     */
    orderAlertsEmail: str('ORDER_ALERTS_EMAIL', ''),
  },

  /**
   * Business configuration.
   *
   * These are the values that must NOT be hardcoded in domain modules — each is
   * a decision the founder may legitimately change. Per-city commercial values
   * (bands, guarantee tier, free-delivery threshold) live in the DATABASE, not
   * here, because they vary per city. What lives here is genuinely global.
   */
  business: {
    /**
     * Launch distance bands, in paise, used only to SEED a new city's band table.
     * After seeding, the database is the source of truth — a city with different
     * bands needs no code change and no redeploy.
     *
     * The values themselves are the launch configuration from
     * product-design.md §4.1: ₹45 / ₹60 / ₹75 over a 12km zone.
     */
    seedBands: [
      { code: 'A', minKm: 0, maxKm: 3, payPaise: 4500 },
      { code: 'B', minKm: 3, maxKm: 7, payPaise: 6000 },
      { code: 'C', minKm: 7, maxKm: 12, payPaise: 7500 },
    ],

    /** Indian pincodes are exactly 6 digits. Configurable for a future change. */
    pincodePattern: str('PINCODE_PATTERN', '^[0-9]{6}$'),

    /**
     * Whether COD is offered. STRUCTURALLY FALSE and not operator-configurable.
     *
     * A COD return leg is 25–30 days and the returned plant is non-saleable in
     * every competitor policy we examined — a total write-off, not returned
     * inventory. The absence is the business model, so it is not a setting
     * anyone can flip; the database CHECK constraint enforces it too. This
     * constant exists only so the UI can explain the absence.
     */
    codOffered: false,

    /** GST rate in basis points (1800 = 18%). Integer, to avoid float tax math. */
    defaultTaxRateBp: int('DEFAULT_TAX_RATE_BP', 1800),
  },

  compliance: {
    /*
     * Consumer Protection (E-Commerce) Rules 2020, r.4(2) and r.4(4).
     *
     * These were defined here and read by NOTHING — the compliance review found
     * four documented keys wired to zero consumers, with blank env values, while
     * `assertConfigValid` only checked DATABASE_URL. A compliance block nobody
     * imports is a requirement that was written down and never met.
     *
     * Now: rendered by `SiteFooter`, and the boot-time check below refuses to
     * start without them. The trade-off is deliberate — the app will not boot
     * with an unconfigured grievance officer, which is exactly the state a
     * launch-blocking disclosure gap looks like.
     */
    /** Legal name of the entity — r.4(2)(a). */
    legalEntityName: str('LEGAL_ENTITY_NAME', ''),
    /** Principal geographic address of headquarters — r.4(2)(b). */
    principalAddress: str('PRINCIPAL_ADDRESS', ''),
    /** Customer care e-mail and telephone — r.4(2)(d). */
    customerCareEmail: str('CUSTOMER_CARE_EMAIL', ''),
    customerCarePhone: str('CUSTOMER_CARE_PHONE', ''),
    /** Grievance officer: name, designation and contact — r.4(4). */
    grievanceOfficerName: str('GRIEVANCE_OFFICER_NAME', ''),
    grievanceOfficerDesignation: str('GRIEVANCE_OFFICER_DESIGNATION', ''),
    grievanceOfficerEmail: str('GRIEVANCE_OFFICER_EMAIL', ''),
    grievanceOfficerPhone: str('GRIEVANCE_OFFICER_PHONE', ''),
  },

  features: {
    /**
     * Feature flags default OFF. Deliberately not read from the database for
     * things the price book owns (guarantee tiers live in `price-books`), but
     * available for infrastructure-shaped switches that no operator should
     * touch from the UI.
     */
    enableE2E: bool('ENABLE_E2E', false),
  },
} as const

export type AppConfig = typeof config

/** Fails fast at startup rather than at first request. Call from instrumentation. */
export function assertConfigValid(): void {
  const missing: string[] = []
  if (!config.database.url) missing.push('DATABASE_URL')

  /*
   * Compliance disclosures are NOT optional in production.
   *
   * Consumer Protection (E-Commerce) Rules 2020 r.4(2) and r.4(4) require the
   * legal entity name, principal address, customer-care contact, and a named
   * grievance officer with a designation — all displayed accessibly on the
   * platform. Failing fast here means the site cannot boot while quietly
   * rendering an empty footer, which is precisely how this gap survived a
   * review unnoticed.
   *
   * Skipped when ENABLE_E2E is on, so tests do not need a real officer.
   */
  if (!config.features.enableE2E) {
    const required: Array<[keyof typeof config.compliance, string]> = [
      ['legalEntityName', 'LEGAL_ENTITY_NAME'],
      ['principalAddress', 'PRINCIPAL_ADDRESS'],
      ['customerCareEmail', 'CUSTOMER_CARE_EMAIL'],
      ['customerCarePhone', 'CUSTOMER_CARE_PHONE'],
      ['grievanceOfficerName', 'GRIEVANCE_OFFICER_NAME'],
      ['grievanceOfficerDesignation', 'GRIEVANCE_OFFICER_DESIGNATION'],
      ['grievanceOfficerEmail', 'GRIEVANCE_OFFICER_EMAIL'],
      ['grievanceOfficerPhone', 'GRIEVANCE_OFFICER_PHONE'],
    ]
    for (const [key, envName] of required) {
      if (!config.compliance[key]) missing.push(envName)
    }
  }

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required configuration: ${missing.join(', ')}. Copy .env.example to .env.`,
      missing,
    )
  }
}
