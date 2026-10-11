import type { ReactNode } from 'react'

/**
 * Prose beside prose — a two-column editorial block.
 *
 * ── WHY THIS IS THE FIX AND NOT A WIDER PARAGRAPH ────────────────────────────
 *
 * The symptom was pages whose text sat entirely in the left column with the
 * right half of a 1120px container empty: `/gifting`, `/plants`, `/problems`,
 * `/blog`, `/collections/[handle]`, `/corporate`.
 *
 * The tempting fix is to widen the paragraph. That is wrong. DESIGN.md fixes the
 * readable measure at 68ch, and `.prose-upvvan` says the same: "68ch is where a
 * line of this typeface stops being scannable and starts being work." A 1120px
 * paragraph is roughly 110 characters of Georgia and genuinely hard to read.
 *
 * So the width has to be spent on a second column of text instead of on longer
 * lines. That is what this is: two measures side by side, which is also the
 * shape the homepage hero already uses (`Hero.tsx` runs `1.25fr 1fr`), so the
 * storefront now has one layout idea rather than two.
 *
 * ── WHY IT COLLAPSES TO ONE COLUMN ───────────────────────────────────────────
 *
 * Two 68ch columns need about 1400px. Below `lg` there is not that width, and a
 * 300px column of prose is worse than a single readable one, so this stacks.
 * The `gap` is the spacing token rather than a Tailwind arbitrary value so the
 * rhythm matches the rest of the page.
 *
 * ── WHY `items-start` ────────────────────────────────────────────────────────
 *
 * Without it, CSS grid stretches both columns to the height of the taller one
 * and a short left column gets a block of invisible padding under it, which
 * reads as a layout bug even though it is not one.
 */
export default function ProseSplit({
  children,
  reverse = false,
  className = '',
}: {
  /** Two blocks of prose. Rendered left-then-right unless `reverse`. */
  children: ReactNode
  /** Put the second block on the left. For pages where the aside leads. */
  reverse?: boolean
  className?: string
}) {
  const blocks = Array.isArray(children) ? children : [children]

  return (
    <div
      className={`gap-x-xl gap-y-base lg:grid lg:grid-cols-2 lg:items-start ${className}`}
    >
      {blocks.map((block, index) => (
        <div key={index} className={reverse && index === 1 ? 'lg:order-first' : undefined}>
          {block}
        </div>
      ))}
    </div>
  )
}

/**
 * The heading half of a `ProseSplit`.
 *
 * Extracted so the eyebrow/h1/lede rhythm is identical on every page that uses
 * the split. It was previously re-typed per page, which is how the gifting hero
 * ended up with a 22ch headline and the plants hero with an uncapped one.
 */
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  /** Small caps line above the title. Omit for pages without one. */
  eyebrow?: string
  title: string
  /** Optional lede paragraph, rendered under the title. */
  children?: ReactNode
}) {
  return (
    <>
      {eyebrow && <p className="text-label-caps text-clay m-0">{eyebrow}</p>}
      {/*
        `max-w-[20ch]` on the h1 is deliberate and is not the bug this module
        fixes. A display line set at h1 runs to four words per line at full
        width, and four words is a slogan rather than a heading. The measure
        belongs on the heading; what was wrong was applying it to the paragraph
        BELOW it while leaving 500px of container empty beside both.
      */}
      <h1 className="mt-xs mb-0 max-w-[20ch]">{title}</h1>
      {children}
    </>
  )
}