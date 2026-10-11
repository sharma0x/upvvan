import Link from 'next/link'

export interface PaginationProps {
  total: number
  page: number
  limit: number
  basePath: string
  pageSizeOptions?: readonly number[]
  nounSingle?: string
  nounPlural?: string
  extraParams?: Record<string, string | string[] | undefined>
}

/**
 * Accessible, production-grade pagination controls.
 * Supports page size switching (10, 25, 50) and numbered page navigation.
 */
export function Pagination({
  total,
  page,
  limit,
  basePath,
  pageSizeOptions = [10, 25, 50],
  nounSingle = 'item',
  nounPlural = 'items',
  extraParams = {},
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const startItem = total === 0 ? 0 : (currentPage - 1) * limit + 1
  const endItem = Math.min(total, currentPage * limit)

  function buildUrl(newPage: number, newLimit: number): string {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(extraParams)) {
      if (key === 'page' || key === 'limit') continue
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v)
      } else if (value !== undefined) {
        params.set(key, String(value))
      }
    }
    if (newPage > 1) params.set('page', String(newPage))
    if (newLimit !== 10) params.set('limit', String(newLimit))

    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Generate page numbers with ellipses for long lists
  const pageNumbers: (number | 'ellipsis')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    if (currentPage > 3) pageNumbers.push('ellipsis')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pageNumbers.push(i)
    if (currentPage < totalPages - 2) pageNumbers.push('ellipsis')
    pageNumbers.push(totalPages)
  }

  return (
    <nav
      aria-label="Pagination Navigation"
      className="border-border bg-surface-card mt-xl flex flex-wrap items-center justify-between gap-base rounded-md border p-base text-sm"
    >
      {/* Range summary */}
      <div className="text-ink-muted">
        Showing <span className="text-ink font-semibold">{startItem}</span>–
        <span className="text-ink font-semibold">{endItem}</span> of{' '}
        <span className="text-ink font-semibold">{total}</span>{' '}
        {total === 1 ? nounSingle : nounPlural}
      </div>

      <div className="flex flex-wrap items-center gap-base">
        {/* Page size controls (10, 25, 50) */}
        <div className="flex items-center gap-xs">
          <span className="text-ink-muted text-xs">Per page:</span>
          {pageSizeOptions.map((size) => {
            const isActive = size === limit
            return (
              <Link
                key={size}
                href={buildUrl(1, size)}
                className={`min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-sm px-2 text-xs font-semibold no-underline transition-colors ${
                  isActive
                    ? 'bg-primary text-surface font-bold'
                    : 'border-border bg-surface hover:bg-surface-raised text-ink border'
                }`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${size} items per page`}
              >
                {size}
              </Link>
            )
          })}
        </div>

        {/* Page Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-xs">
            {/* Previous button */}
            {currentPage > 1 ? (
              <Link
                href={buildUrl(currentPage - 1, limit)}
                className="border-border bg-surface hover:bg-surface-raised text-ink inline-flex min-h-[36px] items-center rounded-sm border px-3 text-sm font-semibold no-underline"
                aria-label="Previous page"
              >
                ← Prev
              </Link>
            ) : (
              <span
                className="border-border text-ink-muted/50 inline-flex min-h-[36px] items-center rounded-sm border px-3 text-sm cursor-not-allowed opacity-50"
                aria-hidden="true"
              >
                ← Prev
              </span>
            )}

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {pageNumbers.map((p, index) => {
                if (p === 'ellipsis') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="text-ink-muted px-1.5"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  )
                }

                const isActive = p === currentPage
                return (
                  <Link
                    key={p}
                    href={buildUrl(p, limit)}
                    className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-sm px-2 font-semibold no-underline transition-colors ${
                      isActive
                        ? 'bg-primary text-surface font-bold'
                        : 'border-border bg-surface hover:bg-surface-raised text-ink border'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`Page ${p}`}
                  >
                    {p}
                  </Link>
                )
              })}
            </div>

            {/* Next button */}
            {currentPage < totalPages ? (
              <Link
                href={buildUrl(currentPage + 1, limit)}
                className="border-border bg-surface hover:bg-surface-raised text-ink inline-flex min-h-[36px] items-center rounded-sm border px-3 text-sm font-semibold no-underline"
                aria-label="Next page"
              >
                Next →
              </Link>
            ) : (
              <span
                className="border-border text-ink-muted/50 inline-flex min-h-[36px] items-center rounded-sm border px-3 text-sm cursor-not-allowed opacity-50"
                aria-hidden="true"
              >
                Next →
              </span>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
