/**
 * A fixed-window rate limiter, in memory, per process.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * Order lookup and claim creation take a customer-supplied order code. Codes are
 * now 48 bits of CSPRNG, so guessing one is not a practical attack — but the
 * endpoints still accept unlimited attempts, which means unlimited 10,000-way
 * PIN guesses against a KNOWN code. A customer who has their own order code (from
 * a screenshot, a group chat, an old email) can brute-force the four digits at
 * 4 requests/second forever. The code is secret; the tail is not.
 *
 * So: bounded attempts per client per window, and the window is stated to the
 * caller so the UI can say "try again in a minute" instead of a bare 429.
 *
 * ── WHY IN-MEMORY AND WHAT THAT COSTS — READ THIS BEFORE SCALING ────────────
 *
 * THIS IS PER-INSTANCE STATE. It does not survive a restart and it does not
 * coordinate across instances. Behind two app replicas, an attacker gets 2× the
 * budget by alternating requests, and a deploy resets every counter.
 *
 * That is an accepted trade for a single-process deployment, which is what this
 * project is (AGENTS.md: "Single process, single database"). It is NOT acceptable
 * for a horizontally scaled deployment, and the replacement is a fixed-window
 * counter in Postgres:
 *
 *   INSERT INTO rate_limit_buckets (key, window_start, hits) VALUES ($1, $2, 1)
 *   ON CONFLICT (key, window_start)
 *   DO UPDATE SET hits = rate_limit_buckets.hits + 1
 *   RETURNING hits;
 *
 * keyed by a hash of (client ip, purpose) with a UNIQUE (key, window_start), so
 * the increment is atomic and the row self-expires with the window. That table is
 * deliberately NOT created here — a rate-limit table added without the migration
 * that owns it is exactly the kind of drift this project forbids.
 */
export interface RateLimitDecision {
  allowed: boolean
  /** Attempts left in the current window. Shown to the customer, never the limit. */
  remaining: number
  /** Whole seconds until the window resets. 0 when allowed. */
  retryAfterSeconds: number
}

interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

/**
 * Sweep interval. Without it the Map is an unbounded memory leak keyed by client
 * address — a slow leak that only shows up in production, which is the worst
 * place to meet it.
 */
const SWEEP_MS = 60_000
let lastSweep = Date.now()

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(key)
  }
}

/**
 * WINDOW_MS and MAX_ATTEMPTS are deliberately module constants rather than config
 * keys, and the reason is worth being explicit about: they are abuse thresholds
 * for a 10,000-value keyspace, not operational facts about this business. An
 * operator tuning MAX_ATTEMPTS would be weakening a security control from a
 * config file, and the number has no business being a per-deployment decision. If
 * this ever needs to vary, it varies by code review.
 */
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 8

/**
 * @param key   identifies the caller. IP alone is not enough behind a proxy —
 *              the route layer is responsible for resolving it, and comments
 *              there must say which header it trusts.
 * @param purpose names the action being limited, so exhausting lookup does not
 *              also lock a customer out of raising a claim about an order they
 *              legitimately own.
 */
export function consume(key: string, purpose: string): RateLimitDecision {
  const now = Date.now()
  sweep(now)

  const bucketKey = `${purpose}:${key}`
  const existing = buckets.get(bucketKey)

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(bucketKey, { count: 1, windowStart: now })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1

  if (existing.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - existing.windowStart)) / 1000),
    )
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - existing.count, retryAfterSeconds: 0 }
}

/** Reset a key. Only for tests — a production caller would be a bypass. */
export function resetLimiter(): void {
  buckets.clear()
}