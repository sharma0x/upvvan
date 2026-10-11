import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { POLICIES } from '@/lib/commerce/policies'
import { currentSeasons } from '@/lib/catalogue/loader.server'

/**
 * Policies index — `/policies`.
 *
 * ── WHY THIS IS AN INDEX AND NOT A PAGE ─────────────────────────────────────
 *
 * It used to be a page. Everything on it is now on one of six, because a single
 * 600-word policy page is the shape of thing that goes stale: it is one file,
 * nobody edits one section without editing the rest, and the guarantee window
 * lives in exactly one place until somebody pastes a different number next to
 * it. Which is what happened — this page asserted "48 hours" as a literal while
 * the price book held the authoritative tier, and the audit's finding about
 * Ugaoo is two contradictory policies shipping simultaneously.
 *
 * So the window is not written here at all. This page reads it and shows it,
 * which means the number on this page and the number on the guarantee page and
 * the number on the cart are the same value by construction.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Policies, guarantee & privacy',
    description:
      'The guarantee, delivery, refunds, privacy and terms — in full, and all reading the same numbers from one place.',
    alternates: { canonical: '/policies' },
  }
}

export default async function PoliciesPage() {
  const storefront = await loadStorefront()
  const seasons = currentSeasons()

  // The one number, read once. Every page below interpolates the same value.
  const book = storefront.state === 'ready' ? storefront.terms : null
  const terms =
    storefront.state === 'ready'
      ? {
          label: book!.terms.label,
          days: book!.terms.days,
          summary: book!.terms.summary,
          cityName: storefront.cityName,
        }
      : null

  return (
    <main id="main" tabIndex={-1} className="px-base py-2xl mx-auto max-w-[760px]">
      <h1 className="mt-0">Policies</h1>
      <p className="text-ink-muted mt-sm mb-xl text-[1.05rem] leading-relaxed">
        Six pages, and every number on all six comes from one row in the database. If you find a
        different figure anywhere on this site, that is a bug and we would like to hear about it.
      </p>

      <ul className="gap-base m-0 flex list-none flex-col p-0">
        {POLICIES.map((policy) => (
          <li key={policy.slug}>
            <Link
              href={`/policies/${policy.slug}`}
              className="border-border bg-surface-card hover:border-clay p-base text-ink block rounded-md border no-underline"
            >
              <span className="block text-[1.1rem] font-semibold">{policy.title}</span>
              <span className="text-ink-muted mt-xs block text-sm">{policy.standfirst}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/*
        THE TWO NUMBERS A CUSTOMER ACTUALLY LOOKS FOR, on the index.

        Someone who lands here does not want a table of contents; they want to
        know how long the cover lasts and whether delivery is free. Both come
        from the price book, so they cannot be stale — which is the entire point
        of this page replacing the old prose version.
      */}
      {terms && (
        <section className="border-warning bg-surface-raised mt-2xl p-lg rounded-md border">
          <h2 className="mt-0">The two short answers</h2>
          <p className="mb-xs">
            <strong>How long is the guarantee?</strong> {terms.label} — {terms.summary}
          </p>
          <p className="mb-0">
            <strong>Is delivery free?</strong>{' '}
            {book!.freeDeliveryThresholdPaise > 0
              ? `Free over ${'₹'}${Math.floor(
                  book!.freeDeliveryThresholdPaise / 100,
                )}, and ₹${Math.floor(book!.deliveryFeePaise / 100)} below that.`
              : 'Free on every order, with no minimum. One plant costs what six cost us to send.'}
          </p>
        </section>
      )}

      {/*
        The heat window, in place, because it is the only policy on this site that
        changes with the calendar. Nobody in the category publishes one: Rooted
        holds orders "until it is warm enough", which in an Indian April is the
        whole summer, and we would rather swap species than close.
      */}
      {terms && seasons[0] === 'summer' && (
        <section className="mt-2xl">
          <h2 className="mt-0">The {terms.cityName} heat window</h2>
          <p className="text-ink-muted mt-sm">
            March to June runs 40–46°C here. We do not stop selling through it. We list only species
            we grew outdoors through a full summer, and we swap the catalogue as the season turns.
            If a species you liked is not here in April, that is a decision about the plant and not
            about your address.
          </p>
          <p className="mt-sm mb-0">
            <Link href="/collections/summer-safe-plants" className="text-primary underline">
              What survives a Bengaluru summer
            </Link>
          </p>
        </section>
      )}

      <section className="mt-2xl">
        <h2 className="mt-0">Something wrong?</h2>
        <p className="text-ink-muted mt-sm mb-0">
          A plant arrived damaged, or a parcel never arrived, or something on this site is wrong.{' '}
          <Link href="/claim" className="text-primary underline">
            Report it
          </Link>{' '}
          — or{' '}
          <Link href="/contact" className="text-primary underline">
            message a grower on WhatsApp
          </Link>
          , which is the fastest route and the one we answer.
        </p>
      </section>
    </main>
  )
}
