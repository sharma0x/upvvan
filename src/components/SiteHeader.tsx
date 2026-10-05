'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Site header — brand, primary nav, cart count.
 *
 * ── WHY THIS EXISTS NOW ─────────────────────────────────────────────────────
 * There was no header at all. The storefront opened straight into an h1 with no
 * way to reach the cart, the policies, or back to the catalogue once you had
 * navigated into a PDP. Every competitor audited has a nav; the absence read as
 * "not a shop yet".
 *
 * It is deliberately restrained. Our catalogue is seasonal and small — often a
 * dozen listings — so a deep mega-nav with twelve collections would be a lie
 * about depth. Four items is what the business actually has.
 *
 * ── WHY THE COUNT IS CLIENT-SIDE ─────────────────────────────────────────────
 * The cart is a sessionStorage draft (`AddToCart` writes it, `/cart` reads it),
 * not a server-side basket, so there is no server value to render. Reading it
 * here rather than in a separate leaf component means the badge and the header
 * cannot drift apart, and returning `null` before mount keeps the server HTML
 * from claiming an empty cart that turns out to have three plants in it.
 */
const CART_KEY = 'upvvan.cart'

export default function SiteHeader() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    try {
      const lines = JSON.parse(sessionStorage.getItem(CART_KEY) ?? '[]')
      setCount(Array.isArray(lines) ? lines.length : 0)
    } catch {
      // A corrupt draft cart is an empty draft cart. Never crash the header over
      // it — the cart page will clear it when the customer edits anything.
      setCount(0)
    }
  }, [])

  return (
    <header className="border-border bg-surface/95 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex max-w-[1120px] items-center gap-lg px-base py-3">
        <Link
          href="/"
          className="text-ink no-underline"
          style={{ fontFamily: 'var(--font-h2)', fontSize: '1.3rem' }}
        >
          Upvvan
        </Link>

        {/*
          Nav targets carry `py-2` so their hit area clears WCAG 2.2 SC2.5.8
          (24x24 CSS px minimum) — measured in a real browser at 390px they were
          20px tall, which is under the floor and the reason a thumb misses them.
          44px is the Apple HIG / Material guidance, so the container pads to that
          rather than relying on the link's own line-height. `inline-flex
          items-center` is what makes the padding actually part of the tap target
          instead of just spacing the text.
        */}
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="text-ink-muted hover:text-ink inline-flex min-h-[44px] items-center px-2 text-sm no-underline"
          >
            Plants
          </Link>
          <Link
            href="/policies"
            className="text-ink-muted hover:text-ink inline-flex min-h-[44px] items-center px-2 text-sm no-underline"
          >
            Guarantee
          </Link>
          <Link
            href="/grievance"
            className="text-ink-muted hover:text-ink inline-flex min-h-[44px] items-center px-2 text-sm no-underline"
          >
            Contact
          </Link>
          <Link
            href="/cart"
            className="border-primary text-primary inline-flex min-h-[44px] items-center rounded-sm border px-3 text-sm no-underline"
          >
            {/* Nothing renders until we know — see the note above. */}
            {count === null ? 'Cart' : `Cart · ${count}`}
          </Link>
        </nav>
      </div>
    </header>
  )
}