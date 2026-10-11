import { EmptyState } from '@/components/ops/OpsTiles'
import { ClaimTriageControls } from '@/components/ops/ClaimTriageControls'
import { requireOpsStaff } from '@/lib/dispatch/session.server'
import { listClaims } from '@/lib/claims/triage'
import { guaranteeTerms } from '@/lib/commerce/guarantee'

/**
 * The claims queue.
 *
 * ── WHY THIS PAGE HAD TO BE BUILT ───────────────────────────────────────────
 *
 * A customer could open a claim and nothing could close it. There was no screen
 * for it, no route, no button, and — because `order_claims` is a raw table with
 * no Payload collection — not even an admin panel view.
 *
 * The order's own state machine made that terminal: `CLAIM_OPEN` only leads to
 * `REPLACEMENT_QUEUED` or `DELIVERED`, so an unresolved claim pinned the order
 * there permanently and blocked a second claim with "we are already handling it".
 *
 * So the console's job on this page is narrow and important: put a person in front
 * of a photograph within the guarantee window, and let them say one of three
 * things.
 *
 * ── WHY OPEN CLAIMS ARE FIRST ────────────────────────────────────────────────
 *
 * The ordering is by `created_at` DESC within OPEN, because the risk is age.
 * Every hour an open claim sits here is an hour closer to a guarantee window
 * closing on a plant we have already agreed to replace.
 */
export const dynamic = 'force-dynamic'

function ago(d: Date): string {
  const hours = Math.max(0, Math.round((Date.now() - d.getTime()) / 3_600_000))
  if (hours < 1) return 'just now'
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default async function OpsClaims() {
  // GATED. See `requireOpsStaff` — this page renders customer names, phone
  // numbers, what each customer says about a dead plant, and the evidence URLs
  // they sent.
  await requireOpsStaff('/admin-ops/claims')

  const claims = await listClaims()
  const open = claims.filter((c) => c.status === 'OPEN')
  const closed = claims.filter((c) => c.status !== 'OPEN')

  return (
    <>
      <p className="text-label-caps text-clay m-0">Customer problems</p>
      <h1 className="mt-xs mb-0">Claims</h1>

      <p className="text-ink-muted mt-sm mb-0 max-w-[68ch]">
        Every claim here is a plant somebody paid for. Decide it within the guarantee window and
        tell them either way — a customer who hears nothing concludes we did not read it.
      </p>

      <section aria-labelledby="open-claims" className="mt-2xl">
        <h2 id="open-claims" className="mt-0">
          Open ({open.length})
        </h2>

        {open.length === 0 ? (
          <EmptyState
            title="Nothing open"
            body="Every claim has been decided. This is the state the page was built to reach."
          />
        ) : (
          <ul className="gap-sm m-0 flex list-none flex-col p-0">
            {open.map((claim) => {
              const terms = guaranteeTerms(
                claims.find((c) => c.id === claim.id)?.guaranteeTier ?? 'T0',
              )
              return (
                <li
                  key={claim.id}
                  className="border-border bg-surface-card p-base rounded-md border"
                  data-testid={`claim-${claim.claimCode}`}
                >
                  <div className="gap-sm flex flex-wrap items-baseline justify-between">
                    <span className="text-label-caps text-clay">{claim.claimCode}</span>
                    <span className="text-ink-muted text-sm">{ago(claim.createdAt)}</span>
                  </div>

                  <p className="mt-xs mb-0">
                    <strong>{claim.customerName ?? 'Customer'}</strong>
                    {claim.customerPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${claim.customerPhone}`} className="text-primary underline">
                          {claim.customerPhone}
                        </a>
                      </>
                    )}
                  </p>

                  <p className="text-ink-muted mt-0 mb-0 text-sm">
                    <LinkToOrder code={claim.orderCode} /> ·{' '}
                    {claim.kind.replace(/_/g, ' ').toLowerCase()}
                    {claim.orderItemLabel ? ` · ${claim.orderItemLabel}` : ''}
                  </p>

                  {/*
                    The customer's words, verbatim. Not summarised, not truncated
                    to fit a table — a grower deciding whether a plant arrived
                    dead needs the sentence the customer actually typed, and this
                    project promises "a human reads every claim".
                  */}
                  <p className="mt-sm mb-0 whitespace-pre-line">{claim.description}</p>

                  {claim.evidenceUrl && (
                    <p className="mt-xs mb-0 text-sm">
                      <a
                        href={claim.evidenceUrl}
                        rel="noreferrer noopener"
                        target="_blank"
                        className="text-primary underline"
                      >
                        Their photo →
                      </a>
                    </p>
                  )}

                  <p className="text-ink-muted mt-xs mb-0 text-sm">
                    Guarantee on this order: {terms.label} — {terms.summary}
                  </p>

                  <ClaimTriageControls claimId={claim.id} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="closed-claims" className="mt-2xl">
        <h2 id="closed-claims" className="mt-0">
          Decided ({closed.length})
        </h2>

        {closed.length === 0 ? (
          <p className="text-ink-muted">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Claims that have been decided</caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Claim
                  </th>
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Order
                  </th>
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Outcome
                  </th>
                  <th scope="col" className="py-sm pr-base text-label-caps text-ink-muted">
                    Decided
                  </th>
                </tr>
              </thead>
              <tbody>
                {closed.map((claim) => (
                  <tr key={claim.id} className="border-border border-b">
                    <th scope="row" className="py-sm pr-base font-normal">
                      {claim.claimCode}
                    </th>
                    <td className="py-sm pr-base">
                      <LinkToOrder code={claim.orderCode} />
                    </td>
                    <td className="py-sm pr-base">
                      {claim.status.replace(/_/g, ' ').toLowerCase()}
                    </td>
                    <td className="py-sm pr-base text-ink-muted">
                      {claim.resolvedAt ? ago(claim.resolvedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function LinkToOrder({ code }: { code: string }) {
  return (
    <a href={`/admin-ops/board#order-${code}`} className="text-primary underline">
      {code}
    </a>
  )
}
