import { NextResponse } from 'next/server'
import { loadStorefront } from '@/lib/commerce/storefront.server'
import { rowsFor } from '@/lib/catalogue/query.server'
import { leadImagesForItems, type PlantImage } from '@/lib/catalogue/images'
import { batchOf, clampBatchSize, clampOffset } from '@/lib/catalogue/paging'
import type { CatalogueItem } from '@/lib/catalogue/loader.server'

/**
 * GET /api/catalogue — one more batch of product cards.
 *
 * This is what "Show more" presses.
 *
 * ── WHY IT REUSES `rowsFor` INSTEAD OF REIMPLEMENTING THE FILTERS ────────────
 *
 * Six grid routes filter the catalogue six different ways, and the API has to
 * reproduce whichever one the shopper is on. A second implementation of those
 * predicates would drift from the page within a week, and the visible symptom is
 * the worst kind: the page keeps two orderings and starts repeating plants.
 *
 * So this route owns no filtering logic at all. It calls `loadStorefront()` and
 * `rowsFor()` — the exact functions the page called — and slices.
 *
 * ── WHY ART COMES BACK WITH THE BATCH ────────────────────────────────────────
 *
 * `leadImagesForItems` de-duplicates photographs across a whole grid, so two
 * adjacent cards never show the same plant. A client that resolved art itself would
 * produce a grid with duplicates the moment a second batch appeared, because it
 * cannot see the images already on the page.
 *
 * So the client sends back the image indexes it has already displayed (`taken`) and
 * the server resolves around them. The invariant that the original `ItemGrid` exists
 * to protect is now preserved across batches, not just within one.
 */
export const dynamic = 'force-dynamic'

interface BatchResponse {
  items: Array<CatalogueItem & { art: PlantImage | null }>
  total: number
  offset: number
  limit: number
  page: number
  totalPages: number
  hasMore: boolean
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const pageParam = url.searchParams.get('page')
  const limitParam = url.searchParams.get('limit')
  const limit = clampBatchSize(limitParam ? Number(limitParam) : undefined)

  let offset: number
  if (pageParam !== null) {
    const pageNum = Math.max(1, Number(pageParam) || 1)
    offset = clampOffset((pageNum - 1) * limit)
  } else {
    offset = clampOffset(Number(url.searchParams.get('offset') ?? 0))
  }

  const currentPage = Math.floor(offset / limit) + 1

  /*
   * `taken` is the image indexes the client is already showing, sent so this batch
   * picks different photographs. It is bounded and coerced: a hand-edited
   * `?taken=` of a million entries must not become a million filesystem probes.
   */
  const taken = (url.searchParams.get('taken') ?? '')
    .split(',')
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .slice(0, 500)

  try {
    const storefront = await loadStorefront()

    if (storefront.state === 'no-city') {
      return NextResponse.json({
        items: [],
        total: 0,
        offset,
        limit,
        page: currentPage,
        totalPages: 0,
        hasMore: false,
      })
    }

    const rows = rowsFor(storefront, url.searchParams)
    const batch = batchOf(rows, offset, limit)
    const totalPages = Math.ceil(batch.total / limit)

    // Keyed by skuId, exactly as `resolveArt` does on the page. Keying by slug —
    // as the first version of this did — hands two size tiers of one species the
    // same photograph, which is the precise thing the art module exists to prevent.
    const art = leadImagesForItems(batch.items, new Set(taken))

    const body: BatchResponse = {
      items: batch.items.map((item) => ({ ...item, art: art.get(item.skuId) ?? null })),
      total: batch.total,
      offset: batch.offset,
      limit,
      page: currentPage,
      totalPages,
      hasMore: batch.hasMore,
    }

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    /*
     * Never leak the message. A missing column here arrives as Postgres internals
     * — `column s.slug does not exist` — and this response feeds a customer-facing
     * button, so the wording has to be ours. The real error goes to the log.
     */
    console.error('[catalogue] batch failed:', error)
    return NextResponse.json({ error: 'We could not load more plants just now.' }, { status: 500 })
  }
}
