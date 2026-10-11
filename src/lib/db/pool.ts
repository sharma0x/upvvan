import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

import { config } from '@/lib/config'

/*
 * ── NO `import 'server-only'` HERE, DELIBERATELY ────────────────────────────
 *
 * `server-only` is a BUNDLER HINT, not a security control: it makes a bundler
 * error if a module reaches a client bundle, and it throws in any plain Node
 * process. It is not a boundary — `pg` runs perfectly well in Node, and this
 * module is legitimately used by three different runtimes:
 *
 *   · the Next.js server (where the bundler enforces the boundary)
 *   · `payload generate:types` / `migrate`, which load the config in plain Node
 *   · every script under `scripts/`, via tsx
 *
 * With the guard on, `pnpm build` died at its very first step:
 *
 *   Error: This module cannot be imported from a Client Component module.
 *
 * with no file, no import chain and nothing to act on — because `payload
 * generate:types` is a Node process, not a client bundle.
 *
 * The guard belongs on the SERVER COMPONENTS that consume this, which is where a
 * client component would actually be reaching for a database handle. Those are
 * the `.server.ts` modules and the route handlers, and they already carry it.
 */
//
// (The section above opens with a plain comment rather than the usual /** — the
//  original doc comment continues below and should not be split in two.)
/**
 * THE ONE Postgres pool for this process.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * There were nine separate module-level pools, each with its own `max`:
 *
 *     dispatch/store.server.ts        max 20   ← the worst of it
 *     geo/loader.server.ts            max  5
 *     catalogue/loader.server.ts      max  5
 *     guarantee.ts                    max  5
 *     settings/server.ts              max  2
 *     email/send.ts                   max  2
 *     orders/db.ts, accounts/addresses.ts, content/posts.server.ts   (default 10)
 *
 * Worst case around 60+ connections PER MODULE LOAD, and a Next.js server build
 * loads several of them while prerendering dozens of routes in parallel. The build
 * failed with:
 *
 *     error: sorry, too many clients already
 *     Error occurred prerendering page "/collections/plants-for-a-bright-room"
 *
 * — which reads like a Postgres misconfiguration and is actually a design fault
 * this repository had been carrying quietly. It passed intermittently, because
 * whether it blew up depended on how many routes happened to compile at once, and
 * that is the worst kind of failure: a build that works on one machine and fails
 * on another, for reasons no error message explains.
 *
 * ── WHY ONE POOL IS ALSO THE FASTER DESIGN ──────────────────────────────────
 *
 * A pool exists to reuse connections. Nine pools reusing the same nine
 * connections is not reuse — it is nine separate warm-up costs, nine idle-client
 * timeouts to reap, and nine places for a connection leak to hide. One pool is
 * one `max_connections` budget, one number to reason about, and one place to look
 * when the database is under pressure.
 *
 * ── WHY `max` IS SMALL ──────────────────────────────────────────────────────
 *
 * Postgres is at its best serving many short queries from a modest number of
 * connections. A Node process that can open 60 of them against one database is a
 * process that can take the whole server's capacity on its own, and a queue that
 * deepens latency for every other application sharing it. 10 is the default here
 * deliberately: a Node app is not faster with more, and the connection count is
 * the resource most likely to affect somebody else's deploy.
 *
 * Pool sizing is a config value, not a constant, for the same reason everything
 * else operational is: an operator who knows their database can raise it without
 * a code change.
 */
/*
 * ── WHY THIS IS ON `globalThis` AND NOT IN A MODULE VARIABLE ─────────────────
 *
 * A module-level `let` is a per-BUNDLE singleton, not a per-process one, and in
 * `next dev` those are not the same thing at all.
 *
 * Webpack compiles each route into its own server bundle, and each bundle gets its
 * own copy of this module. So `/account`, `/api/orders`, `/rider` and forty others
 * each held their own `Pool` with `max: DATABASE_POOL_MAX` — ten apiece. The
 * consolidation this file exists to perform was silently undone by the bundler,
 * which is how the exact failure its own header describes came back:
 *
 *     [cause]: Error: Connection terminated unexpectedly
 *     GET /rider 307 in 3.3min (application-code: 100s)
 *
 * Requests queue behind a connection that never arrives, Postgres refuses new
 * ones at its own limit, and the symptom is a site that is slow and then
 * unreachable rather than a site that reports "too many clients".
 *
 * `globalThis` is keyed so the key cannot collide with anything else on the
 * object, and it is the only place a per-process singleton actually survives
 * across duplicated module instances. The production build bundles more coarsely
 * and so hid this — which is the usual shape of a dev-only bug that is really a
 * production bug waiting for a deploy that bundles differently.
 */
const POOL_KEY = Symbol.for('upvvan.pg.pool')

type GlobalWithPool = typeof globalThis & { [POOL_KEY]?: Pool }

function shared(): Pool | null {
  return (globalThis as GlobalWithPool)[POOL_KEY] ?? null
}

export function getPool(): Pool {
  let pool = shared()
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.poolMax,
      // Postgres's `idle_session_timeout` analogue. Without it, connections
      // closed by a deploy linger in the pool until something notices, which is
      // how "too many clients" happens on a server that is not under load — the
      // process has 10, Postgres thinks it has 400, and they belong to nobody.
      idleTimeoutMillis: 30_000,
      // Fail fast rather than queue forever. A request that waits indefinitely
      // for a connection looks to the customer like a hung site, which is worse
      // than an honest error the route can turn into a real message.
      connectionTimeoutMillis: 10_000,
    })

    /*
     * An idle client erroring is NOT a reason to take the process down.
     *
     * It means a connection was closed by the server or a proxy — a restart, an
     * idle timeout, a failover. That is routine, and it arrives with no request
     * attached. Without a handler it is an unhandled 'error' event, which Node
     * treats as fatal: the whole app dies during somebody else's deploy, and the
     * log shows one line of noise rather than the reason.
     */
    pool.on('error', (error) => {
      console.error('[db] idle client error:', error.message)
    })

    ;(globalThis as GlobalWithPool)[POOL_KEY] = pool
  }
  return pool
}

/** `query` on the shared pool. The common case; use `withClient` for a transaction. */
export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<Row>> {
  return getPool().query<Row>(text, values as never[])
}

/**
 * Run `fn` inside a transaction, committing on return and rolling back on throw.
 *
 * Exists so the transaction pattern is written once. The version this replaced
 * was hand-rolled in at least six places, and they did not all roll back in their
 * `finally` — so a thrown error in one of them left an open transaction holding a
 * row lock until the connection was reaped. On a table that checkout also writes
 * to, that is a checkout that stops working for everyone else.
 */
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const value = await fn(client)
    await client.query('COMMIT')
    return value
  } catch (error) {
    // The ROLLBACK can itself fail if the connection is already gone. Swallowing
    // that is right: the original error is the one worth reporting, and there is
    // nothing left to roll back if the socket has died.
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** Close the pool. For scripts and tests; a server process does not call this. */
export async function closePool(): Promise<void> {
  const closing = shared()
  if (closing) {
    delete (globalThis as GlobalWithPool)[POOL_KEY]
    await closing.end()
  }
}
