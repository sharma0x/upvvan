import { NextResponse } from 'next/server'

import { TransitionError, reissueOtp } from '@/lib/dispatch/store.server'
import { currentStaff } from '@/lib/dispatch/session.server'
import { sendEmail } from '@/lib/email/send'
import { customerMailbox } from '@/lib/email/address'
import { deliveryCode } from '@/lib/email/templates'
import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * POST /api/dispatch/<id>/reissue — send the customer a fresh delivery code.
 *
 * ── WHY THIS ROUTE EXISTS ────────────────────────────────────────────────────
 *
 * Three rider-facing errors say "ask the dispatcher to reissue it":
 *
 *     OTP_EXPIRED             "That delivery code has expired."
 *     OTP_ATTEMPTS_EXHAUSTED  "Too many wrong codes on this drop (5)."
 *     OTP_INVALID             "No delivery code was sent for this drop."
 *
 * `reissueOtp` existed and had zero callers. So all three instructed a rider to
 * ask a dispatcher to do something no dispatcher could do, on a screen with no
 * such button — and the underlying cause was that the delivery code inherited
 * the five-minute LOGIN OTP lifetime and expired at 6pm for an 8pm drop.
 *
 * Two fixes, and both were needed:
 *
 *   1. `config.auth.deliveryOtpExpiresIn` — a twelve-hour delivery window rather
 *      than a five-minute sign-in window. See config.ts.
 *   2. This route — so that when a window IS missed (a mistyped phone number, five
 *      wrong taps from a customer who cannot read the SMS, a rider on a
 *      two-day-old drop) the dispatcher has one button rather than a support
 *      ticket and a `psql` session.
 *
 * The five-attempt cap is the reason this matters most: it is a permanent state,
 * and only this route clears it.
 *
 * ── WHY IT EMAILS THE CODE ──────────────────────────────────────────────────
 *
 * `reissueOtp` returns the plaintext alongside the new expiry. It used to return
 * only the expiry and drop the code into the `outbox` table, which nothing drains
 * — so the function's only effect was to invalidate the code the customer was
 * holding and generate a replacement nobody received. Pressing this button would
 * have made the delivery strictly LESS closable.
 *
 * E-mail is the channel that demonstrably reaches this customer: the original
 * code arrives the same way, and Phase 4 swaps both for the WhatsApp Business API
 * without changing either call site.
 *
 * ── WHY IT IS STAFF-ONLY ─────────────────────────────────────────────────────
 *
 * It mints a credential that closes a delivery, and it resets a brute-force
 * counter. Both are things a customer must not be able to do to themselves — the
 * whole anti-fraud design is that a code is read off the customer's phone by a
 * rider they did not choose.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const staff = await currentStaff()
  if (!staff) {
    return NextResponse.json(
      { message: 'Sign in to the ops console to reissue a delivery code.' },
      { status: 401 },
    )
  }

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: 'That drop is not valid.' }, { status: 400 })
  }

  try {
    const result = await reissueOtp({
      dispatchId: id,
      actorLabel: staff.email ?? `staff#${staff.id}`,
    })

    const settings = await loadBusinessSettings()
    const template = deliveryCode({
      orderCode: result.orderCode,
      // The template interpolates these without a null guard, and both are known
      // at this point: `reissueOtp` refuses when there is no phone, and the
      // dispatch always carries a rider. Coerced rather than `!`-asserted so a
      // future nullable column produces an empty string instead of the word
      // "undefined" in a message a customer reads at their door.
      customerName: '',
      code: result.code,
      riderName: result.riderName ?? 'your rider',
      address: '',
      supportPhone: settings.customerCarePhone || 'our published number',
    })

    // Awaited, and its result checked.
    //
    // Everywhere else in this codebase a notification is fire-and-forget, and
    // that is right: a mail outage must not fail a payment or a delivery. Here
    // the mail IS the deliverable. An operator who clicks "reissue" and is told
    // it worked, when the code went nowhere, has just invalidated the customer's
    // working code and lost the only way to close that drop.
    const sent = await sendEmail({
      kind: 'delivery_code_reissue',
      to: customerMailbox('', result.phone),
      subject: template.subject,
      text: template.text,
      html: template.html,
    })

    if (!sent) {
      return NextResponse.json(
        {
          message:
            'The new code could not be sent, so we have not changed anything. Check the Emails log and try again.',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      dispatchId: Number(id),
      orderCode: result.orderCode,
      expiresAt: result.expiresAt.toISOString(),
      message: `A new code is on its way to the customer for ${result.orderCode}. The old one no longer works.`,
    })
  } catch (err) {
    if (err instanceof TransitionError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: err.status })
    }
    console.error('[dispatch/reissue] failed:', err)
    return NextResponse.json(
      { message: 'Could not reissue that code. Nothing has changed — try again.' },
      { status: 500 },
    )
  }
}
