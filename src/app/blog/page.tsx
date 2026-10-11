import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { loadPostsByKind } from '@/lib/content/posts.server'
import { loadRecentPosts } from '@/lib/content/posts.server'
import { COLLECTIONS, collectionSize } from '@/lib/catalogue/collections'
import { PostCard, PostList } from '@/components/content/PostCard'
import { resolvePostArt } from '@/lib/content/art.server'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import NotOpenYet from '@/components/storefront/NotOpenYet'

/**
 * The blog index — `/blog`.
 *
 * ── WHY THE PROBLEM LIBRARY IS PROMOTED ABOVE THE ARTICLES ─────────────────
 *
 * The articles are the acquisition surface and the problem pages are the
 * retention surface, but the problem pages are what a customer with a LIVE plant
 * needs today. So the library gets the top block on the index and on the
 * homepage, and this page's job is to say plainly that it exists rather than to
 * bury it under a list of gardening articles.
 *
 * Every audited competitor that has content has made the articles the only door
 * to it. Ugaoo's homepage links a live post titled "TESTING PLANT CARE BLOG".
 * Kyari's blog is 101 posts of news with no entry point from a product page. The
 * thing that ranks is a page someone links to from the thing they were reading —
 * so the cross-link from the plant's care guide into these posts is the mechanism,
 * and it exists on both sides.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Plant care articles',
    description:
      'Care written by the people who grow the plants, and the symptom library for when something is already wrong.',
    alternates: { canonical: '/blog' },
  }
}

export default async function BlogIndexPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Plant care" />

  const [articles, problems] = await Promise.all([
    loadPostsByKind('article', 60),
    loadRecentPosts(3).then((r) => r.problems),
  ])

  const liveCollections = COLLECTIONS.filter((c) => collectionSize(storefront.facets, c) !== null)

  // One resolution for both rails, so a problem card and an article card about
  // the same plant do not show the same photograph twice.
  const art = resolvePostArt([...problems, ...articles])

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[1120px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Plant care' }]} />

      <header className="mt-lg max-w-[68ch]">
        <h1 className="mb-0">Plant care</h1>
        <p className="text-ink-muted mt-sm mb-0 text-[1.05rem] leading-relaxed">
          Written by the people who grow the plants, in the light and the weather we actually have.
          Most of it answers a specific question rather than explaining botany, because that is what
          arrives in the inbox.
        </p>
      </header>

      {problems.length > 0 && (
        <section className="border-warning bg-surface-raised mt-2xl p-lg rounded-md border">
          <h2 className="mt-0">Something is already wrong?</h2>
          <p className="mb-base">
            Start from what you can see rather than what you think it is — yellowing, browning,
            drooping, pests. The answer and the fix come first on each page.
          </p>
          <ul className="gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-3">
            {problems.map((post) => (
              <PostCard key={post.id} post={post} art={art} />
            ))}
          </ul>
          <p className="mt-base mb-0">
            <Link href="/problems" className="text-primary underline">
              See every symptom we have written about →
            </Link>
          </p>
        </section>
      )}

      <div className="mt-3xl">
        <PostList
          heading="Care articles"
          posts={articles}
          art={art}
          emptyMessage={
            'Nothing published here yet. In the meantime the per-plant care guides carry the same information for each species we sell — start from a plant.'
          }
        />
      </div>

      {articles.length === 0 && (
        <section className="mt-3xl">
          <h2 className="mt-0">What we do have</h2>
          <p className="text-ink-muted mb-base">
            Every plant we sell carries a full care guide — light, water as a soil-moisture figure
            rather than a calendar, humidity, temperature, feeding and what actually arrives in the
            parcel.
          </p>
          <ul className="gap-sm m-0 flex list-none flex-wrap p-0">
            {liveCollections.slice(0, 6).map((c) => (
              <li key={c.handle}>
                <Link
                  href={`/collections/${c.handle}`}
                  className="border-border bg-surface-card hover:border-clay inline-flex min-h-[44px] items-center rounded-sm border px-3 text-sm no-underline"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
