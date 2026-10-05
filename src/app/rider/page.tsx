import { redirect } from 'next/navigation'

import { formatPaise } from '@/lib/catalogue/pricing'
import { currentRider } from '@/lib/dispatch/session.server'
import { listDispatchesForRider, todayRange } from '@/lib/dispatch/store.server'
import { RiderDrop } from '@/components/rider/RiderDrop'

/**
 * Today's run.
 *
 * ── WHY THE LIST IS SORTED BY BAND, NOT BY TIME ────────────────────────────
 * `listDispatchesForRider` orders by the band's `min_km`, so the short drops are
 * at the top. Two reasons, and the second is the one that pays riders:
 *
 *   1. It is the order that finishes fastest. A run is a sequence of trips, and
 *      doing the near ones first means the tail of the day is the long ones
 *      rather than a scatter of long and short.
 *
 *   2. It matches how the pay is designed to work. The far drops pay more, so
 *      they should not be the ones a rider runs out of time for. Sorting by band
 *      puts the best-paid work at the START of the day rather than at the end,
 *      which is what stops a rider "not getting to" the ₹75 drop.
 *
 * Insertion order would have quietly made the highest-value work the first thing
 * a tired rider drops.
 */
export const dynamic = 'force-dynamic'

export default async function RiderRunPage() {
  const rider = await currentRider()
  if (!rider) redirect('/rider/signin')

  const day = todayRange()
  const drops = await listDispatchesForRider(rider.id, day)

  // Integer paise throughout. Summing formatted rupee strings is how a day's
  // total ends up a rupee short and a rider stops trusting the number.
  const earnedPaise = drops
    .filter((d) => d.status === 'DELIVERED')
    .reduce((sum, d) => sum + d.payoutPaise, 0)
  const pendingPaise = drops
    .filter((d) => d.status !== 'DELIVERED' && d.status !== 'FAILED' && d.status !== 'CANCELLED')
    .reduce((sum, d) => sum + d.payoutPaise, 0)

  return (
    <>
      <h1 className="mt-0 mb-xs">Today&rsquo;s run</h1>
      <p className="text-ink-muted mt-0">
        {drops.length === 0
          ? 'No drops assigned yet.'
          : `${drops.length} ${drops.length === 1 ? 'drop' : 'drops'}, nearest first.`}
      </p>

      {drops.length > 0 && (
        <section
          aria-labelledby="tally"
          className="mt-base rounded-md border border-border bg-surface-card p-base"
        >
          <h2 id="tally" className="text-label-caps text-ink-muted mt-0 mb-sm">
            Your pay today
          </h2>
          <dl className="m-0 flex gap-xl">
            <div>
              <dt className="text-sm text-ink-muted">Earned</dt>
              {/* formatPaise, not a hand-rolled `₹${x/100}`: a per-rider
                  multiplier can produce a payout that is not a whole rupee, and
                  flooring it here would show the rider less than they earned. */}
              <dd className="font-h2 mt-0 mb-0" data-testid="earned">
                {formatPaise(earnedPaise)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Still to earn</dt>
              <dd className="font-h2 mt-0 mb-0" data-testid="pending">
                {formatPaise(pendingPaise)}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-ink-muted mt-sm mb-0">
            Fixed per drop when it was assigned, so a rate change today will not change what you
            are owed.
          </p>
        </section>
      )}

      <section aria-labelledby="drops" className="mt-xl">
        <h2 id="drops" className="sr-only">
          Your drops
        </h2>

        {drops.length === 0 ? (
          <div className="rounded-md border border-border bg-surface-card p-xl text-center">
            <p className="text-label-caps text-clay m-0">Nothing assigned</p>
            <p className="text-ink-muted mt-sm mb-0">
              When the dispatcher assigns you a drop it will appear here.
            </p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-sm p-0">
            {drops.map((drop) => (
              <li key={drop.id} className="m-0 p-0">
                <RiderDrop drop={drop} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}