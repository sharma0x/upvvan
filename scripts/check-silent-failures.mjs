#!/usr/bin/env node
/**
 * Guards against two failure modes that pass typecheck, lint, the build and every
 * DOM assertion, and are invisible until somebody LOOKS at the page.
 *
 * ── 1 · A BACKTICK INSIDE A SQL COMMENT IN A TEMPLATE LITERAL ───────────────
 *
 * SQL lives in `sql` template literals, and a comment inside one is ordinary
 * text to JavaScript — so a backtick in it closes the literal. This bit three
 * times in one session:
 *
 *     `-- \`kind\` is an enum`   →   the rest of the file becomes a string
 *
 * The failure is spectacular rather than subtle: the module fails to parse, and
 * the error points at a comment. But the same mechanism produces a silent version
 * too — a backtick mid-query turns the remaining SQL into a string literal, the
 * query becomes nonsense, and the page renders an empty grid while everything
 * else passes.
 *
 * ── 2 · A JSX COMMENT CLOSED WITH A PAREN RATHER THAN THE REAL TERMINATOR ─
 *
 *     slash-star comment, closed with a paren instead of the real terminator
 *     <div>This renders</div>
 *
 * The block comment never terminates at its apparent end, so everything after it
 * is swallowed as comment text. It is
 * VALID TypeScript — which is the problem. On this site it silently deleted the
 * water interval, soil-moisture target and pet-safety line from every single
 * plant card, on every page, for the whole storefront, with `tsc`, ESLint, the
 * production build and the full test suite all green. The only thing that caught
 * it was a screenshot.
 *
 * This is not a hypothetical: it shipped, and the cost was a trust claim
 * (every plant states its watering interval) silently removed from the whole shop.
 *
 * ── WHY A SCRIPT AND NOT AN ESLINT RULE ─────────────────────────────────────
 * Because both are about code that is *deliberately* absent from the parse tree.
 * ESLint would have to run over the comment body of a construct ESLint also
 * believes is a comment, which is exactly the state that is broken. A separate
 * text scan has no such blind spot and runs in milliseconds.
 *
 * Wired into `make ci-local` so neither can come back.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIRS = ['src', 'scripts', 'tests']
const EXTS = new Set(['.ts', '.tsx', '.mjs', '.js'])

/** Files that legitimately contain a `sql` tag we do not scan. */
const findings = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full)
    } else if (EXTS.has(entry.slice(entry.lastIndexOf('.')))) {
      check(full)
    }
  }
}

/**
 * Find `sql` template literals and look for a backtick inside them.
 *
 * Scans for the literal tag rather than every backtick pair, because a legitimate
 * template literal elsewhere in the codebase may contain SQL-looking prose in a
 * comment — and a false positive here trains people to ignore the warning, which
 * is worse than not having the check.
 */
function check(file) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)

  // This file necessarily CONTAINS the malformed patterns as string literals — it
  // is a scanner for them. Scanning itself would report its own source.
  if (rel === 'scripts/check-silent-failures.mjs') return

  // ── Check 1: backticks inside a `sql` template literal ──────────────────────
  const sqlTag = /sql`/g
  let m
  while ((m = sqlTag.exec(src)) !== null) {
    const start = m.index + m[0].length
    // Walk to the closing backtick, honouring escapes. An unterminated literal is
    // a parse error the compiler will report, so stop and move on.
    let i = start
    let closed = false
    while (i < src.length) {
      if (src[i] === '\\') {
        i += 2
        continue
      }
      if (src[i] === '`') {
        closed = true
        break
      }
      i++
    }
    if (!closed) break

    const body = src.slice(start, i)
    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      // Only a comment can carry a backtick here; a backtick elsewhere in the
      // query is a genuine syntax error and not what this check is about.
      if (!/^--/.test(trimmed)) continue
      if (trimmed.includes('`')) {
        findings.push({
          file: rel,
          line: src.slice(0, start + body.indexOf(line)).split('\n').length,
          rule: 'sql-comment-backtick',
          message:
            'A backtick inside a `--` comment in a `sql` template literal closes the literal and turns the rest of the query into a string. Use plain quotes.',
        })
      }
    }
    sqlTag.lastIndex = i
  }

  // ── Check 2: a JSX comment closed with `)}` ────────────────────────────────
  // Walk each `{/*` and confirm the matching closer is `*/}` and that it is the
  // FIRST thing after the comment body — a `)}` means the block never closed.
  const opener = /\{\/\*/g
  while ((m = opener.exec(src)) !== null) {
    const bodyStart = m.index + m[0].length
    const close = src.indexOf('*/}', bodyStart)
    const nextOpener = src.indexOf('{/*', bodyStart)

    if (close === -1 || (nextOpener !== -1 && nextOpener < close)) {
      const line = src.slice(0, m.index).split('\n').length
      const following = src
        .slice(bodyStart, bodyStart + 240)
        .split('\n')
        .slice(0, 3)
        .join(' | ')
      findings.push({
        file: rel,
        line,
        rule: 'jsx-comment-unterminated',
        message:
          'A JSX comment starting here is never closed, so everything after it is comment text and renders as nothing. Close it with a slash-star pair. Found: ' +
          following,
      })
      break
    }
  }
}

for (const dir of DIRS) walk(join(ROOT, dir))

if (findings.length === 0) {
  console.log('✓ silent-failure guard: no unterminated JSX comments, no backticks in SQL comments')
  process.exit(0)
}

console.error(`✗ ${findings.length} silent-failure risk(s):\n`)
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.rule}]`)
  console.error(`    ${f.message}\n`)
}
console.error(
  '  Both failure modes pass typecheck, lint and build. They are found by looking at the page.',
)
process.exit(1)
