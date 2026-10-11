import Link from 'next/link'

/**
 * Breadcrumbs.
 *
 * ── WHY THIS IS A NAV AND NOT A LIST ───────────────────────────────────────
 *
 * A `<ol>` of links styled as text is the pattern, because the ordering is
 * information — a customer looking at "Low light" needs to know it is under
 * "Plants" and not a peer of it. A `<ul>` cannot carry that, and screen readers
 * announce list position inconsistently.
 *
 * `aria-current="page"` on the last item is what tells a screen-reader user they
 * have arrived, rather than inferring it from the absence of a link.
 *
 * ── WHY THE SEPARATOR IS DECORATIVE ─────────────────────────────────────────
 * A `/` between items is punctuation, not content. A screen reader announcing
 * "home slash plants slash low light" is noise. `aria-hidden` on the separator
 * and a `VisuallyHidden` "current page" label do the work instead.
 */
export default function Breadcrumbs({
  trail,
}: {
  /** Last entry is the current page and is rendered as text, not a link. */
  trail: Array<{ href?: string; label: string }>
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-ink-muted gap-xs m-0 flex list-none flex-wrap items-center p-0 text-sm">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="gap-xs flex items-center">
              {index > 0 && (
                <span aria-hidden className="opacity-60">
                  /
                </span>
              )}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="text-primary no-underline hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-ink">
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
