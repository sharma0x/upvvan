/**
 * Next.js instrumentation — runs once when the server process boots.
 *
 * Fails FAST here rather than at first request. A missing DATABASE_URL or a
 * placeholder production secret should stop the deploy on the developer's
 * machine, where it is cheap, not in front of a customer.
 *
 * `register()` must stay synchronous-safe: Next runs this in the Node runtime
 * before the server accepts connections.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { assertConfigValid } = await import('./lib/config')
  assertConfigValid()
}
