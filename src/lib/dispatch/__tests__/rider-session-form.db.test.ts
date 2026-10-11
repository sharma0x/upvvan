/**
 * The rider session endpoint, called the way each caller actually calls it.
 *
 * ── WHY THIS FILE EXISTS, AND WHAT IT WAS AIMED AT ───────────────────────────
 *
 * `POST /api/rider/session` has two callers that send two different content
 * types:
 *
 *     /rider/signin        fetch(),  application/json
 *     "End shift" button   <form>,   application/x-www-form-urlencoded
 *
 * The route parsed with `request.json()` alone. Against a form body that throws,
 * a `.catch(() => ({}))` turned it into an empty object, and `action` fell back
 * to its `'request'` default. Pressing "End shift" therefore:
 *
 *   · did NOT clear the rider cookie — the session stayed live;
 *   · navigated the phone to /api/rider/session and showed the JSON
 *     `{"message":"Enter your 10-digit phone number."}`, which is the SIGN-IN
 *     error, on the one control whose entire job is to sign out;
 *   · left a rider at a doorway believing they had ended their shift while still
 *     authenticated for it.
 *
 * ── WHY NOTHING CAUGHT IT ───────────────────────────────────────────────────
 *
 * Every automated check of this route used `fetch` with JSON — which is the path
 * that always worked. The path that was broken is the one a human takes with a
 * thumb, on a phone, on a bad connection.
 *
 * That is the specific shape of blindness this file is written against: a test
 * that exercises a DIFFERENT encoding than production sends is not a weaker
 * test, it is a test of a different program. So the assertions below go through
 * `application/x-www-form-urlencoded` and a browser `Accept` header, because
 * that is what the button sends.
 */
import { describe, it, expect, beforeAll } from 'vitest'

/*
 * `undici`'s fetch, NOT the global one.
 *
 * This suite runs under happy-dom, whose `globalThis.fetch` is a DOM stub that
 * cannot open a socket. The first version of this file used the global and every
 * request failed — so `reachable()` returned false, and because each test began
 * with `if (!available) return`, six of them reported PASSED while having checked
 * absolutely nothing.
 *
 * That is the most dangerous possible failure for a suite like this one: the bug
 * it guards is "a rider pressed End shift and stayed signed in", and the test
 * would have reported green forever while the rider kept their session. `undici`
 * ships Node's real HTTP client and nothing stubs it.
 */
const { fetch: realFetch } = await import('undici')

const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3100}`

/**
 * Post a FORM, as the End shift button does.
 *
 * `Accept: text/html` is what makes it a navigation rather than a `fetch`, and it
 * is what decides whether the route returns JSON or redirects. A test that omits
 * it is testing the `fetch` path while claiming to test the form.
 */
async function postForm(fields: Record<string, string>) {
  return realFetch(`${BASE}/api/rider/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  })
}

/** Post JSON, as the sign-in page does. */
async function postJson(body: Record<string, unknown>) {
  return realFetch(`${BASE}/api/rider/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
}

/*
 * Reachability is asserted ONCE, in `beforeAll`, and throws.
 *
 * The previous structure put the check inside the first `it()` and had every other
 * test open with `if (!available) return`. That is the skip-as-pass pattern: when
 * the check failed, six tests reported green having asserted nothing.
 *
 * A `beforeAll` throw fails EVERY test in the suite, which is the honest outcome —
 * "we could not check" is not "it is fine", and for a guard on rider
 * authentication the difference matters.
 */
beforeAll(async () => {
  let ok = false
  try {
    const res = await realFetch(`${BASE}/rider/signin`, {
      signal: AbortSignal.timeout(5000),
    })
    ok = res.ok || res.status === 307
  } catch {
    ok = false
  }

  if (!ok) {
    throw new Error(
      `[rider-session] No server on ${BASE}. Start one with \`make dev\`.\n` +
        `These tests are deliberately NOT skipped: a sign-out test that silently ` +
        `passes is worse than no test, because the bug it guards — a rider who ` +
        `pressed "End shift" and stayed authenticated — is invisible from anywhere else.`,
    )
  }
})

describe('rider sign-out — the FORM path, not the fetch path', () => {
  it('a form sign-out returns a REDIRECT to a page, not JSON', async () => {
    const res = await postForm({ action: 'signout' })

    /*
     * 303, specifically.
     *
     * 302 would let a browser re-issue the POST to `/rider/signin` as a GET under
     * some clients, and any non-303 redirect after a POST is the classic recipe
     * for a form that gets resubmitted. 303 says "go there, and fetch it".
     */
    expect(res.status, 'the rider must land on a page, not on a JSON body').toBe(303)
    // Absolute, not relative. A relative Location is legal but has to be resolved
    // against the request URL by every client, and some do it against the wrong
    // base — so the assertion pins the shape rather than the exact string.
    expect(res.headers.get('location')).toMatch(/\/rider\/signin$/)
  })

  it('a form sign-out EXPIRES the rider cookie', async () => {
    const res = await postForm({ action: 'signout' })
    const setCookie = res.headers.getSetCookie?.().join('; ') ?? ''

    /*
     * This is the half that was silently wrong.
     *
     * `cookies().delete()` inside the handler marks the cookie for deletion in the
     * response the RENDER writes. A redirect response is not a render — it is
     * built by `NextResponse.redirect` and returned directly — so without an
     * explicit `response.cookies.delete(...)` the browser keeps a live session
     * cookie and signs the rider straight back in.
     *
     * "End shift" that does not end the shift.
     */
    expect(setCookie, 'the cookie must be expired on the redirect response').toContain(
      'upvvan_rider=',
    )
    expect(
      /Expires=Thu, 01 Jan 1970/i.test(setCookie),
      `the cookie must be expired, not merely overwritten. Got: ${setCookie}`,
    ).toBe(true)
  })

  it('a form sign-out is not mistaken for a sign-IN request', async () => {
    // The exact string the broken route returned: it had defaulted to `request`.
    const res = await postForm({ action: 'signout' })
    const body = await res.text()

    expect(
      body,
      'A sign-out answered with the SIGN-IN error, which is how the bug presented: ' +
        'the action fell through to its default because the body could not be parsed.',
    ).not.toMatch(/10-digit phone number/i)
  })

  it('a JSON sign-out still gets JSON, because a fetch caller cannot follow a redirect', async () => {
    const res = await postJson({ action: 'signout' })

    /*
     * A redirect here would be followed transparently by `fetch`, so the caller
     * would receive the sign-in page's HTML as if it were a response body — and a
     * `response.json()` on it would throw somewhere far from the cause.
     */
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('a form sign-in request is parsed, not swallowed', async () => {
    const res = await postForm({ action: 'request', phone: '9845011122' })
    const body = (await res.json()) as { ok?: boolean; challengeId?: number }

    expect(body.ok, 'a form-encoded sign-in must produce a challenge').toBe(true)
    expect(typeof body.challengeId).toBe('number')
  })

  it('a form-encoded challengeId is coerced to a number', async () => {
    /*
     * Every field in a form arrives as a STRING. `challengeId` was reaching
     * `Number.isInteger` as `"22"`, so the guard that exists to reject a
     * malformed challenge would have rejected every form-encoded sign-in — the
     * one encoding a rider on a bad connection would actually produce.
     */
    const requested = await postForm({ action: 'request', phone: '9845011122' })

    /*
     * Parse the body ONCE.
     *
     * This called `request.json()` twice, so the second call got an already-drained
     * body, `challengeId` came back undefined, and the verify was rejected with
     * a 400 that looked exactly like the coercion bug the test exists to catch.
     *
     * Worth recording because the failure mode is indistinguishable from the real
     * one: a broken assertion in a guard test looks precisely like the bug it was
     * written to find.
     */
    const { devCode, challengeId } = (await requested.json()) as {
      devCode?: string
      challengeId?: number
    }
    if (!devCode) {
      // Non-production only. Nothing to prove without the code.
      return
    }

    const verify = await postForm({
      action: 'verify',
      challengeId: String(challengeId ?? ''),
      code: devCode,
    })

    expect(verify.status, 'a form-encoded verify must be accepted').toBe(200)
  })
})
