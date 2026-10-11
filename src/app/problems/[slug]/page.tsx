import { permanentRedirect, redirect } from 'next/navigation'

import { loadPost } from '@/lib/content/posts.server'

/**
 * A problem page reached through `/problems/[slug]`.
 *
 * This is a redirect, not a second renderer.
 *
 * One `posts` row is reachable at both `/blog/[slug]` and `/problems/[slug]`;
 * the kind lives on the row, not on the route. Rendering at both would put one
 * article at two addresses, which is precisely the duplicate-URL pattern the
 * audit flags at Kyari (`gift-box-builder-1` and `gift-box-builder-2` both live)
 * and Upvan (`plants-example-products`, an un-renamed Shopify demo handle).
 *
 * The direction matters and it is one-way. `/problems/[slug]` → `/blog/[slug]`,
 * ALWAYS, including for a problem post. Redirecting a problem post to
 * `/problems/[slug]` would be a redirect to itself — an infinite loop, which is
 * the failure mode of "canonical depends on data" when the canonical is also a
 * route that renders.
 *
 * So `/blog/[slug]` is the single renderer, and its `generateMetadata` emits the
 * kind-appropriate canonical: a problem page declares `canonical:
 * /problems/<slug>` and a search engine consolidates onto that address even
 * though the server serves it from the `/blog` route. Exactly one real address
 * per post from a visitor's point of view, and one render path in the codebase.
 *
 * A 308 rather than a 302 because the mapping is permanent and a browser that
 * caches a 302 will keep bouncing.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await loadPost(slug)
  // `noindex` on the alias itself: the canonical lives on the renderer.
  return post ? { robots: { index: false, follow: true } } : { title: 'Not found' }
}

export default async function ProblemAliasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  /*
   * Unknown or unpublished → the index, not a 404.
   *
   * The metadata for this route still returns "Not found", so nothing
   * unpublished is indexed and no draft title leaks. The redirect is only about
   * giving a person who typed a URL something useful instead of a dead end.
   */
  const post = await loadPost(slug)
  if (!post) redirect('/problems')

  permanentRedirect(`/blog/${slug}`)
}
