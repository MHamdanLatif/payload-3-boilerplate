import type { Payload } from 'payload'
import type { Blog, FeaturedProject, PropertyListing, Media } from '@/payload-types'
import { PROJECT_ENTITIES } from '@/lib/project-mapper'
import { lexicalToPlainText } from '@/lib/lexical-to-text'

// Generic real-estate words that shouldn't count as a match signal between a
// blog and a listing (every post/listing shares these).
const LISTING_MATCH_STOPWORDS = new Set([
  'apartment', 'apartments', 'flat', 'flats', 'karachi', 'sale', 'buy', 'price',
  'prices', 'plan', 'plans', 'payment', 'project', 'projects', 'property',
  'properties', 'ready', 'move', 'moving', 'beds', 'bath', 'baths', 'room',
  'rooms', 'home', 'homes', 'house', 'guide', 'best', 'launch', 'under', 'over',
  'crore', 'sqft', 'area', 'with', 'from', 'your', 'that', 'this', 'pakistan',
  'luxury', 'residential', 'lounge', 'drawing', 'possession', 'urgent', 'resale',
])

/** Distinctive lowercased word tokens (≥4 chars, excluding generic terms). */
function distinctiveTokens(text: string): Set<string> {
  const words: string[] = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return new Set(words.filter((w) => w.length >= 4 && !LISTING_MATCH_STOPWORDS.has(w)))
}

/**
 * Live ready-to-move listings relevant to a blog — matched on distinctive token
 * overlap between the blog (title + keywords) and the listing (title, society,
 * unit type). So a "duplex" post surfaces duplex listings, and a post naming a
 * building surfaces that building's unit. Best matches first, capped at `limit`.
 */
export async function fetchRelatedListings(
  payload: Payload,
  blog: Blog,
  limit = 2,
): Promise<PropertyListing[]> {
  const blogTokens = distinctiveTokens(
    [blog.title ?? '', ...(blog.keywords ?? []).map((k) => k.keyword ?? '')].join(' '),
  )
  if (!blogTokens.size) return []

  const res = await payload.find({
    collection: 'property-listings',
    depth: 1,
    limit: 250,
    pagination: false,
  })

  return (res.docs as PropertyListing[])
    .map((l) => {
      const text = [l.title ?? '', l.societyName ?? '', l.unitType ?? ''].join(' ')
      let score = 0
      for (const t of distinctiveTokens(text)) if (blogTokens.has(t)) score++
      return { l, score }
    })
    .filter((x) => x.score > 0 && Boolean(x.l.slug))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.l)
}

/**
 * Projects a blog is about — detected by scanning its title, keywords and body
 * for project names/aliases (the same dictionary the CMS auto-linker uses). Used
 * to render a "featured development" card at the end of a post, which both
 * strengthens internal links blog → project page and gives the reader a direct
 * next step. Returns up to `limit` projects, ordered by the entity list.
 */
export async function fetchRelatedProjects(
  payload: Payload,
  blog: Blog,
  limit = 2,
): Promise<FeaturedProject[]> {
  const hay = [
    blog.title ?? '',
    ...(blog.keywords ?? []).map((k) => k.keyword ?? ''),
    lexicalToPlainText(blog.content) ?? '',
  ].join(' ')

  const slugs: string[] = []
  for (const e of PROJECT_ENTITIES) {
    if (slugs.length >= limit) break
    if (slugs.includes(e.slug)) continue
    const names = [e.canonical, ...e.aliases]
    const hit = names.some((n) => {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escaped}\\b`, 'i').test(hay)
    })
    if (hit) slugs.push(e.slug)
  }
  if (!slugs.length) return []

  const res = await payload.find({
    collection: 'featured-projects',
    where: { slug: { in: slugs } },
    depth: 1,
    limit,
  })
  // Preserve the entity-list order (so the most canonical match shows first).
  const rank = new Map(slugs.map((s, i) => [s, i]))
  return (res.docs as FeaturedProject[])
    .filter((d) => Boolean(d.slug))
    .sort((a, b) => (rank.get(a.slug ?? '') ?? 99) - (rank.get(b.slug ?? '') ?? 99))
}

/** Fetch all published blogs, newest first. */
export async function fetchPublishedBlogs(
  payload: Payload,
  limit = 50,
): Promise<Blog[]> {
  const res = await payload.find({
    collection: 'blogs',
    where: { status: { equals: 'published' } },
    sort: '-publishedAt',
    depth: 1,
    limit,
  })
  return res.docs as Blog[]
}

/** Fetch a single published blog by slug. */
export async function fetchBlogBySlug(
  payload: Payload,
  slug: string,
): Promise<Blog | null> {
  const res = await payload.find({
    collection: 'blogs',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
      ],
    },
    depth: 2,
    limit: 1,
  })
  return (res.docs[0] as Blog) ?? null
}

/**
 * Published blogs related to a set of match terms (a project/location name and
 * its aliases). A post matches when any term appears — case-insensitively — in
 * its title, excerpt or keywords. Newest-first, capped at `limit`. Used to link
 * project/location pages *into* their matching articles (reverse of the blog's
 * own outbound seoInternalLinks).
 */
export async function fetchRelatedBlogs(
  payload: Payload,
  terms: (string | null | undefined)[],
  limit = 3,
): Promise<Blog[]> {
  const needles = terms
    .map((t) => t?.toLowerCase().trim())
    .filter((t): t is string => Boolean(t))
  if (!needles.length) return []

  const blogs = await fetchPublishedBlogs(payload, 50)
  return blogs
    .filter((b) => {
      const hay = [
        b.title ?? '',
        b.excerpt ?? '',
        ...(b.keywords ?? []).map((k) => k.keyword ?? ''),
      ]
        .join(' ')
        .toLowerCase()
      return needles.some((n) => hay.includes(n))
    })
    .slice(0, limit)
}

/** generateStaticParams helper — just the slugs of every published blog. */
export async function fetchPublishedBlogSlugs(payload: Payload): Promise<string[]> {
  const res = await payload.find({
    collection: 'blogs',
    where: { status: { equals: 'published' } },
    depth: 0,
    limit: 500,
    pagination: false,
    select: { slug: true },
  })
  return res.docs.map((d) => d.slug).filter((s): s is string => Boolean(s))
}

/** Featured image URL or null. */
export function blogImage(blog: Blog): string | null {
  const img = blog.featuredImage as Media | number | null | undefined
  if (!img || typeof img !== 'object') return null
  return img.url ?? null
}

/** Human-readable date — "12 May 2026" style. */
export function formatBlogDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
