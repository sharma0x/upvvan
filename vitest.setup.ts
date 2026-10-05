/**
 * Vitest setup.
 *
 * Intentionally minimal. It used to stash Node's `fetch` for the link-integrity
 * suite, but `setupFiles` run AFTER happy-dom installs its DOM stub, so the
 * stashed value was the stub and the suite silently verified nothing. That suite
 * now imports `undici` directly, which nothing stubs.
 *
 * Kept as a hook point for component tests that need jest-dom matchers.
 */
export {}
