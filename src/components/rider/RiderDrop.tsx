'use client'

import { useState } from 'react'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { DispatchRow } from '@/lib/dispatch/store.server'

/**
 * One drop on the rider's run.
 *
 * ── WHY DELIVERY IS A CODE ENTRY AND NOT A BUTTON ──────────────────────────
 *
 * This is the most important 40 lines of rider UI in the project.
 *
 * "Order marked delivered but not received" is the complaint that produced
 * Urvann's 2.1/5, and their fix was to fine staff ₹100 for exactly this. A fine
 * is an admission that lying is cheaper than delivering — and for a rider closing
 * ten drops before dinner, it still is. So the honest path has to be the EASY
 * path instead.
 *
 * The easy path is: read the code off the customer's phone, type it, done. Four
 * digits, one field, no penalty, no fine, no escalation. What we have removed is
 * every reason to skip it.
 *
 * What we have NOT done is trusted anybody. The `DELIVERED` write is refused by
 * the database unless `delivery_otp_verified_at` is set, so this component is a
 * convenience over a control that holds without it. Two defences of the same
 * thing is the point: the UI makes it easy, the schema makes it true.
 *
 * The rider is not the adversary in this design. A rider asked to fake a delivery
 * is a rider whose employer made honesty expensive, and the fix for that is the
 * pay structure in `assign.ts` — not a threat on a screen.
 *
 * ── THE ADDRESS AND THE PHONE, WHICH WERE MISSING ───────────────────────────
 *
 * This card used to show the order code, the status, the pincode, the zone and
 * the pay. The delivery address and the customer's phone number existed only in
 * the dispatch e-mail.
 *
 * Which means the run page could not actually be used to run a delivery. A rider
 * with the app open in one hand had to read an address off a mail client in the
 * other, and had no way to call the customer on arrival at all — while the
 * component's own closing step requires reading a code off that customer's phone.
 * The address and the number are here now, because they are the two things a
 * rider uses at the door.
 *
 * ── WHY "COULDN'T DELIVER" IS ON THIS SCREEN AT ALL ─────────────────────────
 *
 * `FAILED` and `CANCELLED` were legal from the transition route, legal in the
 * database trigger, rendered by the dashboard's "Failed" tile and printed on the
 * dispatch board — and NOBODY COULD PRODUCE ONE. No page, no component, no
 * admin control emitted them.
 *
 * So a rider who turned up to a closed flat, a wrong address or a refused
 * handover had exactly one available action: lie, and mark it delivered. The
 * honest outcome and the dishonest one led to the same button.
 *
 * That is the failure mode this whole surface was designed to prevent, and it was
 * reachable because the reporting path was never built.
 *
 * ── WHY THE EVIDENCE QUESTION IS ASKED RATHER THAN ASSUMED ──────────────────
 *
 * This card used to send, on every single delivery, a hardcoded:
 *
 *     claimEvidenceKind: 'unboxing_video_requested'
 *     claimEvidenceNote: 'Told the customer to film the unboxing, same day, uncut.'
 *
 * Nobody was asked. That note is a written record — in `dispatch_events`, in an
 * append-only ledger — asserting a conversation that may never have happened, and
 * it is precisely the kind of record that must not be manufactured. It also made
 * the schema's other three evidence values (`customer_declined`, `photo_at_handover`,
 * `not_requested`) unreachable, so the column could only ever say one thing.
 *
 * Now the rider is asked what actually happened, and a refusal is a first-class
 * answer. Recording "the customer said no" honestly is more useful to us than a
 * fabricated "they said yes" — it tells us where the unboxing-request lever does
 * and does not convert.
 */
export function RiderDrop({
  drop,
  otpLength,
  supportPhone,
}: {
  drop: DispatchRow
  /**
   * From `config.auth.otpLength`.
   *
   * It was hardcoded to `6` in three places on this surface while the API used
   * the config value. Set the config to 4 and the "Close delivery" button could
   * never enable — the rider was permanently locked out of closing a delivery, on
   * a screen with no error message explaining why. A number that both sides must
   * agree on has exactly one home.
   */
  otpLength: number
  supportPhone: string
}) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)

  /*
   * The unboxing question, per drop, in component state.
   *
   * Deliberately NOT defaulted. A pre-selected answer is an answer the rider did
   * not give — they tapped through a screen at a doorstep, and whatever was
   * highlighted is what gets written into the ledger. Defaulting to "requested"
   * would have produced the same fabricated record this component used to send,
   * with an extra tap to do it.
   */
  const [evidence, setEvidence] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState('')
  const [showFailure, setShowFailure] = useState(false)

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? 'That did not work.')
    return payload
  }

  async function advance(to: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setError(null)
    try {
      await post(`/api/rider/dispatch/${drop.id}/transition`, { to, ...extra })
      // Full reload rather than router.refresh(): the run list re-sorts by band
      // after every transition, so this card may no longer belong where it is.
      // A refresh cannot leave a rider looking at a card that has moved.
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function closeDelivery() {
    setBusy(true)
    setError(null)
    try {
      await post(`/api/rider/dispatch/${drop.id}/deliver`, {
        code,
        // Only sent if the rider actually answered. `null` tells the API to fall
        // back to its own default rather than inventing an answer on their behalf.
        ...(evidence ? { claimEvidenceKind: evidence } : {}),
      })
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const terminal =
    drop.status === 'DELIVERED' || drop.status === 'FAILED' || drop.status === 'CANCELLED'

  const callHref = drop.customerPhone ? `tel:${drop.customerPhone.replace(/[^\d+]/g, '')}` : ''
  const waHref = drop.customerPhone
    ? `https://wa.me/91${drop.customerPhone.replace(/\D/g, '').slice(-10)}`
    : ''

  return (
    <article className="border-border bg-surface-card p-base rounded-lg border">
      <div className="gap-sm flex flex-wrap items-baseline justify-between">
        <h3 className="font-body-md mt-0 mb-0 text-base font-normal">{drop.orderCode}</h3>
        <span
          className={`border-border px-sm py-xs text-label-caps inline-block rounded-sm border ${
            drop.status === 'DELIVERED'
              ? 'bg-success-soft text-success'
              : drop.status === 'FAILED'
                ? 'bg-surface-raised text-danger'
                : 'bg-brand-soft text-forest'
          }`}
        >
          {drop.status.replace(/_/g, ' ').toLowerCase()}
        </span>
      </div>

      {/*
        ── WHERE, AND WHO ──────────────────────────────────────────────────────

        Above everything else on the card. The pincode was here before and it is
        not enough: a pincode is a postcode, and a rider standing on a street with
        six identical apartment blocks cannot use a postcode to find a door.
      */}
      {drop.customerName && <p className="mt-sm mb-0 font-semibold">{drop.customerName}</p>}
      <address className="text-ink mt-xs mb-0 not-italic" data-testid="drop-address">
        {drop.addressLines.length > 0 ? (
          drop.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))
        ) : (
          <span className="block">{drop.pincode}</span>
        )}
      </address>

      {/* One tap to call, one to WhatsApp. Not decoration: the rider is told the
          customer will be asked for a code, and the fastest resolution of a
          "nobody is answering" is a phone call. */}
      {drop.customerPhone && (
        <p className="gap-sm mt-sm mb-0 flex flex-wrap">
          <a
            href={callHref}
            data-testid="drop-call"
            className="border-border text-primary inline-flex min-h-[44px] items-center rounded-sm border px-4 no-underline"
          >
            Call {drop.customerPhone}
          </a>
          {waHref && (
            <a
              href={waHref}
              className="border-border text-ink-muted inline-flex min-h-[44px] items-center rounded-sm border px-4 no-underline"
            >
              WhatsApp
            </a>
          )}
        </p>
      )}

      {/*
        What is in the box. The rider is pulling this off a shelf by hand, and a
        card that says only "1 item" is a card that gets the wrong pot.
      */}
      {drop.itemSummary && (
        <p className="text-ink-muted mt-sm mb-0 text-sm">
          <span className="text-label-caps">In the box: </span>
          {drop.itemSummary}
        </p>
      )}

      <p className="text-ink-muted mt-xs mb-0 text-sm">
        {drop.pincode} · {drop.zoneName ?? 'No zone'}
      </p>

      {/*
        The pay line is not decoration. research/concept.md §4.1 requires per-drop
        pay to be visible upfront and §4.4 forbids hiding the banding behind an
        internal formula — so the band AND the resulting amount are both shown,
        and so is the per-rider multiplier when it is not 1.0×. A rider who
        cannot see what a drop pays stops trusting the run, and an untrusted run
        is where a "let me just tap this" shortcut comes from.
      */}
      <p className="mt-sm mb-0">
        <span className="text-ink-muted text-sm">Band {drop.bandCode} · </span>
        <span className="text-base">{formatPaise(drop.payoutPaise)}</span>
        {drop.payMultiplierBp !== 10_000 && (
          <span className="text-ink-muted text-sm">
            {' '}
            (band {formatPaise(drop.bandPayPaise)} × {drop.payMultiplierBp / 10_000})
          </span>
        )}
      </p>

      {terminal ? (
        <p className="text-ink-muted mt-base mb-0 text-sm">
          {drop.status === 'DELIVERED'
            ? `Delivered at ${drop.deliveredAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Closed on the customer's code.`
            : (drop.failureReason ?? 'This drop is closed.')}
        </p>
      ) : drop.status === 'OUT_FOR_DELIVERY' ? (
        <div className="mt-base">
          {showCode ? (
            <>
              <label htmlFor={`code-${drop.id}`} className="text-label-caps text-ink-muted block">
                Code from the customer&rsquo;s phone
              </label>
              {/*
                `inputMode="numeric"` + `autoComplete="one-time-code"` so iOS
                offers the code straight from the SMS banner and Android offers
                autofill. It is the difference between typing six digits at a
                doorstep and one tap — and this screen is used at a doorstep.
              */}
              <input
                id={`code-${drop.id}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={otpLength}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, otpLength))}
                className="mt-xs border-border bg-surface px-base py-sm font-h2 w-full rounded-sm border text-center"
              />

              <p className="text-ink-muted mt-sm mb-0 text-sm">
                Ask the customer for the code in the message we sent them. Give it to me only when
                the plant is in your hands.
              </p>

              {/*
                ── THE UNBOXING QUESTION, ASKED ───────────────────────────────────

                Four answers, none pre-selected. "They said no" is a real answer
                and recording it is more useful to us than a fabricated yes —
                and it is the only way the three other values the schema permits
                can ever be written.
              */}
              <fieldset className="border-border mt-base p-sm rounded-sm border">
                <legend className="text-label-caps text-ink-muted px-xs">
                  Did you ask them to film the unboxing?
                </legend>
                <div className="gap-xs flex flex-col">
                  {[
                    { value: 'unboxing_video_requested', label: 'Yes, and they agreed' },
                    { value: 'photo_at_handover', label: 'No — I took a photo instead' },
                    { value: 'customer_declined', label: 'They said no' },
                    { value: 'not_requested', label: 'I did not ask' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="inline-flex min-h-[44px] items-center gap-2"
                    >
                      <input
                        type="radio"
                        name={`evidence-${drop.id}`}
                        value={option.value}
                        checked={evidence === option.value}
                        onChange={() => setEvidence(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={closeDelivery}
                disabled={busy || code.length !== otpLength}
                data-testid="close-delivery"
                className="mt-base bg-primary px-base py-base text-surface-card w-full cursor-pointer rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Closing…' : 'Close delivery'}
              </button>

              <p className="mt-base mb-0">
                <button
                  type="button"
                  onClick={() => setShowFailure(true)}
                  className="border-border text-ink-muted min-h-[44px] w-full cursor-pointer rounded-sm border text-sm"
                >
                  I could not deliver this
                </button>
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowCode(true)}
              data-testid="ask-for-code"
              className="bg-primary px-base py-base text-surface-card w-full cursor-pointer rounded-sm"
            >
              Ask for the customer&rsquo;s code
            </button>
          )}
        </div>
      ) : drop.status === 'PICKED_UP' ? (
        <button
          type="button"
          onClick={() => advance('OUT_FOR_DELIVERY')}
          disabled={busy}
          data-testid="out-for-delivery"
          className="mt-base bg-primary px-base py-base text-surface-card w-full cursor-pointer rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Out for delivery'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => advance('PICKED_UP')}
          disabled={busy}
          data-testid="picked-up"
          className="mt-base bg-primary px-base py-base text-surface-card w-full cursor-pointer rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Picked up'}
        </button>
      )}

      {/*
        ── THE FAILURE PATH ────────────────────────────────────────────────────

        Free text, and it is REQUIRED. `failure_reason` is what turns "the Failed
        tile says 2" into something a dispatcher can act on at 7pm, and an empty
        reason produces a tile nobody can do anything with.

        The failure is NOT terminal for the ORDER — only for the drop. The order
        stays paid and stays ours to deliver; see `order-sync.ts`. So a rider
        reporting a failure is reporting a logistics problem, not cancelling
        somebody's plant.
      */}
      {showFailure && !terminal && (
        <div className="border-border bg-surface-raised mt-sm p-sm rounded-sm border">
          <label htmlFor={`failure-${drop.id}`} className="text-label-caps text-ink-muted block">
            What happened? (required)
          </label>
          <textarea
            id={`failure-${drop.id}`}
            rows={3}
            maxLength={200}
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
            placeholder="Nobody home. Called twice, no answer."
            className="border-border bg-surface mt-xs w-full rounded-sm border px-3 py-2.5"
          />
          <div className="mt-sm gap-sm flex">
            <button
              type="button"
              disabled={busy || failureReason.trim().length < 5}
              onClick={() => advance('FAILED', { failureReason: failureReason.trim() })}
              className="bg-primary text-surface-card min-h-[44px] flex-1 cursor-pointer rounded-sm px-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Report it'}
            </button>
            <button
              type="button"
              onClick={() => setShowFailure(false)}
              className="border-border min-h-[44px] cursor-pointer rounded-sm border px-3"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/*
        `role="alert"` rather than `status`: a refused code is the outcome the
        rider needs to react to immediately, and an alert interrupts. A success
        message here would be `status` — but success reloads the page, so there is
        nothing to announce.
      */}
      {error && (
        <p
          role="alert"
          className="mt-sm border-border bg-surface-raised p-sm text-danger mb-0 rounded-sm border text-sm"
        >
          {error}
        </p>
      )}

      {supportPhone && (
        <p className="text-ink-muted mt-base mb-0 text-xs">
          Something wrong with this drop? The dispatcher is on{' '}
          <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="underline">
            {supportPhone}
          </a>
          . Do not mark it delivered to get it off your list.
        </p>
      )}
    </article>
  )
}
