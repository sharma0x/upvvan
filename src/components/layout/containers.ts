/**
 * Page containers.
 *
 * ── WHY THESE EXIST RATHER THAN A UTILITY CLASS ───────────────────────────────
 *
 * Every page used to hand-write `mx-auto max-w-[1120px]` and then, separately,
 * hand-write `max-w-[62ch]` on the prose inside it. Nothing connected the two
 * numbers, so a page could pair a 1120px container with a 620px paragraph and
 * ship a page whose right-hand third was permanently empty. That is exactly what
 * happened on `/gifting`, `/plants`, `/problems`, `/blog` and the rest, and it
 * is a defect no test caught because every one of those pages returned 200 with
 * correct text — the text was simply crammed into the left half.
 *
 * The pairing is the whole point, so it lives here as data rather than as prose in
 * a component file that the next page will not read.
 */

/**
 * Wide container — storefront surfaces that hold a grid.
 *
 * 1120px is the DESIGN.md storefront measure: "the storefront widens to 1120px
 * with a two-column hero, because it is browsing rather than deciding, and
 * browsing in a 640px column is a list, not a shop."
 *
 * A page that uses this width owes the reader a second column. That is what
 * `ProseSplit` is for.
 */
export const WIDE = 'px-base mx-auto max-w-[1120px]'

/**
 * Prose container — pages that are a column of words.
 *
 * 760px is roughly 68ch at the body size, which is the measure DESIGN.md and
 * `.prose-upvvan` both treat as the point where a line stops being scannable and
 * starts being work. Below this, paragraphs are unreadable; above it, they are
 * two hard returns of nothing in particular.
 *
 * `about`, `faq` and `policies` were already on this width and are the reference
 * for what a prose page is supposed to look like.
 */
export const PROSE = 'px-base mx-auto max-w-[760px]'

/**
 * Form container — a single decision with fields attached.
 *
 * 880px, not 640px. The coverage checker is 640px because it asks one question;
 * a checkout, a quote form or a claim form has labelled fields with help text
 * under them, and at 640px those help lines wrap to three rows each. A form that
 * wraps its own labels is a form that has been made harder to use by choosing the
 * prettier number.
 */
export const FORM = 'px-base mx-auto max-w-[880px]'

/**
 * Narrow container — one question, one answer.
 *
 * The coverage checker and the grievance form. DESIGN.md is explicit that a
 * wider layout here "would imply there is more to decide".
 */
export const NARROW = 'px-base mx-auto max-w-[640px]'

/**
 * Prose measure for a single text block.
 *
 * Only ever used INSIDE a prose or form container, or as the left column of a
 * `ProseSplit`. A `ch` measure inside a wide container is the bug this module
 * exists to prevent — see `layout/__tests__/measure.test.ts`.
 */
export const MEASURE = 'max-w-[68ch]'