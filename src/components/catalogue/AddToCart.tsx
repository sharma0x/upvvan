'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'
import { mergeLines, readCart, writeCart, clampQuantity } from '@/lib/cart'

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
 *
 *  · FIVE planters, not fourteen. Ugaoo runs 14 pot styles × 17 colours on one
 *    plant and its complaint corpus is full of grading mistakes — "two plants
 *    awkwardly potted together", "two different plants in one pot" — plus
 *    "premium prices, budget quality" reviews. The uplift ratio transfers; the
 *    variant sprawl does not. We take the ratio and refuse the sprawl.
 */
export default function AddToCart({ item }: { item: CatalogueItem }) {
  const router = useRouter()
  const [planterId, setPlanterId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  /*
   * Stock is a hard stop, not a hint.
   *
   * `sku_stock` was enforced at checkout and shown nowhere on the storefront, so
   * a customer could add a sold-out plant, pay for it, and find out at the
   * packing bench. The audit found Upvan displaying "Sold out" on an in-stock
   * SKU and Kyari offering 399 of 428 without saying which 29 — so the honest
   * state has to be visible before the money is spent, and the button has to
   * refuse rather than warn.
   */
  const soldOut = item.stock <= 0

  const selected =
    item.ladder.find((l, i) => i === 0 && planterId === '') ??
    item.ladder[
      Math.max(
        0,
        item.planters.findIndex((p) => p.planterId === planterId),
      ) + 1
    ] ??
    item.ladder[0]!

  function add() {
    setAdding(true)
    try {
      // The cart is a client-side draft until checkout creates the order. Order
      // placement re-derives every price server-side from the SKU — a client
      // total is a display convenience, never an authority.
      const lines = mergeLines([
        ...readCart(),
        {
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
          planterName: planterId
            ? (item.planters.find((p) => p.planterId === planterId)?.name ?? null)
            : null,
          totalPaise: selected.totalPaise,
          quantity: clampQuantity(quantity),
          /*
           * The whole ladder, so "change the pot" works in the cart without a
           * catalogue fetch. Prices are already resolved here; the server
           * re-derives them at order time regardless.
           */
          planterOptions: [
            {
              planterId: '',
              name: 'Grow pot',
              totalPaise: item.ladder[0]!.totalPaise,
            },
            ...item.planters
              .filter((p) => p.upliftBp > 0)
              .map((p) => ({
                planterId: p.planterId,
                name: p.name,
                totalPaise:
                  item.ladder[0]!.totalPaise +
                  Math.ceil((item.ladder[0]!.totalPaise * p.upliftBp) / 10_000),
              })),
          ],
        },
      ])

      writeCart(lines)
      router.push('/cart')
    } finally {
      setAdding(false)
    }
  }

  if (soldOut) {
    return (
      <div>
        <p className="border-warning bg-surface-raised p-base rounded-md border">
          <strong>Sold out at the bench.</strong> We grow these ourselves, so a sold-out plant is
          genuinely gone rather than sitting in a warehouse. It usually comes back with the next
          batch — ask us and we will tell you when.
        </p>
        <button
          type="button"
          disabled
          className="border-border text-ink-muted mt-base w-full cursor-not-allowed rounded-sm border px-4 py-4 font-semibold"
        >
          Sold out
        </button>
        <p className="text-ink-muted mt-sm mb-0 text-sm">
          <a href="/contact" className="text-primary underline">
            Ask us to tell you when it is back →
          </a>
        </p>
      </div>
    )
  }

  return (
    <div>
      {item.planters.length > 0 && (
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
                <span className="block font-semibold">Grow pot</span>
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
                        active
                          ? 'border-primary bg-brand-soft'
                          : 'border-border hover:border-primary'
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
                      <span className="text-ink-muted mt-xs block text-sm">
                        The pot is worth {formatPaise(value)} more
                      </span>
                      <span className="block font-semibold">{formatPaise(total)}</span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </fieldset>
      )}

      <div className="mt-base gap-base flex items-center">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
            className="border-border hover:bg-brand-soft min-h-[44px] min-w-[44px] cursor-pointer rounded-l-sm border px-3 text-lg"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="border-border min-h-[44px] min-w-[3rem] border-y px-3 py-2.5 text-center font-semibold"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(item.stock, q + 1))}
            disabled={quantity >= item.stock}
            aria-label="One more"
            className="border-border hover:bg-brand-soft min-h-[44px] min-w-[44px] cursor-pointer rounded-r-sm border px-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={adding}
          className="bg-primary text-surface flex-1 cursor-pointer rounded-sm px-4 py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adding ? 'Adding…' : `Add to cart · ${formatPaise(selected.totalPaise * quantity)}`}
        </button>
      </div>

      {/*
        Availability as a fact, from the bench. `LOW_STOCK_THRESHOLD` is one named
        constant shared with the card, so "Only 3 left" means the same thing in
        every place it appears — and it never appears when there is no urgency,
        which is the point.
      */}
      {item.stock <= 5 && (
        <p role="status" className="text-clay mt-sm mb-0 text-sm">
          Only {item.stock} left at the bench. We do not restock from outside, so this is genuinely
          all there is.
        </p>
      )}

      <p className="text-ink-muted mt-sm mb-0 text-sm">
        Free delivery, no minimum. Prepaid only — we do not offer cash on delivery.
      </p>
    </div>
  )
}
