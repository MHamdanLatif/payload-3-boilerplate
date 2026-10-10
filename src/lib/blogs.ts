import type { Payload } from 'payload'
import { availableProjectsWhere } from './project-visibility'
import type { Blog, FeaturedProject, Media } from '@/payload-types'
import { PROJECT_ENTITIES } from '@/lib/project-mapper'
import { lexicalToPlainText } from '@/lib/lexical-to-text'

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
    overrideAccess: false,
    where: { and: [availableProjectsWhere, { slug: { in: slugs } }] },
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
    overrideAccess: false,
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
    overrideAccess: false,
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
    overrideAccess: false,
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
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : 'Asia/Karachi',
  })
}
