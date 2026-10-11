/**
 * A FAQ list, rendered with native `<details>`.
 *
 * ── WHY `<details>` AND NOT A STATEFUL ACCORDION ────────────────────────────
 *
 * Three reasons, in order of how much they matter:
 *
 *   1. IT WORKS WITHOUT JAVOSCRIPT. Every question is in the HTML. A client-side
 *      accordion renders nothing until React hydrates, which means the content is
 *      invisible to a crawler that does not execute JavaScript and to a customer
 *      on a slow connection — and this is precisely the failure the audit found at
 *      Upvan, which had five good Q&As trapped in a hydration-dependent accordion.
 *
 *   2. THE ANSWER IS IN THE DOM, so it is searchable. `Ctrl-F` finds "48 hours"
 *      on an open accordion and does not on a closed one.
 *
 *   3. IT IS ACCESSIBLE FOR FREE. `details`/`summary` is a button with
 *      `aria-expanded` maintained by the browser, keyboard-operable, and announced
 *      correctly. Re-implementing that with buttons and `aria-expanded` is a
 *      hundred lines and a class of bug.
 *
 * `name` on the `<details>` makes the group exclusive — only one open at a time —
 * which is native in modern browsers and is why a second stateful component is not
 * needed.
 */
export interface FaqEntry {
  group: string
  q: string
  a: string
  href?: string
}

export default function FaqAccordion({ entries }: { entries: FaqEntry[] }) {
  return (
    <div className="mt-base flex flex-col">
      {entries.map((entry) => (
        <details
          key={entry.q}
          // Exclusive: opening one closes its siblings. `name` is a native HTML
          // attribute, so there is no React state to keep in sync.
          name={`faq-${entry.group.toLowerCase()}`}
          className="border-border group border-b py-1"
        >
          <summary className="hover:text-primary gap-base flex min-h-[44px] cursor-pointer list-none items-center justify-between py-2 font-semibold">
            <span>{entry.q}</span>
            {/*
              The chevron, drawn in CSS rather than an icon component.

              An SVG here would be an extra dependency, a `aria-hidden` to remember,
              and a `rotate` transition to animate. `::after` on the summary needs
              none of that, and because it lives on `group-open` it cannot get out of
              step with the open state — which a JS-driven icon always eventually
              does.
            */}
            <span
              aria-hidden
              className="text-ink-muted shrink-0 transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="text-ink-muted pb-base">
            <p className="mt-0">{entry.a}</p>
            {entry.href && (
              <p className="mt-sm mb-0">
                <a href={entry.href} className="text-primary underline">
                  Read the full thing
                </a>
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}
