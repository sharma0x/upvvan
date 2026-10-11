'use client'

import { useState } from 'react'

/**
 * Triage controls for one claim.
 *
 * Three outcomes, and none of them is a bare link:
 *
 *   · Accept           — we agree; a replacement is owed.
 *   · Queue a replacement — it is actually going out.
 *   · Reject           — requires a sentence, because the sentence is stored on
 *                       the claim and sent to the customer.
 *
 * ── WHY THE REJECTION IS DELIBERATELY THE FINGERPIECIEST ────────────────────
 *
 * Every other control on the ops console is one click. This one asks for text
 * first, and the note field only appears once "Reject" is chosen.
 *
 * That asymmetry is the point. Rejecting a claim is the single action in this
 * product that can be both wrong and final-feeling to a customer who sent a photo
 * of a dead plant, and a one-click "Reject" sitting next to a one-click "Accept"
 * is how it gets pressed at 9pm on the wrong row. A required sentence costs one
 * person eight seconds and is the difference between a decision and a reflex.
 */
export function ClaimTriageControls({ claimId }: { claimId: number }) {
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function resolve(outcome: string) {
    setBusy(outcome)
    setError(null)
    try {
      const res = await fetch(`/api/admin-ops/claims/${claimId}/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome, note: note.trim() || undefined }),
      })
      const body = (await res.json()) as { message?: string }
      if (!res.ok) {
        setError(body.message ?? 'That did not work.')
        return
      }
      setDone(body.message ?? 'Resolved.')
    } catch {
      setError('We could not reach the server. Nothing has changed — try again.')
    } finally {
      setBusy(null)
    }
  }

  if (done) {
    return (
      <p role="status" className="border-success text-success m-0 rounded-sm border px-4 py-3">
        {done}
      </p>
    )
  }

  return (
    <div className="mt-sm">
      <div className="gap-sm flex flex-wrap">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => resolve('accepted')}
          className="bg-primary text-surface-card min-h-[44px] cursor-pointer rounded-sm px-4 disabled:opacity-60"
        >
          {busy === 'accepted' ? 'Saving…' : 'Accept — a replacement is owed'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => resolve('replacement_queued')}
          className="border-border min-h-[44px] cursor-pointer rounded-sm border px-4 disabled:opacity-60"
        >
          {busy === 'replacement_queued' ? 'Saving…' : 'Replacement is going out'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setShowReject(true)}
          className="border-border text-danger min-h-[44px] cursor-pointer rounded-sm border px-4 disabled:opacity-60"
        >
          Reject
        </button>
      </div>

      {showReject && (
        <div className="border-danger mt-sm p-sm rounded-sm border">
          <label htmlFor={`reject-${claimId}`} className="text-label-caps block">
            Why are we rejecting this? (the customer is told this)
          </label>
          <textarea
            id={`reject-${claimId}`}
            rows={3}
            maxLength={600}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="The photo shows the plant after 9 days out of soil, not on arrival. Our 48-hour arrival guarantee does not cover this — but the survival guarantee does, and it is open for another 26 days."
            className="border-border bg-surface mt-xs w-full rounded-sm border px-3 py-2.5 text-sm"
          />
          <div className="mt-sm gap-sm flex">
            <button
              type="button"
              disabled={busy !== null || note.trim().length < 10}
              onClick={() => resolve('rejected')}
              className="bg-danger text-surface-card min-h-[44px] cursor-pointer rounded-sm px-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'rejected' ? 'Saving…' : 'Reject and tell them why'}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="border-border min-h-[44px] cursor-pointer rounded-sm border px-4"
            >
              Cancel
            </button>
          </div>
          {note.trim().length > 0 && note.trim().length < 10 && (
            <p className="text-ink-muted mt-xs mb-0 text-xs">
              A few more words — this goes to the customer and onto the claim record.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="border-danger text-danger mt-sm rounded-sm border px-4 py-3">
          {error}
        </p>
      )}
    </div>
  )
}
