import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import ClaimClient from './ClaimClient'
import { db, loadOrderVerified, normaliseCode } from '@/lib/orders/db'
import { authoriseOrderAccess } from '@/lib/orders/access'
import { guaranteeTerms } from '@/lib/commerce/guarantee'
import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * `/claim/<code>` — report a damaged or dead plant.
 *
 * ── WHAT A CLAIM MEANS HERE, AND WHY IT IS NOT A REFUND REQUEST ─────────────
 *
 * For a plant, a claim means ONE thing: we send another. There is no refund path
 * for a plant anywhere in this system, and that is the single biggest structural
 * difference from every competitor in the research — Ugaao's 30-day guarantee is
 * defeated four ways (register within five days, keep it in the original pot,
 * mortality only, triage before payout) and Urvann defaults to wallet credit, which
 * suppresses the complaint and starves the DOA model of the feedback it depends on.
 *
 * The replacement is not a concession. The marginal cost of a replacement plant is a
 * plant we already grew and would otherwise discard.
 *
 * ── WHY ONLY A DELIVERED ORDER CAN CLAIM ────────────────────────────────────
 *
 * `assertTransition` refuses DELIVERED-anything-else, and the write is row-locked,
 * so two simultaneous claims cannot both read DELIVERED. A claim raised against an
 * order still in transit is a customer who has not waited — and answering those with
 * replacements trains customers to claim early and turns our DOA rate into fiction,
 * which is the number every future guarantee decision is priced off.
 *
 * ── WHY THE PAGE IS NOT A PDF UPLOAD ────────────────────────────────────────
 *
 * The unboxing video is the strongest evidence a claim has and we do not collect it
 * yet: it needs presigned multipart upload to S3, a size cap, a retention policy and
 * a read-authorisation rule. That is a separate piece of work, REPORTED as a
 * follow-up. A link to a video the customer already has is accepted meanwhile, so
 * the evidence is not lost while that is built.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Report a problem — Upvvan',
  description:
    'Tell us what arrived and we will send a replacement. Plants are replaced, never refunded.',
  robots: { index: false, follow: false },
}

export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalised = normaliseCode(code)

  /*
   * Authorisation is the signed order cookie OR a customer session that owns the
   * order — `authoriseOrderAccess`, the same decision `/order/<code>` and
   * `/invoice/<code>` make.
   *
   * This page used to accept the cookie alone, so a signed-in customer reached
   * their own claim form only if they had separately done the code+phone lookup.
   * Combined with `/account` having no link here, and `/order/<code>` linking here
   * only when `status === 'DELIVERED'`, the practical effect was that a signed-in
   * customer's route to reporting a problem ran through the guest lookup.
   *
   * `notFound()` rather than a 403 when neither credential is present: telling a
   * stranger that this code exists but is not theirs is exactly the enumeration
   * the randomised code exists to prevent.
   */
  const access = await authoriseOrderAccess(
    normalised,
    (await headers()).get('cookie') ?? undefined,
  )
  if (!access) notFound()
  void (await cookies())

  const found = await loadOrderVerified(db(), normalised)
  if (!found) notFound()

  const { order, items } = found

  /*
   * The guarantee THIS order was sold at, and the claims already on it.
   *
   * Both were missing. The form used to print a hardcoded "48 hours" whatever tier
   * the plant was sold on, and nothing anywhere told a returning customer that
   * their claim already existed — so filing a second one produced a paragraph of
   * writing and then a 409.
   */
  const terms = guaranteeTerms(order.guaranteeTier)
  const settings = await loadBusinessSettings()
  const claims = await db().query<{ id: number; kind: string; status: string }>(
    `SELECT "id", "kind", "status"
       FROM "order_claims"
      WHERE "order_id" = (SELECT "id" FROM "orders" WHERE "order_code" = $1)
      ORDER BY "created_at" DESC`,
    [normalised],
  )

  return (
    <main className="px-base py-2xl mx-auto max-w-[560px]">
      <Link
        href={`/order/${order.orderCode}`}
        className="text-primary text-sm no-underline hover:underline"
      >
        ← Back to your order
      </Link>

      <p className="text-label-caps text-ink-muted mt-lg mb-0">Order {order.orderCode}</p>
      <h1 className="my-sm">Tell us what arrived</h1>

      <p className="text-ink-muted">
        If a plant arrived damaged or dead we send a replacement — you do not need to send anything
        back, and there is nothing to pay. Pots, soil and fertiliser are settled in money within 24
        hours.
      </p>

      <ClaimClient
        orderCode={order.orderCode}
        phone={order.customerPhone ?? ''}
        delivered={order.status === 'DELIVERED'}
        items={items.map((i) => ({
          id: i.id,
          label: `${i.commonName ?? 'Plant'} · ${i.sizeTier}`,
          // The remedy is a property of the SKU's item class, not of the customer's
          // wording. Showing it here prevents "I want a refund" on a plant, which we
          // could not honour anyway and which would then read as a refusal.
          refundable: i.itemClass !== 'plant',
        }))}
        guaranteeLabel={terms.label}
        guaranteeDays={terms.days}
        arrivalWindowHours={terms.arrivalWindowHours}
        supportPhone={settings.customerCarePhone}
        existingClaims={claims.rows.map((c) => ({
          id: `CLM-${String(c.id).padStart(6, '0')}`,
          kind: c.kind,
          status: c.status,
        }))}
      />
    </main>
  )
}
