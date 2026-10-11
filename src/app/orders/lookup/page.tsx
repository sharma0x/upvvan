import Link from 'next/link'

import LookupClient from './LookupClient'

/**
 * Order lookup — find an order by code + phone.
 *
 * ── WHY THIS PAGE EXISTS ────────────────────────────────────────────────────
 *
 * Because there was no way back to an order. A customer who closed the tab after
 * checkout, or who wants to check on a delivery from a different phone, had nothing
 * but a WhatsApp message and a code they could not use. That is a service
 * deficiency, and for a prepaid business it is the kind that reads as "they took my
 * money and vanished".
 *
 * ── WHY TWO FIELDS ──────────────────────────────────────────────────────────
 *
 * The order code is 48 bits of CSPRNG, so it cannot be guessed — but unguessable is
 * not the same as authorised. A code leaks through screenshots, group chats and
 * shared browser history. Pairing it with a number the buyer already knows makes
 * this a credential check rather than a bearer token, and the failure message is
 * deliberately identical for "no such order" and "wrong phone" so this page cannot
 * be used to enumerate real order codes.
 */
export const metadata = {
  title: 'Find your order — Upvvan',
  description: 'Look up an Upvvan order with your order code and the phone number on the order.',
  // A lookup form is not content. No value in indexing it, and the page is a
  // credential prompt, which is the last thing that should appear in a search result.
  robots: { index: false, follow: true },
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ orderCode?: string }>
}) {
  const { orderCode } = await searchParams

  return (
    <main className="px-base py-2xl mx-auto max-w-[560px]">
      <Link href="/" className="text-primary text-sm no-underline hover:underline">
        ← Back to the nursery
      </Link>

      <h1 className="my-sm">Find your order</h1>
      <p className="text-ink-muted">
        Your order code is in the message we sent you and on your receipt. We also ask for the phone
        number on the order — not to check up on you, but so a screenshot of this page is useless to
        whoever took it.
      </p>

      <LookupClient initialCode={orderCode ?? ''} />
    </main>
  )
}
