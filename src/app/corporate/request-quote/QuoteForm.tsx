'use client'

import { useState } from 'react'

import { formatPaise } from '@/lib/catalogue/pricing'
import {
  CORPORATE_MOQ,
  MAX_NOTES,
  MAX_PERSONALISATION,
  OCCASION_OPTIONS,
  POT_PRINTING_EXTRA_DAYS,
  POT_PRINTING_MIN_QUANTITY,
  VOLUME_TIERS,
  estimatedTotalPaise,
  leadTimeDays,
  parseQuantity,
  rupeesToPaise,
  tierFor,
  validateQuoteRequest,
} from '@/lib/commerce/corporate'

/**
 * The self-serve quote form.
 *
 * ── WHY THIS LIVES BESIDE THE ROUTE AND NOT IN `src/components/` ─────────────
 *
 * The repo has both habits — `ContactForm.tsx` is in `src/components/contact/`,
 * while `CheckoutClient.tsx`, `LookupClient.tsx` and `ClaimClient.tsx` sit in
 * their route folders. This one is a single-use component with no second
 * consumer, and the co-located form is the one that wins as `src/components/`
 * fills up: a component in a `components/` folder is a claim that something else
 * will import it. So it is `QuoteForm.tsx`, in the route it serves.
 *
 * ── WHY THE VALIDATION COPY IS NOT WRITTEN HERE ──────────────────────────────
 *
 * Every refusal on this form comes out of `validateQuoteRequest` in
 * `corporate.ts` — the same function the API route calls. The message a buyer
 * reads under the form is byte-for-byte the message the server would have
 * returned, so the two can never disagree, and the copy is written once, in the
 * module that owns it. This file contains presentation and nothing else.
 *
 * What this file DOES add is the two affordances a validator cannot: the live
 * tier estimate while they type, and a `<min>` on the quantity so the browser
 * stops them submitting something the schema would refuse.
 */
type State =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; reference: string; tierLabel: string; quantity: string }
  | { state: 'failed'; message: string }

/**
 * Input styling, kept as one constant for the same reason `ContactForm` has one:
 * eleven hand-written class strings drift, and a form whose second box is a
 * different height is a form that looks unfinished.
 *
 * `bg-surface-raised` is the DESIGN.md `input-field` background, not a choice
 * made here, and every interactive element carries `min-h-[44px]` for WCAG 2.2
 * SC2.5.8 — the floor both HIG and Material ask for.
 */
const inputClass =
  'border-border bg-surface-raised text-ink min-h-[44px] w-full rounded-sm border px-3.5 py-3 text-base'

export default function QuoteForm({
  earliestDate,
  latestDate,
}: {
  /** Computed on the SERVER and passed down, so the `min` cannot hydrate-differ. */
  earliestDate: string
  latestDate: string
}) {
  const [state, setState] = useState<State>({ state: 'idle' })

  /*
   * Quantity and budget are CONTROLLED, and the occasion is controlled too, each
   * for one stated reason: the quantity drives the estimate panel, the budget
   * drives the "that is ₹700 per plant" confirmation, and the occasion has to be
   * readable to render ITS OWN note — a Diwali order needs months and an employee
   * birthday needs Tuesday, and advice that does not change with the selection is
   * not advice. Everything else is uncontrolled and read through FormData, because
   * a controlled field has its value mirrored into React state and that is nine
   * chances to have the mirror disagree with the DOM.
   *
   * All three initial values are constants or module literals, so the first render
   * is identical on the server and the client.
   */
  const [quantity, setQuantity] = useState(String(CORPORATE_MOQ))
  const [budget, setBudget] = useState('')
  const [occasion, setOccasion] = useState(OCCASION_OPTIONS[0]!.value)

  const typedQuantity = parseQuantity(quantity)
  /*
   * `orderableQuantity` is null for anything we would refuse — unparseable, or
   * under the published minimum — and the estimate always falls back to the MOQ.
   * Showing the entry tier to somebody who typed 6 is the most useful thing on
   * this page for them; totalling it at 6 would be quoting a price we do not sell
   * at, so the fallback is the quantity, not the typed one.
   */
  const orderableQuantity =
    typedQuantity !== null && typedQuantity >= CORPORATE_MOQ ? typedQuantity : null
  const belowMoq = orderableQuantity === null
  const pricedQuantity = orderableQuantity ?? CORPORATE_MOQ

  const tier = tierFor(pricedQuantity)
  const totalPaise = estimatedTotalPaise(pricedQuantity, tier.perUnitPaise)
  const leadDays = leadTimeDays(pricedQuantity)

  const nextTier = VOLUME_TIERS.find((candidate) => candidate.from > pricedQuantity)
  const budgetPaise = budget.trim() === '' ? null : rupeesToPaise(budget)
  const printingApplies = orderableQuantity !== null && pricedQuantity >= POT_PRINTING_MIN_QUANTITY
  const selectedOccasion = OCCASION_OPTIONS.find((option) => option.value === occasion)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())

    /*
     * Validate with the SERVER'S function, in the browser, before sending
     * anything. Two reasons, and the second is the real one: the buyer finds out
     * at the box rather than after a round trip, and the message is guaranteed to
     * be the one the server would have sent — there is no second copy of the copy.
     */
    const checked = validateQuoteRequest(data)
    if (!checked.ok) {
      setState({ state: 'failed', message: checked.error })
      return
    }

    setState({ state: 'sending' })
    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) {
        /*
         * A 429 carries the wait. Saying "try again in 40 seconds" is the
         * difference between a limit the customer understands and one that looks
         * like being blocked.
         */
        const wait = Number.isInteger(body.retryAfterSeconds)
          ? ` Try again in ${body.retryAfterSeconds} seconds.`
          : ''
        setState({ state: 'failed', message: `${body.message ?? 'Could not send that.'}${wait}` })
        return
      }
      setState({
        state: 'sent',
        reference: String(body.reference),
        tierLabel: String(body.tierLabel ?? tier.label),
        quantity: String(checked.value.minimumQuantity),
      })
    } catch {
      setState({
        state: 'failed',
        message:
          'We could not reach the server, so nothing has been sent and nothing has been charged. E-mail sales@upvvan and we will pick it up there.',
      })
    }
  }

  if (state.state === 'sent') {
    return (
      <div
        role="status"
        data-testid="quote-sent"
        className="border-success bg-success-soft mt-sm p-lg rounded-md border"
      >
        <h2 className="mt-0">Request received. Your reference is {state.reference}.</h2>
        <p>
          You asked about {state.quantity} plants, which is the <strong>{state.tierLabel}</strong>{' '}
          band. Keep that reference — quote it if you message us again and you will not have to
          explain yourself twice.
        </p>
        <h3 className="mt-lg">What happens next</h3>
        <ol className="mt-sm mb-base gap-xs flex list-decimal flex-col pl-5">
          <li>
            <strong>Within one working day</strong> — the same day if this is before noon — you get
            the itemised quote: plant by plant, pot by pot, with the GST as its own line and the
            date we can hold.
          </li>
          <li>
            <strong>Nothing has been charged and nothing is reserved.</strong> A quote is a
            document, not a commitment, and you are free to take it to another supplier and compare
            it — which is the entire point of this page.
          </li>
          <li>
            <strong>If we cannot do it</strong>, the first reply says so and says why. We would
            rather lose the order than take it and explain later.
          </li>
        </ol>
        <button
          type="button"
          onClick={() => {
            setState({ state: 'idle' })
            setQuantity(String(CORPORATE_MOQ))
            setBudget('')
          }}
          className="border-border hover:bg-brand-soft mt-sm min-h-[44px] cursor-pointer rounded-sm border px-3 text-sm"
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-base" noValidate>
      {/*
        `noValidate` for the same reason as `/contact`: the native bubbles are
        worse than ours. A browser says "Please fill out this field" and says
        nothing useful about a quantity under our minimum or a budget typed in
        words. We validate on submit and say which thing is wrong in a sentence.
        The `min` attributes below are still set — they are for the spinner and
        for the calendar, not for the bubble.
      */}

      <div className="gap-base flex flex-col">
        <label className="block">
          <span className="text-label-caps text-ink-muted block">Organisation</span>
          <input
            name="organisation"
            required
            autoComplete="organization"
            placeholder="The trading name that goes on the invoice"
            className={inputClass}
          />
        </label>

        <div className="gap-base grid sm:grid-cols-2">
          <label className="block">
            <span className="text-label-caps text-ink-muted block">Your name</span>
            <input name="contactName" required autoComplete="name" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-label-caps text-ink-muted block">Work e-mail</span>
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
        </div>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">Mobile number</span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            required
            autoComplete="tel"
            placeholder="A procurement WhatsApp number gets answered fastest"
            className={inputClass}
          />
          <span className="text-ink-muted mt-xs block text-sm">
            We check the shape of it rather than which domain it is from. Plenty of good buyers run
            a company out of a personal mailbox, and turning away a real enquiry on a technicality
            is the same failure as not replying.
          </span>
        </label>

        <div className="gap-base grid sm:grid-cols-2">
          <label className="block">
            <span className="text-label-caps text-ink-muted block">How many plants?</span>
            <input
              name="minimumQuantity"
              type="number"
              inputMode="numeric"
              required
              min={CORPORATE_MOQ}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-describedby="quantity-note"
              className={inputClass}
            />
            <span id="quantity-note" className="mt-xs block text-sm">
              <span className="text-ink-muted">
                Our minimum is {CORPORATE_MOQ}. A smaller parcel is priced for a single customer,
                and the shop is cheaper for you than we are.
              </span>
              {belowMoq && (
                <span className="text-warning block font-semibold">
                  That is under our minimum of {CORPORATE_MOQ} plants — the estimate below shows
                  what {CORPORATE_MOQ} would cost.
                </span>
              )}
            </span>
          </label>

          <label className="block">
            <span className="text-label-caps text-ink-muted block">Occasion</span>
            <select
              name="occasion"
              required
              value={occasion}
              onChange={(event) => setOccasion(event.target.value)}
              aria-describedby="occasion-note"
              className={inputClass}
            >
              {OCCASION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/*
          The occasion note, shown for whichever is selected. It is the honest
          guidance per occasion from `OCCASION_OPTIONS`, and it is the one piece of
          this form that is advice rather than a field — which is the difference
          between a funnel and a purchase.

          Full width under the row rather than tucked under the select: at half a
          column these are four lines of text about a plant that may not exist for
          another season, and the reader needs to see the whole sentence.
        */}
        <p id="occasion-note" className="text-ink-muted mb-0 text-sm">
          <strong className="font-semibold">On this occasion: </strong>
          {selectedOccasion?.note}
        </p>

        <div className="gap-base grid sm:grid-cols-2">
          <label className="block">
            <span className="text-label-caps text-ink-muted block">
              Budget per plant <span className="font-normal normal-case">in rupees, optional</span>
            </span>
            <input
              name="budgetPerUnitRupe"
              inputMode="decimal"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="e.g. 700 or 700.50"
              className={inputClass}
            />
            <span className="text-ink-muted mt-xs block text-sm">
              Leave it empty if you have not been given one — we would rather ask than have you
              invent a number.
              {budgetPaise !== null && (
                <span className="block">
                  That is {formatPaise(budgetPaise)} per plant
                  {!belowMoq && budgetPaise > tier.perUnitPaise && (
                    <>
                      {' '}
                      — above our {formatPaise(tier.perUnitPaise)} at this quantity, so it is
                      comfortably covered.
                    </>
                  )}
                </span>
              )}
            </span>
          </label>

          <label className="block">
            <span className="text-label-caps text-ink-muted block">
              Wanted by <span className="font-normal normal-case">optional</span>
            </span>
            <input
              name="deliveryDate"
              type="date"
              min={earliestDate}
              max={latestDate}
              className={inputClass}
            />
            <span className="text-ink-muted mt-xs block text-sm">
              Weekday delivery to an office address. If the date is not ready, say so in the notes
              rather than inventing one — a date we cannot hold is worse than no date.
            </span>
          </label>
        </div>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">Personalisation needed</span>
          <textarea
            name="personalisation"
            rows={4}
            maxLength={MAX_PERSONALISATION}
            placeholder="Logo or wording, and how many of each. If it is going on the pot, note that printing is possible from 50 plants and adds 10 working days."
            className={inputClass}
          />
          <span className="text-ink-muted mt-xs block text-sm">
            {printingApplies
              ? `At ${pricedQuantity} plants, printing is possible and adds ${POT_PRINTING_EXTRA_DAYS} working days on top of the ${leadDays} above.`
              : `Printing on the pot is possible from ${POT_PRINTING_MIN_QUANTITY} plants — below that we would have to spread a print-run charge over too few pots to be honest about.`}
          </span>
        </label>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">
            Anything else <span className="font-normal normal-case">optional</span>
          </span>
          <textarea
            name="notes"
            rows={4}
            maxLength={MAX_NOTES}
            placeholder="Delivery floors, a budget ceiling you have to live under, a variety you already know fails in your office, a festival date that is fixed. All of it helps."
            className={inputClass}
          />
        </label>
      </div>

      {/*
        THE LIVE ESTIMATE.

        `aria-live="polite"` because it changes on every keystroke in the quantity
        box, and a screen-reader user has no other way of knowing the number moved.
        Polite rather than assertive: it is confirmation of what they just did, not
        an emergency.
      */}
      <section
        aria-live="polite"
        aria-label="Your estimate"
        className="border-primary bg-brand-soft mt-xl p-base rounded-md border"
      >
        <h3 className="mb-sm mt-0">What this looks like</h3>
        <dl className="gap-base m-0 grid sm:grid-cols-3">
          <div>
            <dt className="text-label-caps text-ink-muted">Tier</dt>
            <dd className="m-0 font-semibold">{tier.label}</dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Per plant, GST included</dt>
            <dd className="m-0 font-semibold">{formatPaise(tier.perUnitPaise)}</dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Order value at {pricedQuantity}</dt>
            <dd className="m-0 font-semibold">{formatPaise(totalPaise)}</dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Working days to deliver</dt>
            <dd className="m-0 font-semibold">{leadDays} days</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-label-caps text-ink-muted">Included at this tier</dt>
            <dd className="m-0">
              <ul className="gap-xs m-0 flex list-none flex-col p-0 text-sm">
                {tier.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>

        {/*
          The volume nudge, and it is honest arithmetic rather than a "save 20%"
          banner: the tier sheet is public, so pointing at the next band is just
          telling them where the published price moves. A prospect who leaves
          knowing the next band is worth 30 more plants has a reason to come back,
          which is worth more than the order we might have talked them out of.
        */}
        {nextTier && !belowMoq && (
          <p className="mt-base mb-0 text-sm">
            {nextTier.from - pricedQuantity} more plants takes you to {nextTier.label} at{' '}
            {formatPaise(nextTier.perUnitPaise)} each.{' '}
            <span className="text-ink-muted">
              Order value from{' '}
              {formatPaise(estimatedTotalPaise(nextTier.from, nextTier.perUnitPaise))}.
            </span>
          </p>
        )}
      </section>

      {state.state === 'failed' && (
        <p role="alert" className="text-danger mt-base mb-0 text-sm">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.state === 'sending'}
        className="bg-primary text-surface mt-base min-h-[44px] w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.state === 'sending' ? 'Sending…' : 'Request the quote — costs nothing'}
      </button>

      <p className="text-ink-muted mt-sm mb-0 text-sm">
        One working day for a reply, the same day if you send this before noon. No card details, no
        obligation, and nothing added to a total you were not shown.{' '}
        <a href="/corporate" className="text-primary underline">
          Back to the price list
        </a>
      </p>
    </form>
  )
}
