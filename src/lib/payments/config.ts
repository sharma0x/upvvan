import { config } from '@/lib/config'
import { DEFAULT_PAYMENT_GATEWAY_CONFIG, type PaymentGatewayConfig } from '@/lib/payments/gateway'

/**
 * Payment configuration — read from `config`, with the keys reported rather than
 * merged.
 *
 * ── WHY THIS FILE EXISTS INSTEAD OF AN EDIT TO config.ts ─────────────────────
 *
 * `src/lib/config.ts` is owned by another agent working concurrently, so the
 * payments block is NOT edited here. This module reads the block through a
 * structural cast, and falls back to the documented defaults when the keys are
 * absent — which is what makes the payment loop testable today and a two-line
 * deletion later.
 *
 * ── WHAT THE OTHER AGENT MUST ADD TO src/lib/config.ts ─────────────────────
 *
 *   payments: {
 *     // Which gateway implementation the checkout talks to. 'simulated' moves no
 *     // money and is the only value that may be set outside production.
 *     gateway: str('PAYMENT_GATEWAY', 'simulated'),
 *     simulated: {
 *       provider: str('PAYMENT_SIMULATED_PROVIDER', 'simulated'),
 *       intentIdPrefix: str('PAYMENT_SIMULATED_INTENT_PREFIX', 'pi_sim_'),
 *       // Artificial capture latency, ms. Non-zero on purpose: a gateway that
 *       // answers instantly trains you to ship a checkout with no pending state,
 *       // which is exactly the bug that let the UI claim "Order placed" with no
 *       // money moved.
 *       latencyMs: int('PAYMENT_SIMULATED_LATENCY_MS', 350),
 *       // How long a created intent stays capturable.
 *       intentTtlMinutes: int('PAYMENT_INTENT_TTL_MINUTES', 30),
 *       declineCodes: str('PAYMENT_SIMULATED_DECLINE_CODES',
 *         'CARD_DECLINED,INSUFFICIENT_FUNDS,AUTH_TIMEOUT')
 *         .split(',').map((c) => c.trim()).filter(Boolean),
 *     },
 *   },
 *
 * Note the three-tier rule in config.ts applies: `gateway` is defaulted because
 * the app must boot in an environment with no PSP account, and everything else is
 * defaulted with the reason recorded above.
 */

/**
 * The shape we expect `config.payments` to have. Declared structurally rather
 * than imported so this module compiles before the config.ts edit lands — the
 * type IS the contract being reported.
 */
interface PaymentsConfigShape {
  gateway?: string
  simulated?: Partial<PaymentGatewayConfig>
}

/**
 * `config` is `as const`, so the cast is needed to read a key that may not be
 * there yet. Narrowed immediately — an operator setting PAYMENT_GATEWAY to a real
 * PSP must not silently get simulated behaviour, so a non-simulated value with no
 * implementation is a hard error rather than a fallback.
 */
function readPayments(): PaymentsConfigShape {
  return (config as unknown as { payments?: PaymentsConfigShape }).payments ?? {}
}

export function paymentConfig(): PaymentGatewayConfig {
  const payments = readPayments()
  const simulated = payments.simulated ?? {}

  if (payments.gateway && payments.gateway !== 'simulated') {
    // A real PSP is not implemented. Saying so loudly beats falling back to the
    // simulator and taking money that never arrives.
    throw new Error(
      `PAYMENT_GATEWAY="${payments.gateway}" has no implementation. Only "simulated" exists today; ` +
        `wire a real provider in src/lib/payments/ before setting it.`,
    )
  }

  return {
    provider: simulated.provider ?? DEFAULT_PAYMENT_GATEWAY_CONFIG.provider,
    intentIdPrefix: simulated.intentIdPrefix ?? DEFAULT_PAYMENT_GATEWAY_CONFIG.intentIdPrefix,
    latencyMs: simulated.latencyMs ?? DEFAULT_PAYMENT_GATEWAY_CONFIG.latencyMs,
    intentTtlMinutes: simulated.intentTtlMinutes ?? DEFAULT_PAYMENT_GATEWAY_CONFIG.intentTtlMinutes,
    declineCodes: simulated.declineCodes?.length
      ? simulated.declineCodes
      : DEFAULT_PAYMENT_GATEWAY_CONFIG.declineCodes,
  }
}
