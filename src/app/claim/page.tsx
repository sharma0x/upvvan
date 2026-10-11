import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import { PROSE } from '@/components/layout/containers'

/**
 * Claims — `/claim`.
 *
 * ── WHY THIS PAGE EXISTS AT ALL ──────────────────────────────────────────────
 *
 * It is linked from the footer and from three policy pages, and it did not exist:
 * `/claim/[code]` did, so every one of those links was a 404 on every page of
 * the site. A footer link that 404s is worse than no footer link, because it tells
 * a customer who has just read "report damage within 48 hours" that the site does
 * not actually work.
 *
 * So this is the entry point to the claim flow, and it has one job: get the
 * customer from "something is wrong with my plant" to the claim form in one step,
 * and set expectations before they fill it in.
 *
 * ── WHY THE EXPECTATIONS ARE SET BEFORE THE FORM ────────────────────────────
 *
 * Every competitor's claims policy is written defensively, and the consequences
 * are visible in their reviews: Ugaoo requires registration within 5 days, keeps
 * the plant in its original pot, covers mortality only, and triages with a plant
 * doctor before paying. Kyari's own shipping page contains an unfilled template
 * — "send it to ****\-------****". The result is customers who feel processed
 * rather than helped, and Trustpilot scores to match.
 *
 * So the three things a claimant needs to know are stated up front, in the plainest
 * possible terms, and none of them is a trap:
 *
 *   · A plant is REPLACED, not refunded. You keep the plant. That is because a
 *     returned plant is a dead plant, and asking you to post it back would cost
 *     you a courier fee to save us a plant we cannot sell.
 *   · ONE photograph is enough. Not a video, not a form, not an unboxing
 *     recording in front of a camera.
 *   · You do NOT need to sign up, and you do not need to sign in.
 *
 * Every one of those is a point where the category loses people, and every one is
 * free for us to state.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Report damage or a claim',
    description:
      'A plant arrived damaged, or one died. One photograph and your order code, and we send a replacement. No form to join, nothing to send back.',
    alternates: { canonical: '/claim' },
  }
}

export default async function ClaimIndexPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Report a problem" />

  const { terms } = storefront
  const window = terms.terms.arrivalWindowHours

  return (
    <main id="main" tabIndex={-1} className={`py-base ${PROSE}`}>
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Report a problem' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">Something is wrong with a plant</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">
          One photograph and your order code. That is the whole thing — and you will hear from a
          grower rather than a ticket system.
        </p>
      </header>

      {/*
        The three facts that stop a claim being abandoned, in the order a person
        needs them. Each one answers a question the research shows is a real
        abandonment point in this category.
      */}
      <section className="border-success bg-success-soft mt-xl p-lg rounded-md border">
        <h2 className="mt-0 text-[1.15rem]">Before you start — three things</h2>
        <ol className="mt-sm gap-base m-0 flex list-none flex-col p-0">
          <li>
            <strong>A plant is replaced, not refunded.</strong> You keep the plant. Nothing comes
            back to us, because a plant that has travelled is a dead plant and asking you to post it
            would cost you a courier fee and cost us something we cannot sell.
          </li>
          <li>
            <strong>One photograph is enough.</strong> The plant, in its pot, in daylight. No video,
            no form to download, nothing to upload.
          </li>
          <li>
            <strong>You do not need an account.</strong> Your order code and the mobile number on
            the order are the whole identification, which is also how you would identify yourself to
            a rider.
          </li>
        </ol>
      </section>

      <section className="mt-2xl">
        <h2 className="mt-0">Start here</h2>
        <p className="text-ink-muted mt-sm">
          Paste your order code and we will take you straight to the form for that order, already
          verified. If you do not have the code to hand,{' '}
          <Link href="/orders/lookup" className="text-primary underline">
            find the order first
          </Link>{' '}
          with the mobile number you used.
        </p>

        {/*
          A real GET form to the claim route rather than a button that needs
          JavaScript: it works if the bundle never arrives, and it is a form
          because it is a question with one answer, not an action.

          ── WHICH WAS A NO-OP ──────────────────────────────────────────────────

          The action was `/claim` — this page — and `ClaimIndexPage` took no
          `searchParams` at all. So a customer pasted their order code, pressed
          "Open my claim", and got back an identical page with `?code=…` in the
          address bar. No validation, no error, no redirect, no form.

          It is the first thing a person in this situation tries, and the page's
          own header comment says its one job is "get the customer from 'something
          is wrong with my plant' to the claim form in one step".

          The button now goes to `/claim/<CODE>`, and the reason it cannot be a
          plain GET form any more is worth stating: `/claim/[code]` authorises on
          a signed cookie or a customer session, so reaching it needs one of
          those. The code alone is not a credential — that is the whole design,
          and it is why a leaked code in a screenshot does not render an address.

          So the form's job is now to hand the code to the lookup, which is the
          page that CAN verify a phone number without an account. One extra step,
          and it is the step that proves the claim belongs to the person making
          it.
        */}
        <form method="get" action="/orders/lookup" className="mt-base">
          <label htmlFor="claim-code" className="text-label-caps text-ink-muted block">
            Your order code
          </label>
          <div className="mt-xs gap-sm flex">
            <input
              id="claim-code"
              name="orderCode"
              required
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="UPV-XXXXXXXX"
              className="border-border bg-surface w-full rounded-sm border px-3.5 py-3.5 text-base"
            />
            <button
              type="submit"
              className="bg-primary text-surface px-base shrink-0 cursor-pointer rounded-sm font-semibold"
            >
              Find my order
            </button>
          </div>
          <p className="text-ink-muted mt-xs mb-0 text-xs">
            We will ask for the mobile number on the order. That is the only thing standing between
            your address and somebody who has read this page.
          </p>
        </form>
      </section>

      <section className="mt-3xl">
        <h2 className="mt-0">What to photograph, and when</h2>
        <dl className="mt-base gap-base m-0 grid grid-cols-1 sm:grid-cols-2">
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">Anything wrong on arrival</dt>
            <dd className="text-ink-muted m-0">
              Within <strong className="text-ink">{window} hours</strong> of delivery. A plant that
              travelled a day and lost a leaf is not damage, and we say so — but a broken stem or a
              pot that arrived smashed is, and that window is short because it is about the journey
              rather than about the plant.
            </dd>
          </div>
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">A plant that dies or declines</dt>
            <dd className="text-ink-muted m-0">
              Within <strong className="text-ink">{terms.terms.days} days</strong> of delivery.
              Photograph it before you repot or throw it away — a repot tells us nothing about the
              plant we sent you.
            </dd>
          </div>
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">One close-up and one at arm&rsquo;s length</dt>
            <dd className="text-ink-muted m-0">
              The close-up shows the damage; the wider shot shows the whole plant and its pot. Those
              two together are what settles a dispute, and taking both takes four seconds.
            </dd>
          </div>
          <div className="border-border p-base rounded-md border">
            <dt className="font-semibold">The pot matters</dt>
            <dd className="text-ink-muted m-0">
              Keep it in the pot we sent it in. We identify plants by the pot they arrived in, which
              is how we tell a plant that failed with us from one that was repotted and then
              disliked.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-3xl">
        <h2 className="mt-0">What we will not claim</h2>
        <p className="text-ink-muted mt-sm">
          We are as precise about the exclusions as about the promise, because a guarantee that
          quietly excludes the common case is not a guarantee. Each has a &ldquo;we will help
          anyway&rdquo; answer.
        </p>
        <ul className="mt-sm gap-xs flex list-none flex-col p-0">
          <li className="text-ink-muted before:bg-clay before:mr-sm before:mt-[0.6em] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full">
            Over- or under-watering — the care spec is on every plant page, and we will answer any
            watering question for free, on WhatsApp, as many times as you ask.
          </li>
          <li className="text-ink-muted before:bg-clay before:mr-sm before:mt-[0.6em] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full">
            Repotting inside the first 30 days. Tell us before you do and we will say whether to go
            ahead.
          </li>
          <li className="text-ink-muted before:bg-clay before:mr-sm before:mt-[0.6em] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full">
            The wrong light — every listing states its requirement, and the collections are
            organised by room, so the information was there before you bought.
          </li>
          <li className="text-ink-muted before:bg-clay before:mr-sm before:mt-[0.6em] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full">
            Pests arriving weeks after delivery. We inspect every batch; name the pest and we will
            tell you what it is and how to treat it.
          </li>
        </ul>
        <p className="mt-base mb-0">
          <Link href="/policies/guarantee" className="text-primary underline">
            The guarantee in full
          </Link>{' '}
          ·{' '}
          <Link href="/problems" className="text-primary underline">
            or look your plant&rsquo;s symptoms up first
          </Link>{' '}
          — most apparent failures are a care problem with a fixable answer, and it is worth two
          minutes before you claim.
        </p>
      </section>

      <section className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
        <h2 className="mt-0">No order code?</h2>
        <p className="mb-0">
          Find the order with the mobile number you used, or{' '}
          <Link href="/contact" className="text-primary underline">
            message a grower
          </Link>{' '}
          and describe what happened — we can usually find it from the name and the address. Nobody
          has to prove anything to us to get a plant replaced.
        </p>
      </section>
    </main>
  )
}
