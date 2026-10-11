/**
 * How old an order is must be legible, not inferable.
 *
 * ── WHY THIS IS TESTED AT ALL ─────────────────────────────────────────────────
 *
 * Both ops surfaces rendered a bare `toLocaleTimeString` — "21:11" — for every
 * row, which was correct only while the queue was day-scoped. `loadBoard` stopped
 * scoping it to today (that filter was deleting paid orders from the worklist
 * permanently), and a bare time on a two-day-old row is not a rounding of the
 * truth, it is a false statement: 21:11 on a Tuesday row reads as 21:11 tonight.
 *
 * The list is sorted oldest-first *because* age is the risk, so the one number
 * that makes a row alarming was the number its rendering hid.
 *
 * The formatter lives in `src/lib/dispatch/age.ts` rather than inside a page for
 * exactly this reason: as a component-local function its only possible check
 * would have been rendering a page, and the day boundary — where the whole
 * ambiguity lives — would have had no test at all.
 *
 * `now` is injected so the interesting cases (yesterday, three days ago) can be
 * tested without waiting for them.
 */
import { describe, it, expect } from 'vitest'

import { ageInDays, placedLabel } from '@/lib/dispatch/age'

/** 2026-10-07 15:26 local — mid-afternoon, so no boundary is near. */
const NOW = new Date(2026, 9, 7, 15, 26)

/**
 * `en-IN` renders a 12-hour clock ("09:11 pm"), which is correct for the
 * audience and irrelevant here. Deriving the expected string from the same call
 * rather than hardcoding it keeps the test asserting the DATE and the AGE — the
 * two things this function exists for — instead of asserting ICU's opinion.
 */
const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

describe('ageInDays', () => {
  it('is 0 for anything placed today, whatever the time of day', () => {
    expect(ageInDays(new Date(2026, 9, 7, 0, 0), NOW)).toBe(0)
    expect(ageInDays(new Date(2026, 9, 7, 15, 25), NOW)).toBe(0)
  })

  it('counts CALENDAR days, not elapsed hours', () => {
    // Two rows on 6 October, 23h40m apart. Elapsed hours from 23:50 to 15:26 the
    // next day is 15.6h — floor, 0 days — so an elapsed-hours calculation calls
    // yesterday's row "today" and renders it with no date at all. That is the
    // exact failure this function exists to prevent, so it is asserted rather
    // than described.
    expect(ageInDays(new Date(2026, 9, 6, 23, 50), NOW)).toBe(1)
    expect(ageInDays(new Date(2026, 9, 6, 0, 10), NOW)).toBe(1)
    expect(ageInDays(new Date(2026, 9, 5, 23, 59), NOW)).toBe(2)
  })

  it('measures across a month boundary', () => {
    expect(ageInDays(new Date(2026, 9, 1, 12, 0), NOW)).toBe(6)
  })

  it('is 0 for a future-dated row rather than negative', () => {
    // A clock-skewed or future-dated order must not render "-1 days ago".
    expect(ageInDays(new Date(2026, 9, 8, 9, 0), NOW)).toBe(0)
  })
})

describe('placedLabel', () => {
  it('shows a bare time for today, and nothing more', () => {
    const created = new Date(2026, 9, 7, 14, 20)
    const label = placedLabel(created, NOW)

    expect(label).toBe(clock(created))
    expect(label).not.toMatch(/yesterday|days ago|[A-Za-z]{3}/)
  })

  it('names yesterday, because "yesterday" is not the same claim as a date', () => {
    const created = new Date(2026, 9, 6, 21, 11)
    const label = placedLabel(created, NOW)
    expect(label).toContain('yesterday')
    expect(label).toContain(clock(created))
    expect(label).toContain('6')
  })

  it('counts days for anything older than yesterday', () => {
    expect(placedLabel(new Date(2026, 9, 4, 21, 11), NOW)).toContain('3 days ago')
    expect(placedLabel(new Date(2026, 9, 5, 4, 11), NOW)).toContain('2 days ago')
    expect(placedLabel(new Date(2026, 9, 4, 21, 11), NOW)).toContain(
      clock(new Date(2026, 9, 4, 21, 11)),
    )
  })

  it('never renders a time alone for a row that is not from today', () => {
    /*
     * The regression itself, stated as an assertion rather than described in a
     * comment: for every backdated row, the output must carry the date. A bare
     * time here is indistinguishable from today's, which is the whole defect.
     */
    for (const daysAgo of [1, 2, 3, 9, 400]) {
      const created = new Date(2026, 9, 7, 21, 11)
      created.setDate(created.getDate() - daysAgo)
      const label = placedLabel(created, NOW)

      expect(label, `a row ${daysAgo} days old rendered as a bare time`).not.toMatch(
        /^\d{2}:\d{2}$/,
      )
      expect(label).toContain(clock(created))
    }
  })

  it('defaults `now` to the current time', () => {
    // The pages call it with one argument. A default that threw here would take
    // both ops screens down at render time.
    expect(() => placedLabel(new Date())).not.toThrow()
  })
})
