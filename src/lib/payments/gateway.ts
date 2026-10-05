/**
 * The payment gateway — a SIMULATED one, and honest about being simulated.
 *
 * ── WHY THIS EXISTS RATHER THAN A REAL PSP INTEGRATION ──────────────────────
 *
 * Razorpay/Cashfree need live merchant credentials and a webhook endpoint on a
 * public host. Neither can exist inside a checkout test, and — more importantly
 * — a fake that reports success when nothing was charged is worse than no
 * integration at all, because the order page then tells a customer their money
 * moved when it did not.
 *
 * So the gateway is simulated at the SHAPE level, not faked at the result level.
 * It has intents, it has an authorisation step, it has capture, it has decline
 * paths with the failure codes a real PSP returns, and it is idempotent. Swapping
 * it for a real one means implementing the same interface with HTTP; nothing
 * above this file changes, because nothing above it knows the money is fake.
 *
 * ── THE ONE THING THAT MUST NEVER HAPPEN ────────────────────────────────────
 *
 * An order page that says "Order placed" when no money moved. The customer-facing
 * consequence of getting this wrong is a company that takes orders it has not
 * paid for, and the whole prepaid-only model collapses the first time someone
 * realises it. So the state machine below is explicit about four distinct
 * outcomes, and `PaymentState` distinguishes "we asked the gateway" from "the
 * gateway said yes".
 *
 * ── WHAT IS CONFIG-DRIVEN, NOT HARDCODED ────────────────────────────────────
 *
 * `config.payments.simulatedGateway.*` — see the additions reported for
 * src/lib/config.ts. The latency, the decline codes, the intent-id prefix and the
 * capture delay are all operational facts, not code. A simulated gateway that
 * responds instantly trains us to write UI that flashes "paid" for 40ms.
 */

/**
 * Config block the payments module reads.
 *
 * Declared here as a structural type rather than imported from `config` so the
 * module compiles and unit-tests WITHOUT the config.ts edit landing first — the
 * shape is the contract, and the report of the required keys is the same list.
 * `simulatedGatewayFromEnv()` is the single place env is read for these values,
 * so merging the config.ts block later is a two-line change here and a deletion
 * of this function.
 */
export interface PaymentGatewayConfig {
  /** Gateway identifier recorded on the intent. */
  provider: string
  /** Prefix for generated intent ids, so a simulated intent is never mistaken for a real one. */
  intentIdPrefix: string
  /**
   * Artificial latency, milliseconds. Non-zero on purpose: instant capture makes
   * it easy to ship a UI with no pending state, which is the bug this whole
   * exercise is about.
   */
  latencyMs: number
  /** How long a created intent stays capturable. Past this, capture must fail. */
  intentTtlMinutes: number
  /** Card-like values that force a decline, so the decline UI is reachable in a test. */
  declineCodes: readonly string[]
}

export const DEFAULT_PAYMENT_GATEWAY_CONFIG: PaymentGatewayConfig = {
  provider: 'simulated',
  intentIdPrefix: 'pi_sim_',
  latencyMs: 350,
  intentTtlMinutes: 30,
  declineCodes: ['CARD_DECLINED', 'INSUFFICIENT_FUNDS', 'AUTH_TIMEOUT'],
}

/**
 * ── THE FOUR STATES, AND WHY FOUR ───────────────────────────────────────────
 *
 * `created`    — we hold an intent; no money has moved and none can.
 * `processing` — the gateway call is in flight. Distinct from `created` because
 *                a UI that renders `created` while a request is open will happily
 *                say "pending" after a capture that actually succeeded.
 * `captured`   — money moved. The ONLY state in which an order may say "paid".
 * `failed`     — the gateway refused. Carries a code the customer never sees but
 *                support does, because "payment failed" with no code is unactionable.
 */
import { randomBytes } from 'node:crypto'

/**
 * Randomness, in one place.
 *
 * `node:crypto` imported at module scope, not lazily required inside the function:
 * this module is imported by route handlers under the App Router, where a
 * `require()` at call time is a bundler hazard rather than a convenience.
 */
export type PaymentState = 'created' | 'processing' | 'captured' | 'failed'

export interface PaymentIntent {
  /** Opaque to the storefront, meaningless to a human. */
  id: string
  orderCode: string
  /** INTEGER PAISE. Never rupees, never a float — see AGENTS.md. */
  amountPaise: number
  currency: 'INR'
  state: PaymentState
  provider: string
  createdAt: string
  /** Present only once captured. This is the audit value a real PSP webhook gives us. */
  capturedAt?: string
  /** Gateway reference — the PSP's own id for the charge, not ours. */
  gatewayPaymentId?: string
  /** Machine-readable failure code. NEVER rendered to the customer. */
  failureCode?: string
}

/**
 * What the customer is told. Kept as its own type so a route cannot render
 * `failureCode` by accident — the decline path has exactly one legal output, and
 * it is prose written for a person whose card was refused.
 */
export interface PaymentFailure {
  code: string
  /** Customer-facing sentence. Say what happened and what to do next. */
  message: string
}

const DECLINE_MESSAGES: Record<string, string> = {
  CARD_DECLINED: 'Your bank declined this payment. No money has left your account.',
  INSUFFICIENT_FUNDS: 'Your bank said there are not enough funds for this payment.',
  AUTH_TIMEOUT: 'The bank took too long to answer and we cancelled the payment.',
  EXPIRED_INTENT: 'This payment link has expired. Start the payment again.',
  AMOUNT_MISMATCH: 'The payment amount did not match your order. Nothing was charged.',
}

/** The one sanctioned way to turn a gateway code into something a human can read. */
export function customerMessageFor(code: string): string {
  return (
    DECLINE_MESSAGES[code] ??
    'The payment did not go through and nothing was charged. You can try again.'
  )
}

export class PaymentDeclinedError extends Error {
  constructor(readonly failure: PaymentFailure) {
    super(failure.message)
    this.name = 'PaymentDeclinedError'
  }
}

/**
 * ── MONEY ASSERTION AT THE BOUNDARY ─────────────────────────────────────────
 *
 * A gateway that accepts 199.5 paise is a gateway that rounds. The value arrives
 * from the order row (a `numeric` column, so the pg driver hands it over as a
 * STRING) and crosses into a module that decides whether money moved. Coerce with
 * an assertion that refuses, never with `Number(x)` on faith — this is precisely
 * the boundary AGENTS.md describes, where a string silently becomes a float two
 * frames later.
 */
function assertPaise(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error(
      `Payment amount must be an integer number of paise, received ${value}. Refusing to move money whose exact value is unknown.`,
    )
  }
  if (value < 0) {
    throw new Error(`Payment amount cannot be negative (${value}p).`)
  }
  return value
}

/** Coerce a `numeric` column (string) or number into verified integer paise. */
export function toPaise(raw: unknown, _label = 'amount'): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw))
  return assertPaise(n)
}

/**
 * ── INTENT IDS ARE UNGUESSABLE, NOT SEQUENTIAL ──────────────────────────────
 *
 * The order code was `Date.now().toString(36)`, which is a CLOCK. Anyone who
 * placed an order a second before you can compute yours. Same class of bug, so
 * the fix is the same: 6 random bytes from the CSPRNG, base64url, no padding
 * characters to trip a URL parser.
 *
 * 6 bytes = 48 bits. That is enough that brute-forcing the space is not a
 * strategy, and the intent id is still paired with the order's phone number at
 * capture time — a capability alone is not authorisation.
 */
export function newIntentId(prefix: string): string {
  return `${prefix}${randomToken(12)}`
}

/** The one place randomness is generated, so auditing "is this random?" is one grep. */
export function randomToken(bytes: number): string {
  // Node's crypto, not Math.random. A payment identifier derived from a
  // non-cryptographic PRNG is a payment identifier that can be predicted.
  return randomBytes(bytes).toString('base64url')
}

/**
 * ── THE ORDER CODE ──────────────────────────────────────────────────────────
 *
 * Was `UPV-${Date.now().toString(36).toUpperCase()}`. That is a monotonic clock
 * rendered in base36: the n-th order of the day has an n-th guessable code, and
 * `/order/${code}` was therefore an enumerable resource that leaked every
 * customer's order to anyone incrementing a counter.
 *
 * Now: 6 CSPRNG bytes, base64url, uppercased. The `UPV-` prefix stays because it
 * is genuinely useful to a customer reading it off a WhatsApp message — it says
 * "this is an Upvvan order" before they trust the link — and it carries no
 * information, because the part after it is uniformly random.
 *
 * The base64url alphabet includes `-` and `_`, both URL-safe, so the code needs no
 * further escaping to survive a path segment.
 */
export function newOrderCode(): string {
  return `UPV-${randomToken(6).toUpperCase()}`
}

/**
 * The simulated gateway.
 *
 * Every method is async and every method can fail, because the real one does.
 * A synchronous stub is how "payment always succeeds" reaches production.
 */
export interface PaymentGateway {
  createIntent(orderCode: string, amountPaise: number): Promise<PaymentIntent>
  /** Authorise + capture in one step. Real PSPs split these; we keep the split in the interface below. */
  capture(intent: PaymentIntent, simulate?: SimulatedOutcome): Promise<PaymentIntent>
  /** The authorisation step, exposed so the state machine is not lying about granularity. */
  authorize(intent: PaymentIntent, simulate?: SimulatedOutcome): Promise<PaymentIntent>
  /**
   * Read an intent back by id.
   *
   * Part of the interface rather than a method on the concrete simulator, because
   * the capture route MUST be able to ask "is this intent yours, and is it for
   * this order?" before it moves money. Leaving that off the interface and
   * casting to SimulatedPaymentGateway at the call site would tie the route to the
   * simulator, and the first real PSP would silently lose that check.
   */
  get(id: string): PaymentIntent | undefined
}

export type SimulatedOutcome = 'success' | 'decline'

/**
 * A card-like token the test can send to force a decline.
 *
 * The choice is made by the CALLER, and the caller is a test or a demo — never a
 * customer's real instrument. There is no "decline everything" switch in
 * production config, because a gateway that can be told to fail on demand is a
 * denial-of-service lever pointed at ourselves.
 */
export const SIMULATED_DECLINE_INSTRUMENT = '4000000000000002'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * In-memory intent store, hung off `globalThis`.
 *
 * ── WHY globalThis AND NOT A MODULE-SCOPE Map ────────────────────────────────
 *
 * Because a module-scope Map is NOT shared between route handlers in the App
 * Router. `/api/payments/intent` and `/api/payments/capture` are separate route
 * bundles with separate module registries, so an intent created by one lives in a
 * different Map from the one the other reads. The first version had exactly that,
 * and the symptom is the worst kind: the decline path returned "This payment
 * session has expired. Start the payment again" for an intent created one second
 * earlier, because the simulator genuinely had never heard of it.
 *
 * `globalThis` is process-global, so every bundle in one Node process shares one
 * store. That is the same guarantee a single-process deployment needs and no more.
 *
 * ── THE OTHER TWO CONSEQUENCES, STATED RATHER THAN HIDDEN ────────────────────
 *
 * Intents do not survive a restart, and they are not shared between instances.
 * Both are acceptable for a simulated gateway and both would be a data-loss bug for
 * a real one — which is why `capture` treats a missing intent as "expired" and tells
 * the customer to start again, rather than guessing. The moment this is swapped for
 * a PSP, the store becomes the PSP plus our `payments` table, and the interface
 * above does not change.
 */
const INTENTS_KEY = Symbol.for('upvvan.simulated-payment-intents')

interface IntentStore {
  map: Map<string, PaymentIntent>
}

const store: IntentStore = ((globalThis as unknown as Record<symbol, IntentStore>)[INTENTS_KEY] ??=
  { map: new Map<string, PaymentIntent>() })

const intents = store.map

export class SimulatedPaymentGateway implements PaymentGateway {
  constructor(private readonly cfg: PaymentGatewayConfig = DEFAULT_PAYMENT_GATEWAY_CONFIG) {}

  async createIntent(orderCode: string, amountPaise: number): Promise<PaymentIntent> {
    await delay(this.cfg.latencyMs)
    const intent: PaymentIntent = {
      id: newIntentId(this.cfg.intentIdPrefix),
      orderCode,
      amountPaise: assertPaise(amountPaise),
      currency: 'INR',
      state: 'created',
      provider: this.cfg.provider,
      createdAt: new Date().toISOString(),
    }
    intents.set(intent.id, intent)
    return intent
  }

  async authorize(intent: PaymentIntent, simulate: SimulatedOutcome = 'success'): Promise<PaymentIntent> {
    await delay(this.cfg.latencyMs)
    return this.#settle(intent, simulate, false)
  }

  async capture(intent: PaymentIntent, simulate: SimulatedOutcome = 'success'): Promise<PaymentIntent> {
    await delay(this.cfg.latencyMs)
    // TTL before outcome: an expired intent is refused regardless of the
    // instrument, which is the real PSP ordering and the one that stops a stale
    // link from charging a customer for an order they abandoned.
    const ageMs = Date.now() - Date.parse(intent.createdAt)
    if (ageMs > this.cfg.intentTtlMinutes * 60_000) {
      return this.#settle(intent, 'decline', true, 'EXPIRED_INTENT')
    }
    return this.#settle(intent, simulate, true)
  }

  /**
   * The single write point for a terminal state.
   *
   * `#settle` exists so `captured` and `failed` cannot be reached by two code
   * paths that disagree about idempotency. Re-capturing an already-captured
   * intent returns the SAME captured intent rather than moving money twice —
   * a double-submit of the pay button must not become two charges.
   */
  #settle(
    intent: PaymentIntent,
    simulate: SimulatedOutcome,
    captured: boolean,
    forcedCode?: string,
  ): PaymentIntent {
    if (intent.state === 'captured') return intent

    const code = forcedCode ?? (simulate === 'decline' ? this.#declineCode() : null)

    if (code) {
      const next: PaymentIntent = { ...intent, state: 'failed', failureCode: code }
      intents.set(intent.id, next)
      return next
    }

    const next: PaymentIntent = {
      ...intent,
      state: captured ? 'captured' : 'processing',
      ...(captured
        ? { capturedAt: new Date().toISOString(), gatewayPaymentId: `pay_sim_${randomToken(9)}` }
        : {}),
    }
    intents.set(intent.id, next)
    return next
  }

  /**
   * A deterministic-ish decline code drawn from the configured set.
   *
   * Config-driven rather than fixed, so a test can assert on a specific message
   * and ops can extend the set without a deploy — the codes here are the ones a
   * real PSP returns, and the mapping to customer prose lives in
   * `DECLINE_MESSAGES`.
   */
  #declineCode(): string {
    const codes = this.cfg.declineCodes
    if (codes.length === 0) return 'CARD_DECLINED'
    return codes[Math.floor(Math.random() * codes.length)] ?? 'CARD_DECLINED'
  }

  /** Read back an intent. Used by the capture route's idempotency check. */
  get(id: string): PaymentIntent | undefined {
    return intents.get(id)
  }
}

/** The instance the routes use. Configured at boot, never constructed per request. */
export const paymentGateway: PaymentGateway = new SimulatedPaymentGateway()