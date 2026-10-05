/**
 * Delivery OTP and the claim-evidence vocabulary.
 *
 * ── THE ANTI-FRAUD MECHANISM, AND WHY IT IS AN OTP AND NOT A PENALTY ────────
 *
 * The single loudest complaint in the nine research files is "order marked
 * delivered but not received". Urvann's answer to it was to write a ₹100 penalty
 * into a 3PL contract — and they carry 2.1/5 anyway.
 *
 * The reason a penalty does not work is arithmetic, not culture. Under Urvann's
 * structure a rider earns ₹65 for a tap either way, and the tap takes ten
 * seconds while delivering takes twenty minutes with a live plant. Fining ₹100
 * changes the expected value of the tap only if detection is near-certain AND
 * the penalty exceeds the saved labour — neither holds on a network of hundreds
 * of riders and a complaint process that starts when a customer notices.
 *
 * So we do not fine. We make the honest action the cheap one:
 *
 *   · The OTP goes to the CUSTOMER's phone. The rider cannot read it off their
 *     own handset, so `DELIVERED` cannot be reached by pressing a button — it
 *     requires a customer to read out four digits. That converts "mark it
 *     delivered" from a ten-second solo action into a conversation the customer
 *     is part of, which is the only place the fraud is actually visible.
 *   · The close-out is recorded as an APPEND-ONLY EVENT. A mutable
 *     `delivered = true` can be flipped back; an event cannot.
 *   · There is no penalty field anywhere in this system. The audit trail is
 *     something we would want anyway to settle a disputed delivery — not a
 *     deterrent, and not aimed at the rider.
 *
 * The rider is not the enemy here. A rider being asked to fake a delivery is a
 * rider whose employer has made honesty expensive, and the honest fix is the pay
 * structure in `assign.ts`, not a threat.
 *
 * ── WHY THE OTP LIFETIME IS CONFIGURATION ───────────────────────────────────
 * `config.auth.otpExpiresIn` (AUTH_OTP_EXPIRES_IN, default 300s). An OTP that
 * lives for a day is a password; one that lives for five minutes and is
 * single-use cannot be phoned to a friend. It is a commercial/security decision,
 * so it lives in env rather than in this module.
 *
 * ── ATTEMPTS ARE COUNTED AND CAPPED ────────────────────────────────────────
 * Six digits is a million candidates, and a brute-forceable close-out defeats the
 * entire mechanism — an attacker who can mark orders delivered can bill the
 * fraud against a delivery system. `MAX_OTP_ATTEMPTS` caps attempts per dispatch
 * and the column lives on the row, so the counter survives a page refresh.
 */

import { randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

import { config } from '@/lib/config'

/**
 * Digits only. No alphabet, no case-folding, no `O`/`0` ambiguity: this is read
 * aloud over the phone at a doorstep in traffic, so it must be unambiguous when
 * spoken. Six digits at 5 minutes with a 5-attempt cap is ~1.7e-7 per attempt.
 */
export const OTP_LENGTH = config.auth.otpLength

/** Matches the `delivery_otp_attempts` semantics. */
export const MAX_OTP_ATTEMPTS = 5

/** Uniform over the digit range. `randomInt` is a CSPRNG; `Math.random` is not. */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
}

export interface OtpHash {
  hash: string
  salt: string
}

/**
 * scrypt with a per-code random salt.
 *
 * A six-digit OTP has under 3e6 possible values, so a fast hash would be
 * trivially reversible by anyone who can read the table — the salt and a slow
 * KDF are what stop a database dump from being a fraud kit. `node:crypto` gives
 * us scrypt with no new dependency, which matters: this project counts datastores
 * at 4x a domain-code cost (C-5) and an auth library for one six-digit field
 * would not earn its place.
 */
export function hashOtp(code: string, salt = randomBytes(16).toString('hex')): OtpHash {
  const hash = scryptSync(code, salt, 32).toString('hex')
  return { hash, salt }
}

/**
 * Constant-time compare.
 *
 * A byte-by-byte `===` leaks the matching prefix length through timing, which is
 * how a six-digit space gets walked in minutes rather than years. `timingSafeEqual`
 * also requires equal lengths, so a length mismatch is a `false` rather than a
 * throw.
 */
export function verifyOtp(code: string, storedHash: string, salt: string): boolean {
  const candidate = scryptSync(code, salt, 32)
  const stored = Buffer.from(storedHash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

/**
 * The claim-evidence vocabulary.
 *
 * research/concept.md §7: "Uncut same-day unboxing video, stated at point of
 * sale — free to the customer, non-refundable if omitted" is the mechanism that
 * yields claim evidence AND fraud filtering from a single artefact. That is why
 * it beats a returns process: a video recorded at the door cannot have been
 * taken after the plant died, and the customer is recording it, not us.
 *
 * So the rider's step is not "upload a video". It is: at the door, confirm the
 * customer was told to open and film. The four values are honest about what each
 * one means rather than collapsing "customer declined" into success:
 *
 *   not_requested          — nothing was asked. No evidence exists.
 *   unboxing_video_requested — the prompt was made at the door. STRONGEST state:
 *                            the customer has a same-day video that we do not
 *                            hold but that they will produce if they need to.
 *   photo_at_handover      — a delivery photo exists. Real evidence of arrival,
 *                            silent on condition. A plant can be dead on arrival
 *                            and photograph convincingly.
 *   customer_declined      — asked, refused. Recorded so that a later claim can
 *                            be assessed honestly, and so the refusal rate is
 *                            visible to ops instead of being lost.
 */
export const CLAIM_EVIDENCE_KINDS = [
  'not_requested',
  'unboxing_video_requested',
  'photo_at_handover',
  'customer_declined',
] as const

export type ClaimEvidenceKind = (typeof CLAIM_EVIDENCE_KINDS)[number]

export function isClaimEvidenceKind(value: unknown): value is ClaimEvidenceKind {
  return typeof value === 'string' && (CLAIM_EVIDENCE_KINDS as readonly string[]).includes(value)
}

/**
 * Event kinds for the append-only ledger.
 *
 * Mirrors `dispatch_events_kind_is_known` in schema.sql. Kept in one place so
 * the rider surface, the ops console and the database cannot drift: the CHECK
 * refuses an unknown value, so a typo here surfaces as a failed delivery rather
 * than as a silently dropped audit record.
 */
export const DISPATCH_EVENT_KINDS = [
  'ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'OTP_SENT',
  'OTP_VERIFIED',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'CLAIM_EVIDENCE',
  'PROOF_CAPTURED',
  'REASSIGNED',
] as const

export type DispatchEventKind = (typeof DISPATCH_EVENT_KINDS)[number]

export type ActorKind = 'rider' | 'staff' | 'system'

/**
 * The delivery-completion message body.
 *
 * Terse, and it names the ORDER rather than the plant: a customer's phone is
 * read by whoever is standing at the door, and "your order UPV-XXXX is on its
 * way" tells them what to say. It does NOT contain the code — the code only ever
 * goes to the customer, which is the whole mechanism.
 */
export function deliveryOtpMessage(orderCode: string, code: string): string {
  return `Upvvan: your order ${orderCode} is out for delivery. Delivery code ${code}. Give it to the rider only when the plant is in your hands.`
}

export function riderLoginMessage(code: string): string {
  return `Your Upvvan rider code is ${code}. It expires in a few minutes.`
}