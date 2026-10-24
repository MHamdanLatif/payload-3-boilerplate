import type { Payload, Where } from 'payload'
import { PROJECT_BUDGETS, priceMatchesBudget, propertyTypeLabel } from './project-budgets'
import { availableProjectsWhere } from './project-visibility'
import type { FeaturedProject, Media } from '@/payload-types'

export const VALID_PROPERTY_TYPES = ['Flat', 'Plot', 'Office', 'Shop', 'Commercial'] as const
export const VALID_FILTER_STATUSES = [
  'Ready',
  'Under Construction',
  'Pre-launch',
  'Newly launched',
] as const
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

export type RawSearchParams = {
  location?: string
  propertyType?: string
  status?: string
  unitType?: string
  /** Layout, orthogonal to unitType. Currently only 'duplex'. */
  layout?: string
  budget?: string
  minPrice?: string
  maxPrice?: string
}

export const VALID_LAYOUTS = ['duplex'] as const
export type Layout = (typeof VALID_LAYOUTS)[number]

export type ParsedSearchParams = {
  location?: FilterLocation
  propertyType?: PropertyType
  status?: FilterStatus
  unitType?: UnitType
  layout?: Layout
  budget?: string
  minPrice?: number
  maxPrice?: number
}

export type UnifiedListing = {
  kind: 'project'
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
  if (sp.layout && (VALID_LAYOUTS as readonly string[]).includes(sp.layout)) {
    out.layout = sp.layout as Layout
  }
  if (PROJECT_BUDGETS.some((b) => b.value === sp.budget)) out.budget = sp.budget
  const min = Number(sp.minPrice)
  if (sp.minPrice && Number.isFinite(min) && min >= 0) out.minPrice = min
  const max = Number(sp.maxPrice)
  if (sp.maxPrice && Number.isFinite(max) && max >= 0) out.maxPrice = max
  return out
}

export type ProjectFilterOptions = {
  locations: string[]
  propertyTypes: string[]
  budgetLabel: 'Total Budget' | 'Starting Price Budget'
  hasStartingPriceFallback: boolean
}

export function projectFilterOptions(projects: FeaturedProject[]): ProjectFilterOptions {
  return {
    locations: [...new Set(projects.map((p) => p.location).filter(Boolean))].sort(),
    propertyTypes: [
      ...new Set(projects.map((p) => p.propertyType).filter((t): t is PropertyType => Boolean(t))),
    ].sort(),
    budgetLabel: projects.some((p) => p.unitTypes?.some((u) => Number.isFinite(u.price)))
      ? 'Total Budget'
      : 'Starting Price Budget',
    hasStartingPriceFallback: projects.some((p) => !p.unitTypes?.length && p.startingPrice != null),
  }
}

/** Match price and configuration on the SAME unit, not separate rows. */
export function projectMatchesFilters(project: FeaturedProject, sp: ParsedSearchParams): boolean {
  const hasPrice = Boolean(sp.budget) || sp.minPrice != null || sp.maxPrice != null
  // Sold-out units must not make a project match a budget or configuration search.
  const units = (project.unitTypes ?? []).filter((u) => !u.soldOut)
  const matchesPrice = (price: number | null | undefined) => {
    if (!hasPrice) return true
    if (price == null || !Number.isFinite(price)) return false
    if (sp.budget) return priceMatchesBudget(price, sp.budget)
    // Existing manually shared min/max URLs keep their inclusive semantics.
    return (
      (sp.minPrice == null || price >= sp.minPrice) && (sp.maxPrice == null || price <= sp.maxPrice)
    )
  }
  if (!units.length) return !sp.unitType && !sp.layout && matchesPrice(project.startingPrice)
  return units.some(
    (unit) =>
      (!sp.unitType || unit.type === sp.unitType) &&
      (!sp.layout || unit.isDuplex === true) &&
      matchesPrice(unit.price),
  )
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

export async function fetchUnified(
  payload: Payload,
  sp: ParsedSearchParams,
): Promise<UnifiedListing[]> {
  const conditions: Where[] = [availableProjectsWhere]
  if (sp.location) conditions.push({ location: { equals: sp.location } })
  if (sp.propertyType) conditions.push({ propertyType: { equals: sp.propertyType } })
  if (sp.status === 'Newly launched')
    conditions.push({ highlightTag: { equals: 'newly-launched' } })
  else if (sp.status)
    conditions.push({ status: { equals: sp.status === 'Ready' ? 'Ready to Move' : sp.status } })
  const res = await payload.find({
    collection: 'featured-projects',
    overrideAccess: false,
    where: { and: conditions },
    depth: 1,
    limit: 500,
    pagination: false,
    sort: '-updatedAt',
  })
  return res.docs.filter((doc) => projectMatchesFilters(doc, sp)).map(toUnifiedProject)
}

function toUnifiedProject(doc: FeaturedProject): UnifiedListing {
  const firstImage = doc.elevationImages?.[0]?.image
  const meta: string[] = []
  if (doc.propertyType) meta.push(propertyTypeLabel(doc.propertyType))
  if (doc.builderName) meta.push(`by ${doc.builderName}`)
  return {
    kind: 'project',
    id: doc.id,
    slug: doc.slug ?? `${doc.id}`,
    title: doc.title,
    href: `/projects/${doc.slug ?? doc.id}`,
    image: imageUrl(firstImage) ?? MEDIA_FALLBACK,
    location: doc.location ?? 'Karachi',
    priceLabel: doc.startingPrice ? `From ${formatPkr(doc.startingPrice)}` : 'On Request',
    badge: doc.status ?? 'Featured Project',
    meta,
  }
}
