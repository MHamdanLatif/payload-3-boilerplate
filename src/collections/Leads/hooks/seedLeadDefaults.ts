import type { CollectionBeforeChangeHook } from 'payload'
import { randomBytes } from 'crypto'
import type { FeaturedProject } from '@/payload-types'

/**
 * On create: give the lead a unique `brochureId` (powers /brochure/<id>) and
 * pre-fill the brochure assets from the project the lead enquired about, so the
 * auto-sent link has content immediately. The agent can override any of it later.
 */
export const seedLeadDefaults: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const next = { ...data }

  if (!next.brochureId) {
    next.brochureId = randomBytes(9).toString('base64url') // ~12 url-safe chars
  }

  const needsAssets = !next.brochurePdfPrimary || !next.brochureMapEmbed || !next.brochureHeadline
  if (next.sourceKind === 'project' && typeof next.sourceSlug === 'string' && next.sourceSlug && needsAssets) {
    try {
      const res = await req.payload.find({
        collection: 'featured-projects',
        where: { slug: { equals: next.sourceSlug } },
        depth: 0,
        limit: 1,
      })
      const project = res.docs[0] as FeaturedProject | undefined
      if (project) {
        if (!next.brochureHeadline) next.brochureHeadline = project.title
        if (!next.brochurePdfPrimary && project.brochure) next.brochurePdfPrimary = project.brochure
        if (!next.brochureMapEmbed && project.googleMapsEmbedUrl) {
          next.brochureMapEmbed = project.googleMapsEmbedUrl
        }
      }
    } catch {
      // best-effort — never block the save on a prefill lookup
    }
  }

  return next
}
