'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MicroSpinner } from '@/components/ui/MicroSpinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { toast } from '@/components/ui/Toast'

export default function SaveForLater({
  skuId,
  name,
  initiallySaved,
}: {
  skuId: number
  name: string
  initiallySaved: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initiallySaved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    setNeedsSignIn(false)

    // Optimistic UI update: instantly reflect saved state
    const previousSaved = saved
    setSaved(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/wishlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ skuId }),
        signal: controller.signal,
      })
      if (res.status === 401) {
        // Rollback state gracefully
        setSaved(previousSaved)
        setNeedsSignIn(true)
        toast.info('Sign in with your mobile number to save plants.', 'Sign in required')
        return
      }
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        // Rollback state gracefully on API failure
        setSaved(previousSaved)
        const errMsg = body.error ?? 'We could not save that. Please try again.'
        setError(errMsg)
        toast.error(errMsg)
        return
      }
      toast.success(`We will tell you when ${name} is back.`, 'Saved')
      router.refresh()
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      // Rollback on network exception
      setSaved(previousSaved)
      const networkError = 'We could not reach us. Nothing has been saved — please try again.'
      setError(networkError)
      toast.error(networkError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ErrorBoundary label="Save For Later">
      {saved ? (
        <p
          className="border-success bg-success-soft mt-base rounded-sm border px-4 py-3"
          role="status"
        >
          Saved. We will tell you when {name} is back.{' '}
          <Link href="/account/saved" className="text-primary underline">
            Your saved plants
          </Link>
        </p>
      ) : (
        <div className="mt-base">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            data-testid="save-for-later"
            aria-busy={busy}
            className="border-border text-ink-muted hover:border-primary focus-visible:ring-primary min-h-[44px] w-full cursor-pointer rounded-sm border px-4 text-sm disabled:opacity-60 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <MicroSpinner size="sm" />
                <span>Saving…</span>
              </span>
            ) : (
              `Sold out? Tell me when ${name} is back`
            )}
          </button>

          {needsSignIn && (
            <p className="border-border bg-surface-raised mt-sm rounded-sm border px-4 py-3 text-sm">
              One code, no password —{' '}
              <Link href="/sign-in?next=/account/saved" className="text-primary underline">
                sign in with your mobile number
              </Link>{' '}
              and we will hold it against your account, so it is still there if you sign in on another
              phone.
            </p>
          )}

          {error && (
            <p role="alert" className="text-danger mt-sm mb-0 text-sm">
              {error}
            </p>
          )}
        </div>
      )}
    </ErrorBoundary>
  )
}
