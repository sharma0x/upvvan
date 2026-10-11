import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * No HTML entity inside a JavaScript string.
 *
 * ── THE BUG THIS EXISTS BECAUSE OF ───────────────────────────────────────────
 *
 * The plant-listing page's heading was built with a template literal:
 *
 *     `${plantCount} plant${…} and ${supplyCount} packs of soil, feed &amp; tools`
 *
 * `&amp;` is an HTML entity. Inside JSX text it decodes to "&", which is why the
 * same character is written that way on six other pages and looks right in all of
 * them. Inside a template literal there is no HTML parser — the string is emitted
 * verbatim, so the customer read:
 *
 *     12 plants and 3 packs of soil, feed &amp; tools
 *
 * on the main catalogue page. It survived because it is only visible with
 * consumables in the listing, and because every test asserts structure rather than
 * prose.
 *
 * ── WHY A STATIC SCAN ────────────────────────────────────────────────────────
 *
 * A render test would have to seed a catalogue with both plants and consumables
 * and then assert on exact copy, which is brittle in a different way: the next
 * copy edit breaks it and teaches everyone to update the test rather than to read
 * it. The defect is structural — an entity in the wrong kind of literal — and a
 * structural defect is cheap to check structurally.
 *
 * The scan reads the source, so it reports the file and line rather than a page
 * that happened to render wrong.
 */
const SRC = resolve(__dirname, '..', '..', '..')

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      sourceFiles(full, acc)
    } else if (/\.tsx$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

const FILES = sourceFiles(SRC)

/** Entities that decode to something visible, so a literal one is obvious. */
const ENTITIES = /&(?:amp|nbsp|rsquo|lsquo|mdash|ndash|hellip|middot|times);/g

describe('HTML entities in JavaScript strings', () => {
  it('found the tsx files it is checking', () => {
    expect(FILES.length, 'no .tsx files found — the scan is looking at nothing').toBeGreaterThan(10)
  })

  it('no entity sits inside a template literal or quoted JS string', () => {
    const offenders: string[] = []

    for (const file of FILES) {
      const source = readFileSync(file, 'utf8')

      /*
       * Only strings are checked, never JSX text: `&amp;` in JSX text is CORRECT
       * and is how six other pages write an ampersand. The difference is the whole
       * point — inside a literal there is no decoder.
       *
       * Comments are stripped first, because a comment explaining the ampersand
       * problem would otherwise trip the scan that exists because of it.
       */
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

      const strings = [
        ...withoutComments.matchAll(/`[^`]*`/g),
        ...withoutComments.matchAll(/(?:^|[\s(,{[=])(["'])(?:(?!\1)[^\\\n]|\\.)*\1/g),
      ]

      for (const match of strings) {
        /*
         * A template literal containing JSX is a different animal. It renders
         * through the HTML parser, so `&rsquo;` inside it decodes correctly and
         * flagging it is a false positive that teaches people to ignore the scan.
         * Those are skipped; plain text literals are checked.
         */
        if (/<\/?[A-Za-z]/.test(match[0])) continue

        const found = match[0].match(ENTITIES)
        if (!found) continue

        const line = withoutComments.slice(0, match.index!).split('\n').length
        offenders.push(
          `${relative(SRC, file)}:${line}  ${found.join(' ')}  →  ${match[0].slice(0, 60).replace(/\n/g, ' ')}`,
        )
      }
    }

    expect(
      offenders,
      `These HTML entities are inside JavaScript strings, where nothing decodes them,\n` +
        `so a customer reads the entity itself:\n  ${offenders.join('\n  ')}\n\n` +
        `Use the literal character ("&") instead. Entities are only correct in JSX text.`,
    ).toEqual([])
  })
})
