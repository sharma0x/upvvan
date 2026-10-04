'use client'

import { useState } from 'react'

import type { CityRef } from '@/lib/geo/serviceability'

/**
 * The coverage checker.
 *
 * Large targets and an unambiguous result, for the same reason the packing bench
 * will need them later: this is a customer on a phone, often on a patchy
 * connection, reading "we do not deliver to your pincode yet" — and they will act
 * on it, by choosing a competitor. So the answer gets the same visual weight as
 * the question.
 *
 * All styling is Tailwind utilities referencing DESIGN.md tokens. There are no
 * literal colour values here: the palette is normative and lives in
 * src/app/theme.css, projected from DESIGN.md.
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

  const canSubmit = pincode.length === 6 && verdict.state !== 'checking'

  async function check(event: React.FormEvent) {
    event.preventDefault()
    setVerdict({ state: 'checking' })

    try {
      const res = await fetch(
        `/api/serviceability?pincode=${encodeURIComponent(pincode)}&city=${encodeURIComponent(citySlug)}`,
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
    } catch {
      setVerdict({
        state: 'error',
        message: 'Could not check that pincode. Please try again.',
      })
    }
  }

  return (
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
        onChange={(e) => setCitySlug(e.target.value)}
        className={`${FIELD} mt-xs`}
      >
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      {/*
        A disabled button keeps its place in the layout and its opacity cue.
        Removing the affordance entirely would make the control jump the moment
        the form becomes valid, which reads as a glitch on a phone.
      */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-base bg-primary text-surface w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {verdict.state === 'checking' ? 'Checking…' : 'Check coverage'}
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
  )
}
