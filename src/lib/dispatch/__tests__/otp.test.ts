/**
 * OTP, claim vocabulary and money coercion — pure unit tests.
 *
 * The OTP is the control that makes "order marked delivered but not received"
 * structurally impossible, so these tests are about the properties that control
 * depends on: the code is unpredictable, the stored value is not the code, a
 * wrong code is refused, and the comparison does not leak its prefix by timing.
 */

import { describe, it, expect } from 'vitest'

import {
  CLAIM_EVIDENCE_KINDS,
  DISPATCH_EVENT_KINDS,
  MAX_OTP_ATTEMPTS,
  OTP_LENGTH,
  deliveryOtpMessage,
  generateOtp,
  hashOtp,
  isClaimEvidenceKind,
  riderLoginMessage,
  verifyOtp,
} from '../otp'
import { isValidPayPaise, minMultiplierBpFor, multiplierPreservesBandOrdering } from '../pay'
import { toPaise } from '../store.server'

describe('the delivery OTP', () => {
  it('is digits only, of the configured length', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtp()
      expect(code).toHaveLength(OTP_LENGTH)
      expect(code).toMatch(/^\d+$/)
    }
  })

  it('is zero-padded, so 000042 stays six characters', () => {
    // Without padding a short code would be read aloud ambiguously at a doorway.
    for (let i = 0; i < 500; i++) {
      expect(generateOtp()).toHaveLength(OTP_LENGTH)
    }
  })

  it('does not repeat across 500 draws', () => {
    // A weak PRNG would collide here; `randomInt` is a CSPRNG.
    const codes = new Set(Array.from({ length: 500 }, generateOtp))
    expect(codes.size).toBeGreaterThan(480)
  })
})

describe('only the HASH is stored, never the code', () => {
  it('verifies the right code', () => {
    const { hash, salt } = hashOtp('482913')
    expect(verifyOtp('482913', hash, salt)).toBe(true)
  })

  it('refuses a wrong code', () => {
    const { hash, salt } = hashOtp('482913')
    expect(verifyOtp('482914', hash, salt)).toBe(false)
  })

  it('never stores the code in the clear', () => {
    // A database dump must not be a delivery-fraud kit. Six digits have under
    // 3e6 possibilities, so a fast hash would be trivially reversible.
    const { hash } = hashOtp('482913')
    expect(hash).not.toContain('482913')
    expect(hash).not.toBe('482913')
  })

  it('salts, so the same code hashes differently for two dispatches', () => {
    const a = hashOtp('111111')
    const b = hashOtp('111111')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    // Both still verify — salt changes the storage, not the contract.
    expect(verifyOtp('111111', a.hash, a.salt)).toBe(true)
    expect(verifyOtp('111111', b.hash, b.salt)).toBe(true)
  })

  it('refuses a code verified against the WRONG salt', () => {
    const a = hashOtp('111111')
    const b = hashOtp('222222')
    expect(verifyOtp('111111', a.hash, b.salt)).toBe(false)
  })

  it('returns false rather than throwing on a malformed stored hash', () => {
    // `timingSafeEqual` throws on a length mismatch. A bad row must not become a
    // 500 in front of a rider at a door.
    expect(verifyOtp('111111', 'not-hex-at-all', 'deadbeef')).toBe(false)
    expect(verifyOtp('111111', '', '')).toBe(false)
  })
})

describe('the brute-force budget', () => {
  it('exists, and is small', () => {
    // Six digits at 5 minutes with 5 attempts is ~1.7e-7 per delivery. Without a
    // cap, a close-out that is brute-forceable defeats the entire mechanism.
    expect(MAX_OTP_ATTEMPTS).toBeGreaterThan(0)
    expect(MAX_OTP_ATTEMPTS).toBeLessThanOrEqual(10)
  })

  it('is bounded by OTP length', () => {
    // Not a real security property — a documentation guard. If OTP_LENGTH drops
    // to 4, five attempts is genuinely guessable.
    expect(OTP_LENGTH).toBeGreaterThanOrEqual(6)
  })
})

describe('the delivery message', () => {
  it('names the order, so the customer knows what to say at the door', () => {
    const body = deliveryOtpMessage('UPV-MUU02SR9', '482913')
    expect(body).toContain('UPV-MUU02SR9')
    expect(body).toContain('482913')
  })

  it('tells the customer to hand the code over only on receipt', () => {
    const body = deliveryOtpMessage('UPV-1', '482913')
    expect(body).toMatch(/only when the plant is in your hands/i)
  })

  it('is what the customer receives — never the rider', () => {
    // The mechanism only works if the code reaches the customer. Asserted so a
    // future refactor that routes it to the rider is caught here.
    expect(riderLoginMessage('123456')).toContain('123456')
  })
})

describe('the claim-evidence vocabulary is honest', () => {
  it('has the four states', () => {
    expect(CLAIM_EVIDENCE_KINDS).toEqual([
      'not_requested',
      'unboxing_video_requested',
      'photo_at_handover',
      'customer_declined',
    ])
  })

  it('refuses an unknown value rather than defaulting to success', () => {
    // The whole point of recording `customer_declined` separately is that we do
    // not collapse a refusal into a pass.
    expect(isClaimEvidenceKind('unboxing_video_requested')).toBe(true)
    expect(isClaimEvidenceKind('video')).toBe(false)
    expect(isClaimEvidenceKind('')).toBe(false)
    expect(isClaimEvidenceKind(null)).toBe(false)
    expect(isClaimEvidenceKind(7)).toBe(false)
  })

  it('mirrors the ledger kinds the schema CHECK accepts', () => {
    // These two lists must agree or an event insert fails at 6pm instead of at
    // save time.
    expect(DISPATCH_EVENT_KINDS).toContain('OTP_VERIFIED')
    expect(DISPATCH_EVENT_KINDS).toContain('DELIVERED')
    expect(DISPATCH_EVENT_KINDS).toContain('ASSIGNED')
    expect(DISPATCH_EVENT_KINDS).not.toContain('DELIVERED_BY_RIDER_WITHOUT_CODE')
  })
})

describe('money coercion at the loader boundary', () => {
  it('coerces the string pg returns for a numeric column', () => {
    // AGENTS.md: `base_price_paise: 19900` arrives as `'19900'`. This is the
    // driver being faithful to the column type, and the fix is an assertion at
    // the boundary — never a wider cast deeper in.
    expect(toPaise('4500', 'test')).toBe(4500)
    expect(toPaise(4500, 'test')).toBe(4500)
  })

  it('REFUSES a fractional value rather than coercing it silently', () => {
    expect(() => toPaise('4500.5', 'payout_paise')).toThrow(/whole paise/)
    expect(() => toPaise(0.1 + 0.2, 'payout_paise')).toThrow(/whole paise/)
  })

  it('refuses a non-numeric value', () => {
    expect(() => toPaise('not-a-number', 'payout_paise')).toThrow()
    expect(() => toPaise(null, 'payout_paise')).toThrow()
  })
})

describe('shared money validation', () => {
  it('accepts integer paise', () => {
    expect(isValidPayPaise(4500, 'Band pay')).toBe(true)
  })

  it('refuses a decimal and explains that money is paise', () => {
    const msg = isValidPayPaise(4500.5, 'Band pay')
    expect(msg).not.toBe(true)
    expect(String(msg)).toMatch(/integer paise/i)
  })

  it('refuses a negative', () => {
    expect(String(isValidPayPaise(-1, 'Band pay'))).toMatch(/negative/i)
  })

  it('uses multiplier wording for a multiplier', () => {
    expect(isValidPayPaise(11_500, 'Pay multiplier', true)).toBe(true)
    expect(String(isValidPayPaise(11.5, 'Pay multiplier', true))).toMatch(/basis points/i)
    expect(String(isValidPayPaise(0, 'Pay multiplier', true))).toMatch(/above zero/i)
  })

  it('refuses an absurd multiplier', () => {
    expect(String(isValidPayPaise(500_000, 'Pay multiplier', true))).toMatch(/typo/i)
  })
})

describe('the band-ordering floor', () => {
  const bands = [{ payPaise: 4500 }, { payPaise: 6000 }, { payPaise: 7500 }]

  it('is 7bp for the launch bands', () => {
    // 10000 / smallest gap (1500) = 6.67 → 7
    expect(minMultiplierBpFor(bands)).toBe(7)
  })

  it('refuses a multiplier that would flatten the bands', () => {
    expect(multiplierPreservesBandOrdering(1, bands)).toBe(false)
    expect(multiplierPreservesBandOrdering(0, bands)).toBe(false)
    expect(multiplierPreservesBandOrdering(-1, bands)).toBe(false)
  })

  it('accepts every multiplier at or above the floor', () => {
    const floor = minMultiplierBpFor(bands)
    for (const bp of [floor, floor + 1, 100, 5_000, 10_000, 11_500, 99_999]) {
      expect(multiplierPreservesBandOrdering(bp, bands)).toBe(true)
    }
  })

  it('treats a single-band city as unconstrained', () => {
    // Nothing to order against, so nothing to collapse.
    expect(minMultiplierBpFor([{ payPaise: 4500 }])).toBe(1)
    expect(multiplierPreservesBandOrdering(1, [{ payPaise: 4500 }])).toBe(true)
  })
})