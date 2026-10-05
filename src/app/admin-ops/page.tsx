import Link from 'next/link'

import { EmptyState, OpsTiles, StatusPill } from '@/components/ops/OpsTiles'
import { formatPaise } from '@/lib/catalogue/pricing'
import {
  iso,
  loadBoard,
  loadDashboardCounts,
  loadOperationalCity,
  todayRange,
} from '@/lib/dispatch/store.server'
import { currentStaff } from '@/lib/dispatch/session.server'

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
 * ── WHY A MISSING STAFF SESSION IS A WARNING AND NOT A 403 ─────────────────
 * `currentStaff()` is a best-effort read of Payload's session cookie. Refusing
 * the page outright would mean an operator mid-shift gets logged out of the
 * console by an unrelated admin session expiring. So the console renders and says
 * plainly that actions will be refused — the API routes enforce, and the warning
 * here is about honesty rather than about access control.
 */
export const dynamic = 'force-dynamic'

export default async function OpsDashboard() {
  const [staff, city] = await Promise.all([currentStaff(), loadOperationalCity()])

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
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <div>
          <p className="text-label-caps text-clay m-0">{city.name} · today</p>
          <h1 className="mt-xs mb-0">Shift</h1>
        </div>
        <p className="text-sm text-ink-muted m-0">
          {staff ? `Signed in as ${staff.email ?? `staff#${staff.id}`}` : 'Not signed in'}
        </p>
      </div>

      {/*
        `role="status"` + `aria-live="polite"` on the warning: it appears on load
        for an operator who needs to know their next click will fail, and a
        visually-present-only warning is invisible to a screen-reader user unless
        it is announced.
      */}
      {!staff && (
        <p
          role="status"
          className="mt-base rounded-md border border-border bg-surface-raised p-base text-sm text-ink"
        >
          You are not signed in as staff, so you can look but not assign. Sign in at{' '}
          <Link href="/admin" className="text-primary underline underline-offset-4">
            /admin
          </Link>{' '}
          and reload this page.
        </p>
      )}

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
              why: 'Orders with no rider. The only number on this screen that gets worse while you wait.',
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
              href: '/admin-ops/board',
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
          drop was assigned. Editing a band today does not change these numbers, because a rider
          who was promised a rate should be paid that rate.
        </p>

        <dl className="m-0 grid gap-sm sm:grid-cols-2">
          <div className="rounded-md border border-border bg-surface-card p-base">
            <dt className="text-label-caps text-ink-muted">Earned (delivered)</dt>
            <dd className="font-h2 mt-xs mb-0">{formatPaise(earnedPaise)}</dd>
          </div>
          <div className="rounded-md border border-border bg-surface-card p-base">
            <dt className="text-label-caps text-ink-muted">Outstanding (in flight)</dt>
            <dd className="font-h2 mt-xs mb-0">{formatPaise(outstandingPaise)}</dd>
          </div>
        </dl>

        <p className="text-sm text-ink-muted mt-base mb-0">
          {counts.ridersOnShift} active {counts.ridersOnShift === 1 ? 'rider' : 'riders'} on the
          roster.
        </p>
      </section>

      <section aria-labelledby="unassigned-list" className="mt-2xl">
        <h2 id="unassigned-list" className="mt-0">
          Waiting for a rider
        </h2>

        {board.unassigned.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            body="Every order placed today has a rider."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Orders with no rider assigned, oldest first
              </caption>
              <thead>
                <tr className="border-b border-border">
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
                  <tr key={order.id} className="border-b border-border">
                    <th scope="row" className="py-sm pr-base font-normal">
                      {order.orderCode}
                    </th>
                    <td className="py-sm pr-base">{order.pincode}</td>
                    <td className="py-sm pr-base">
                      {order.zoneName ?? <span className="text-ink-muted">No zone</span>}
                    </td>
                    <td className="py-sm pr-base text-ink-muted">
                      <time dateTime={iso(order.createdAt) ?? undefined}>
                        {order.createdAt.toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </td>
                    <td className="py-sm text-right">
                      <Link
                        href={`/admin-ops/queue#order-${order.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-sm bg-primary px-base py-sm text-sm text-surface-card no-underline"
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
              <p className="text-sm text-ink-muted mt-sm mb-0">
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
          <ul className="m-0 grid list-none gap-sm p-0 sm:grid-cols-2">
            {board.assigned.slice(0, 8).map((dispatch) => (
              <li key={dispatch.id} className="m-0 p-0">
                <Link
                  href={`/admin-ops/board#dispatch-${dispatch.id}`}
                  className="block rounded-md border border-border bg-surface-card p-base text-ink no-underline hover:border-primary"
                >
                  <span className="flex items-baseline justify-between gap-sm">
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