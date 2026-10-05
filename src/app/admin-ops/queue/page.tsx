import Link from 'next/link'

import { AssignButton } from '@/components/ops/AssignButton'
import { EmptyState, StatusPill } from '@/components/ops/OpsTiles'
import { formatPaise } from '@/lib/catalogue/pricing'
import {
  iso,
  loadBands,
  loadBoard,
  loadOperationalCity,
  loadRiderLoads,
  loadRiders,
  todayRange,
} from '@/lib/dispatch/store.server'

/**
 * The assign queue.
 *
 * ── WHY THIS IS A QUEUE AND NOT A TABLE WITH A DROPDOWN ────────────────────
 * The question an operator is actually answering is "what is still unhandled",
 * not "show me all orders". Those are different orders: the queue is filtered to
 * the ones with no rider, sorted oldest-first, because age is the risk. A table
 * sorted newest-first buries the order that has been sitting since 9am under
 * everything that arrived after lunch.
 *
 * Each row carries its own assign control rather than one bulk action, because
 * the distance — and therefore the band and the rider's pay — is a per-drop fact.
 * There is no "distance for this batch of orders" that is true.
 */
export const dynamic = 'force-dynamic'

export default async function OpsQueue() {
  const city = await loadOperationalCity()
  if (!city) {
    return (
      <>
        <h1 className="mt-0">Queue</h1>
        <EmptyState
          title="No city is live"
          body="Set a city to live with an approved licence in the admin panel."
        />
      </>
    )
  }

  const day = todayRange()
  const [board, riders, bands, loads] = await Promise.all([
    loadBoard(city.id, day),
    loadRiders(city.id),
    loadBands(city.id),
    loadRiderLoads(city.id, day),
  ])

  /*
   * Load per rider, for the capacity hint on the rider picker. Counted from the
   * same non-terminal rule `assignDispatch` uses, so the number the operator
   * reads and the number the allocator will use cannot disagree.
   */
  const riderOptions = riders
    .filter((rider) => rider.active)
    .map((rider) => ({
      id: rider.id,
      name: rider.name,
      zoneName: rider.zoneName,
      load: loads.get(String(rider.id)) ?? 0,
      capacity: rider.maxDropsPerDay ?? rider.maxDailyDrops,
    }))

  /*
   * Placeholder distance: the midpoint of the city's outermost band.
   *
   * A PLACEHOLDER, and the control says so — the operator confirms the real
   * distance before the pay is committed, because a wrong band is worse than no
   * band: it pays a rider wrongly and the trigger then refuses to let it be
   * corrected. Deriving it from the city's bands rather than a literal keeps
   * "nothing operational is hardcoded" true even for a UI default.
   */
  function suggestedKmFor(): number {
    const outer = bands.length > 0 ? bands[bands.length - 1] : null
    return outer ? Math.round(((outer.minKm + outer.maxKm) / 2) * 10) / 10 : 1
  }

  return (
    <>
      <p className="text-label-caps text-clay m-0">{city.name}</p>
      <h1 className="mt-xs mb-0">Assign queue</h1>

      <p className="text-ink-muted mt-base mb-xl max-w-[68ch]">
        Oldest first. A rider pay comes from the distance band the drop falls in, so the distance
        below is the number that decides what they earn — confirm it rather than accepting the
        suggestion.
      </p>

      {board.unassigned.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          body="Nothing is waiting for a rider. The dispatch board shows what is already on the road."
        />
      ) : (
        <ul className="m-0 grid list-none gap-base p-0">
          {board.unassigned.map((order) => (
            <li key={order.id} id={`order-${order.id}`} className="m-0 scroll-mt-xl p-0">
              <article className="rounded-lg border border-border bg-surface-card p-lg">
                <div className="flex flex-wrap items-baseline justify-between gap-sm">
                  <div>
                    <h2 className="mt-0 mb-xs font-body-md text-base font-normal">
                      {order.orderCode}
                    </h2>
                    <p className="text-sm text-ink-muted m-0">
                      {order.pincode} · {order.zoneName ?? 'No zone assigned'} ·{' '}
                      {order.lineCount} {order.lineCount === 1 ? 'item' : 'items'} ·{' '}
                      {formatPaise(order.revenuePaise)}
                    </p>
                  </div>
                  <StatusPill status={order.orderStatus} />
                </div>

                <p className="text-sm text-ink-muted mt-sm mb-0">
                  Placed{' '}
                  <time dateTime={iso(order.createdAt) ?? undefined}>
                    {order.createdAt.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </p>

                <AssignButton
                  orderId={order.id}
                  orderCode={order.orderCode}
                  zoneName={order.zoneName}
                  suggestedKm={suggestedKmFor()}
                  riders={riderOptions}
                  bandRows={bands}
                />
              </article>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2xl text-sm text-ink-muted">
        <Link href="/admin-ops/board" className="text-primary underline underline-offset-4">
          See what is already on the road
        </Link>
      </p>
    </>
  )
}