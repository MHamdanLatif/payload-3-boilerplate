import type { Payload } from 'payload'
import type { FeaturedProject, Media } from '@/payload-types'

export type SmallestUnit = {
  type: NonNullable<FeaturedProject['unitTypes']>[number]['type']
  rooms: number
  price: number
}

export function imageUrl(media: number | Media | null | undefined): string | null {
  if (!media || typeof media !== 'object') return null
  return media.url ?? null
}

export function imageAlt(media: number | Media | null | undefined, fallback = ''): string {
  if (!media || typeof media !== 'object') return fallback
  return media.alt ?? fallback
}

/** Lowest-room unit, with price as tiebreaker. Returns null if the project has none. */
export function smallestUnit(project: FeaturedProject): SmallestUnit | null {
  const units = project.unitTypes ?? []
  if (!units.length) return null
  const sorted = [...units].sort((a, b) => {
    if (a.rooms !== b.rooms) return a.rooms - b.rooms
    return a.price - b.price
  })
  const u = sorted[0]
  return { type: u.type, rooms: u.rooms, price: u.price }
}

/** Format a PKR amount as "PKR 2.45 Cr" / "PKR 95 Lac" / "PKR 50,000". */
export function formatPkr(n: number | null | undefined): string {
  if (n == null) return 'On Request'
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(2).replace(/\.?0+$/, '')} Lac`
  return `PKR ${n.toLocaleString()}`
}

/** Hero image URL: first elevation, or null. */
export function heroImage(project: FeaturedProject): string | null {
  const first = project.elevationImages?.[0]?.image
  return imageUrl(first)
}

/** Fetch all featured projects in display order. */
export async function fetchPublishedProjects(payload: Payload): Promise<FeaturedProject[]> {
  const res = await payload.find({
    collection: 'featured-projects',
    depth: 2,
    limit: 250,
    sort: '-updatedAt',
  })
  return res.docs as FeaturedProject[]
}

/** Fetch a single project by slug. */
export async function fetchProjectBySlug(
  payload: Payload,
  slug: string,
): Promise<FeaturedProject | null> {
  const res = await payload.find({
    collection: 'featured-projects',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
  })
  return (res.docs[0] as FeaturedProject) ?? null
}

/** Fetch all featured projects in a given location (canonical name). */
export async function fetchProjectsByLocation(
  payload: Payload,
  location: string,
): Promise<FeaturedProject[]> {
  const res = await payload.find({
    collection: 'featured-projects',
    where: { location: { equals: location } },
    depth: 2,
    limit: 50,
    sort: '-updatedAt',
  })
  return res.docs as FeaturedProject[]
}

/** Used by generateStaticParams: just the slugs, lightweight. */
export async function fetchPublishedProjectSlugs(payload: Payload): Promise<string[]> {
  const res = await payload.find({
    collection: 'featured-projects',
    depth: 0,
    limit: 250,
    pagination: false,
    select: { slug: true },
  })
  return res.docs.map((d) => d.slug).filter((s): s is string => Boolean(s))
}

/** Extract a short plain-text excerpt from the Lexical rich-text description. */
export function richTextExcerpt(description: unknown, max = 160): string {
  if (!description || typeof description !== 'object') return ''
  const text = collectText(description as { root?: unknown }).trim()
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

function collectText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  let out = ''
  if (typeof n.text === 'string') out += n.text + ' '
  const children = Array.isArray(n.children) ? n.children : []
  for (const c of children) out += collectText(c)
  if (typeof n.root === 'object' && n.root) out += collectText(n.root)
  return out
}
