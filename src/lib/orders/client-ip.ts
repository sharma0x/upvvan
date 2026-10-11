/**
 * Client identity for rate limiting.
 *
 * ── WHY THIS LIVES IN A LIB AND NOT IN THE ROUTE ────────────────────────────
 *
 * Both `/api/payments/*` and `/api/orders/lookup` need it, and a Next.js App
 * Router `route.ts` may only export HTTP verbs plus route config — a second
 * exported function is a build error whose message points at the wrong thing
 * entirely. One implementation, one place to read the trust question.
 *
 * ── WHAT THIS SIGNAL IS WORTH ───────────────────────────────────────────────
 *
 * `x-forwarded-for` is a HEADER THE CLIENT CAN SET. On a single-host deployment
 * with no proxy in front, there is no better signal available, and the rate limiter
 * is a speed bump against casual guessing rather than a wall. It stops being one
 * the moment the deployment sits behind a proxy that appends rather than replaces.
 *
 * The upgrade path, when this matters: take the LAST hop of X-Forwarded-For (the
 * one your own proxy added) rather than the first, or move the counter into the
 * database-backed bucket described in `src/lib/orders/rate-limit.ts`. Neither is
 * worth doing while there is exactly one process and no proxy — writing it now
 * would be a claim about the topology that is not true today.
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    const hops = fwd
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
    if (hops.length > 0) return hops[0]!
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}
