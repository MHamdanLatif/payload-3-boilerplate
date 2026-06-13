import type { Payload } from 'payload'
import type { Blog, Media } from '@/payload-types'

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
