import Image from 'next/image'
import Link from 'next/link'

import type { PostSummary } from '@/lib/content/posts.server'
import { formatDate } from '@/lib/content/posts.server'
import type { PlantImage } from '@/lib/catalogue/images'

/**
 * slug → resolved art for the posts in view.
 *
 * Re-exported from the `server-only` resolver so callers have one import for a
 * list and a card, without the card itself reaching into the filesystem.
 */
export type { PostArtMap } from '@/lib/content/art.server'

/**
 * Content cards and lists.
 *
 * ── WHY THE ART IS RESOLVED FROM THE RELATED SPECIES ────────────────────────
 *
 * `posts.cover_image_url` is empty for every post we seed, because uploading a
 * cover for every article is a second thing to remember and the photographs
 * already exist. So the card resolves art the same way every other surface on
 * this site does: by species slug, against `public/images/plants`.
 *
 * The comment on the previous version of this file CLAIMED that behaviour and
 * did not implement it. The result was that every problem card rendered a
 * full-bleed placeholder plate carrying the words "Something is wrong" — and a
 * card that is two-thirds placeholder reads as a broken image, not as content.
 * A shopper scanning a grid of six sees six identical grey boxes and concludes
 * the library is empty.
 *
 * So the resolution is real, and the placeholder is the last resort rather than
 * the first.
 *
 * ── WHY THE FALLBACK IS A THIN BAND, NOT A FILLED PLATE ────────────────────
 * A content card's job is the title. If there is no photograph, the honest
 * layout is one that does not reserve a large empty region for its absence — so
 * the fallback collapses the image slot and the card leads with its label. It
 * looks like a text card, which is what it is, rather than a broken image with
 * a caption.
 */
/**
 * The best available image for a post.
 *
 * Order: an explicit cover, then the first related species that has art. Order
 * matters — an editor who has deliberately set a cover must not have it
 * overridden by a species link.
 */
export function artForPost(post: PostSummary, art?: Map<string, PlantImage>): PlantImage | null {
  if (post.coverImageSrc) return { src: post.coverImageSrc, index: -1 }
  if (!art) return null
  for (const slug of post.speciesSlugs) {
    const hit = art.get(slug)
    if (hit) return hit
  }
  return null
}

export function PostCard({
  post,
  art,
  headingLevel = 'h3',
}: {
  post: PostSummary
  /** Resolved art, slug → image. Optional; without it the card is a text card. */
  art?: Map<string, PlantImage>
  headingLevel?: 'h2' | 'h3'
}) {
  const isProblem = post.kind === 'problem'
  const href = isProblem ? `/problems/${post.slug}` : `/blog/${post.slug}`
  const image = artForPost(post, art)
  const Heading = headingLevel

  /*
    Alt text on a content card.

    The heading immediately below is the title, and a screen reader announcing
    "Snake plant photograph" then reading the full question aloud twice is noise.
    So the image is decorative here — `alt=""` — which is the correct treatment
    for an image whose meaning is entirely carried by the adjacent text.

    This is different from the catalogue card, where the image IS the product and
    the alt text carries the name, and it is worth stating because the two look
    identical in the markup and are not.
  */
  const alt = ''

  return (
    <li>
      <article className="border-border bg-surface-card flex h-full flex-col overflow-hidden rounded-md border">
        {image && (
          <div className="border-border bg-surface-raised relative aspect-[16/10] w-full shrink-0 overflow-hidden border-b">
            <Image
              src={image.src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 100vw, 360px"
              className="object-cover"
            />
          </div>
        )}

        <div className="px-md py-base flex flex-1 flex-col">
          <span className={`text-label-caps block ${isProblem ? 'text-warning' : 'text-clay'}`}>
            {isProblem ? 'Diagnosis' : 'Plant care'} · {formatDate(post.publishedAt)}
          </span>

          {/*
            The title is the question a customer TYPED, on a problem page. That is
            the mechanism: a symptom-first library ranks because the URL and the
            heading are the sentence somebody would put in a search box, so it is
            written that way and the title is allowed to be long.

            The whole card is one link, so the heading is wrapped rather than the
            card being a link containing a link — the nested-anchor shape that
            produces a hydration mismatch.
          */}
          <Heading className="mt-xs mb-0 text-[1.05rem] leading-snug">
            <Link href={href} className="text-ink no-underline hover:underline">
              {post.title}
            </Link>
          </Heading>

          <p className="text-ink-muted mt-sm mb-0 text-sm">{post.excerpt}</p>

          {post.speciesSlugs.length > 0 && (
            <span className="text-ink-muted pt-sm mt-auto block text-xs">
              About: {post.speciesSlugs.slice(0, 2).join(', ')}
              {post.speciesSlugs.length > 2 && ` and ${post.speciesSlugs.length - 2} more`}
            </span>
          )}
        </div>
      </article>
    </li>
  )
}

export function PostList({
  posts,
  heading,
  headingLevel = 'h2',
  emptyMessage,
  art,
}: {
  posts: PostSummary[]
  heading: string
  headingLevel?: 'h2' | 'h3'
  emptyMessage?: string
  art?: Map<string, PlantImage>
}) {
  const Heading = headingLevel

  if (posts.length === 0) {
    if (!emptyMessage) return null
    return (
      <section>
        <Heading className="mt-0">{heading}</Heading>
        <p className="border-border bg-surface-raised p-lg rounded-md border">{emptyMessage}</p>
      </section>
    )
  }

  return (
    <section>
      <Heading className="mt-0">{heading}</Heading>
      <ul className="mt-base gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} art={art} />
        ))}
      </ul>
    </section>
  )
}
