/**
 * The ops console links, shown at the top of the admin sidebar.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The admin panel and the ops console are two different applications:
 *
 *   /admin        Payload — products, stock, prices, cities, settings, contacts
 *   /admin-ops    the delivery desk — today's shift, the assign queue, the board
 *
 * And until this component existed, NOTHING CONNECTED THEM. Neither linked to the
 * other. So the person asking "where do I see my orders, and where do I assign a
 * delivery partner" had to already know an unadvertised URL — which is precisely
 * the kind of thing a founder concludes means "the software does not do this".
 *
 * The two stay separate for good reasons: the panel is CRUD and needs roles and
 * auth, while the console is a shift view built around zones, distance bands and
 * a day's work. But somebody who has signed in to the admin panel is staff by
 * definition, and staff should be able to get from one to the other in one click.
 *
 * Rendered ABOVE the collection list rather than buried in settings, because the
 * question is asked at the start of a shift, not while configuring something.
 *
 * Plain anchors, not `next/link`. This renders inside Payload's own client-side
 * router, which is not Next's — and a `next/link` here would hand the admin panel
 * a navigation handler it does not have.
 *
 * The parameter exists only to satisfy Payload's `CustomComponent` type. It is
 * underscore-prefixed because it is genuinely unused, and this repo's lint rule
 * requires that prefix rather than an outright omission.
 */
/*
 * A plain default-exported component, referenced from `payload.config.ts` BY
 * PATH rather than by import.
 *
 * Two attempts got this wrong before the third worked, and the reason is worth
 * writing down: Payload's `afterNavLinks` does not take a component. It takes a
 * `PayloadComponent`, which is `false | string | { path, exportName?, … }` — a
 * POINTER that Payload resolves through its import map. Passing a function type-
 * checks as a hard error, which is the good outcome; the dangerous version would
 * have been a cast that silently rendered nothing in the sidebar.
 *
 * Because it is resolved through the import map, adding this file means
 * `make generate-importmap` has to run — see AGENTS.md, where that path is
 * already documented as costing hours when it is wrong.
 */
function OpsConsoleLinks() {
  const link = {
    display: 'block',
    padding: '0.5rem 0.75rem',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-100)',
    fontSize: 13,
    lineHeight: 1.35,
    textDecoration: 'none',
  } as const

  return (
    <div style={{ margin: '0 0 1.5rem', padding: '0 1rem' }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        Delivery desk
      </p>
      <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
        {[
          { href: '/admin-ops', label: 'Today’s shift' },
          { href: '/admin-ops/queue', label: 'Assign queue — orders with no rider' },
          { href: '/admin-ops/board', label: 'Dispatch board — live drops' },
        ].map((item) => (
          <li key={item.href} style={{ margin: '0 0 0.35rem' }}>
            <a href={item.href} style={link}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <p style={{ margin: '0.75rem 0 0', fontSize: 11, lineHeight: 1.4, opacity: 0.6 }}>
        Riders open <a href="/rider">/rider</a> on their own phone — no account, an OTP goes to the
        number on the rider record.
      </p>
    </div>
  )
}

export default OpsConsoleLinks
