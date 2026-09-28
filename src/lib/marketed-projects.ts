import type { Payload } from 'payload'
import type { MarketedProject } from '@/payload-types'
import { normaliseSlugKey } from '@/collections/MarketedProjects'

export { normaliseSlugKey }

/**
 * Resolve a landing page from a URL segment, ignoring casing and hyphens.
 *
 * The match runs against the derived `slugKey` column rather than `slug`,
 * because Payload's `like` operator maps to a SUBSTRING ilike on Postgres — it
 * would match `TulipComforts` for the input `tulip`, which is not a URL lookup.
 * `slugKey` is indexed and unique, so this stays a single `equals`.
 *
 * Returns the document even when the casing differs from the canonical slug;
 * the caller is responsible for redirecting to `doc.slug`.
 */
export async function fetchMarketedProject(
  payload: Payload,
  segment: string,
): Promise<MarketedProject | null> {
  const key = normaliseSlugKey(segment)
  if (!key) return null

  const res = await payload.find({
    collection: 'marketed-projects',
    where: { slugKey: { equals: key } },
    depth: 2,
    limit: 1,
  })
  const doc = (res.docs[0] as MarketedProject | undefined) ?? null
  return doc ? stripServerOnlyFields(doc) : null
}

/**
 * Remove the fields that must never cross to the browser.
 *
 * Any project data handed to client components is public, and
 * anything passed to a client component is serialised into the RSC flight
 * payload — visible in view-source. Two fields make that a real problem:
 *
 *   `linkedProject` is a relationship to the organic project, and `depth: 2`
 *   populates it into a whole `FeaturedProject`. That would publish the organic
 *   price list, FAQs and address inside the ad page — defeating the entire point
 *   of keeping the two collections separate.
 *
 *   `brochure` resolves to a public R2 URL. The brochure is meant to be earned
 *   by registering, and a URL in the page source is not gated by anything.
 *
 * Neither is read while rendering: `linkedProject` is for CRM attribution and
 * `brochure` for the lead's pack, and both are looked up again server-side in
 * `seedLeadDefaults` at depth 0.
 */
function stripServerOnlyFields(doc: MarketedProject): MarketedProject {
  return { ...doc, linkedProject: null, brochure: null }
}

/** Live pages, for prerendering. */
export async function fetchMarketedSlugs(payload: Payload): Promise<string[]> {
  const res = await payload.find({
    collection: 'marketed-projects',
    where: { active: { equals: true } },
    depth: 0,
    limit: 200,
    pagination: false,
    select: { slug: true },
  })
  return res.docs.map((d) => (d as MarketedProject).slug).filter(Boolean)
}

/** Labels shared by the hero and enquiry forms, in CMS row order. */
export function unitInterestOptions(project: Pick<MarketedProject, 'availableUnits'>): string[] {
  return [...new Set((project.availableUnits ?? []).map((unit) => unit.type.trim()).filter(Boolean))]
}

/** Configuration labels and the available area range; no pricing data required. */
export function availabilityLine(project: Pick<MarketedProject, 'availableUnits'>): string | null {
  const configurations = unitInterestOptions(project)
  if (!configurations.length) return null

  const areas = (project.availableUnits ?? [])
    .filter((unit) => unit.type.trim())
    .map((unit) => unit.areaSqFt)
    .filter((area): area is number => typeof area === 'number' && Number.isFinite(area) && area > 0)
  const min = Math.min(...areas)
  const max = Math.max(...areas)
  const format = (value: number) => value.toLocaleString('en-US')
  const area = areas.length
    ? (min === max ? format(min) : format(min) + '–' + format(max)) + ' sq ft'
    : null
  return 'Available: ' + configurations.join(', ') + (area ? ' · ' + area : '')
}
