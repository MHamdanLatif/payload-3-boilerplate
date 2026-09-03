import type { CollectionBeforeChangeHook } from 'payload'
import { randomBytes } from 'crypto'
import type { FeaturedProject, MarketedProject } from '@/payload-types'

/**
 * On create: give the lead a unique `brochureId` (powers /brochure/<id>) and
 * pre-fill the brochure assets from the project the lead enquired about, so the
 * auto-sent link has content immediately. The agent can override any of it later.
 */
const FIRST_TOUCH_KEYS = [
  'firstTouchSource', 'firstTouchMedium', 'firstTouchCampaign', 'firstTouchContent',
  'firstTouchTerm', 'firstTouchLandingPath', 'firstTouchReferrer', 'firstTouchFbclid',
  'firstTouchGclid', 'firstTouchAt', 'acquiredProject', 'marketedProject',
] as const

export const seedLeadDefaults: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  // First touch and acquired project are write-once. Enforced here rather than
  // by convention, because a mutable field eventually gets mutated - and the
  // one thing this model must guarantee is that the campaign and project which
  // ACQUIRED a buyer survive every later visit and every cross-sell.
  //
  // The admin marks these read-only, but that is a UI affordance; the REST API
  // and any future import script would bypass it.
  if (operation === 'update' && originalDoc) {
    const guarded = { ...data }
    let blocked = false
    for (const key of FIRST_TOUCH_KEYS) {
      const existing = (originalDoc as Record<string, unknown>)[key]
      if (existing != null && existing !== '' && guarded[key] !== existing) {
        guarded[key] = existing
        blocked = true
      }
    }
    if (blocked) {
      req.payload.logger.info('[leads] first-touch attribution is immutable; restored prior values')
    }
    return guarded
  }

  if (operation !== 'create') return data
  const next = { ...data }

  if (!next.brochureId) {
    next.brochureId = randomBytes(9).toString('base64url') // ~12 url-safe chars
  }

  const needsAssets = !next.brochurePdfPrimary || !next.brochureMapEmbed || !next.brochureHeadline
  // Attribution is looked up even when the brochure assets are already present.
  // Gating the whole lookup on needsAssets would silently skip acquiredProject
  // for any lead created with its assets pre-filled.
  const needsAttribution = !next.acquiredProject || !next.currentInterestedProject
  if (
    next.sourceKind === 'project' &&
    typeof next.sourceSlug === 'string' &&
    next.sourceSlug &&
    (needsAssets || needsAttribution)
  ) {
    try {
      const res = await req.payload.find({
        collection: 'featured-projects',
        where: { slug: { equals: next.sourceSlug } },
        depth: 0,
        limit: 1,
      })
      const project = res.docs[0] as FeaturedProject | undefined
      if (project) {
        // Project attribution. Both are set on create and then diverge:
        // acquiredProject is frozen by the guard above, while
        // currentInterestedProject follows the buyer as sales cross-sells.
        if (!next.acquiredProject) next.acquiredProject = project.id
        if (!next.currentInterestedProject) next.currentInterestedProject = project.id
        if (needsAssets && !next.brochureHeadline) next.brochureHeadline = project.title
        if (!next.brochurePdfPrimary && project.brochure) next.brochurePdfPrimary = project.brochure
        if (needsAssets && !next.brochureMapEmbed && project.googleMapsEmbedUrl) {
          next.brochureMapEmbed = project.googleMapsEmbedUrl
        }
        // Walkthrough video, so a new lead's pack shows it without anyone
        // pasting the URL onto each lead by hand.
        if (!next.brochureVideoUrl && project.walkthroughVideoUrl) {
          next.brochureVideoUrl = project.walkthroughVideoUrl
        }
      }
    } catch {
      // best-effort — never block the save on a prefill lookup
    }
  }

  // Leads from a paid landing page. Same brochure prefill, but the project
  // relationships have to come from the marketed doc's `linkedProject`, because
  // acquiredProject/currentInterestedProject can only point at featured-projects.
  // Without that link the lead is still captured; it just has no project to
  // group under in the CRM.
  if (
    next.sourceKind === 'marketed-project' &&
    typeof next.sourceSlug === 'string' &&
    next.sourceSlug
  ) {
    try {
      const res = await req.payload.find({
        collection: 'marketed-projects',
        where: { slug: { equals: next.sourceSlug } },
        depth: 0,
        limit: 1,
      })
      const mp = res.docs[0] as MarketedProject | undefined
      if (mp) {
        if (!next.marketedProject) next.marketedProject = mp.id
        const linked = typeof mp.linkedProject === 'object' ? mp.linkedProject?.id : mp.linkedProject
        if (linked) {
          if (!next.acquiredProject) next.acquiredProject = linked
          if (!next.currentInterestedProject) next.currentInterestedProject = linked
        }
        if (!next.brochureHeadline) next.brochureHeadline = mp.title
        if (!next.brochurePdfPrimary && mp.brochure) next.brochurePdfPrimary = mp.brochure
        if (!next.brochureMapEmbed && mp.googleMapsEmbedUrl) {
          next.brochureMapEmbed = mp.googleMapsEmbedUrl
        }
        if (!next.brochureVideoUrl && mp.walkthroughVideoUrl) {
          next.brochureVideoUrl = mp.walkthroughVideoUrl
        }
      }
    } catch {
      // best-effort — never block the save on a prefill lookup
    }
  }

  return next
}
