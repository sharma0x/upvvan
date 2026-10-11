/**
 * How old an order is, in words an operator can act on.
 *
 * ── WHY A BARE `toLocaleTimeString` IS NOT ENOUGH ANY MORE ───────────────────
 *
 * Both ops surfaces rendered `Placed 21:11` and nothing else, because the
 * unassigned queue used to be scoped to the current day — and inside one day, a
 * time places the row perfectly well. "21:11" is only ambiguous when you cannot
 * rule out a date, and for a same-day queue you can.
 *
 * `loadBoard` stopped filtering the queue to today, because that filter was
 * deleting paid orders from the worklist permanently (see its own header for the
 * measurement). The moment a row can be two days old, a bare time stops being a
 * rounding of the truth and becomes a false statement about it: 21:11 rendered on
 * a row from Tuesday reads as 21:11 tonight.
 *
 * That is not a cosmetic regression on a list sorted oldest-first. Age is the
 * entire reason the list is sorted oldest-first — the header says so — so the one
 * number that makes a row alarming is the number its rendering was hiding.
 *
 * ── WHY THIS IS ITS OWN MODULE AND NOT A FUNCTION INSIDE A PAGE ───────────────
 *
 * Two pages render this, and two copies of a formatter is two copies of a bug.
 * More usefully: it is a pure function over a Date, which means it can be TESTED.
 * Duplicated inside a server component it could only be checked by rendering a
 * page, so the day-boundary logic would have had no test at all — and the
 * day-boundary is precisely where the ambiguity lives.
 *
 * `now` is injectable for the same reason `todayRange` takes one: the interesting
 * cases are all relative ("yesterday", "3 days ago") and a test that has to wait
 * for midnight to test midnight is a test nobody writes.
 */
export function ageInDays(createdAt: Date, now: Date): number {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfCreatedDay = new Date(createdAt)
  startOfCreatedDay.setHours(0, 0, 0, 0)
  const days = Math.round((startOfToday.getTime() - startOfCreatedDay.getTime()) / 86_400_000)

  /*
   * Clamped, and this was not theoretical.
   *
   * The first draft returned the raw difference, so a row whose `created_at` was
   * in the future — clock skew between the app host and the database, or a
   * fixture written with a forward-dated `now()` — produced "-1 days ago".
   *
   * `placedLabel` already guarded on `days <= 0` so nothing customer-visible
   * shipped with a minus sign in it. But the clamp belongs HERE rather than at
   * the one call site that happens to remember: a function called `ageInDays`
   * that can return a negative number of days is a lie with a plausible-looking
   * signature, and the next caller will not read this comment.
   */
  return Math.max(0, days)
}

/**
 * `Placed …` — a time today, a date and a relative age for anything older.
 *
 * Short form for today is deliberate: "Placed 14:20" is the case that needs no
 * thought, and the date is what carries information here. Adding "· today" to
 * every row would be noise on the rows that are fine, in a table an operator
 * scans rather than reads.
 */
export function placedLabel(createdAt: Date, now: Date = new Date()): string {
  const time = createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const days = ageInDays(createdAt, now)
  if (days <= 0) return time

  const day = createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${day} · ${time} · ${days === 1 ? 'yesterday' : `${days} days ago`}`
}
