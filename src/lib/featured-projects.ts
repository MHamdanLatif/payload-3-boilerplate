import type { Payload } from 'payload'
import type { FeaturedProject, Media } from '@/payload-types'
import type { ElevationSource, UnitsSource } from '@/lib/project-shape'

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
export function smallestUnit(project: UnitsSource): SmallestUnit | null {
  const units = project.unitTypes ?? []
  if (!units.length) return null
  const sorted = [...units].sort((a, b) => {
    if (a.rooms !== b.rooms) return a.rooms - b.rooms
    return a.price - b.price
  })
  const u = sorted[0]
  return { type: u.type, rooms: u.rooms, price: u.price }
}

// Re-exported from project-shape so existing importers keep working; that module
// is the single definition, shared with `marketed-projects`.
export type { ProjectUnit } from '@/lib/project-shape'
type ProjectUnit = NonNullable<FeaturedProject['unitTypes']>[number]

/**
 * Identity of a unit row, used as the calculator's selection key and as the
 * `?unit=` deep-link value from the units table. Defined once so the table's
 * links and the calculator's lookup cannot drift apart.
 */
export function unitKey(u: Pick<ProjectUnit, 'type' | 'rooms' | 'price'>): string {
  return `${u.type}::${u.rooms}::${u.price}`
}

/** Units sorted for display: fewest rooms first, cheapest first within a tie. */
export function sortedUnits(project: UnitsSource): ProjectUnit[] {
  return [...(project.unitTypes ?? [])].sort((a, b) => {
    if (a.rooms !== b.rooms) return a.rooms - b.rooms
    return a.price - b.price
  })
}

export type UnitSummary = {
  count: number
  types: string[]
  minPrice: number
  maxPrice: number
  minArea: number | null
  maxArea: number | null
  /** How many of the units are two-level duplexes. */
  duplexCount: number
  /** Configuration labels that are available as a duplex, e.g. ["3 Bed Drawing"]. */
  duplexTypes: string[]
}

/** Configuration + layout, e.g. "4 Bed Drawing · Duplex". */
export function unitLabel(u: Pick<ProjectUnit, 'type' | 'isDuplex'>): string {
  return u.isDuplex ? `${u.type} · Duplex` : String(u.type)
}

/**
 * Derived commercial facts about a project's unit mix, for the crawlable
 * summary sentence, the hero availability line and the meta-description
 * fallback. Returns null when the project has no unit rows.
 *
 * Areas are optional per unit, so min/max area are null unless at least one row
 * carries `areaSqFt` — callers must not print "0 sq ft".
 */
export function unitSummary(project: UnitsSource): UnitSummary | null {
  const units = sortedUnits(project)
  if (!units.length) return null

  const prices = units.map((u) => u.price).filter((p): p is number => typeof p === 'number')
  const areas = units
    .map((u) => u.areaSqFt)
    .filter((a): a is number => typeof a === 'number' && a > 0)

  // Distinct type labels, preserving the room-ascending order above.
  const types = [...new Set(units.map((u) => u.type).filter(Boolean))] as string[]
  const duplexes = units.filter((u) => u.isDuplex)
  const duplexTypes = [...new Set(duplexes.map((u) => u.type).filter(Boolean))] as string[]

  return {
    count: units.length,
    types,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    duplexCount: duplexes.length,
    duplexTypes,
  }
}

/** "1,050–2,300 sq ft", or null when no unit carries an area. */
export function areaRangeLabel(s: UnitSummary): string | null {
  if (s.minArea == null || s.maxArea == null) return null
  return s.minArea === s.maxArea
    ? `${s.minArea.toLocaleString()} sq ft`
    : `${s.minArea.toLocaleString()}–${s.maxArea.toLocaleString()} sq ft`
}

/** Format a PKR amount as "PKR 2.45 Cr" / "PKR 95 Lac" / "PKR 50,000". */
export function formatPkr(n: number | null | undefined): string {
  if (n == null) return 'On Request'
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(2).replace(/\.?0+$/, '')} Lac`
  return `PKR ${n.toLocaleString()}`
}

/** Hero image URL: first elevation, or null. */
export function heroImage(project: ElevationSource): string | null {
  const first = project.elevationImages?.[0]?.image
  return imageUrl(first)
}

// Lower number wins. Anything outside the map (incl. null / undefined) gets
// HIGHLIGHT_TAG_RANK_DEFAULT so untagged projects fall to the back of the
// curated section but otherwise keep their -updatedAt order.
const HIGHLIGHT_TAG_RANK: Record<string, number> = {
  'hot-selling': 1,
  'newly-launched': 2,
  'limited-inventory': 3,
}
const HIGHLIGHT_TAG_RANK_DEFAULT = 99

/**
 * Fetch featured projects in display order — tagged first, then -updatedAt.
 *
 * `limit` caps how many are RETURNED, applied after the ranking sort — not as a
 * query limit. The highlight-tag ranking is computed in JS over the whole set,
 * so limiting the query instead would silently drop a "hot selling" project
 * just because it hadn't been edited recently.
 *
 * Callers that render a grid of client-side cards should pass a limit: each
 * card is a client component carrying its own modal, so an unbounded grid grows
 * the hydration cost linearly.
 */
export async function fetchPublishedProjects(
  payload: Payload,
  opts?: { limit?: number },
): Promise<FeaturedProject[]> {
  const res = await payload.find({
    collection: 'featured-projects',
    depth: 2,
    limit: 250,
    sort: '-updatedAt',
  })
  // Stable sort by (tag rank ASC). `Array.prototype.sort` is stable since ES2019,
  // so ties (incl. all untagged projects) keep the -updatedAt order from Postgres.
  const ranked = (res.docs as FeaturedProject[]).slice().sort((a, b) => {
    const rankA = HIGHLIGHT_TAG_RANK[a.highlightTag ?? ''] ?? HIGHLIGHT_TAG_RANK_DEFAULT
    const rankB = HIGHLIGHT_TAG_RANK[b.highlightTag ?? ''] ?? HIGHLIGHT_TAG_RANK_DEFAULT
    return rankA - rankB
  })
  return typeof opts?.limit === 'number' ? ranked.slice(0, opts.limit) : ranked
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
