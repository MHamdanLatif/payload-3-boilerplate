/**
 * Entity dictionary used by the blog-generation pipeline to build a semantic
 * internal-link silo. The entity scanner matches body text against canonical
 * names + aliases here; the publish hook resolves matches to URLs.
 *
 * Adding a new project or location: add a new entry below. The entity scanner
 * picks it up immediately. The corresponding FeaturedProject doc (for projects)
 * or /locations/<slug> page (for locations) must exist for links to resolve at
 * publish time — un-resolvable entries are left with `injected: false` so the
 * admin sees the gap.
 */

export type EntityKind = 'project' | 'location'

export type EntityEntry = {
  kind: EntityKind
  canonical: string
  aliases: string[]
  slug: string
  url: (slug: string) => string
}

const projectUrl = (slug: string) => `/projects/${slug}`
const locationUrl = (slug: string) => `/locations/${slug}`

export const PROJECT_ENTITIES: EntityEntry[] = [
  {
    kind: 'project',
    canonical: 'Saima Elite Enclave',
    aliases: ['Saima Elite', 'Elite Enclave'],
    slug: 'saima-elite-enclave',
    url: projectUrl,
  },
  {
    kind: 'project',
    canonical: 'Tulip Comforts',
    aliases: ['Tulip Comfort', 'Tulip'],
    slug: 'tulip-comforts',
    url: projectUrl,
  },
  {
    kind: 'project',
    canonical: 'Saima Center Point',
    aliases: ['Center Point', 'Saima Centerpoint'],
    slug: 'saima-center-point',
    url: projectUrl,
  },
  {
    kind: 'project',
    canonical: 'Saima Uptown',
    aliases: ['Uptown'],
    slug: 'saima-uptown',
    url: projectUrl,
  },
  {
    kind: 'project',
    canonical: 'Saima Dreams',
    aliases: ['Dreams'],
    slug: 'saima-dreams',
    url: projectUrl,
  },
]

export const LOCATION_ENTITIES: EntityEntry[] = [
  {
    kind: 'location',
    canonical: 'Gulshan-e-Iqbal',
    aliases: ['Gulshan', 'Gulshan e Iqbal', 'Gulshan-e Iqbal'],
    slug: 'gulshan-e-iqbal',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'Scheme 33',
    aliases: ['Scheme-33', 'KDA Scheme 33'],
    slug: 'scheme-33',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'Gulistan-e-Jauhar',
    aliases: ['Gulistan e Jauhar', 'Jauhar', 'Gulistan e-Jauhar'],
    slug: 'gulistan-e-jauhar',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'DHA',
    aliases: ['Defence Housing Authority', 'DHA Karachi'],
    slug: 'dha',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'Clifton',
    aliases: ['Clifton Karachi', 'Clifton Block'],
    slug: 'clifton',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'Jinnah Avenue',
    aliases: ['Jinnah Ave', 'M.A. Jinnah Avenue'],
    slug: 'jinnah-avenue',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'M.A. Jinnah Road',
    aliases: ['M.A Jinnah', 'MA Jinnah Road', 'M.A. Jinnah'],
    slug: 'ma-jinnah-road',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'Model Colony',
    aliases: ['Model Colony Karachi'],
    slug: 'model-colony',
    url: locationUrl,
  },
  {
    kind: 'location',
    canonical: 'Malir',
    aliases: ['Malir Karachi', 'Malir Cantt'],
    slug: 'malir',
    url: locationUrl,
  },
]

export const ALL_ENTITIES: EntityEntry[] = [...PROJECT_ENTITIES, ...LOCATION_ENTITIES]

export function resolveSlugFromMatch(match: string): EntityEntry | null {
  const lower = match.toLowerCase().trim()
  return (
    ALL_ENTITIES.find(
      (e) =>
        e.canonical.toLowerCase() === lower ||
        e.aliases.some((a) => a.toLowerCase() === lower),
    ) ?? null
  )
}

export function findEntityByProjectSlug(slug: string): EntityEntry | null {
  return PROJECT_ENTITIES.find((e) => e.slug === slug) ?? null
}

export function findEntityByLocationSlug(slug: string): EntityEntry | null {
  return LOCATION_ENTITIES.find((e) => e.slug === slug) ?? null
}

/**
 * Map a canonical location name (as stored on FeaturedProject.location / PropertyListing.location)
 * back to its silo slug. Returns null for locations without a dedicated /locations/<slug> page.
 */
export function findLocationSlugByCanonicalName(canonical: string): string | null {
  const match = LOCATION_ENTITIES.find(
    (e) => e.canonical.toLowerCase() === canonical.toLowerCase(),
  )
  return match?.slug ?? null
}
