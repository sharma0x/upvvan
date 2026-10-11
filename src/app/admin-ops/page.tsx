import Link from 'next/link'

import { EmptyState, OpsTiles, StatusPill } from '@/components/ops/OpsTiles'
import { formatPaise } from '@/lib/catalogue/pricing'
import { placedLabel } from '@/lib/dispatch/age'
import {
  iso,
  loadBoard,
  loadDashboardCounts,
  loadOperationalCity,
  todayRange,
} from '@/lib/dispatch/store.server'
import { requireOpsStaff } from '@/lib/dispatch/session.server'

/**
 * The shift dashboard.
 *
 * ── WHY THE DATA IS LOADED SERVER-SIDE AND NOT FETCHED ──────────────────────
 * A dispatch board is polled every few minutes during a shift. Fetching it from
 * the client means the operator is looking at a stale queue on the one screen
 * where staleness causes a plant to be missed, and it adds a loading state to
 * every render. Server-rendered with `revalidate = 0` gives the operator the
 * truth at request time, and `router.refresh()` from the assign button is one
 * line instead of a state machine.
 *
 * ── WHY THIS PAGE IS NOW GATED, WHEN IT PREVIOUSLY WAS NOT ─────────────────
 *
 * It used to render for anyone, with a banner: "You are not signed in as staff,
 * so you can look but not assign."
 *
 * That was reasoned about as if the page held only counts. It does not. It also
 * renders the waiting list (order code, pincode, zone, time) and the on-the-road
 * cards (order code, pincode, zone, band, PAYOUT). Order codes are capability
 * credentials — they are half of the credential that unlocks `/order/<code>` —
 * and rider payout is commercial information about named individuals.
 *
 * Publishing those to an unauthenticated visitor is not "looking but not acting".
 * So the page now redirects to the admin login, exactly as `/admin-ops/queue` and
 * `/admin-ops/board` do.
 *
 * The operator-experience worry behind the old banner — "an unrelated admin
 * session expiring logs them out mid-shift" — is answered by the `next`
 * parameter on the redirect rather than by showing the data to everybody.
 */
export const dynamic = 'force-dynamic'

export default async function OpsDashboard() {
  const staff = await requireOpsStaff('/admin-ops')
  const city = await loadOperationalCity()

  if (!city) {
    return (
      <>
        <h1 className="mt-0">Nothing to dispatch</h1>
        <EmptyState
          title="No city is live"
          body="Set a city to live with an approved licence in the admin panel and this console comes to life."
        />
      </>
    )
  }

  const day = todayRange()
  const [counts, board] = await Promise.all([
    loadDashboardCounts(city.id, day),
    loadBoard(city.id, day),
  ])

  // Money is summed as an integer and formatted once. Summing formatted strings
  // is how a payout total ends up ₹1 off, and it is also how a float gets near
  // a paise column.
  const earnedPaise = board.assigned
    .filter((d) => d.status === 'DELIVERED')
    .reduce((sum, d) => sum + d.payoutPaise, 0)

  const outstandingPaise = board.assigned
    .filter((d) => d.status !== 'DELIVERED' && d.status !== 'FAILED' && d.status !== 'CANCELLED')
    .reduce((sum, d) => sum + d.payoutPaise, 0)

  return (
    <>
      <div className="gap-sm flex flex-wrap items-baseline justify-between">
        <div>
          <p className="text-label-caps text-clay m-0">{city.name} · today</p>
          <h1 className="mt-xs mb-0">Shift</h1>
        </div>
        <p className="text-ink-muted m-0 text-sm">
          {staff ? `Signed in as ${staff.email ?? `staff#${staff.id}`}` : 'Not signed in'}
        </p>
      </div>

      <section aria-labelledby="today-numbers" className="mt-xl">
        <h2 id="today-numbers" className="sr-only">
          Today&rsquo;s numbers
        </h2>
        <OpsTiles
          tiles={[
            {
              label: 'Orders today',
              value: counts.ordersToday,
              tone: 'neutral',
              why: 'Everything placed today, assigned or not.',
            },
            {
              label: 'Unassigned',
              value: counts.unassigned,
              tone: counts.unassigned > 0 ? 'attention' : 'good',
              href: '/admin-ops/queue',
              // "Orders with no rider" — NOT "orders with no rider today".
              //
              // The tile stopped being a today-count when `loadBoard` stopped
              // hiding backlog, and the label has to say which one it is. An
              // operator reading "Unassigned 3" against a queue of 26 has no way
              // to tell whether the tile is measuring a different thing or simply
              // lying, and the only honest answer is to stop implying a window it
              // no longer has.
              why: 'Every paid order with no rider, however long it has been waiting. Not a today-count — this is a backlog, and waiting has no expiry date.',
            },
            {
              label: 'In flight',
              value: counts.inFlight,
              tone: 'neutral',
              href: '/admin-ops/board',
              why: 'Assigned, picked up or out for delivery right now.',
            },
            {
              label: 'Delivered',
              value: counts.delivered,
              tone: 'neutral',
              href: '/admin-ops/board',
              why: 'Closed on a customer-read code. Deliberately not the loudest number on this screen.',
            },
            {
              label: 'Failed',
              value: counts.failed,
              tone: counts.failed > 0 ? 'attention' : 'neutral',
              why: 'A rider could not complete the drop. These need a re-run, not a retry button.',
            },
            {
              label: 'Claims open',
              value: counts.claimsOpen,
              tone: counts.claimsOpen > 0 ? 'bad' : 'good',
              // Was `/admin-ops/board`, which cannot answer the question — the
              // board renders dispatch status and never reads the order's claim
              // state. It now goes where the decision can be made.
              href: '/admin-ops/claims',
              why: 'The only number here that means we failed the customer. It is always visible on purpose.',
            },
          ]}
        />
      </section>

      <section aria-labelledby="money" className="mt-2xl">
        <h2 id="money" className="mt-0">
          Rider pay today
        </h2>
        <p className="text-ink-muted mt-xs mb-base max-w-[68ch]">
          Every figure below is snapshotted from the city&rsquo;s distance bands at the moment the
          drop was assigned. Editing a band today does not change these numbers, because a rider who
          was promised a rate should be paid that rate.
        </p>

        <dl className="gap-sm m-0 grid sm:grid-cols-2">
          <div className="border-border bg-surface-card p-base rounded-md border">
            <dt className="text-label-caps text-ink-muted">Earned (delivered)</dt>
            <dd className="font-h2 mt-xs mb-0">{formatPaise(earnedPaise)}</dd>
          </div>
          <div className="border-border bg-surface-card p-base rounded-md border">
            <dt className="text-label-caps text-ink-muted">Outstanding (in flight)</dt>
            <dd className="font-h2 mt-xs mb-0">{formatPaise(outstandingPaise)}</dd>
          </div>
        </dl>

        <p className="text-ink-muted mt-base mb-0 text-sm">
          {counts.ridersOnShift} active {counts.ridersOnShift === 1 ? 'rider' : 'riders'} on the
          roster.
        </p>
      </section>

      <section aria-labelledby="unassigned-list" className="mt-2xl">
        <h2 id="unassigned-list" className="mt-0">
          Waiting for a rider
        </h2>

        {board.unassigned.length === 0 ? (
          // Was "Every order placed today has a rider." That sentence is only
          // true of a today-scoped queue, and this queue is not scoped to today —
          // it is every paid order still waiting. So the claim had to go rather
          // than be quietly narrowed: the whole cost of the filter that caused
          // this was an empty state that read as reassurance.
          <EmptyState
            title="Nothing waiting"
            body="Every paid order has a rider. This is every order, not only today's."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Orders with no rider assigned, oldest first</caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Order
                  </th>
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Pincode
                  </th>
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Zone
                  </th>
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Placed
                  </th>
                  <th scope="col" className="py-sm text-label-caps text-ink-muted">
                    <span className="sr-only">Assign</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.unassigned.slice(0, 12).map((order) => (
                  <tr key={order.id} className="border-border border-b">
                    <th scope="row" className="py-sm pr-base font-normal">
                      {order.orderCode}
                    </th>
                    <td className="py-sm pr-base">{order.pincode}</td>
                    <td className="py-sm pr-base">
                      {order.zoneName ?? <span className="text-ink-muted">No zone</span>}
                    </td>
                    <td className="py-sm pr-base text-ink-muted">
                      <time dateTime={iso(order.createdAt) ?? undefined}>
                        {placedLabel(order.createdAt)}
                      </time>
                    </td>
                    <td className="py-sm text-right">
                      <Link
                        href={`/admin-ops/queue#order-${order.id}`}
                        className="bg-primary px-base py-sm text-surface-card inline-flex min-h-[44px] items-center rounded-sm text-sm no-underline"
                      >
                        Assign
                        <span className="sr-only"> order {order.orderCode}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {board.unassigned.length > 12 && (
              <p className="text-ink-muted mt-sm mb-0 text-sm">
                Showing 12 of {board.unassigned.length}.{' '}
                <Link href="/admin-ops/queue" className="text-primary underline underline-offset-4">
                  See the whole queue
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="recent" className="mt-2xl">
        <h2 id="recent" className="mt-0">
          On the road
        </h2>

        {board.assigned.length === 0 ? (
          <EmptyState
            title="No drops assigned"
            body="Assign one from the queue and it appears here."
          />
        ) : (
          <ul className="gap-sm m-0 grid list-none p-0 sm:grid-cols-2">
            {board.assigned.slice(0, 8).map((dispatch) => (
              <li key={dispatch.id} className="m-0 p-0">
                <Link
                  href={`/admin-ops/board#dispatch-${dispatch.id}`}
                  className="border-border bg-surface-card p-base text-ink hover:border-primary block rounded-md border no-underline"
                >
                  <span className="gap-sm flex items-baseline justify-between">
                    <span className="text-label-caps text-clay">{dispatch.orderCode}</span>
                    <StatusPill status={dispatch.status} />
                  </span>
                  <span className="text-ink-muted mt-sm block text-sm">
                    {dispatch.pincode} · {dispatch.zoneName ?? 'No zone'}
                  </span>
                  <span className="mt-sm block text-sm">
                    Band {dispatch.bandCode} · {formatPaise(dispatch.payoutPaise)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
