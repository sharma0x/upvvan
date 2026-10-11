/**
 * Boot the app for the simulation, and wait for it honestly.
 *
 * ── WHY NOT `make dev` ───────────────────────────────────────────────────────
 *
 * Two reasons, and the second is the one that matters.
 *
 * 1. `next dev` compiles each route on first request. The simulation touches
 *    fifty-odd of them in a fixed order, so the first run spends its time waiting
 *    for webpack and reports slow failures that are really compilation. Warming
 *    them first is the difference between a five-minute run and a thirty-minute
 *    one.
 *
 * 2. `next dev` duplicates the module registry per route bundle, so a
 *    module-level singleton is not a singleton. That is a genuine bug in the app
 *    and it is fixed in `lib/db/pool.ts` — but running the business simulation
 *    against a PRODUCTION build is closer to the thing being tested anyway. The
 *    server this boots is the same artefact `pnpm build && pnpm start` produces,
 *    which is what a customer would actually be talking to.
 *
 * Use `--dev` to opt back into the dev server; the simulation does not care which
 * it is talking to, because it only ever uses HTTP and SQL.
 */
import { spawn } from 'node:child_process'

const DEV = process.argv.includes('--dev')
const PORT = process.env.PORT ?? '3100'
const BASE = `http://localhost:${PORT}`

const child = spawn('npx', DEV ? ['next', 'dev', '--webpack'] : ['next', 'start'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, PORT },
})

let exited = false
child.on('exit', (code) => {
  exited = true
  if (code !== 0 && code !== null) {
    console.error(`\nserver exited with ${code}`)
    process.exit(code)
  }
})

/**
 * Wait for a page that exercises the database, not just for the port.
 *
 * `/` is server-rendered and reads geo data, so a 200 from it means the app
 * booted AND Postgres answered. Waiting on the port alone is how a simulation
 * starts failing on connection timeouts twenty checks later.
 */
async function waitForApp(timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (exited) throw new Error('the server exited before it was ready')
    try {
      const res = await fetch(`${BASE}/`, { redirect: 'manual' })
      if (res.ok) return
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) {
      throw new Error(`the server never answered ${BASE}/ within ${timeoutMs / 1000}s`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

async function main(): Promise<void> {
  console.log(`\nbooting ${DEV ? 'dev' : 'production'} server on ${BASE} …`)
  await waitForApp()

  // Warm the routes the simulation touches. Compiling them one at a time, before
  // the run, keeps every measured failure about the product rather than about
  // webpack.
  const paths = [
    '/',
    '/plants',
    '/search?q=zz',
    '/cart',
    '/track-order',
    '/faq',
    '/about',
    '/contact',
    '/grievance',
    '/claim',
    '/orders/lookup',
    '/account',
    '/account/addresses',
    '/account/saved',
    '/account/profile',
    '/policies',
    '/admin-ops',
    '/admin-ops/queue',
    '/admin-ops/board',
    '/admin-ops/claims',
    '/rider',
    '/rider/signin',
    '/sign-in',
    '/order/checkout',
    '/api/serviceability?pincode=560001&city=bengaluru',
  ]
  process.stdout.write('warming ')
  for (const path of paths) {
    try {
      await fetch(`${BASE}${path}`, { redirect: 'manual' })
    } catch {
      // A warm-up failure is reported by the simulation itself, with context.
    }
    process.stdout.write('.')
  }
  console.log(' done\n')

  const sim = spawn('npx', ['tsx', 'scripts/simulate.ts'], {
    stdio: 'inherit',
    env: { ...process.env, PORT },
  })
  sim.on('exit', (code) => {
    child.kill('SIGTERM')
    process.exit(code ?? 1)
  })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  child.kill('SIGTERM')
  process.exit(1)
})
