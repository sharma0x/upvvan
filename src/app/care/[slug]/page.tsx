import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { imagesForSpecies } from '@/lib/catalogue/images'
import { loadPostsForSpecies } from '@/lib/content/posts.server'
import { formatPaise } from '@/lib/catalogue/pricing'
import { stockBadge } from '@/lib/catalogue/facets'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * A per-species care guide — `/care/[slug]`.
 *
 * ── WHY THIS IS A PAGE AND NOT A SECTION OF THE PDP ────────────────────────
 *
 * Kyari has ~40 of these and Ugaoo embeds a care widget on the product page.
 * Embedding is the mistake: the care content is the thing that ranks, and content
 * that only exists on a product URL ranks for the product name and nothing else.
 * A customer typing "why are the leaves on my zz plant turning brown" is not
 * looking for a shop.
 *
 * So the guide is its own URL, and the PDP links to it and carries a summary of
 * the same data. The data is ONE record — `species.care` and
 * `species.careGuide` — read by both, so they cannot disagree.
 *
 * ── THE SEVEN HEADINGS ──────────────────────────────────────────────────────
 * Light · Water · Humidity · Temperature · Food · Toxicity · Additional. That is
 * Bloomscape's ACF structure verbatim, and it is worth copying for a specific
 * reason: each heading is a SEARCH TERM. Somebody googles "zz plant humidity
 * India". A blob of prose called "care instructions" matches nothing.
 *
 * ── WHY WATER IS A SOIL-MOISTURE FIGURE AND NOT A CALENDAR ──────────────────
 * The most transferable mechanic in the whole category. Bloomscape writes "water
 * when the top 50–75% of the soil is dry" because that is testable — you can
 * check it with a finger. "Water weekly" is neither testable nor correct in a
 * Bengaluru flat with an AC running, where a plant in a plastic pot can be dry in
 * four days in April and wet for a week in August.
 *
 * Both numbers appear, always: the interval AND the target. The interval is what
 * a customer remembers, the target is what tells them whether to trust it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return { title: 'Care guide' }

  // The first tier is the guide's subject; size changes the numbers, not the care.
  const item = storefront.items.find((i) => i.slug === slug && i.itemClass === 'plant')
  if (!item) return { title: 'Care guide not found' }

  const description =
    item.summary ??
    `${item.commonName} (${item.botanicalName ?? ''}) — light, water, humidity, temperature and feeding for an Indian home. Water every ${item.care.waterIntervalDays} days.`.trim()

  return {
    title: `${item.commonName} care guide`,
    description,
    alternates: { canonical: `/care/${item.slug}` },
    openGraph: { title: `${item.commonName} care guide`, description, type: 'article' },
  }
}

export default async function CareGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Care guide" />

  /*
   * The smallest tier, deliberately.
   *
   * The care guidance is a property of the SPECIES. A big ZZ plant and a small
   * one want the same water target and the same light; what differs is how much
   * water and how fast it dries, and that is a sentence of nuance rather than a
   * different guide. So the guide is written once per species and the PDP shows
   * the same content with the tier's own interval.
   */
  const tiers = storefront.items.filter((i) => i.slug === slug && i.itemClass === 'plant')
  const item = tiers.find((t) => t.sizeTier === 'XS') ?? tiers[0]
  if (!item) notFound()

  const related = await loadPostsForSpecies(slug)
  const gallery = imagesForSpecies(slug).slice(0, 6)
  const badge = stockBadge(item.stock)
  const cheapest = Math.min(...tiers.map((t) => t.ladder[0]!.totalPaise))

  /*
   * The seven headings. Each renders ONLY if the grower wrote it — a section
   * with a heading and nothing under it is worse than a missing section, because
   * it advertises an answer the page does not contain.
   */
  const sections: Array<{ heading: string; body: string | null; note?: string }> = [
    {
      heading: 'Light',
      body: item.care.guide.light,
      note: `Requirement on our records: ${item.care.light.replace(/_/g, ' ')}.`,
    },
    {
      heading: 'Water',
      body: item.care.guide.water,
      note: `Every ${item.care.waterIntervalDays} days at average indoor conditions, and hold the soil at about ${item.care.soilMoistureTargetPct}% moisture. Check the soil rather than the calendar.`,
    },
    { heading: 'Humidity', body: item.care.guide.humidity },
    { heading: 'Temperature', body: item.care.guide.temperature },
    { heading: 'Food', body: item.care.guide.feeding },
    {
      heading: 'Toxicity',
      body:
        item.care.toxicity === 'safe'
          ? 'Non-toxic to cats, dogs and children if a leaf is chewed. We verify this claim at the bench before a species may be listed as safe — the database refuses the label without a dated check.'
          : item.care.toxicity === 'pets'
            ? 'Toxic to cats and dogs if eaten. Keep it out of reach, and put it where a curious animal cannot get at it rather than trusting a high shelf.'
            : 'Toxic if eaten. Keep it away from children and small hands, and wash your hands after repotting.',
      note:
        item.care.toxicity === 'safe'
          ? undefined
          : 'Toxic if eaten does not mean dangerous — it means not for a surface within reach of a mouth.',
    },
    { heading: 'Additional care', body: item.care.guide.additional },
  ].filter((section) => section.body !== null && section.body !== '')

  const faq = [
    {
      q: `How often should I water a ${item.commonName.toLowerCase()}?`,
      a: `Every ${item.care.waterIntervalDays} days at average indoor conditions — but treat that as a hint rather than an instruction. Check the soil: if the top 40% still feels damp, wait. In a Bengaluru April with an AC running, that interval can be four days; in August with the monsoon going, it can be twelve.`,
    },
    {
      q: `Can a ${item.commonName.toLowerCase()} live in a room with no window?`,
      a:
        item.care.light === 'low'
          ? 'Yes, and this is one of the plants we would put in one. It will grow more slowly than it would in better light — usually visibly so — but it will not decline the way a bright-light plant does. Expect a few new leaves a year rather than a few a month.'
          : 'Honestly, not well. It will survive for a few months and then decline, and it is not worth selling you one for a room that cannot support it. If the windowless room is the situation, the plants on our low-light collection are the ones we would put there instead.',
    },
    {
      q: 'Is it safe around a cat?',
      a:
        item.care.toxicity === 'safe'
          ? 'Yes — it is listed non-toxic, and that claim is verified at the bench rather than assumed. Non-toxic means a nibbled leaf will not harm your pet; it does not mean your cat will enjoy it.'
          : 'No. It is listed as toxic to pets, so keep it out of reach. If you need something for the same spot that a cat cannot poison itself on, our pet-safe collection is the place to look.',
    },
    {
      q: 'What actually arrives in the box?',
      a: item.benchNote,
    },
    {
      q: 'Is it covered if it dies?',
      a: `Yes, within the guarantee window on your order. Send a photo on WhatsApp and we replace it — you do not ship anything back. ${item.benchNote}`,
    },
  ].filter((entry) => entry.a)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  }

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs
        trail={[
          { href: '/', label: 'Home' },
          { href: '/plants', label: 'Plants' },
          { label: `${item.commonName} care guide` },
        ]}
      />

      <header className="mt-lg">
        <p className="text-label-caps text-clay m-0">Care guide</p>
        <h1 className="mt-xs mb-0">{item.commonName}</h1>
        {item.botanicalName && (
          <p className="text-ink-muted mt-xs mb-0 text-[1.05rem] italic">{item.botanicalName}</p>
        )}
        {item.summary && <p className="mt-sm mb-0 text-[1.05rem]">{item.summary}</p>}
      </header>

      {/*
        The gallery, from the photographs already on disk for this species.

        Every species has 8–9 images and the grid used ONE per card, so this was
        the single largest unused asset on the site. A customer deciding whether a
        plant is right wants to see what variation to expect, and one photograph
        cannot show variation — which is also how "it looked nothing like the
        photo" complaints start.
      */}
      {gallery.length > 1 && (
        <div className="border-border mt-lg gap-sm grid grid-cols-2 overflow-hidden rounded-md border sm:grid-cols-3">
          {gallery.map((image, index) => (
            <div key={image.src} className="bg-surface-raised relative aspect-square">
              <Image
                src={image.src}
                alt={
                  index === 0
                    ? `${item.commonName} (${item.botanicalName ?? 'plant'})`
                    : `${item.commonName}, another plant from the same batch`
                }
                fill
                priority={index === 0}
                sizes="(max-width: 640px) 50vw, 240px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/*
        THE WHAT-ARRIVES BLOCK.

        The most important paragraph on the site, and the one the audit says the
        category is worst at. FNP customers report 3×3-inch pots against a declared
        4×4; Bloomscape's Trustpilot is dominated by "I don't think they have
        plants in the sizes they're selling them"; Hey Rooted's defence is "all
        measurements are shown as a range".

        We show a range AND a minimum AND the pot it arrives in. That is the
        whole fix, and it costs one field that a migration requires to be at
        least 40 characters — long enough that "a nice healthy plant" cannot be
        written into it.
      */}
      {item.benchNote && (
        <section className="border-primary bg-brand-soft mt-lg p-lg rounded-md border">
          <h2 className="mt-0 text-[1.1rem]">What actually arrives</h2>
          <p className="mb-0">{item.benchNote}</p>
        </section>
      )}

      {/*
        The quick reference. Four numbers, in a `<dl>` because it is a set of
        labelled values and not a sentence — a `<ul>` of facts announces as a list
        of items with no labels, which is the information a customer actually needs.
      */}
      <section className="mt-2xl">
        <h2 className="mt-0">The short version</h2>
        <dl className="border-border gap-base p-base m-0 grid grid-cols-2 rounded-md border sm:grid-cols-4">
          <div>
            <dt className="text-label-caps text-ink-muted">Light</dt>
            <dd className="m-0 font-semibold capitalize">{item.care.light.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Water every</dt>
            <dd className="m-0 font-semibold">{item.care.waterIntervalDays} days</dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Soil moisture</dt>
            <dd className="m-0 font-semibold">{item.care.soilMoistureTargetPct}%</dd>
          </div>
          <div>
            <dt className="text-label-caps text-ink-muted">Difficulty</dt>
            <dd className="m-0 font-semibold capitalize">{item.care.difficulty}</dd>
          </div>
        </dl>
      </section>

      {/*
        The seven headings, rendered as a `<dl>` so each heading is programmatically
        associated with its text. `<section>` + `<h2>` + `<p>` announces the same
        way to a screen reader and is simpler; `<dl>` is used where the values are
        genuinely key-value pairs, which is the short version above.
      */}
      <div className="mt-2xl">
        {sections.map((section) => (
          <section key={section.heading} className="border-border pb-lg border-b">
            <h2 className="mt-0">{section.heading}</h2>
            <p className="mt-xs mb-0">{section.body}</p>
            {section.note && (
              <p className="text-ink-muted mt-sm mb-0 text-sm">
                <strong>On our records:</strong> {section.note}
              </p>
            )}
          </section>
        ))}
      </div>

      {/*
        The cross-links INTO the problem library.

        This is the mechanism that makes the symptom library rank: the page a
        worried customer lands on links out to it, and it links back. Neither page
        exists in isolation and both are findable from the other.
      */}
      {related.length > 0 && (
        <section className="mt-2xl">
          <h2 className="mt-0">If something goes wrong with it</h2>
          <ul className="mt-sm gap-xs m-0 flex list-none flex-col p-0">
            {related.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-primary inline-flex min-h-[44px] items-center underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-2xl">
        <h2 className="mt-0">Questions about this plant specifically</h2>
        <div className="mt-sm">
          <details name={`faq-care-${slug}`} className="border-border border-b py-1">
            <summary className="hover:text-primary gap-base flex min-h-[44px] cursor-pointer list-none items-center justify-between py-2 font-semibold">
              <span>{faq[0]!.q}</span>
              <span aria-hidden className="text-ink-muted shrink-0">
                +
              </span>
            </summary>
            <p className="text-ink-muted pb-base mt-0">{faq[0]!.a}</p>
          </details>
          {faq.slice(1).map((entry) => (
            <details
              key={entry.q}
              name={`faq-care-${slug}`}
              className="border-border group border-b py-1"
            >
              <summary className="hover:text-primary gap-base flex min-h-[44px] cursor-pointer list-none items-center justify-between py-2 font-semibold">
                <span>{entry.q}</span>
                <span
                  aria-hidden
                  className="text-ink-muted shrink-0 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-ink-muted pb-base mt-0">{entry.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/*
        The buy block. A care guide with no route to a purchase is content, and
        content that does not convert is a cost centre. It carries the CURRENT
        stock state, the honest cheapest price, and the sold-out path.
      */}
      <section className="border-border bg-surface-raised mt-3xl p-lg rounded-md border">
        {badge?.tone === 'out' ? (
          <>
            <h2 className="mt-0">Currently sold out</h2>
            <p className="mb-sm">
              We grow these ourselves, so a sold-out plant is genuinely gone rather than sitting in
              a warehouse. It usually comes back with the next batch.
            </p>
            <Link href="/contact" className="text-primary underline">
              Ask us to tell you when it is back
            </Link>
          </>
        ) : (
          <>
            <h2 className="mt-0">Want one?</h2>
            <p className="mb-sm">
              {formatPaise(cheapest)} for the plant in its grow pot. Pots are optional on the plant
              page, and the price there is the price you pay.
            </p>
            <Link
              href={`/plant/${item.slug}`}
              className="bg-primary text-surface inline-flex min-h-[44px] items-center rounded-sm px-4 no-underline"
            >
              See the {item.commonName}
            </Link>
          </>
        )}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}
