import type { Payload, Where } from 'payload'
import type { FeaturedProject, PropertyListing, Media } from '@/payload-types'

export const VALID_PROPERTY_TYPES = ['Flat', 'Plot', 'Office', 'Shop', 'Commercial'] as const
export const VALID_FILTER_STATUSES = ['Ready', 'Under Construction', 'Pre-launch'] as const
export const VALID_LOCATIONS = [
  'Gulshan-e-Iqbal',
  'Gulistan-e-Johar',
  'Scheme 33',
  'DHA',
  'Clifton',
  'M.A. Jinnah Road',
  'Jinnah Avenue',
  'Malir',
  'Saddar',
  'Korangi',
  'Model Colony',
  'Sukkur',
  'Other',
] as const
export const VALID_UNIT_TYPES = [
  '1 Bed Lounge',
  '2 Bed Lounge',
  '2 Bed Drawing',
  '2 Bed DD / 3 Bed Lounge',
  '3 Bed Lounge',
  '3 Bed Drawing',
  '4 Bed Drawing',
  '4+ Rooms',
] as const

export type PropertyType = (typeof VALID_PROPERTY_TYPES)[number]
export type FilterStatus = (typeof VALID_FILTER_STATUSES)[number]
export type FilterLocation = (typeof VALID_LOCATIONS)[number]
export type UnitType = (typeof VALID_UNIT_TYPES)[number]

/**
 * Translate a Unit Type label to a room-count filter usable against PropertyListings.
 * `exact` means listings with that exact `rooms` count match.
 * `atLeast` means listings with `rooms >= n` match. Used for the open-ended "4+ Rooms".
 * `oneOf` matches any of the listed counts (used for convertible units like
 *   "2 Bed DD / 3 Bed Lounge" where the same flat can be laid out as 2 or 3 rooms).
 */
export function unitTypeRoomCount(
  t: UnitType,
): { exact?: number; atLeast?: number; oneOf?: number[] } {
  if (t === '4+ Rooms') return { atLeast: 4 }
  if (t === '2 Bed DD / 3 Bed Lounge') return { oneOf: [2, 3] }
  const match = t.match(/^(\d+)/)
  if (!match) return {}
  return { exact: Number(match[1]) }
}

export type RawSearchParams = {
  location?: string
  propertyType?: string
  status?: string
  unitType?: string
  minPrice?: string
  maxPrice?: string
}

export type ParsedSearchParams = {
  location?: FilterLocation
  propertyType?: PropertyType
  status?: FilterStatus
  unitType?: UnitType
  minPrice?: number
  maxPrice?: number
}

export type UnifiedListing = {
  kind: 'project' | 'listing'
  id: string | number
  slug: string
  title: string
  href: string
  image: string | null
  location: string
  priceLabel: string
  badge: string
  meta: string[]
}

const MEDIA_FALLBACK = '/properties/placeholder.jpg'

export function parseSearchParams(sp: RawSearchParams): ParsedSearchParams {
  const out: ParsedSearchParams = {}
  if (sp.location && (VALID_LOCATIONS as readonly string[]).includes(sp.location)) {
    out.location = sp.location as FilterLocation
  }
  if (sp.propertyType && (VALID_PROPERTY_TYPES as readonly string[]).includes(sp.propertyType)) {
    out.propertyType = sp.propertyType as PropertyType
  }
  if (sp.status && (VALID_FILTER_STATUSES as readonly string[]).includes(sp.status)) {
    out.status = sp.status as FilterStatus
  }
  if (sp.unitType && (VALID_UNIT_TYPES as readonly string[]).includes(sp.unitType)) {
    out.unitType = sp.unitType as UnitType
  }
  const min = Number(sp.minPrice)
  if (sp.minPrice && Number.isFinite(min) && min >= 0) out.minPrice = min
  const max = Number(sp.maxPrice)
  if (sp.maxPrice && Number.isFinite(max) && max >= 0) out.maxPrice = max
  return out
}

function priceWhere(min?: number, max?: number, field = 'price'): Where | null {
  if (min == null && max == null) return null
  const w: Where = {}
  if (min != null) w[field] = { ...(w[field] ?? {}), greater_than_equal: min }
  if (max != null) w[field] = { ...(w[field] ?? {}), less_than_equal: max }
  return w
}

function formatPkr(n: number | null | undefined): string {
  if (n == null) return 'On Request'
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(2).replace(/\.?0+$/, '')} Lac`
  return `PKR ${n.toLocaleString()}`
}

function imageUrl(image: number | Media | null | undefined): string | null {
  if (!image || typeof image !== 'object') return null
  return image.url ?? null
}

export async function fetchUnified(payload: Payload, sp: ParsedSearchParams): Promise<UnifiedListing[]> {
  const sharedListingWhere: Where = { and: [] as Where[] }
  const sharedProjectWhere: Where = { and: [] as Where[] }
  const pushIf = (arr: Where[], w: Where | null | undefined) => {
    if (w) arr.push(w)
  }

  if (sp.location) {
    pushIf(sharedListingWhere.and as Where[], { location: { equals: sp.location } })
    pushIf(sharedProjectWhere.and as Where[], { location: { equals: sp.location } })
  }
  if (sp.propertyType) {
    pushIf(sharedListingWhere.and as Where[], { propertyType: { equals: sp.propertyType } })
    pushIf(sharedProjectWhere.and as Where[], { propertyType: { equals: sp.propertyType } })
  }
  // Unit-type filter:
  //   • FeaturedProjects: match against `unitTypes.type` directly.
  //   • PropertyListings: match the exact `unitType`. For legacy listings that
  //     pre-date the field (unitType unset), fall back to the room-count
  //     heuristic so they still surface instead of disappearing.
  if (sp.unitType) {
    pushIf(sharedProjectWhere.and as Where[], { 'unitTypes.type': { equals: sp.unitType } })

    const rc = unitTypeRoomCount(sp.unitType)
    const roomWhere: Where | null =
      rc.exact != null
        ? { rooms: { equals: rc.exact } }
        : rc.atLeast != null
          ? { rooms: { greater_than_equal: rc.atLeast } }
          : rc.oneOf?.length
            ? { rooms: { in: rc.oneOf } }
            : null

    pushIf(sharedListingWhere.and as Where[], {
      or: [
        { unitType: { equals: sp.unitType } },
        ...(roomWhere ? [{ and: [{ unitType: { exists: false } }, roomWhere] }] : []),
      ],
    })
  }
  pushIf(sharedListingWhere.and as Where[], priceWhere(sp.minPrice, sp.maxPrice, 'price'))
  pushIf(sharedProjectWhere.and as Where[], priceWhere(sp.minPrice, sp.maxPrice, 'startingPrice'))

  // Branch on status per the user's spec.
  let queryListings = false
  let queryProjects = false
  let projectStatusFilter: 'Pre-launch' | 'Under Construction' | undefined

  if (sp.status === 'Ready') {
    queryListings = true
  } else if (sp.status === 'Under Construction' || sp.status === 'Pre-launch') {
    queryProjects = true
    projectStatusFilter = sp.status
  } else {
    queryListings = true
    queryProjects = true
  }

  const tasks: Promise<UnifiedListing[]>[] = []

  if (queryListings) {
    tasks.push(
      payload
        .find({
          collection: 'property-listings',
          where: sharedListingWhere.and && (sharedListingWhere.and as Where[]).length
            ? sharedListingWhere
            : undefined,
          depth: 1,
          limit: 50,
        })
        .then((res) => res.docs.map(toUnifiedListing)),
    )
  }

  if (queryProjects) {
    const projWhere: Where = { and: [...((sharedProjectWhere.and as Where[]) ?? [])] }
    if (projectStatusFilter) {
      ;(projWhere.and as Where[]).push({ status: { equals: projectStatusFilter } })
    }
    tasks.push(
      payload
        .find({
          collection: 'featured-projects',
          where: (projWhere.and as Where[]).length ? projWhere : undefined,
          depth: 1,
          limit: 50,
        })
        .then((res) => res.docs.map(toUnifiedProject)),
    )
  }

  const groups = await Promise.all(tasks)
  return groups.flat()
}

function toUnifiedListing(doc: PropertyListing): UnifiedListing {
  const meta: string[] = []
  if (doc.propertyType) meta.push(doc.propertyType)
  // Prefer the exact unit-type layout (e.g. "3 Bed Drawing"); fall back to a
  // bare bed count for legacy listings without a unitType set.
  if (doc.unitType) meta.push(doc.unitType)
  else if (doc.rooms) meta.push(`${doc.rooms} bed${doc.rooms === 1 ? '' : 's'}`)
  if (doc.bathrooms) meta.push(`${doc.bathrooms} bath`)
  if (doc.areaSqFt) meta.push(`${doc.areaSqFt.toLocaleString()} sq ft`)
  return {
    kind: 'listing',
    id: doc.id,
    slug: doc.slug ?? `${doc.id}`,
    title: doc.title,
    href: `/listings/${doc.slug ?? doc.id}`,
    image: imageUrl(doc.mainImage) ?? MEDIA_FALLBACK,
    location: doc.location ?? 'Karachi',
    priceLabel: formatPkr(doc.price ?? null),
    badge: doc.status ?? 'Listing',
    meta,
  }
}

function toUnifiedProject(doc: FeaturedProject): UnifiedListing {
  const firstImage = doc.elevationImages?.[0]?.image
  const meta: string[] = []
  if (doc.propertyType) meta.push(doc.propertyType)
  if (doc.builderName) meta.push(`by ${doc.builderName}`)
  return {
    kind: 'project',
    id: doc.id,
    slug: doc.slug ?? `${doc.id}`,
    title: doc.title,
    href: `/projects/${doc.slug ?? doc.id}`,
    image: imageUrl(firstImage) ?? MEDIA_FALLBACK,
    location: doc.location ?? 'Karachi',
    priceLabel: doc.startingPrice
      ? `From ${formatPkr(doc.startingPrice)}`
      : 'On Request',
    badge: doc.status ?? 'Featured Project',
    meta,
  }
}
