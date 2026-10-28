import type { Payload } from 'payload'
import type { FeaturedProject, Lead, MarketedProject, Media } from '@/payload-types'

/**
 * What a lead's pack shows, resolved when the link is opened.
 *
 * The brochure, map and video used to be copied onto the lead when it was
 * created, and the pack read those copies. So replacing a project's brochure
 * or video only reached leads created afterwards - everyone who already had a
 * link kept seeing the old files. The project is now read live on every open.
 *
 * Project values win over the lead's own fields. The lead fields are the
 * fallback for leads with no resolvable project (manual entries, or a project
 * that has since been deleted) and for an asset the project does not have.
 * The secondary PDF has no project counterpart, so it always comes from the lead.
 *
 * Which project: `currentInterestedProject` first, because after a cross-sell
 * that is what sales has the buyer looking at. A paid landing-page lead still
 * on its original project gets the marketed page's own assets, which can differ
 * from the featured project's, with the featured project filling any gaps.
 */
export type PackAssets = {
  headline: string | null
  pdfPrimary: number | Media | null
  pdfSecondary: number | Media | null
  mapEmbed: string | null
  videoUrl: string | null
}

type AssetSource = Pick<
  FeaturedProject | MarketedProject,
  'title' | 'brochure' | 'googleMapsEmbedUrl' | 'walkthroughVideoUrl'
>

function relId(rel: number | { id: number } | null | undefined): number | null {
  if (rel == null) return null
  return typeof rel === 'object' ? rel.id : rel
}

async function findProject(payload: Payload, lead: Lead): Promise<FeaturedProject | null> {
  const rel = lead.currentInterestedProject ?? lead.acquiredProject
  if (rel && typeof rel === 'object') return rel as FeaturedProject
  if (typeof rel === 'number') {
    return (await payload.findByID({
      collection: 'featured-projects',
      id: rel,
      depth: 0,
      overrideAccess: true,
    })) as FeaturedProject
  }
  if (lead.sourceKind === 'project' && lead.sourceSlug) {
    const res = await payload.find({
      collection: 'featured-projects',
      where: { slug: { equals: lead.sourceSlug } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    return (res.docs[0] as FeaturedProject) ?? null
  }
  return null
}

async function findMarketed(
  payload: Payload,
  lead: Lead,
  project: FeaturedProject | null,
): Promise<MarketedProject | null> {
  let mp: MarketedProject | null = null
  if (lead.marketedProject && typeof lead.marketedProject === 'object') {
    mp = lead.marketedProject as MarketedProject
  } else if (typeof lead.marketedProject === 'number') {
    mp = (await payload.findByID({
      collection: 'marketed-projects',
      id: lead.marketedProject,
      depth: 0,
      overrideAccess: true,
    })) as MarketedProject
  } else if (lead.sourceKind === 'marketed-project' && lead.sourceSlug) {
    const res = await payload.find({
      collection: 'marketed-projects',
      where: { slug: { equals: lead.sourceSlug } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    mp = (res.docs[0] as MarketedProject) ?? null
  }
  if (!mp) return null
  // Cross-sold to a different project: the landing page no longer applies.
  const linked = relId(mp.linkedProject as number | { id: number } | null | undefined)
  if (project && linked !== project.id) return null
  return mp
}

/** Load a media relation that may still be a bare id. */
async function loadMedia(
  payload: Payload,
  m: number | Media | null | undefined,
): Promise<number | Media | null> {
  if (!m) return null
  if (typeof m === 'object') return m
  try {
    return (await payload.findByID({ collection: 'media', id: m, overrideAccess: true })) as Media
  } catch {
    return null
  }
}

/**
 * Never throws: on any lookup failure it falls back to what is stored on the
 * lead, so a customer opening their link always gets a page.
 */
export async function resolvePackAssets(payload: Payload, lead: Lead): Promise<PackAssets> {
  const own: PackAssets = {
    headline: lead.brochureHeadline ?? null,
    pdfPrimary: lead.brochurePdfPrimary ?? null,
    pdfSecondary: lead.brochurePdfSecondary ?? null,
    mapEmbed: lead.brochureMapEmbed ?? null,
    videoUrl: lead.brochureVideoUrl ?? null,
  }

  try {
    const project = await findProject(payload, lead)
    const marketed = await findMarketed(payload, lead, project)
    const sources = [marketed, project].filter(Boolean) as AssetSource[]
    if (!sources.length) return own

    const pick = <K extends keyof AssetSource>(key: K) =>
      sources.map((s) => s[key]).find((v) => v != null && v !== '') ?? null

    return {
      headline: (pick('title') as string | null) ?? own.headline,
      pdfPrimary:
        (await loadMedia(payload, pick('brochure') as number | Media | null)) ?? own.pdfPrimary,
      pdfSecondary: own.pdfSecondary,
      mapEmbed: (pick('googleMapsEmbedUrl') as string | null) ?? own.mapEmbed,
      videoUrl: (pick('walkthroughVideoUrl') as string | null) ?? own.videoUrl,
    }
  } catch (e) {
    payload.logger.warn(`[pack-assets] live lookup failed, using lead copy: ${(e as Error).message}`)
    return own
  }
}
