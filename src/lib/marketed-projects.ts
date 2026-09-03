import type { Payload } from 'payload'
import type { MarketedProject } from '@/payload-types'
import { normaliseSlugKey } from '@/collections/MarketedProjects'
import { areaRangeLabel, sortedUnits, unitSummary } from '@/lib/featured-projects'
import type { UnitsSource } from '@/lib/project-shape'

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
 * The page hands `project` to client components (the calculator is one), and
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

/**
 * Options for the "Interested in which unit type" select, in the same order the
 * units table renders. Duplex is appended per configuration so the buyer picks
 * the thing they actually saw in the table.
 */
export function unitInterestOptions(project: UnitsSource): string[] {
  const labels = sortedUnits(project).map((u) =>
    u.isDuplex ? `${u.type} (Duplex)` : String(u.type),
  )
  return [...new Set(labels)]
}

/**
 * The hero availability line, e.g.
 * "Available: 2 Bed DD / 3 Bed Lounge, 3 Bed Drawing (Duplex) · 1,300–2,250 sq ft".
 *
 * Differs from the organic hero, which reports an aggregate duplex COUNT
 * ("· 2 duplex"). Here the duplex marker is attached to the specific
 * configurations that offer one, because on an ad page the visitor is choosing
 * between named units rather than skimming a summary.
 *
 * Dedupes on configuration + duplex together: keying on configuration alone
 * would label a whole configuration "(Duplex)" when a project offers both a
 * flat and a duplex of the same bed count.
 */
export function availabilityLine(project: UnitsSource): string | null {
  const summary = unitSummary(project)
  if (!summary) return null

  const configurations = unitInterestOptions(project)
  if (!configurations.length) return null

  const area = areaRangeLabel(summary)
  return `Available: ${configurations.join(', ')}${area ? ` · ${area}` : ''}`
}
