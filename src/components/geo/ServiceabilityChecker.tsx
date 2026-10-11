'use client'

import { useEffect, useRef, useState } from 'react'
import type { CityRef } from '@/lib/geo/serviceability'
import { MicroSpinner } from '@/components/ui/MicroSpinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

/**
 * The coverage checker.
 */
type Verdict =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'error'; message: string }
  | {
      state: 'done'
      serviceable: boolean
      message?: string
      zone?: string
      cityName?: string
      pincode?: string
    }

const FIELD = 'w-full rounded-sm border border-border bg-surface-raised px-3.5 py-3.5 text-base'

export default function ServiceabilityChecker({ cities }: { cities: CityRef[] }) {
  const [pincode, setPincode] = useState('')
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? '')
  const [verdict, setVerdict] = useState<Verdict>({ state: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const canSubmit = pincode.length === 6 && verdict.state !== 'checking'

  async function check(event: React.FormEvent) {
    event.preventDefault()
    setVerdict({ state: 'checking' })

    if (!citySlug) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(
        `/api/serviceability?pincode=${encodeURIComponent(pincode)}&city=${encodeURIComponent(citySlug)}`,
        { signal: controller.signal },
      )
      const body = await res.json()

      setVerdict(
        body.serviceable
          ? {
              state: 'done',
              serviceable: true,
              pincode: body.pincode,
              zone: body.zone,
              cityName: body.cityName,
            }
          : { state: 'done', serviceable: false, message: body.message },
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setVerdict({
        state: 'error',
        message: 'Could not check that pincode. Please try again.',
      })
    }
  }

  return (
    <ErrorBoundary label="Coverage Checker">
      <form onSubmit={check} className="mt-lg border-border bg-surface-raised p-lg rounded-md border">
      <label htmlFor="pincode" className="text-label-caps text-ink-muted block">
        6-digit pincode
      </label>
      <input
        id="pincode"
        name="pincode"
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        placeholder="560001"
        value={pincode}
        onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className={`${FIELD} mt-xs text-lg`}
      />

      <label htmlFor="city" className="mt-base text-label-caps text-ink-muted block">
        City
      </label>
      <select
        id="city"
        name="city"
        value={citySlug}
        onChange={(e) => {
          setCitySlug(e.target.value)
          // A different city invalidates the previous verdict. Leaving "We deliver to
          // your pincode" on screen after the shopper switches city would be us
          // answering about Bengaluru when they asked about Hyderabad.
          setVerdict({ state: 'idle' })
        }}
        className={`${FIELD} mt-xs`}
      >
        {/*
          Every city is listed, including ones we have not opened in.

          The alternative is worse than useless: with a single option the dropdown
          silently defaults to Bengaluru, so somebody in Telangana types their
          pincode and is told the answer for the wrong city. Listing Hyderabad with
          "not open here yet" gives them the true answer where they asked for it.

          Active cities sort first so the common case needs no scrolling.
        */}
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
            {c.isActive ? '' : ' — not open here yet'}
          </option>
        ))}

        {cities.length === 0 && <option value="">No cities to check yet</option>}
      </select>

      {/*
        A disabled button keeps its place in the layout and its opacity cue.
        Removing the affordance entirely would make the control jump the moment
        the form becomes valid, which reads as a glitch on a phone.
      */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-base bg-primary text-surface w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50 transition-transform active:scale-[0.99]"
      >
        {verdict.state === 'checking' ? (
          <span className="inline-flex items-center justify-center gap-2">
            <MicroSpinner size="sm" />
            <span>Checking…</span>
          </span>
        ) : (
          'Check coverage'
        )}
      </button>

      {verdict.state === 'done' && (
        <div
          role="status"
          className={
            verdict.serviceable
              ? 'mt-base border-success bg-success-soft rounded-sm border px-4 py-4 font-semibold'
              : 'mt-base border-warning bg-surface rounded-sm border px-4 py-4'
          }
        >
          {verdict.serviceable ? (
            <p className="m-0">
              Yes — we deliver to {verdict.pincode ?? pincode} in {verdict.cityName}
              {verdict.zone ? ` (${verdict.zone})` : ''}.
            </p>
          ) : (
            <p className="m-0">{verdict.message ?? 'We do not deliver to this pincode yet.'}</p>
          )}
        </div>
      )}

      {verdict.state === 'error' && (
        <p role="alert" className="mt-base text-danger">
          {verdict.message}
        </p>
      )}
    </form>
    </ErrorBoundary>
  )
}
