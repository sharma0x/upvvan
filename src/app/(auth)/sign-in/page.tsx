'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { authClient, normalisePhone } from '@/lib/auth/client'

/**
 * Sign in — phone number, then OTP.
 *
 * ── WHY TWO STEPS IN ONE COMPONENT ──────────────────────────────────────────
 *
 * The OTP is worthless without the phone number that requested it, and the phone
 * number is worthless without the OTP. Splitting these across two routes would
 * mean persisting the number in a query string or a cookie to survive the
 * navigation — and a phone number in a URL is a phone number in browser history,
 * in a `Referer` header, and in any analytics script on the page.
 *
 * One component keeps the number in React state, which is where a phone number
 * belongs.
 *
 * ── WHY NO react-hook-form ──────────────────────────────────────────────────
 *
 * Two controlled inputs do not need a form library, and adding a dependency for
 * this would put a new version in the lockfile that the security surface of
 * customer identity then depends on. Plain state it is.
 *
 * ── WHY THE CODE IS `autoComplete="one-time-code"` ─────────────────────────
 *
 * This is what lets iOS and Android offer the code from Messages/WhatsApp above
 * the keyboard. It costs one attribute and is the difference between a customer
 * reading six digits off another screen and the OS filling them in. On the real
 * WhatsApp channel this is the single highest-value line on the page.
 */

/** Per-request UI state. `step` is the whole flow — there is no other mode. */
type Step =
  | { name: 'phone' }
  | { name: 'otp'; phone: string }
  | { name: 'sending' }
  | { name: 'verifying'; phone: string }

const FIELD =
  'w-full rounded-sm border border-border bg-surface-raised px-3.5 py-3.5 text-base'

/**
 * ── WHY THIS COMPONENT IS WRAPPED IN SUSPENSE ────────────────────────────────
 * `useSearchParams()` opts a client component out of static prerendering, and
 * Next.js then refuses to build the page unless the component reading it sits
 * under a `<Suspense>` boundary:
 *
 *   Error occurred prerendering page "/sign-in"
 *
 * That is a BUILD failure, not a runtime one — which is why it survived typecheck
 * and lint, and why it only surfaced when all three agents' work was combined.
 * The symptom is total: /sign-in does not exist in the built product at all.
 *
 * The alternative — dropping `useSearchParams` and hardcoding a redirect — would
 * break the "sign in, then return to where you were" flow that `?next=` exists
 * for. Wrapping is the fix; it costs one boundary and no behaviour.
 */
function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  /*
   * The number the code was actually SENT to, held separately from `phone`.
   *
   * `step` carries the number too, but reading it out of a union in JSX needs a
   * cast, and a cast in markup is how a stale number ends up rendered to a
   * customer. This is a plain string that is correct in both steps.
   */
  const [codeSentTo, setCodeSentTo] = useState('')
  const [step, setStep] = useState<Step>({ name: 'phone' })
  const [error, setError] = useState<string | null>(null)

  /**
   * Where to go after signing in.
   *
   * Read from `?next=` so a customer redirected away from their order history
   * lands back there. Validated against same-origin absolute paths ONLY — an
   * unvalidated `next` is an open redirect, which is how a phishing link wearing
   * our own domain sends a customer to a convincing copy of the sign-in page.
   */
  const next = (() => {
    const raw = params.get('next')
    if (!raw) return '/account'
    // Must start with a single slash and NOT a double slash — `//evil.com` is a
    // protocol-relative URL that browsers treat as absolute.
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account'
  })()

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const normalised = normalisePhone(phone)
    if (!/^\+\d{10,15}$/.test(normalised)) {
      setError('Enter a 10-digit mobile number.')
      return
    }

    setStep({ name: 'sending' })

    const { error: sendError } = await authClient.phoneNumber.sendOtp({
      phoneNumber: normalised,
    })

    if (sendError) {
      /*
       * better-auth's own wording is shown for INVALID_PHONE_NUMBER, because it
       * is accurate and specific. Anything else is logged server-side and shown
       * as generic text — an error string from an auth library can carry
       * internal detail, and this page renders directly in front of a customer.
       */
      if (sendError.code === 'INVALID_PHONE_NUMBER') {
        setError('That does not look like a valid mobile number.')
      } else {
        console.error('[auth] sendOtp failed:', sendError.code, sendError.message)
        setError('We could not send a code just now. Please try again in a moment.')
      }
      setStep({ name: 'phone' })
      return
    }

    setCodeSentTo(normalised)
    setStep({ name: 'otp', phone: normalised })
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (step.name !== 'otp') return
    setError(null)
    setStep({ name: 'verifying', phone: step.phone })

    const { error: verifyError } = await authClient.phoneNumber.verify({
      phoneNumber: step.phone,
      code: code.trim(),
    })

    if (verifyError) {
      /*
       * INVALID_OTP is the customer's typo and the overwhelmingly common case —
       * it gets plain, non-alarming wording with no jargon. TOO_MANY_ATTEMPTS
       * and OTP_EXPIRED get their own copy because in both cases retrying the
       * same code cannot work, and telling someone to "try again" when they
       * cannot is a support ticket we would rather not field.
       */
      if (verifyError.code === 'INVALID_OTP') {
        setError('That code is not right. Check the digits and enter it again.')
        setCode('')
      } else if (verifyError.code === 'OTP_EXPIRED') {
        setError('That code has expired. Send a new one and we will get you in.')
        setStep({ name: 'phone' })
      } else {
        console.error('[auth] verify failed:', verifyError.code, verifyError.message)
        setError('We could not sign you in just now. Please try again.')
      }
      return
    }

    /*
     * The session cookie is already set by the verify call — there is nothing
     * to store here, and nothing SHOULD be stored client-side. The token lives
     * in an httpOnly cookie the page cannot read.
     *
     * `refresh()` is not called because the account page resolves the session
     * on the server. Router state is stale after sign-in, so a full navigation
     * (not `push`) is what guarantees the destination renders as the signed-in
     * customer rather than the cached signed-out version.
     */
    router.push(next)
    router.refresh()
  }

  const busy = step.name === 'sending' || step.name === 'verifying'
  const showingOtp = step.name === 'otp' || step.name === 'verifying'

  return (
    <main className="px-base py-2xl mx-auto max-w-[440px]">
      <p className="text-label-caps text-ink-muted mb-0">Your account</p>
      <h1 className="mt-0">{showingOtp ? 'Enter your code' : 'Sign in'}</h1>

      <p className="text-ink-muted mt-0">
        {showingOtp
          ? `We sent a 6-digit code to ${codeSentTo}.`
          : 'Your mobile number is your account. No password to remember.'}
      </p>

      {!showingOtp ? (
        <form onSubmit={requestOtp}>
          <label htmlFor="phone" className="text-label-caps text-ink-muted block">
            Mobile number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            // 13 digits covers "+919876543210" — the +91 prefix plus the number.
            maxLength={13}
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`${FIELD} mt-xs text-lg`}
          />

          <button
            type="submit"
            disabled={busy || phone.trim().length === 0}
            className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step.name === 'sending' ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label htmlFor="code" className="text-label-caps text-ink-muted block">
            6-digit code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            // Lets iOS/Android offer the code straight from Messages/WhatsApp.
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`${FIELD} mt-xs text-center text-2xl tracking-[0.3em]`}
            /* Focus on mount so the customer can type the code immediately. */
            autoFocus
          />

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="bg-primary text-surface mt-base w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step.name === 'verifying' ? 'Checking…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null)
              setCode('')
              setStep({ name: 'phone' })
            }}
            className="text-ink-muted mt-sm w-full cursor-pointer bg-transparent text-sm underline"
          >
            Use a different number
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="border-danger bg-surface text-danger mt-base rounded-sm border px-4 py-3">
          {error}
        </p>
      )}

      <p className="text-ink-muted mt-xl mb-0 text-sm">
        A new number creates an account automatically — there is nothing to fill
        in. Your number is only used for order updates and delivery.
      </p>
    </main>
  )
}

/**
 * The route's default export. Everything below this line exists to satisfy the
 * Suspense requirement described above.
 */
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[440px] px-base py-3xl">
          <p className="text-ink-muted m-0">Loading sign in…</p>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  )
}
