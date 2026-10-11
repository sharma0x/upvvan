/**
 * The draft cart — one reader, one writer, one key.
 *
 * ── WHY THIS IS A MODULE AND NOT CODE IN THE COMPONENTS ─────────────────────
 *
 * Two client components read `upvvan.cart` from sessionStorage, one wrote it,
 * and they did not agree:
 *
 *   · `AddToCart` pushed a row with no `quantity` field, so adding the same
 *     plant twice produced two identical rows each showing its own single-unit
 *     price. Two rows, two "₹299" figures, and a total that was silently double.
 *
 *   · `SiteHeader` counted `lines.length` while `CartClient` read the same array
 *     and rendered a total. A corrupt value crashed the header and was caught;
 *     a removed line left the badge stale until a hard refresh, because nothing
 *     told the header anything had changed.
 *
 * The three failure modes are all "two places hold the same fact". So there is
 * one shape, one key, one parse that cannot throw, and one write.
 *
 * ── WHY sessionStorage AND NOT A SERVER BASKET ──────────────────────────────
 *
 * Deliberate. A server-side basket means an anonymous session table, a cookie,
 * a merge strategy on sign-in, and a sweep for abandoned rows — for a catalogue
 * where the server re-derives every price at order time anyway. The order is the
 * record that matters; the thing before it is a draft.
 *
 * The cost is that the cart does not follow you across devices. That is
 * acceptable precisely because we never require an account to buy, which the
 * audit identifies as the thing we most want to avoid.
 */
export const CART_KEY = 'upvvan.cart'

/** One planter option, carried so the cart can change pots without a refetch. */
export interface CartPlanterOption {
  planterId: string
  name: string
  totalPaise: number
}

export interface CartLine {
  skuId: string
  slug: string
  commonName: string
  sizeTier: string
  /**
   * Display only — which remedy applies. Absent on carts written before this
   * field existed, hence the fallback at every read site. The server re-derives
   * item class from the SKU when it places the order; this is never authority.
   */
  itemClass?: 'plant' | 'planter' | 'consumable'
  planterId: string | null
  /** The planter's display name, so the cart does not need a catalogue fetch. */
  planterName: string | null
  totalPaise: number
  quantity: number
  /** The full pot ladder for this SKU, so "change the pot" works in the cart. */
  planterOptions?: CartPlanterOption[]
}

/** Above this we assume the value is not our cart. */
const MAX_LINES = 100

/** Above this a single quantity is a mistake or an attack, not a plant order. */
const MAX_QUANTITY = 50

/**
 * Read the draft cart. Never throws.
 *
 * Every caller is a render path — the header, the cart page, checkout — and a
 * corrupt value must degrade to an empty cart rather than a white screen. The
 * individual lines are validated too, not just the array: a hand-edited or
 * half-written row would otherwise reach `formatPaise` as a string.
 */
export function readCart(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    /*
     * NORMALISED, not merely validated.
     *
     * `isCartLine` accepts a row with no `quantity` — carts written before the
     * field existed must not be discarded — but that row then reaches
     * `line.totalPaise * line.quantity` as `NaN`, and `formatPaise` throws
     * `PricingError: Cannot format non-integer paise: NaN` inside a render. That
     * is a whole-page crash from a stored value, which is the worst possible
     * place for one.
     *
     * So every field the rest of the app reads is filled in here, once, at the
     * boundary. A consumer of `readCart` can assume the shape is complete, which
     * is the entire reason this module exists.
     */
    return parsed
      .filter(isCartLine)
      .slice(0, MAX_LINES)
      .map((line) => ({
        ...line,
        quantity: clampQuantity(line.quantity ?? 1),
        planterId: line.planterId ?? null,
        planterName: line.planterName ?? null,
        totalPaise: line.totalPaise,
        planterOptions: Array.isArray(line.planterOptions)
          ? line.planterOptions.filter(
              (o): o is CartPlanterOption =>
                typeof o?.planterId === 'string' &&
                typeof o?.name === 'string' &&
                Number.isInteger(o?.totalPaise),
            )
          : undefined,
      }))
  } catch {
    return []
  }
}

/** Replace the draft cart. */
export function writeCart(lines: CartLine[]): void {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(lines))
  } catch {
    /*
     * Safari in private mode throws on `setItem`, and a full quota throws on
     * anything. Neither is worth crashing a cart over: the customer's next
     * interaction re-reads an empty cart and they re-add. The alternative —
     * showing an error — turns a working session into a support ticket.
     */
  }
}

export function clearCart(): void {
  try {
    sessionStorage.removeItem(CART_KEY)
  } catch {
    // See `writeCart`.
  }
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

export function cartTotalPaise(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.totalPaise * l.quantity, 0)
}

/**
 * Collapse duplicate SKUs.
 *
 * `AddToCart` adds a row per click. Before quantity controls existed that
 * produced two identical rows; merging on the way in means a double-click gives
 * quantity 2, which is what the customer meant, and the lines list stays one row
 * per plant.
 */
export function mergeLines(lines: CartLine[]): CartLine[] {
  const out: CartLine[] = []
  for (const line of lines) {
    /*
     * The pot is part of the identity: the same plant in the grow pot and the
     * same plant in a ceramic pot are two decisions and two prices. Merging
     * across planters would silently change which pot the customer picked.
     */
    const key = `${line.skuId}:${line.planterId ?? ''}`
    const existing = out.find((l) => `${l.skuId}:${l.planterId ?? ''}` === key)
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + line.quantity)
    } else {
      out.push({ ...line })
    }
  }
  return out
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(value)))
}

/**
 * Is this plausibly one of our rows?
 *
 * Explicit rather than a cast. The value came out of sessionStorage, which is
 * as trustworthy as a query string — and a `totalPaise` that is not a positive
 * integer would reach `formatPaise`, which throws `PricingError` on a
 * non-integer. That is a crash in a render, triggered by a stored value.
 */
function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const line = value as Record<string, unknown>
  const quantity = line.quantity ?? 1

  return (
    typeof line.skuId === 'string' &&
    typeof line.slug === 'string' &&
    typeof line.commonName === 'string' &&
    typeof line.sizeTier === 'string' &&
    typeof line.totalPaise === 'number' &&
    Number.isInteger(line.totalPaise) &&
    line.totalPaise >= 0 &&
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity > 0
  )
}
