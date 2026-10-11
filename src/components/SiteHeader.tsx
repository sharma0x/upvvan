'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Site header — brand, primary nav, search, account, cart.
 *
 * ── WHY IT IS Restrained, AND WHY IT IS NO LONGER FOUR ITEMS ────────────────
 * The previous version had four links and no way to reach an account. Two of
 * those are now faults rather than restraint:
 *
 *   · NO SIGN-IN LINK. There was no `<Link href="/sign-in">` anywhere on the
 *     site, so the phone-OTP flow — which is a differentiator, since no
 *     competitor in the audit is documented as using it — was reachable only by
 *     typing the URL or by being redirected out of `/account`. A feature nobody
 *     can find is not a feature.
 *
 *   · NO SEARCH. Undocumented for every competitor we studied, and Upvan's is
 *     confirmed to work. A catalogue of a few dozen listings does not strictly
 *     need one; a catalogue the customer cannot find their way around does.
 *
 * The nav is still short. Our catalogue is seasonal and small, and a deep
 * mega-nav with twelve collections would be a lie about depth. But "short" and
 * "four links" are different things, and the second one was an omission.
 *
 * ── WHY THE COUNT IS CLIENT-SIDE ─────────────────────────────────────────────
 * The cart is a sessionStorage draft (`AddToCart` writes it, `/cart` reads it),
 * not a server-side basket, so there is no server value to render. Reading it
 * here rather than in a separate leaf component means the badge and the header
 * cannot drift apart, and returning `null` before mount keeps the server HTML
 * from claiming an empty cart that turns out to have three plants in it.
 */
const CART_KEY = 'upvvan.cart'

/**
 * Primary navigation.
 *
 * Kept here rather than in a `nav.ts` data file because it is four items and the
 * count of items is the whole design decision. A data file here would be a
 * mechanism for a list that must not grow without someone noticing.
 */
const NAV = [
  { href: '/plants', label: 'Plants' },
  { href: '/gifting', label: 'Gifting' },
  { href: '/corporate', label: 'Corporate' },
  { href: '/about', label: 'About' },
] as const

import { useRouter } from 'next/navigation'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { fetchWithSWR } from '@/lib/cache/swr'
import { MicroSpinner } from '@/components/ui/MicroSpinner'

interface QuickResult {
  skuId: string | number
  slug: string
  commonName: string
  sizeTier: string
  botanicalName?: string | null
}

export default function SiteHeader() {
  const router = useRouter()
  const [count, setCount] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<QuickResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const debouncedQuery = useDebounce(query.trim(), 300)
  const abortRef = useState<{ current: AbortController | null }>({ current: null })[0]

  useEffect(() => {
    try {
      const lines = JSON.parse(sessionStorage.getItem(CART_KEY) ?? '[]')
      setCount(Array.isArray(lines) ? lines.length : 0)
    } catch {
      setCount(0)
    }
  }, [pathname])

  // Close live suggestions on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Debounced instant live suggestions with SWR cache and request cancellation
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSearching(true)

    const cacheKey = `/api/catalogue?q=${encodeURIComponent(debouncedQuery)}&limit=5`
    fetchWithSWR<{ items: QuickResult[] }>(
      cacheKey,
      async (signal) => {
        const res = await fetch(cacheKey, {
          signal: signal ?? controller.signal,
          headers: { accept: 'application/json' },
        })
        if (!res.ok) throw new Error('Search failed')
        return res.json()
      },
      { ttlMs: 120_000, signal: controller.signal },
    )
      .then(({ data }) => {
        setSuggestions(data?.items?.slice(0, 5) ?? [])
        setIsOpen(true)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setSuggestions([])
      })
      .finally(() => {
        setIsSearching(false)
      })

    return () => {
      controller.abort()
    }
  }, [debouncedQuery, abortRef])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length === 0) return
    setIsOpen(false)
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <header className="border-border bg-surface/95 sticky top-0 z-50 border-b backdrop-blur">
      <div className="gap-base px-base mx-auto flex max-w-[1120px] items-center py-3">
        <Link
          href="/"
          className="text-ink no-underline"
          style={{ fontFamily: 'var(--font-h2)', fontSize: '1.3rem' }}
        >
          Upvvan
        </Link>

        {/*
          Nav targets carry `min-h-[44px]` so their hit area clears WCAG 2.2 SC2.5.8
          (24x24 CSS px minimum).
        */}
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className="text-ink-muted hover:text-ink inline-flex min-h-[44px] items-center px-2 text-sm no-underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative ml-auto md:ml-0">
          <form
            role="search"
            action="/search"
            method="get"
            onSubmit={submitSearch}
          >
            <label htmlFor="site-search" className="sr-only">
              Search plants
            </label>
            <div className="relative">
              <input
                id="site-search"
                name="q"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true)
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setIsOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false)
                }}
                placeholder="Jade, snake plant…"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls="live-search-results"
                className="border-border bg-surface w-[9.5rem] rounded-sm border px-2.5 py-2.5 text-sm sm:w-[13rem] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
              {isSearching && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted">
                  <MicroSpinner size="sm" />
                </span>
              )}
            </div>
          </form>

          {/* Live suggestions popover */}
          {isOpen && debouncedQuery.length >= 2 && (
            <div
              id="live-search-results"
              role="listbox"
              aria-label="Search suggestions"
              className="absolute left-0 top-full mt-1.5 w-64 md:w-72 rounded-md border border-border bg-surface shadow-lg z-50 overflow-hidden"
            >
              {suggestions.length > 0 ? (
                <ul className="m-0 p-1 list-none">
                  {suggestions.map((item) => (
                    <li key={item.skuId}>
                      <Link
                        href={`/plant/${item.slug}?tier=${item.sizeTier}`}
                        onClick={() => setIsOpen(false)}
                        className="flex flex-col px-3 py-2 text-sm text-ink hover:bg-surface-raised rounded-sm no-underline transition-colors"
                      >
                        <span className="font-semibold">{item.commonName}</span>
                        <span className="text-xs text-ink-muted">
                          {item.sizeTier}
                          {item.botanicalName ? ` · ${item.botanicalName}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                  <li className="border-t border-border mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false)
                        router.push(`/search?q=${encodeURIComponent(debouncedQuery)}`)
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-primary font-semibold hover:bg-surface-raised cursor-pointer"
                    >
                      View all results for &ldquo;{debouncedQuery}&rdquo; →
                    </button>
                  </li>
                </ul>
              ) : (
                !isSearching && (
                  <div className="px-3 py-3 text-xs text-ink-muted text-center">
                    No matching plants found. Press enter to search.
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <nav aria-label="Account and cart" className="flex items-center gap-1">
          <Link
            href="/account"
            className="text-ink-muted hover:text-ink inline-flex min-h-[44px] items-center px-2 text-sm no-underline"
          >
            Account
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

      {/*
        Mobile nav. The primary nav is `hidden md:flex`, so below 768px these four
        links would simply not exist — the accessibility failure where a control
        is unreachable rather than merely small. A second row rather than a
        hamburger: a burger menu is four interactions to reach "Plants" and it
        hides the thing a customer most wants to check, which is the cart.
      */}
      <nav
        aria-label="Main, compact"
        className="border-border px-base flex items-center gap-1 overflow-x-auto border-t md:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className="text-ink-muted hover:text-ink inline-flex min-h-[44px] shrink-0 items-center px-2 text-sm no-underline"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/policies"
          className="text-ink-muted hover:text-ink inline-flex min-h-[44px] shrink-0 items-center px-2 text-sm no-underline"
        >
          Guarantee
        </Link>
        <Link
          href="/contact"
          className="text-ink-muted hover:text-ink inline-flex min-h-[44px] shrink-0 items-center px-2 text-sm no-underline"
        >
          Contact
        </Link>
      </nav>
    </header>
  )
}
