import { EmptyState, StatusPill } from '@/components/ops/OpsTiles'
import { formatPaise } from '@/lib/catalogue/pricing'
import {
  iso,
  loadBoard,
  loadEvents,
  loadOperationalCity,
  loadZoneCapacityToday,
  todayRange,
} from '@/lib/dispatch/store.server'

/**
 * The dispatch board.
 *
 * ── WHY EACH DROP LINKS TO ITS OWN LEDGER ─────────────────────────────────
 * Every row expands to the append-only event history for that drop. This is the
 * screen where a disputed delivery is actually settled — "the customer says it
 * never arrived" is unanswerable against a status column, because a status
 * column has no memory. Against a ledger it is a question with an answer: when
 * was it assigned, to whom, at what rate, was a code sent, was a code verified,
 * and who was on the other end.
 *
 * That is the audit trail doing the job it was modelled for. It is not a
 * surveillance tool and there is no penalty regime attached to it.
 */
export const dynamic = 'force-dynamic'

export default async function OpsBoard() {
  const city = await loadOperationalCity()
  if (!city) {
    return (
      <>
        <h1 className="mt-0">Dispatch board</h1>
        <EmptyState
          title="No city is live"
          body="Set a city to live with an approved licence in the admin panel."
        />
      </>
    )
  }

  const day = todayRange()
  const [board, zones] = await Promise.all([
    loadBoard(city.id, day),
    loadZoneCapacityToday(city.id, day),
  ])

  // Sequential per drop, but bounded by the number of rows on screen — this is
  // N+1 by design and only N≈small, because the board is one shift. A single
  // joined query returning every event for every drop would load the whole day's
  // history to render six rows nobody scrolls to.
  const events = await Promise.all(
    board.assigned.slice(0, 40).map((dispatch) => loadEvents(dispatch.id)),
  )

  return (
    <>
      <p className="text-label-caps text-clay m-0">{city.name} · today</p>
      <h1 className="mt-xs mb-0">Dispatch board</h1>

      <section aria-labelledby="zone-capacity" className="mt-xl">
        <h2 id="zone-capacity" className="mt-0">
          Zone capacity
        </h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-sm p-0 sm:grid-cols-4">
          {zones.map((zone) => {
            const atCapacity =
              zone.maxDailyDrops != null && zone.used >= zone.maxDailyDrops
            return (
              <li key={zone.zoneId} className="m-0 p-0">
                {/*
                  Border carries the capacity signal as well as the colour, per
                  DESIGN.md's rule that a state must survive greyscale. An
                  operator glancing at four tiles must be able to tell which one
                  is full without relying on amber.
                */}
                <div
                  className={`rounded-md border p-base ${atCapacity ? 'border-warning bg-surface-raised' : 'border-border bg-surface-card'}`}
                >
                  <p className="text-label-caps text-ink-muted m-0">{zone.name}</p>
                  <p className="font-h2 mt-sm mb-0">
                    {zone.used}
                    <span className="text-ink-muted text-base">
                      {' '}
                      / {zone.maxDailyDrops ?? '—'}
                    </span>
                  </p>
                  {atCapacity && (
                    <p className="text-warning mt-xs mb-0 text-sm">Full — add a rider</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="drops" className="mt-2xl">
        <h2 id="drops" className="mt-0">
          Drops
        </h2>

        {board.assigned.length === 0 ? (
          <EmptyState
            title="Nothing on the road"
            body="Assign a drop from the queue and it appears here with its full event history."
          />
        ) : (
          <ul className="m-0 grid list-none gap-sm p-0">
            {board.assigned.map((dispatch, index) => (
              <li
                key={dispatch.id}
                id={`dispatch-${dispatch.id}`}
                className="m-0 scroll-mt-xl p-0"
              >
                <details className="rounded-md border border-border bg-surface-card">
                  <summary className="cursor-pointer list-none p-base">
                    <span className="flex flex-wrap items-baseline justify-between gap-sm">
                      <span>
                        <span className="text-label-caps text-clay">{dispatch.orderCode}</span>
                        <span className="text-ink-muted ml-base text-sm">
                          {dispatch.pincode} · {dispatch.zoneName ?? 'No zone'}
                        </span>
                      </span>
                      <StatusPill status={dispatch.status} />
                    </span>

                    <span className="mt-sm block text-sm">
                      <span className="text-ink-muted">Band {dispatch.bandCode}</span>{' '}
                      <span aria-label={`pays ${formatPaise(dispatch.payoutPaise)}`}>
                        {formatPaise(dispatch.payoutPaise)}
                      </span>
                      {dispatch.payMultiplierBp !== 10_000 && (
                        <span className="text-ink-muted">
                          {' '}
                          (band {formatPaise(dispatch.bandPayPaise)} ×{' '}
                          {dispatch.payMultiplierBp / 10_000})
                        </span>
                      )}
                    </span>

                    <span className="text-ink-muted mt-xs block text-sm">
                      Assigned{' '}
                      <time dateTime={iso(dispatch.assignedAt) ?? undefined}>
                        {dispatch.assignedAt.toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                      {dispatch.deliveredAt && (
                        <>
                          {' · delivered '}
                          <time dateTime={iso(dispatch.deliveredAt) ?? undefined}>
                            {dispatch.deliveredAt.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </>
                      )}
                    </span>
                  </summary>

                  <div className="border-t border-border p-base">
                    {/*
                      A table, not a paragraph: "who did what, when" is tabular
                      data, and a screen-reader user navigating this needs to be
                      able to ask for the DELIVERED row without reading
                      everything above it.
                    */}
                    <table className="w-full border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Append-only event history for {dispatch.orderCode}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col" className="py-xs pr-base text-label-caps text-ink-muted">
                            When
                          </th>
                          <th scope="col" className="py-xs pr-base text-label-caps text-ink-muted">
                            Event
                          </th>
                          <th scope="col" className="py-xs pr-base text-label-caps text-ink-muted">
                            Who
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(events[index] ?? []).map((event) => (
                          <tr key={event.id} className="border-t border-border">
                            <td className="py-xs pr-base text-ink-muted">
                              <time dateTime={iso(event.occurredAt) ?? undefined}>
                                {event.occurredAt.toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </time>
                            </td>
                            <td className="py-xs pr-base">
                              {event.kind.replace(/_/g, ' ').toLowerCase()}
                            </td>
                            <td className="py-xs pr-base text-ink-muted">
                              {event.actorLabel ?? event.actorKind}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <p className="text-sm text-ink-muted mt-base mb-0">
                      This history cannot be edited or deleted — the database refuses both. It
                      exists so a disputed delivery can be reconstructed, not to catch anybody out.
                    </p>

                    {dispatch.failureReason && (
                      <p className="text-danger mt-sm mb-0 text-sm">
                        Failure reason: {dispatch.failureReason}
                      </p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}