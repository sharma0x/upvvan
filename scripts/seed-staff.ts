/**
 * Create or update a STAFF user (the admin panel / ops console login).
 *
 * ── WHY THIS SCRIPT EXISTS ──────────────────────────────────────────────────
 *
 * Payload's documented way in is `POST /api/users/first-register`, which only
 * works while there are ZERO staff users. That is correct for a first install and
 * useless for every install after it — and it left two real gaps:
 *
 *   1. The founder cannot reset their own password. If it is lost, the only
 *      option is a `psql` session and hand-written bcrypt, which is how a
 *      business ends up locked out of its own admin panel.
 *   2. Nobody can script the creation of additional staff — a support person, a
 *      second founder — so in practice everyone shares one login, and an
 *      append-only audit ledger (`dispatch_events.actor_label`) attributes every
 *      action to the same human. A ledger that cannot tell two people apart is
 *      not an audit trail.
 *
 * ── WHY IT GOES THROUGH PAYLOAD'S LOCAL API ─────────────────────────────────
 *
 * Because the password hash is Payload's business, not ours. It is a `salt`/`hash`
 * pair in `users`, with its own parameters, and reproducing that by hand means
 * hardcoding a scheme that a Payload upgrade can invalidate — leaving an account
 * that exists but can never be signed into. `payload.create` / `payload.update`
 * cannot get that wrong.
 *
 * ── WHY THE PASSWORD MUST COME FROM THE ENVIRONMENT ─────────────────────────
 *
 * There is deliberately no default and no `--password` flag. A password on a
 * command line is in the shell history and in the process table, and a default
 * here would mean every deployment that forgot to set one has a login that is
 * printed in this file. `STAFF_SEED_PASSWORD` is required.
 *
 * Usage:
 *   STAFF_SEED_PASSWORD='…' pnpm seed:staff -- ops@upvvan.test "Ops Person" admin
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const password = process.env.STAFF_SEED_PASSWORD
if (!password) {
  console.error(
    'STAFF_SEED_PASSWORD is required.\n' +
      'It is not defaulted and not accepted as a flag: a password on the command\n' +
      'line ends up in shell history and in the process table.\n\n' +
      "Example:  STAFF_SEED_PASSWORD='a long one' pnpm seed:staff -- you@company.test 'Your Name' admin",
  )
  process.exit(1)
}

// `pnpm run x -- a b c` forwards a literal `--`; drop it rather than treating
// it as the email address.
const argv = process.argv.slice(2).filter((a) => a !== '--')
const [email, name, role] = argv

/*
 * ── THE ROLE VOCABULARY, AND WHY IT USED TO BE WRONG ─────────────────────────
 *
 * This list was `['admin', 'support', 'ops']`. `Users.role` has always been a
 * `select` with a completely different set of values:
 *
 *     super-admin · hq-admin · nursery-manager · support · rider
 *
 * So the script's own error message — "Expected one of: admin, support, ops" —
 * described roles the schema cannot hold, and every documented invocation in this
 * file's header (`pnpm seed:staff -- you@x.test "Name" admin`) failed with:
 *
 *     ValidationError: The following field is invalid: Role
 *
 * Which means the ONLY documented way to create the staff login the entire ops
 * console depends on did not work, for any role. The one staff user in this
 * database got there by hand.
 *
 * Two things were wrong and both are fixed: the list, and the default.
 *
 * The default was `admin`, a value the schema rejects. A silent coercion to a
 * role with MORE access than anybody asked for is the wrong direction to be wrong
 * in, so a missing role now errors rather than guessing — but the default for
 * `support` is `support`, which is both valid and the least-privileged role that
 * can actually use this product. Someone creating a support login and getting a
 * super-admin by omission is a real access-control bug, not a nicety.
 */
const ROLES = ['super-admin', 'hq-admin', 'nursery-manager', 'support', 'rider'] as const
type Role = (typeof ROLES)[number]

const DEFAULT_ROLE: Role = 'support'

const chosenRole: Role = ROLES.includes(role as Role) ? (role as Role) : DEFAULT_ROLE
if (role && !ROLES.includes(role as Role)) {
  console.error(`Unknown role "${role}". Expected one of: ${ROLES.join(', ')}`)
  process.exit(1)
}

if (!email || !name) {
  console.error('Usage: pnpm seed:staff -- <email> <name> [role]')
  console.error(`  role: ${ROLES.join(' | ')}  (default: ${DEFAULT_ROLE})`)
  process.exit(1)
}

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'users',
  where: { email: { equals: email } },
  limit: 1,
  depth: 0,
})

try {
  if (existing.docs.length > 0) {
    const id = existing.docs[0]!.id
    // Password only — deliberately NOT overwriting name or role, because this
    // script is also the password reset path and must not silently demote
    // somebody whose role changed in the panel.
    await payload.update({
      collection: 'users',
      id,
      data: { password },
    })
    console.log(`✓ password reset for ${email} (role untouched)`)
  } else {
    await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        name,
        role: chosenRole,
      } as never,
    })
    console.log(`✓ created staff user ${email} with role "${chosenRole}"`)
  }
  process.exit(0)
} catch (error) {
  // The CAUSE, not just the message.
  //
  // Payload wraps driver failures in a "Failed query: select …" error whose text
  // is the whole statement. The actual reason — a missing column, a constraint
  // name, a syntax problem — is on `.cause`, and printing only the wrapper
  // produced a five-hundred-word SQL statement as the entire explanation of why
  // a script failed.
  const chain: string[] = []
  for (let e: unknown = error; e instanceof Error; e = (e as { cause?: unknown }).cause) {
    chain.push(`${e.name}: ${e.message}`)
  }
  console.error('Staff provisioning failed:\n  ' + chain.join('\n  caused by: '))
  process.exit(1)
} finally {
  await payload.db.destroy?.()
}
