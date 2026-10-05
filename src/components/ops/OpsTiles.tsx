/**
 * The five numbers that matter on a shift, and why each one is here.
 *
 * ── WHY UNASSIGNED IS THE HEADLINE AND DELIVERED IS NOT ────────────────────
 *
 * The dashboard's job is to tell an operator, in one glance, whether anything is
 * about to go wrong. Only one of these numbers is a warning: UNASSIGNED. An
 * order with no rider is a plant sitting in a tray with nobody coming for it, and
 * it is the only state that gets worse with waiting.
 *
 * DELIVERED is on the board because a shift with no deliveries on it should look
 * odd, but it is deliberately the least prominent. Optimising a console for the
 * delivered count is how a 2.1/5 rating happens: it puts a number on screen that
 * a dispatcher can raise by pressing buttons, and the OTP makes raising it
 * expensive — which is precisely why the number should not be the loudest thing
 * in the room.
 *
 * CLAIMS OPEN is here for the same reason in reverse. It is the only number that
 * means we failed, and it should be visible every single time somebody looks.
 */

export interface OpsTile {
  label: string
  value: number
  href?: string
  /** Drives the tile's colour. Green means healthy, amber needs attention. */
  tone: 'neutral' | 'attention' | 'good' | 'bad'
  /** Why this tile is on the dashboard, shown in the title attribute. */
  why: string
}

export function OpsTiles({ tiles }: { tiles: OpsTile[] }) {
  return (
    <ul className="grid list-none grid-cols-2 gap-sm p-0 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => {
        const tone =
          tile.tone === 'good'
            ? 'bg-success-soft text-success'
            : tile.tone === 'attention'
              ? 'bg-surface-raised text-warning'
              : tile.tone === 'bad'
                ? 'bg-surface-raised text-danger'
                : 'bg-surface-card text-ink'

        const body = (
          <>
            {/*
              The count is inside an aria-label that names the tile, because a
              screen reader announcing a bare "6" from a list of six tiles is
              useless — and the visual tile already carries its label, so this
              adds the missing piece rather than repeating what is there.
            */}
            <span className="block font-h2 leading-none" aria-hidden="true">
              {tile.value}
            </span>
            <span className="text-label-caps text-ink-muted mt-sm block">{tile.label}</span>
          </>
        )

        return (
          <li key={tile.label} className="m-0 p-0">
            {tile.href ? (
              <a
                href={tile.href}
                title={tile.why}
                className={`block rounded-md border border-border p-base no-underline transition-colors hover:border-primary ${tone}`}
              >
                <span className="sr-only">
                  {tile.label}: {tile.value}. {tile.why}
                </span>
                {body}
              </a>
            ) : (
              <div title={tile.why} className={`rounded-md border border-border p-base ${tone}`}>
                <span className="sr-only">
                  {tile.label}: {tile.value}. {tile.why}
                </span>
                {body}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * A status pill.
 *
 * ── WHY COLOUR IS NEVER THE ONLY SIGNAL ────────────────────────────────────
 * The word is always rendered, and it is always a word rather than a colour
 * alone. DESIGN.md requires result banners to carry a 1px border in addition to
 * a background tint so state survives greyscale and colour blindness — and the
 * same reasoning applies with more force here, because "delivered" and
 * "out for delivery" are the two states an operator misreads at a glance and
 * they differ by hue.
 */
const STATUS_STYLES: Record<string, string> = {
  ASSIGNED: 'bg-surface-raised text-ink-muted',
  PICKED_UP: 'bg-surface-raised text-ink',
  OUT_FOR_DELIVERY: 'bg-brand-soft text-forest',
  DELIVERED: 'bg-success-soft text-success',
  FAILED: 'bg-surface-raised text-danger',
  CANCELLED: 'bg-surface-raised text-ink-muted',
  PLACED: 'bg-surface-raised text-ink-muted',
  CLAIM_OPEN: 'bg-surface-raised text-danger',
}

const STATUS_WORDS: Record<string, string> = {
  ASSIGNED: 'Assigned',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  PLACED: 'Placed',
  CLAIM_OPEN: 'Claim open',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-sm border border-border px-sm py-xs text-label-caps ${STATUS_STYLES[status] ?? 'bg-surface-card text-ink-muted'}`}
    >
      {STATUS_WORDS[status] ?? status.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

/** An empty state that says what to do next, not just that there is nothing. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-card p-xl text-center">
      <p className="text-label-caps text-clay m-0">{title}</p>
      <p className="text-ink-muted mt-sm mb-0">{body}</p>
    </div>
  )
}