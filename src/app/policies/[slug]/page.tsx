import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadBusinessSettings } from '@/lib/settings/server'
import { findPolicy, POLICIES } from '@/lib/commerce/policies'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * A policy page — `/policies/[slug]`.
 *
 * ── WHY THE GUARANTEE WINDOW IS A PARAMETER AND NOT A STRING HERE ───────────
 *
 * Every section is a function of the price book's active tier. There is no
 * literal "48 hours" or "30 days" anywhere in `policies.ts`; the numbers come
 * from `loadPriceBookTerms`, which reads `price_books.active_guarantee_tier` and
 * applies the same flag gate the ORDER trigger applies.
 *
 * That last part is the one that matters. `orders_guarantee_tier_is_enabled()`
 * refuses to write an order at a tier the price book has not enabled — so if
 * this page rendered a raw `active_guarantee_tier` and that tier was disabled,
 * the page would promise something the schema would decline. `guaranteeTerms()`
 * applies the same gate, so the promise and the constraint agree by construction.
 *
 * The audit's worst finding in this category is Ugaoo shipping two contradictory
 * guarantee policies at once. This structure is the answer to it.
 */
export function generateStaticParams(): Array<{ slug: string }> {
  return POLICIES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const doc = findPolicy(slug)
  if (!doc) return { title: 'Not found' }
  return {
    title: doc.title,
    description: doc.standfirst,
    alternates: { canonical: `/policies/${doc.slug}` },
  }
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = findPolicy(slug)
  if (!doc) notFound()

  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading={doc.title} />

  const [{ terms }, settings] = await Promise.all([
    Promise.resolve(storefront),
    loadBusinessSettings(),
  ])
  const sections = doc.sections(
    {
      tierLabel: terms.terms.label,
      tierDays: terms.terms.days,
      tierSummary: terms.terms.summary,
      tierRemedy: terms.terms.remedy,
      arrivalWindowHours: terms.terms.arrivalWindowHours,
      freeDeliveryThresholdPaise: terms.freeDeliveryThresholdPaise,
      deliveryFeePaise: terms.deliveryFeePaise,
    },
    settings,
  )

  const siblings = POLICIES.filter((p) => p.slug !== doc.slug)

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs
        trail={[
          { href: '/', label: 'Home' },
          { href: '/policies', label: 'Policies' },
          { label: doc.title },
        ]}
      />

      <header className="mt-lg">
        <h1 className="mb-0">{doc.title}</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">{doc.standfirst}</p>
        <p className="text-ink-muted mt-sm text-sm">
          Last reviewed against the live price book for {storefront.cityName}.{' '}
          <a href="/contact" className="text-primary underline">
            Ask us anything this page did not answer
          </a>
          .
        </p>
      </header>

      {/*
        A table of contents, because these pages are long and a customer arriving
        from a search result wants the paragraph, not the scroll. Rendered as a
        `<nav>` with real anchors so it works with JavaScript disabled and so
        every entry is reachable by keyboard.
      */}
      <nav
        aria-label="On this page"
        className="border-border bg-surface-raised mt-xl p-base rounded-md border"
      >
        <h2 className="text-label-caps text-ink-muted mb-xs mt-0">On this page</h2>
        <ol className="gap-xs m-0 flex list-none flex-col p-0">
          {sections.map((section, i) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-primary text-sm underline">
                {section.heading}
              </a>
              {i < sections.length - 1 && <span className="sr-only">, then</span>}
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-2xl scroll-mt-lg">
          <h2 className="mt-0">{section.heading}</h2>

          {section.body?.map((paragraph, i) => (
            <p key={i} className="mt-sm">
              {paragraph}
            </p>
          ))}

          {section.points && (
            <ul className="mt-sm gap-xs flex list-none flex-col p-0">
              {section.points.map((point) => (
                <li
                  key={point}
                  className="before:bg-clay before:mr-sm before:mt-[0.6em] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full"
                >
                  {point}
                </li>
              ))}
            </ul>
          )}

          {/*
            A horizontally scrollable table on a phone, NOT a squeezed one.

            The remedy table has three columns of prose and a 390px viewport
            cannot hold them. `overflow-x-auto` keeps every cell legible and lets
            the container scroll, which is what a table with no layout choice
            should do. The alternative — hiding columns — removes exactly the
            information a customer on a phone most needs.
          */}
          {section.table && (
            <div className="border-border mt-sm overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {section.table.headers.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="bg-surface-raised text-ink border-border border-b px-3 py-2.5 text-left align-bottom font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) => (
                        <td
                          key={i}
                          className={`border-border text-ink-muted border-b px-3 py-2.5 align-top ${
                            i === 0 ? 'text-ink font-semibold' : ''
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {/*
        The siblings, as links. A policy page that is a dead end makes the reader
        open a new tab and guess the URL — and Upvan's audit finding is that a
        site with six policy pages and no links between them reads as though it
        has one.
      */}
      <nav aria-label="Other policies" className="border-border mt-3xl pt-base border-t">
        <h2 className="text-label-caps text-ink-muted mt-0">The other policies</h2>
        <ul className="gap-xs m-0 flex list-none flex-col p-0">
          {siblings.map((sibling) => (
            <li key={sibling.slug}>
              <a href={`/policies/${sibling.slug}`} className="text-primary underline">
                {sibling.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}
