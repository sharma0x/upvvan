import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadPostsByKind } from '@/lib/content/posts.server'
import { PostCard } from '@/components/content/PostCard'
import { resolvePostArt } from '@/lib/content/art.server'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * The problem library — `/problems`.
 *
 * ── WHY THIS IS THE HIGHEST-ROI CONTENT IN THE CATEGORY ─────────────────────
 *
 * Bloomscape built 175 symptom-first pages (`/common-issue/why-are-the-leaves-
 * on-my-monstera-turning-yellow`) and the audit's assessment of them is blunt:
 * "written for the exact moment a customer is frightened and needs reassurance",
 * they rank for high-intent problem queries, and they "intercept the customer
 * BEFORE they write a complaint".
 *
 * Not one Indian competitor has any. Ugaoo buries real care content in an
 * accordion on a PDP; Kyari has 101 blog posts and no symptom pages; Urvann has
 * no blog at all and puts its effort into a YouTube channel.
 *
 * The mechanism is the URL. A customer does not search "zz plant care" — they
 * search the whole sentence, in the words they would use out loud. So the page
 * is `/problems/why-are-the-leaves-on-my-zz-plant-turning-brown`, the H1 is the
 * same sentence, and the answer is above the fold.
 *
 * ── WHY IT IS GROUPED BY WHAT THE CUSTOMER CAN SEE ─────────────────────────
 * The index is organised by symptom, not by plant. Someone with a dying plant
 * knows what it LOOKS like; they do not know what species it is, and if they did
 * they would be on the plant's page.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Something looks wrong',
    description:
      'Search by what you can see — yellowing leaves, brown tips, dropping leaves — and get the cause and the fix.',
    alternates: { canonical: '/problems' },
  }
}

export default async function ProblemsIndexPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Something looks wrong" />

  const problems = await loadPostsByKind('problem', 100)

  /*
   * Group by the SYMPTOM, not the plant.
   *
   * The symptom is stored as free text on the post so an editor can write it
   * precisely, which means it cannot be grouped by an exact key. So it is bucketed
   * on the leading noun of the symptom phrase — the word a customer would use to
   * describe what they can see — and anything unrecognised falls into "Something
   * else" rather than being dropped.
   */
  const BUCKETS: Array<{ label: string; test: RegExp }> = [
    { label: 'Yellowing leaves', test: /yellow/i },
    { label: 'Brown or crispy edges', test: /brown|crisp|scorch|burn/i },
    { label: 'Drooping or wilting', test: /droop|wilt/i },
    { label: 'Dropping leaves', test: /drop|fall/i },
    { label: 'Pests', test: /pest|insect|mite|fly|bug|scale|thrip/i },
    { label: 'White or fuzzy growth', test: /white|fuzz|mould|mold|powder/i },
    { label: 'Not growing', test: /grow|stunt|leggy|lean/i },
  ]

  const art = resolvePostArt(problems)

  const grouped = new Map<string, typeof problems>()
  for (const problem of problems) {
    const symptom = problem.excerpt || problem.title
    const bucket =
      BUCKETS.find((b) => b.test.test(problem.title) || b.test.test(symptom))?.label ??
      'Something else'
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), problem])
  }

  // The declared order first, then anything the editor added that we have no
  // bucket for. A fixed order means the page does not reshuffle as content is
  // added, which matters for a page people bookmark.
  const ordered = [
    ...BUCKETS.map((b) => [b.label, grouped.get(b.label) ?? []] as const).filter(
      ([, list]) => list.length > 0,
    ),
    ...(grouped.has('Something else')
      ? ([['Something else', grouped.get('Something else')!]] as const)
      : []),
  ]

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[1120px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Something looks wrong' }]} />

      <header className="mt-lg max-w-[68ch]">
        <h1 className="mb-0">Something looks wrong</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">
          Start from what you can see rather than what you think it is. Every page here is the
          question a customer types at 11pm with a plant they are worried about, answered with the
          cause and the fix first and the explanation second.
        </p>
      </header>

      {ordered.length === 0 ? (
        <p className="border-border bg-surface-raised mt-2xl p-lg rounded-md border">
          Nothing published here yet. If something is wrong with a plant,{' '}
          <Link href="/contact" className="text-primary underline">
            send us a photograph
          </Link>{' '}
          — a grower will look at it, and the answer usually becomes a page here.
        </p>
      ) : (
        <>
          {/*
            A jump list, because a page of grouped headings still requires
            scrolling to find the one that matches. The symptom words are the
            customer's own vocabulary, which is the entire point of the library.
          */}
          <nav aria-label="Jump to a symptom" className="mt-xl gap-sm flex flex-wrap">
            {ordered.map(([label, list]) => (
              <a
                key={label}
                href={`#${slugify(label)}`}
                className="border-border bg-surface-card hover:border-clay gap-sm inline-flex min-h-[44px] items-center rounded-sm border px-3 text-sm no-underline"
              >
                {label}
                <span className="text-ink-muted text-xs">{list.length}</span>
              </a>
            ))}
          </nav>

          {ordered.map(([label, list]) => (
            <section key={label} id={slugify(label)} className="mt-3xl scroll-mt-lg">
              <h2 className="border-border pb-xs mt-0 border-b">{label}</h2>
              {/*
                The shared `PostCard`, not an inline card written for this page.

                The inline version had no artwork and its own type scale, which is
                how a page of six problems came to look like six grey boxes with
                a label on them. One card means the art, the type scale and the
                link behaviour are the same here as everywhere else, and a fix to
                the card fixes this page too.
              */}
              <ul className="mt-base gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((post) => (
                  <PostCard key={post.id} post={post} art={art} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {/*
        The two paths a person takes when the library does not have their problem:
        the care guide for the plant itself, and a human. Both are offered, and
        neither is a dead end — the "ask" is a real endpoint with a published
        response time, not a contact form that goes nowhere.
      */}
      <section className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
        <h2 className="mt-0">Still stuck?</h2>
        <p className="mb-sm">
          Two options, and the second is usually faster. Send a photograph on WhatsApp and a grower
          will look at it — most things are diagnosable from one picture, and it costs nothing.
        </p>
        <p className="gap-base m-0 flex flex-wrap">
          <Link href="/contact" className="text-primary underline">
            Message a grower
          </Link>
          <Link href="/plants" className="text-primary underline">
            or start from the plant itself
          </Link>
          <Link href="/faq" className="text-primary underline">
            or read the common questions
          </Link>
        </p>
      </section>
    </main>
  )
}

/** Lowercase, hyphenated, ASCII. Matches what a heading anchor expects. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
