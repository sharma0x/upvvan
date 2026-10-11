import Link from 'next/link'

import { pageMetadata } from '@/app/metadata'
import { getPool } from '@/lib/db/pool'
import { getCustomerId } from '@/lib/auth/session'
import { formatPaise } from '@/lib/catalogue/pricing'

/**
 * Saved plants — the waitlist, and the thing a customer saved it for.
 *
 * ── WHY THIS PAGE IS SHOWN WHILE A PLANT IS OUT OF STOCK ─────────────────────
 *
 * Because a saved list that says "3 plants" with no other information is a list
 * you have to open and interpret. The one question a person on this page has is
 * "is it back yet", and `sku_stock.stock_on_hand` answers it without a request, a
 * message, or a human.
 *
 * That is the whole difference between a waitlist and a "contact us for stock"
 * form. The customer who has been waiting for four weeks should never have to
 * send the message that asks whether it has arrived.
 *
 * The session check is inherited from `src/app/account/layout.tsx`.
 */
export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  'Saved plants',
  'Plants you have saved. We will tell you when an out-of-stock one is back.',
  '/account/saved',
)

interface SavedRow {
  id: number
  name: string
  sizeTier: string | null
  slug: string | null
  note: string | null
  savedAt: Date
  onHand: number
  pricePaise: number | null
}

async function listSaved(customerId: string): Promise<SavedRow[]> {
  const { rows } = await getPool().query<{
    id: number
    common_name: string | null
    size_tier: string | null
    slug: string | null
    note: string | null
    created_at: Date
    stock_on_hand: string | null
    base_price_paise: string | null
  }>(
    /*
     * `sp."slug"`, not `s."slug"`.
     *
     * Slugs live on `species`. `skus` has no slug column — a SKU is a size tier of a
     * species in a city, so the page lives under the species and the price is per
     * SKU. Selecting `s."slug"` compiled fine, typechecked fine, and returned
     *
     *     column s.slug does not exist
     *
     * on the only request that ever hit it, which is a signed-in customer opening
     * their saved list. Unauthenticated, the page redirects before the query runs,
     * so the route was healthy for curl and every status-code sweep in the suite.
     * The whole page rendered as "This page did not load."
     *
     * `__tests__/saved-plants.db.test.ts` now runs this projection for real.
     */
    `SELECT w."id",
            sp."common_name",
            s."size_tier",
            sp."slug",
            w."note",
            w."created_at",
            st."stock_on_hand",
            s."base_price_paise"
       FROM "wishlists" w
       LEFT JOIN "skus" s     ON s."id" = w."sku_id"
       LEFT JOIN "species" sp ON sp."id" = s."species_id"
       LEFT JOIN "sku_stock" st ON st."sku_id" = s."id"
      WHERE w."better_auth_user_id" = $1
      ORDER BY (COALESCE(st."stock_on_hand", 0) > 0) DESC, w."created_at" DESC`,
    [customerId],
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.common_name ?? 'Plant',
    sizeTier: row.size_tier,
    slug: row.slug,
    note: row.note,
    savedAt: row.created_at,
    onHand: Number(row.stock_on_hand ?? 0),
    pricePaise: row.base_price_paise == null ? null : Number(row.base_price_paise),
  }))
}

export default async function SavedPlantsPage() {
  const customerId = await getCustomerId()
  const saved = customerId ? await listSaved(customerId) : []
  const inStock = saved.filter((row) => row.onHand > 0)

  return (
    <main>
      <h2 className="mb-xs mt-0">Saved plants</h2>
      <p className="text-ink-muted mt-0">
        Our catalogue changes with the season and a plant genuinely sells out. Save one and we will
        tell you when it returns — no need to ask.
      </p>

      {saved.length === 0 ? (
        <div className="border-border bg-surface-raised p-lg rounded-md border">
          <p className="mt-0">Nothing saved yet.</p>
          <p className="text-ink-muted mb-0">
            When a plant is out of stock its page has a &ldquo;tell me when it&rsquo;s back&rdquo;
            button. That is where the list builds.
          </p>
          <Link href="/plants" className="text-primary mt-base inline-block underline">
            Browse the catalogue
          </Link>
        </div>
      ) : (
        <>
          {inStock.length > 0 && (
            <p
              role="status"
              data-testid="saved-in-stock"
              className="border-success bg-success-soft p-base rounded-md border"
            >
              <strong>
                {inStock.length === 1
                  ? 'One of these is back'
                  : `${inStock.length} of these are back`}
              </strong>{' '}
              — {inStock.map((row) => row.name).join(', ')}.
            </p>
          )}

          <ul className="gap-sm mt-lg m-0 flex list-none flex-col p-0">
            {saved.map((row) => (
              <li key={row.id} className="border-border p-base rounded-md border">
                <div className="gap-sm flex flex-wrap items-baseline justify-between">
                  {row.slug ? (
                    <Link href={`/plant/${row.slug}`} className="text-primary font-semibold">
                      {row.name}
                      {row.sizeTier ? ` · ${row.sizeTier}` : ''}
                    </Link>
                  ) : (
                    <span className="font-semibold">{row.name}</span>
                  )}
                  <span
                    className={`text-label-caps ${
                      row.onHand > 0 ? 'text-success' : 'text-ink-muted'
                    }`}
                  >
                    {row.onHand > 0 ? 'Back in stock' : 'Out of stock'}
                  </span>
                </div>

                <p className="text-ink-muted mt-xs mb-0 text-sm">
                  {row.onHand > 0 && row.pricePaise !== null
                    ? `${formatPaise(row.pricePaise)} · `
                    : ''}
                  Saved{' '}
                  {new Intl.DateTimeFormat('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'Asia/Kolkata',
                  }).format(row.savedAt)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
