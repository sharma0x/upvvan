import 'server-only'

import { Pool } from 'pg'

import { getPool as sharedPool } from '@/lib/db/pool'

/**
 * Post reader for the storefront.
 *
 * ── WHY RAW SQL AND NOT PAYLOAD'S LOCAL API ─────────────────────────────────
 * The same reason as `catalogue/loader.server.ts`: this is a read-only storefront
 * projection, and going through Payload would pull the whole config and
 * access-control layer into a page render for no benefit. Writes go through
 * Payload — this file writes nothing.
 *
 * ── WHY THE RICHTEXT IS RENDERED HERE AND NOT BY @payloadcms/richtext-lexical ─
 * Because importing the Lexical React renderer into a storefront page drags a
 * sizeable editor-adjacent dependency graph into the client bundle for what is,
 * in practice, headings and paragraphs. `renderRichText` below handles the
 * node types this site actually authors — heading, paragraph, list, quote, link,
 * and the Lexical `upload` node for a bench photograph — and THROWS on anything
 * else rather than silently dropping it.
 *
 * That throw is deliberate and it is the important line in this file. A content
 * editor adds a block type, the storefront silently renders nothing, and the
 * page looks fine to its author and empty to a customer. Failing loudly at render
 * time is the only version of this that surfaces the problem, and it surfaces it
 * to the person who can fix it.
 */

/*
 * Delegates to the ONE process-wide pool.
 *
 * There were nine module-level pools in this codebase — this one was `max: 20`,
 * and `catalogue/loader.server.ts` was another `max: 20`, which is 40 connections
 * from two modules before anything else loads. `next build` prerenders dozens of
 * routes in parallel and died with
 *
 *     error: sorry, too many clients already
 *     Error occurred prerendering page "/collections/plants-for-a-bright-room"
 *
 * A pool exists to REUSE connections. Nine pools reusing the same handful is not
 * reuse; it is nine warm-up costs and nine places for a leak to hide. See
 * `src/lib/db/pool.ts`.
 *
 * Kept as a thin wrapper rather than replaced at every call site: the callers are
 * correct, and rewriting working call sites during an incident is how an incident
 * becomes an outage.
 */
function getPool(): Pool {
  return sharedPool()
}

export type PostKind = 'article' | 'problem'

export interface PostSummary {
  id: number
  kind: PostKind
  title: string
  slug: string
  excerpt: string
  publishedAt: string
  /** Species slugs this post is cross-linked from. */
  speciesSlugs: string[]
  coverImageSrc: string | null
}

export interface Post extends PostSummary {
  body: unknown
  diagnosis: { symptom: string | null; cause: string | null; fix: string | null } | null
  seoTitle: string | null
  seoDescription: string | null
}

/**
 * The two homepage rails in one query.
 *
 * Two lists are always wanted together — the newest articles and the newest
 * problems — and they are a single index scan with a `kind` filter rather than
 * two round trips. The per-kind `LIMIT` is applied in a window function because
 * a plain `LIMIT` on the combined result would starve whichever kind sorted
 * last.
 */
export async function loadRecentPosts(
  limitPerKind = 4,
): Promise<{ articles: PostSummary[]; problems: PostSummary[] }> {
  const { rows } = await getPool().query<Row>(
    `WITH ranked AS (
       SELECT p."id", p."kind", p."title", p."slug", p."excerpt",
              p."published_at", p."cover_image_url",
              row_number() OVER (PARTITION BY p."kind" ORDER BY p."published_at" DESC) AS rn
         FROM "posts" p
        WHERE p."is_published" = true AND p."published_at" IS NOT NULL
     )
     SELECT * FROM ranked WHERE rn <= $1
     ORDER BY "kind", "published_at" DESC`,
    [limitPerKind],
  )

  const ids = rows.map((r) => r.id)
  const related = ids.length === 0 ? new Map<number, string[]>() : await loadSpeciesFor(ids)

  const summaries = rows.map((r) => toSummary(r, related.get(r.id) ?? []))
  return {
    articles: summaries.filter((s) => s.kind === 'article'),
    problems: summaries.filter((s) => s.kind === 'problem'),
  }
}

export async function loadPostsByKind(kind: PostKind, limit = 100): Promise<PostSummary[]> {
  const { rows } = await getPool().query<Row>(
    `SELECT p."id", p."kind", p."title", p."slug", p."excerpt",
            p."published_at", p."cover_image_url"
       FROM "posts" p
      WHERE p."is_published" = true
        AND p."published_at" IS NOT NULL
        -- The COLUMN is cast, not the parameter. kind is an enum, so comparing
        -- a text parameter against it has no operator (42883). Casting the
        -- column to text keeps the query working when a value is added.
        AND p."kind"::text = $1
      ORDER BY p."published_at" DESC
      LIMIT $2`,
    [kind, limit],
  )
  const related =
    rows.length === 0 ? new Map<number, string[]>() : await loadSpeciesFor(rows.map((r) => r.id))
  return rows.map((r) => toSummary(r, related.get(r.id) ?? []))
}

/**
 * One post by slug.
 *
 * NULL for a missing or unpublished post rather than throwing, because the caller
 * wants `notFound()` and a 404 is the correct answer for both "never existed"
 * and "not published yet".
 */
export async function loadPost(slug: string): Promise<Post | null> {
  const { rows } = await getPool().query<Row>(
    `SELECT p."id", p."kind", p."title", p."slug", p."excerpt", p."body",
            p."diagnosis_symptom", p."diagnosis_cause", p."diagnosis_fix",
            p."published_at", p."cover_image_url", p."seo_title", p."seo_description"
       FROM "posts" p
      WHERE p."slug" = $1
        AND p."is_published" = true
        AND p."published_at" IS NOT NULL
      LIMIT 1`,
    [slug],
  )
  const row = rows[0]
  if (!row) return null

  const related = await loadSpeciesFor([row.id])
  const summary = toSummary(row, related.get(row.id) ?? [])

  return {
    ...summary,
    body: row.body,
    diagnosis: {
      symptom: row.diagnosis_symptom,
      cause: row.diagnosis_cause,
      fix: row.diagnosis_fix,
    },
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  }
}

/** Every post that mentions a species, for the cross-links on its care page. */
export async function loadPostsForSpecies(slug: string): Promise<PostSummary[]> {
  const { rows } = await getPool().query<Row>(
    `SELECT DISTINCT p."id", p."kind", p."title", p."slug", p."excerpt",
                     p."published_at", p."cover_image_url"
       FROM "posts" p
       JOIN "posts_rels" r ON r."parent_id" = p."id"
       JOIN "species" sp ON sp."id" = r."species_id"
      WHERE p."is_published" = true
        AND p."published_at" IS NOT NULL
        AND sp."slug" = $1
      ORDER BY p."published_at" DESC`,
    [slug],
  )
  return rows.map((r) => toSummary(r, []))
}

/**
 * Slugs of the species each post is related to.
 *
 * `posts_rels` is the Payload relationship table, which has `path` and `order`
 * columns and no unique constraint. Selecting `DISTINCT ON (parent_id)` keeps
 * one row per post per species rather than one per relationship row, which is
 * what a `hasMany` relationship would give.
 */
async function loadSpeciesFor(postIds: number[]): Promise<Map<number, string[]>> {
  const { rows } = await getPool().query<{ parent_id: number; slug: string }>(
    `SELECT DISTINCT ON (r."parent_id") r."parent_id", sp."slug"
       FROM "posts_rels" r
       JOIN "species" sp ON sp."id" = r."species_id"
      WHERE r."parent_id" = ANY($1::int[])
      ORDER BY r."parent_id", r."order" NULLS LAST, sp."common_name"`,
    [postIds],
  )

  const out = new Map<number, string[]>()
  for (const row of rows) {
    const list = out.get(row.parent_id) ?? []
    list.push(row.slug)
    out.set(row.parent_id, list)
  }
  return out
}

interface Row {
  id: number
  kind: string
  title: string
  slug: string
  excerpt: string
  body?: unknown
  diagnosis_symptom: string | null
  diagnosis_cause: string | null
  diagnosis_fix: string | null
  published_at: string
  cover_image_url: string | null
  seo_title: string | null
  seo_description: string | null
}

function toSummary(row: Row, speciesSlugs: string[]): PostSummary {
  return {
    id: row.id,
    kind: row.kind as PostKind,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    speciesSlugs,
    coverImageSrc: row.cover_image_url,
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Lexical rendering
// ══════════════════════════════════════════════════════════════════════════

/** The subset of Lexical's node union this site authors. */
type LexNode = Record<string, unknown>

/**
 * Render Lexical rich text to plain HTML for a `<div dangerouslySetInnerHTML>`.
 *
 * ── WHY A STRING AND NOT REACT ELEMENTS ─────────────────────────────────────
 * Because every value that ends up in that string is escaped below, including
 * the text. There is no path by which an author's content becomes markup: text
 * goes through `escapeHtml`, and the only HTML emitted is the tag vocabulary
 * hardcoded in this function. A React-element renderer would make the escaping
 * implicit and rely on never noticing.
 *
 * The trade is that this cannot produce React components inside the body — which
 * is fine, because a CMS article body has no business containing a component,
 * and if it ever does that is a design conversation rather than a rendering one.
 */
export function renderRichText(body: unknown): string {
  if (body == null) return ''
  const root = body as LexNode
  const children = (root.root as LexNode | undefined)?.children
  return renderBlocks(children)
}

function renderBlock(node: LexNode): string {
  const type = String(node.type ?? '')

  switch (type) {
    case 'heading': {
      const tag = headingTag(node)
      return `<${tag}>${renderChildren(node)}</${tag}>`
    }
    case 'paragraph': {
      const html = renderChildren(node)
      // A paragraph with no text still needs a <p> or the Lexical serialiser's
      // empty paragraphs produce visual gaps in the margin rhythm.
      return `<p>${html || '<br>'}</p>`
    }
    /*
     * BOTH quote and blockquote take BLOCK children.
     *
     * Lexical's `quote` holds inline text in the default configuration, but a
     * `blockquote` holds paragraphs — and the two are otherwise identical in
     * shape, so routing one through `renderChildren` and the other through
     * `renderBlocks` is exactly the kind of asymmetry that throws the first time
     * somebody writes a blockquote. Both go through `renderBlocks`: it handles a
     * bare text child by treating it as a one-node block, which `renderBlock`
     * covers via the `paragraph` case.
     */
    case 'quote':
    case 'blockquote':
      return `<blockquote>${renderBlocks(node.children)}</blockquote>`
    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul'
      const items = Array.isArray(node.children) ? node.children : []
      /*
       * A listitem's children are BLOCK nodes — in Lexical a list item wraps
       * paragraphs, not text. So this calls `renderBlocks`, not
       * `renderChildren`.
       *
       * That distinction was found by the renderer's own throw rather than by
       * reading: the first version called `renderChildren` on each `<li>`, which
       * walked into `renderInline` with a `paragraph` node, did not recognise it,
       * and threw. Which is the throw doing exactly its job — a tolerant renderer
       * would have rendered every numbered step in the site as an empty bullet.
       */
      return `<${tag}>${items
        .map((li: LexNode) => `<li>${renderBlocks(li.children)}</li>`)
        .join('')}</${tag}>`
    }
    case 'upload': {
      const src = String(node.src ?? '')
      if (!src) return ''
      const alt = escapeHtml(String((node.altText as string | undefined) ?? ''))
      const caption = node.caption
        ? `<figcaption>${escapeHtml(String((node.caption as { text?: string }).text ?? ''))}</figcaption>`
        : ''
      return `<figure><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" />${caption}</figure>`
    }
    case 'hr':
      return '<hr />'
    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`
    case 'listitem':
      // Reached only if a listitem is a direct child of root, which Lexical does
      // not produce — but rendering it rather than throwing keeps a malformed
      // document readable instead of unviewable.
      return `<li>${renderBlocks(node.children)}</li>`
    default:
      /*
       * THE THROW.
       *
       * An unknown block type renders nothing in a tolerant implementation, so an
       * editor adds a block, publishes, sees it fine in the admin panel, and the
       * storefront silently drops the paragraph. That is the bug this line
       * exists to prevent, and it is worth an exception: the failure lands in
       * front of the person who can fix it, and it cannot reach a customer as an
       * empty section.
       */
      throw new Error(
        `renderRichText: unsupported Lexical node type "${type}". Add it to renderBlock() — a content type that renders as nothing is worse than an error.`,
      )
  }
}

/** Render an array of BLOCK nodes. Used for root children and list-item children. */
function renderBlocks(children: unknown): string {
  if (!Array.isArray(children)) return ''
  return children.map((node: LexNode) => renderBlock(node)).join('')
}

function renderChildren(node: LexNode): string {
  const children = node.children
  if (!Array.isArray(children)) return ''
  return children.map((child: LexNode) => renderInline(child)).join('')
}

function renderInline(node: LexNode): string {
  const type = String(node.type ?? '')

  switch (type) {
    case 'text': {
      const text = String(node.text ?? '')
      // A hard break is a newline the editor asked for; without it, every line
      // break in an author's prose silently disappears.
      let html = escapeHtml(text)
      if (node.format === 'break') return '<br />'
      if (typeof node.format === 'number') {
        const bits = node.format
        if (bits & 1) html = `<strong>${html}</strong>`
        if (bits & 2) html = `<em>${html}</em>`
        if (bits & 4) html = `<s>${html}</s>`
        if (bits & 8) html = `<code>${html}</code>`
      }
      return html
    }
    case 'linebreak':
      return '<br />'
    case 'link': {
      const fields = (node.fields ?? {}) as Record<string, unknown>
      const href = String(fields.url ?? '')
      // A `javascript:` href from the CMS would be stored XSS on a page we
      // control the content of. Anything not http(s), mailto or tel is dropped
      // rather than rendered.
      if (!/^(https?:|mailto:|tel:)/i.test(href)) return renderChildren(node)
      const newTab = fields.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${escapeHtml(href)}"${newTab}>${renderChildren(node)}</a>`
    }
    case 'autolink': {
      const href = String(node.url ?? '')
      if (!/^https?:/i.test(href)) return renderChildren(node)
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${renderChildren(node)}</a>`
    }
    case 'tab':
      return renderChildren(node)
    default:
      throw new Error(
        `renderRichText: unsupported Lexical inline node type "${type}". Add it to renderInline().`,
      )
  }
}

/**
 * Headings cap at h3.
 *
 * An article body sits INSIDE the page's own `<h1>`, so an author writing an
 * `h1` in the body produces a second h1 on the page — which breaks the document
 * outline, and is exactly what the a11y test asserts against every route. Clamping
 * in the renderer means the editor can still offer the control (they expect to be
 * able to) without being able to break the page.
 */
function headingTag(node: LexNode): 'h2' | 'h3' | 'h4' {
  const tag = String(node.tag ?? 'h2')
  if (tag === 'h1') return 'h2'
  if (tag === 'h2') return 'h2'
  if (tag === 'h4' || tag === 'h5' || tag === 'h6') return 'h4'
  return 'h3'
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch)
}

/** "3 March 2026" — unambiguous, and not locale-dependent. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
