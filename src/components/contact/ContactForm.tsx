'use client'
import Link from 'next/link'

import { useState } from 'react'

/**
 * The contact form.
 *
 * ── WHY THIS POSTS TO AN API RATHER THAN MAILING ────────────────────────────
 *
 * Because a mailbox that nobody reads is what every competitor in this category
 * has. The form produces a REFERENCE the customer can quote, which is what
 * Consumer Protection (E-Commerce) Rules 2020 r.4(6)(b) requires of a grievance
 * channel — "a ticket number shall be conveyed to the complainant" — and it
 * makes the response-time promise on `/contact` something we can measure rather
 * than something we assert.
 *
 * ── WHY THE ORDER CODE IS OPTIONAL BUT PROMPTED ─────────────────────────────
 * A customer with an order nearly always has one, and having it turns a support
 * question into a lookup. But making it required would block the two most common
 * messages from people who have never ordered: "do you deliver to Jayanagar"
 * and "is the Jade Plant XL in stock".
 *
 * ── WHAT IS NOT CAPTURED ────────────────────────────────────────────────────
 * No marketing consent checkbox, because consent given alongside a service
 * request is not meaningfully separable and a pre-ticked box is worse than none.
 * The one thing worth asking about — whether they want the seasonal list — is a
 * separate, unticked opt-in at the bottom, and it is not required to send.
 */
type State =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; reference: string }
  | { state: 'failed'; message: string }

const inputClass = 'border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base'

export default function ContactForm() {
  const [state, setState] = useState<State>({ state: 'idle' })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())

    setState({ state: 'sending' })
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) {
        setState({ state: 'failed', message: body.message ?? 'Could not send that.' })
        return
      }
      form.reset()
      setState({ state: 'sent', reference: body.reference })
    } catch {
      setState({
        state: 'failed',
        message:
          'We could not reach the server. Nothing has been lost — e-mail care@upvvan instead and we will pick it up there.',
      })
    }
  }

  if (state.state === 'sent') {
    return (
      <div
        role="status"
        data-testid="contact-sent"
        className="border-success bg-success-soft mt-sm p-lg rounded-md border"
      >
        <h3 className="mt-0">Sent. Your reference is {state.reference}.</h3>
        <p className="mb-0">
          Keep that string — quote it if you message us again and you will not have to explain
          yourself twice. We answer on WhatsApp in under 15 minutes during working hours, and by
          e-mail within 4 working hours.
        </p>
        <button
          type="button"
          onClick={() => setState({ state: 'idle' })}
          className="border-border hover:bg-brand-soft mt-base min-h-[44px] cursor-pointer rounded-sm border px-3 text-sm"
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-base" noValidate>
      {/*
        `noValidate` because the native bubbles are worse than ours: a browser
        says "Please fill out this field" for a required box and says nothing
        useful for a malformed one. We validate on submit and say which field and
        why, in words a customer can act on.
      */}
      <div className="gap-sm flex flex-col">
        <label className="block">
          <span className="text-label-caps text-ink-muted block">What is this about?</span>
          <select name="topic" className={inputClass} defaultValue="plant">
            <option value="plant">A plant I have received</option>
            <option value="order">My order or delivery</option>
            <option value="coverage">Do you deliver to my area?</option>
            <option value="stock">Is something in stock?</option>
            <option value="corporate">Corporate or bulk enquiry</option>
            <option value="care">Advice on a plant that is struggling</option>
            <option value="other">Something else</option>
          </select>
        </label>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">Your name</span>
          <input name="name" required autoComplete="name" className={inputClass} />
        </label>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">Mobile or e-mail</span>
          <input
            name="contact"
            required
            autoComplete="tel"
            placeholder="Either is fine. We only use it to reply."
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">
            Order code, if you have one <span className="font-normal normal-case">(optional)</span>
          </span>
          <input
            name="orderCode"
            placeholder="UVP-XXXX-XXXX"
            autoComplete="off"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-label-caps text-ink-muted block">Your message</span>
          <textarea
            name="message"
            required
            rows={5}
            maxLength={2000}
            placeholder="If it is about a plant: what it is doing, how long it has been like that, and where it is. That is usually enough for a diagnosis."
            className={inputClass}
          />
        </label>

        {/*
          The opt-in, unticked and genuinely optional.

          Pre-ticked consent is not consent, and bundling marketing consent into a
          support request means the only honest answer is to untick it — which
          teaches everyone to untick checkboxes. So it sits apart, unticked, and
          the form submits without it.
        */}
        <label className="gap-sm flex items-start text-sm">
          <input name="optIn" type="checkbox" className="mt-1" />
          <span className="text-ink-muted">
            Also tell me when a plant I have been asking about comes back in stock. Once a month at
            most, and you can reply &ldquo;stop&rdquo; to any of it.
          </span>
        </label>
      </div>

      {state.state === 'failed' && (
        <p role="alert" className="text-danger mt-base mb-0 text-sm">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.state === 'sending'}
        className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.state === 'sending' ? 'Sending…' : 'Send it'}
      </button>

      <p className="text-ink-muted mt-sm mb-0 text-sm">
        A plant arrived damaged or is dying?{' '}
        <Link href="/claim" className="text-primary underline">
          The claim flow is faster
        </Link>{' '}
        — it registers your guarantee window automatically.
      </p>
    </form>
  )
}
