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
import { requireOpsStaff } from '@/lib/dispatch/session.server'
import { ReissueCodeButton } from '@/components/ops/ReissueCodeButton'

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
  //
  // GATED. See `requireOpsStaff`: this page renders order codes, pincodes,
  // revenue, rider names, band rates, payouts and the append-only event ledger.
  // It had no session check at all, so all of that was readable by anyone who
  // typed the URL. `noindex` is not access control.
  await requireOpsStaff('/admin-ops/board')

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

  /*
   * Sequential per drop, but bounded by the number of rows on screen — this is
   * N+1 by design and only N≈small, because the board is one shift. A single
   * joined query returning every event for every drop would load the whole day's
   * history to render six rows nobody scrolls to.
   *
   * ── THE BOUND IS NOT A CAP, IT IS A PAGER ──────────────────────────────────
   *
   * This used to be `board.assigned.slice(0, 40)` and the page then mapped over
   * ALL of `board.assigned`. So from the 41st drop onwards, `events[index]` was
   * `undefined`, `?? []` turned it into an empty array, and the row rendered a
   * table with headers, the caption "Append-only event history for UPV-…", and
   * the closing assurance "This history cannot be edited or deleted — the
   * database refuses both" — over zero rows.
   *
   * That is the worst possible way for this page to be wrong. It is the screen
   * whose entire purpose is reconstructing a disputed delivery, and past the 41st
   * drop it confidently told the operator that no history existed while showing
   * them every reason to believe it had been checked.
   *
   * Both sides now read `visible`, and a `+N more` line says so explicitly rather
   * than letting the tail quietly vanish.
   */
  const visible = board.assigned.slice(0, 40)
  const hiddenCount = board.assigned.length - visible.length

  const events = await Promise.all(visible.map((dispatch) => loadEvents(dispatch.id)))

  return (
    <>
      <p className="text-label-caps text-clay m-0">{city.name} · today</p>
      <h1 className="mt-xs mb-0">Dispatch board</h1>

      <section aria-labelledby="zone-capacity" className="mt-xl">
        <h2 id="zone-capacity" className="mt-0">
          Zone capacity
        </h2>
        <ul className="gap-sm m-0 grid list-none grid-cols-2 p-0 sm:grid-cols-4">
          {zones.map((zone) => {
            const atCapacity = zone.maxDailyDrops != null && zone.used >= zone.maxDailyDrops
            return (
              <li key={zone.zoneId} className="m-0 p-0">
                {/*
                  Border carries the capacity signal as well as the colour, per
                  DESIGN.md's rule that a state must survive greyscale. An
                  operator glancing at four tiles must be able to tell which one
                  is full without relying on amber.
                */}
                <div
                  className={`p-base rounded-md border ${atCapacity ? 'border-warning bg-surface-raised' : 'border-border bg-surface-card'}`}
                >
                  <p className="text-label-caps text-ink-muted m-0">{zone.name}</p>
                  <p className="font-h2 mt-sm mb-0">
                    {zone.used}
                    <span className="text-ink-muted text-base"> / {zone.maxDailyDrops ?? '—'}</span>
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
          <ul className="gap-sm m-0 grid list-none p-0">
            {visible.map((dispatch, index) => (
              <li key={dispatch.id} id={`dispatch-${dispatch.id}`} className="scroll-mt-xl m-0 p-0">
                <details className="border-border bg-surface-card rounded-md border">
                  <summary className="p-base cursor-pointer list-none">
                    <span className="gap-sm flex flex-wrap items-baseline justify-between">
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

                  <div className="border-border p-base border-t">
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
                          <tr key={event.id} className="border-border border-t">
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

                    {events[index]!.length === 0 ? (
                      <p className="text-danger mt-base mb-0 text-sm">
                        No events recorded for this drop. That should not happen — the assignment
                        writes one in the same transaction that creates the row. Treat it as a fault
                        and ask the developer.
                      </p>
                    ) : (
                      <p className="text-ink-muted mt-base mb-0 text-sm">
                        This history cannot be edited or deleted — the database refuses both. It
                        exists so a disputed delivery can be reconstructed, not to catch anybody
                        out.
                      </p>
                    )}

                    {dispatch.failureReason && (
                      <p className="text-danger mt-sm mb-0 text-sm">
                        Failure reason: {dispatch.failureReason}
                      </p>
                    )}

                    {/*
                      ── REISSUE THE DELIVERY CODE ─────────────────────────────────

                      The one control on this page that repairs a stuck delivery.
                      `reissueOtp` existed with zero callers, and three
                      rider-facing errors instructed the rider to "ask the
                      dispatcher to reissue it" — so a drop whose code had expired,
                      or which a customer had failed five times, was permanently
                      unclosable through any interface.

                      Shown on anything not yet DELIVERED, because that is the
                      entire set of drops where a code still has work to do.
                    */}
                    {dispatch.status !== 'DELIVERED' && (
                      <ReissueCodeButton dispatchId={dispatch.id} orderCode={dispatch.orderCode} />
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        {hiddenCount > 0 && (
          <p className="text-ink-muted mt-base mb-0 text-sm">
            Showing the first {visible.length} of {board.assigned.length} drops. {hiddenCount} more{' '}
            {hiddenCount === 1 ? 'is' : 'are'} on the board and not listed here.
          </p>
        )}
      </section>
    </>
  )
}
