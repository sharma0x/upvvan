'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { CustomerAddress } from '@/lib/accounts/addresses'

/**
 * Address book editor.
 *
 * ── WHY THE LIST IS SERVER-RENDERED AND ONLY THE FORM IS A CLIENT ISLAND ────
 *
 * The saved addresses arrive as props from the server component. They are already
 * loaded, already scoped to the session, and rendering them costs nothing —
 * making this a client component that refetches would add a loading state and a
 * second source of truth for data the server already had.
 *
 * So: server renders the list, this island owns the form and the mutations.
 *
 * ── WHY EVERY MUTATION CALLS `router.refresh()` ─────────────────────────────
 *
 * The list is server-rendered from the database. A local `setState` would show
 * the customer an address that is not saved yet, and if the write failed they
 * would not know. Re-rendering from the database means the screen only ever
 * shows what is actually stored.
 */
export default function AddressBook({ addresses }: { addresses: CustomerAddress[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(addresses.length === 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [fullName, setFullName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('Bengaluru')
  const [pincode, setPincode] = useState('')

  const FIELD =
    'w-full rounded-sm border border-border bg-surface-raised px-3.5 py-3 text-base'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Same-origin cookie must ride along, or the request is unauthenticated
        // and the customer is told to sign in while signed in.
        credentials: 'same-origin',
        body: JSON.stringify({
          label,
          fullName,
          line1,
          line2,
          city,
          pincode,
          // The first address a customer saves is their default without being
          // asked — an empty address book with no default is a checkout dead end.
          isDefault: addresses.length === 0,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        // The API already returns customer-safe copy (allowlisted server-side).
        setError(body.error ?? 'Could not save that address.')
        return
      }

      setLabel('')
      setFullName('')
      setLine1('')
      setLine2('')
      setPincode('')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not save that address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function makeDefault(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Could not update that address.')
        return
      }
      router.refresh()
    } catch {
      setError('Could not update that address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Could not delete that address.')
        return
      }
      router.refresh()
    } catch {
      setError('Could not delete that address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      {addresses.length === 0 && !open ? (
        <div className="border-border bg-surface-raised rounded-md border p-lg">
          <p className="mt-0">No saved addresses.</p>
          <p className="text-ink-muted mb-0">
            Save one and checkout gets shorter next time.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-base p-0">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="border-border rounded-md border p-base"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-xs">
                <span className="font-semibold">{address.label}</span>
                {address.isDefault && (
                  <span className="border-success bg-success-soft rounded-sm border px-2 py-0.5 text-xs font-semibold">
                    Default
                  </span>
                )}
              </div>

              <p className="mt-xs mb-0">
                {address.fullName}
                <br />
                {address.line1}
                {address.line2 ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.city} {address.pincode}
              </p>

              {!address.isDefault && (
                <button
                  type="button"
                  onClick={() => makeDefault(address.id)}
                  disabled={busy}
                  className="text-primary mt-sm cursor-pointer bg-transparent text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Make default
                </button>
              )}

              <button
                type="button"
                onClick={() => remove(address.id)}
                disabled={busy}
                className="text-ink-muted mt-sm ml-base cursor-pointer bg-transparent text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="border-danger bg-surface text-danger mt-base rounded-sm border px-4 py-3">
          {error}
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-primary text-primary mt-base cursor-pointer rounded-sm border px-4 py-3 font-semibold"
        >
          Add an address
        </button>
      ) : (
        <form onSubmit={submit} className="border-border mt-lg rounded-md border p-lg">
          <h3 className="mt-0">Add an address</h3>

          <label htmlFor="label" className="text-label-caps text-ink-muted block">
            Label
          </label>
          <input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Home"
            maxLength={40}
            required
            className={`${FIELD} mt-xs`}
          />

          <label htmlFor="fullName" className="text-label-caps text-ink-muted mt-base block">
            Name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            required
            className={`${FIELD} mt-xs`}
          />

          <label htmlFor="line1" className="text-label-caps text-ink-muted mt-base block">
            Flat, house, building
          </label>
          <input
            id="line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            maxLength={160}
            autoComplete="address-line1"
            required
            className={`${FIELD} mt-xs`}
          />

          <label htmlFor="line2" className="text-label-caps text-ink-muted mt-base block">
            Area, landmark (optional)
          </label>
          <input
            id="line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            maxLength={160}
            autoComplete="address-line2"
            className={`${FIELD} mt-xs`}
          />

          <label htmlFor="city" className="text-label-caps text-ink-muted mt-base block">
            City
          </label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            autoComplete="address-level2"
            required
            className={`${FIELD} mt-xs`}
          />

          <label htmlFor="pincode" className="text-label-caps text-ink-muted mt-base block">
            Pincode
          </label>
          <input
            id="pincode"
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            required
            className={`${FIELD} mt-xs`}
          />

          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save address'}
          </button>

          {addresses.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-muted mt-sm w-full cursor-pointer bg-transparent text-sm underline"
            >
              Cancel
            </button>
          )}
        </form>
      )}
    </section>
  )
}