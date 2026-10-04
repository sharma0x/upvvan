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
  },

  database: {
    url: process.env.DATABASE_URL ?? '',
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
    /** Named grievance officer — a mandatory E-Commerce Rules 2020 disclosure. */
    grievanceOfficerName: str('GRIEVANCE_OFFICER_NAME', ''),
    grievanceOfficerEmail: str('GRIEVANCE_OFFICER_EMAIL', ''),
    legalEntityName: str('LEGAL_ENTITY_NAME', ''),
    principalAddress: str('PRINCIPAL_ADDRESS', ''),
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
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required configuration: ${missing.join(', ')}. Copy .env.example to .env.`,
      missing,
    )
  }
}
