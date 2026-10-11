import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadPost, renderRichText } from '@/lib/content/posts.server'
import { loadRecentPosts } from '@/lib/content/posts.server'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import { PostList } from '@/components/content/PostCard'
import { resolvePostArt } from '@/lib/content/art.server'

/**
 * An article or a problem page — `/blog/[slug]` and `/problems/[slug]`.
 *
 * ── WHY ONE ROUTE FOR BOTH KINDS ────────────────────────────────────────────
 * Both are `posts` rows differing by `kind`, and they render identically except
 * for the diagnosis block at the top. Two routes would mean two loaders, two
 * card components and two sets of metadata for a difference that is one
 * conditional.
 *
 * Both routes mount the same component. The alternative — `/blog/[slug]` and
 * `/problems/[slug]` as separate files that both import one shared renderer — is
 * marginally more explicit and costs an extra file plus an import for every
 * future change. The canonical URL is derived from the post's OWN kind, so a
 * problem page reached through `/blog/...` 301s to `/problems/...` rather than
 * existing at two addresses.
 *
 * ── WHY THE DIAGNOSIS BLOCK IS ABOVE THE BODY ──────────────────────────────
 * Because a person who has typed "why are the leaves on my ZZ plant turning
 * brown" into a search engine does not want an essay. They want the cause and
 * the fix. Everything else on the page is for the half of readers who want to
 * understand why, and it is below.
 */
type Params = { params: Promise<{ slug: string }> }

function canonicalFor(kind: string, slug: string): string {
  return kind === 'problem' ? `/problems/${slug}` : `/blog/${slug}`
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post) return { title: 'Not found' }

  const title = post.seoTitle ?? post.title
  const description = post.seoDescription ?? post.excerpt

  return {
    title,
    description,
    alternates: { canonical: canonicalFor(post.kind, post.slug) },
    openGraph: { title, description, type: 'article', publishedTime: post.publishedAt },
  }
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const post = await loadPost(slug)
  // NULL covers both "never existed" and "not published" — a 404 is the right
  // answer for either, and distinguishing them would leak draft titles.
  if (!post) notFound()

  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading={post.title} />

  // The rails, resolved for real rather than linked to an empty index.
  const { articles, problems } = await loadRecentPosts(3)
  const related = (post.kind === 'problem' ? problems : articles).filter(
    (p) => p.slug !== post.slug,
  )

  const isProblem = post.kind === 'problem'
  const parentHref = isProblem ? '/problems' : '/blog'
  const parentLabel = isProblem ? 'Something looks wrong' : 'Care articles'

  /*
   * The cross-links to the species this article concerns. This is the mechanism
   * that turns a support answer into a page that ranks: someone reading about
   * brown ZZ leaves ends up on the ZZ plant's own page, and vice versa.
   */
  const speciesBySlug = new Map(storefront.items.map((i) => [i.slug, i]))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': isProblem ? 'FAQPage' : 'Article',
    ...(isProblem
      ? {
          mainEntity: {
            '@type': 'Question',
            name: post.title,
            acceptedAnswer: {
              '@type': 'Answer',
              text: post.diagnosis?.fix ?? post.excerpt,
            },
          },
        }
      : {
          headline: post.title,
          datePublished: post.publishedAt,
          description: post.excerpt,
        }),
  }

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[720px]">
      <Breadcrumbs
        trail={[
          { href: '/', label: 'Home' },
          { href: parentHref, label: parentLabel },
          { label: post.title },
        ]}
      />

      <article className="mt-lg">
        <header>
          <p className="text-label-caps text-clay m-0">{isProblem ? 'Diagnosis' : 'Plant care'}</p>
          <h1 className="mt-xs mb-0">{post.title}</h1>
          {/*
            The excerpt directly under the headline, in a larger size than the
            body. It is written to be the ANSWER, not a teaser — a customer who
            reads only this should still have left with something.
          */}
          <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">{post.excerpt}</p>
        </header>

        {isProblem && post.diagnosis && (
          <section className="border-warning bg-surface-raised mt-lg p-lg rounded-md border">
            <h2 className="sr-only">The short answer</h2>

            {post.diagnosis.symptom && (
              <p className="m-0 text-sm">
                <span className="text-label-caps text-ink-muted">What you are seeing: </span>
                {post.diagnosis.symptom}
              </p>
            )}
            {post.diagnosis.cause && (
              <p className="mt-sm mb-0">
                <span className="text-label-caps text-ink-muted">Why: </span>
                {post.diagnosis.cause}
              </p>
            )}
            {post.diagnosis.fix && (
              <div className="border-border mt-sm pt-sm border-t">
                <p className="m-0">
                  <span className="text-label-caps text-ink-muted">Do this: </span>
                  {post.diagnosis.fix}
                </p>
              </div>
            )}
          </section>
        )}

        {/*
          The body, as escaped HTML from `renderRichText`.

          `dangerouslySetInnerHTML` with a hand-rolled renderer is a thing to be
          suspicious of, so the reasoning is worth stating: every text value is
          escaped by `escapeHtml`, every tag emitted is in the hardcoded vocabulary
          in that module, and `href` values are refused unless they are
          http(s)/mailto/tel. An author cannot emit an attribute, because the
          renderer never reads one.
        */}
        <div
          className="prose-upvvan mt-lg"
          dangerouslySetInnerHTML={{ __html: renderRichText(post.body) }}
        />

        {/*
          The species this concerns. Only links for species that are actually in
          the current catalogue — a link to a plant we do not stock is a dead end
          with a purchase-intent customer standing in front of it.
        */}
        {post.speciesSlugs.length > 0 && (
          <section className="mt-3xl">
            <h2 className="mt-0 text-[1.2rem]">
              {isProblem ? 'If it is one of these' : 'The plants this is about'}
            </h2>
            {/*
              Two sibling links, not a nested one.

              The obvious structure is a card that is a Link, containing a
              "full care guide" Link inside it. That is an <a> inside an <a>, which
              is invalid HTML, is silently restructured by the parser, and produces
              "In HTML, <a> cannot be a descendant of <a>" — which React reports as
              a hydration mismatch, because the client tree and the server tree
              are genuinely different shapes.

              The fix is to make the card an <article> holding two separate links,
              so each has its own destination and neither contains the other.
            */}
            <ul className="gap-sm m-0 flex list-none flex-col p-0">
              {post.speciesSlugs.map((slug) => {
                const item = speciesBySlug.get(slug)
                if (!item) return null
                return (
                  <li key={slug}>
                    <article className="border-border bg-surface-card p-base rounded-md border">
                      <Link
                        href={`/plant/${item.slug}?tier=${item.sizeTier}`}
                        className="text-ink font-semibold no-underline hover:underline"
                      >
                        {item.commonName}
                      </Link>
                      <span className="text-ink-muted mt-xs block text-sm">
                        {item.care.waterIntervalDays} days between waterings ·{' '}
                        {item.care.toxicity === 'safe'
                          ? 'safe if chewed'
                          : 'keep out of reach of pets and children'}
                      </span>
                      <Link
                        href={`/care/${item.slug}`}
                        className="text-primary mt-sm inline-flex min-h-[44px] items-center text-sm underline"
                      >
                        Full care guide
                      </Link>
                    </article>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/*
          The support escape hatch, at the end of every content page.

          A customer who arrived from a search engine at 11pm with a dying plant
          is exactly the person who needs a human, and this is the only place on
          the page that offers one. The page earns the click by answering first
          and asking second, which is also the only order in which the ask works.
        */}
        <aside className="border-primary bg-brand-soft mt-3xl p-lg rounded-md border">
          <h2 className="mt-0 text-[1.1rem]">Did that not fix it?</h2>
          <p className="mb-sm">
            Send a photograph on WhatsApp and a grower will look at it. Most things are diagnosable
            from one picture, and it is free.
          </p>
          <p className="m-0">
            <Link href="/contact" className="text-primary underline">
              Message a grower
            </Link>{' '}
            · answers in under 15 minutes during working hours
          </p>
        </aside>
      </article>

      {related.length > 0 && (
        <section className="mt-3xl">
          <PostList
            heading={isProblem ? 'Other things going wrong' : 'More on plant care'}
            posts={related}
            art={resolvePostArt(related)}
          />
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  )
}
