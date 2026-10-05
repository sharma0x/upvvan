'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'

/**
 * Planter selection and add-to-cart.
 *
 * ── HOW THE LADDER IS PRESENTED, AND WHY ───────────────────────────────────
 * The planter is our primary AOV lever (+29% to +121%, largest at the small
 * end), and the honest presentation is the whole game:
 *
 *  · The bare grow pot is ALWAYS the first option and is always reachable. It is
 *    not a "basic" tier to scroll past — it is where the customer's eye lands.
 *    Ugaoo sells the identical plant at ₹199 in a plain pot, and that is why
 *    their ₹1,099 version reads as a choice rather than a bait-and-switch.
 *
 *  · The pot's contribution is shown as a VALUE ("the ceramic pot is worth ₹657
 *    more"), never as a saving, and there is no struck-through price anywhere.
 *    An MRP is a merchandising fiction; every Indian site shows one and we don't.
 *
 *  · Selecting a pot updates the total live, because "longer route pays more"
 *    has to be legible to a customer too.
 */
export default function AddToCart({ item }: { item: CatalogueItem }) {
  const router = useRouter()
  const [planterId, setPlanterId] = useState<string>('')
  const [adding, setAdding] = useState(false)

  // Grow pot is the entry option — the ladder's first row, which is the bare
  // plant at the tier price.
  const selected =
    item.ladder.find((l, i) => i === 0 && planterId === '') ??
    item.ladder[
      Math.max(
        0,
        item.planters.findIndex((p) => p.planterId === planterId),
      ) + 1
    ] ??
    item.ladder[0]!

  async function add() {
    setAdding(true)
    try {
      // The cart is a client-side draft until checkout creates the order. Order
      // placement re-derives every price server-side from the SKU — a client
      // total is a display convenience, never an authority.
      const existing = JSON.parse(sessionStorage.getItem('upvvan.cart') ?? '[]')
      existing.push({
        skuId: item.skuId,
        slug: item.slug,
        commonName: item.commonName,
        sizeTier: item.sizeTier,
        /*
         * Carried so the cart can tell the customer the right remedy.
         *
         * A plant is replaced, never refunded; a consumable is refunded in money
         * within 24h. That distinction is the single biggest structural difference
         * from every competitor, so the cart must not state it unconditionally —
         * telling a soil-only buyer that "plants are replaced, not refunded" is
         * both wrong and needlessly alarming.
         *
         * It is display only. The server re-derives item class from the SKU when
         * it places the order.
         */
        itemClass: item.itemClass,
        planterId: planterId || null,
        totalPaise: selected.totalPaise,
      })
      sessionStorage.setItem('upvvan.cart', JSON.stringify(existing))
      router.push('/cart')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <fieldset className="border-0 p-0">
        <legend className="mb-xs text-label-caps text-ink-muted">Choose a pot</legend>

        <ul className="gap-sm m-0 flex list-none flex-col p-0">
          {/* The honest entry option, first and always reachable. */}
          <li>
            <button
              type="button"
              onClick={() => setPlanterId('')}
              aria-pressed={planterId === ''}
              className={`p-base w-full cursor-pointer rounded-sm border text-left ${
                planterId === ''
                  ? 'border-primary bg-brand-soft'
                  : 'border-border hover:border-primary'
              }`}
            >
              <span className="block font-semibold">
                {item.ladder[0]!.isEntryOption
                  ? 'Grow pot'
                  : item.ladder[0]!.planterUpliftBp === 0
                    ? 'Grow pot'
                    : 'Standard'}
              </span>
              <span className="text-ink-muted block text-sm">
                Decorate it yourself on arrival. This is the plant, no pot upgrade.
              </span>
              <span className="mt-xs block font-semibold">
                {formatPaise(item.ladder[0]!.totalPaise)}
              </span>
            </button>
          </li>

          {item.planters
            .filter((p) => p.upliftBp > 0)
            .map((planter) => {
              const tierPrice = item.ladder[0]!.totalPaise
              const value = Math.ceil((tierPrice * planter.upliftBp) / 10_000)
              const total = tierPrice + value
              const active = planterId === planter.planterId

              return (
                <li key={planter.planterId}>
                  <button
                    type="button"
                    onClick={() => setPlanterId(planter.planterId)}
                    aria-pressed={active}
                    className={`p-base w-full cursor-pointer rounded-sm border text-left ${
                      active ? 'border-primary bg-brand-soft' : 'border-border hover:border-primary'
                    }`}
                  >
                    <span className="block font-semibold">{planter.name}</span>
                    <span className="text-ink-muted block text-sm">
                      {planter.material}
                      {planter.colour ? ` · ${planter.colour}` : ''}
                    </span>
                    {/*
                      VALUE framing, never discount framing. "Worth ₹657 more",
                      not "save ₹657" and not a struck-through original price.
                    */}
                    <span className="mt-xs text-ink-muted block text-sm">
                      The pot is worth {formatPaise(value)} more
                    </span>
                    <span className="block font-semibold">{formatPaise(total)}</span>
                  </button>
                </li>
              )
            })}
        </ul>
      </fieldset>

      <button
        type="button"
        onClick={add}
        disabled={adding}
        className="mt-base bg-primary text-surface w-full cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {adding ? 'Adding…' : `Add to cart · ${formatPaise(selected.totalPaise)}`}
      </button>

      <p className="mt-sm text-ink-muted mb-0 text-sm">
        Free delivery, no minimum. Prepaid only — we do not offer cash on delivery.
      </p>
    </div>
  )
}
