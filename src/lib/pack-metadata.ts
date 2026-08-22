import type { Payload } from 'payload'
import type { FeaturedProject, Lead, Media } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Open Graph metadata for a personalised project pack.
 *
 * When a pack link is sent on WhatsApp the preview used to show the generic
 * Lateef Properties logo, so a Tulip Comfort lead and a Saima Elite lead
 * received visually identical messages. The preview should show the project the
 * pack is actually about.
 *
 * NO LEAD DATA APPEARS IN THE PREVIEW. Not the name, not the phone number, not
 * the token's contents. Two reasons: messaging platforms cache previews and
 * pass them through their own servers, and a forwarded message would otherwise
 * leak one customer's details to whoever received it. The page is personalised;
 * the preview is strictly project-level.
 */

/** Media in a link preview must be an absolute, publicly fetchable URL. */
function absolute(url: string | null | undefined, base: string): string | null {
  if (!url) return null
  try {
    return new URL(url, base).href
  } catch {
    return null
  }
}

/**
 * Pick the best available image for a share preview.
 *
 * Prefers the `og` size — JPEG at 1200x630 — over the master, which is WebP.
 * WhatsApp's rendering of WebP previews is unreliable, so the JPEG variant is
 * the one worth serving even though it is a larger file.
 *
 * The `og` size only exists on media uploaded after it was introduced, hence
 * the fall back to the master rather than treating its absence as an error.
 */
function shareImage(m: number | Media | null | undefined, base: string): string | null {
  if (!m || typeof m !== 'object') return null
  const og = m.sizes?.og?.url
  return absolute(og ?? m.url, base)
}

export type PackMeta = {
  title: string
  description: string
  imageUrl: string | null
  canonical: string
}

/**
 * Resolve the project a pack belongs to, then build its preview copy.
 *
 * Resolution order matters. `currentInterestedProject` comes first because it
 * is what sales has the buyer looking at now — after a cross-sell that is a
 * different project from the one that acquired them, and the pack should
 * reflect the current conversation. `sourceSlug` is the final fallback for
 * leads created before the project relationships existed.
 *
 * Never throws: a preview is cosmetic, and a broken one must not take down a
 * page a customer is trying to read.
 */
export async function buildPackMeta(
  payload: Payload,
  lead: Lead | null | undefined,
  token: string,
): Promise<PackMeta> {
  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/brochure/${token}`

  const fallback: PackMeta = {
    title: 'Your project pack | Lateef Properties',
    description:
      'Your personalised project pack — brochure, floor plans, payment plan, video and location.',
    imageUrl: absolute('/brand/og-default.png', base),
    canonical,
  }
  if (!lead) return fallback

  try {
    let project: FeaturedProject | null = null

    const rel = lead.currentInterestedProject ?? lead.acquiredProject
    if (rel && typeof rel === 'object') {
      project = rel as FeaturedProject
    } else if (typeof rel === 'number') {
      project = (await payload.findByID({
        collection: 'featured-projects',
        id: rel,
        depth: 1,
      })) as FeaturedProject
    } else if (lead.sourceKind === 'project' && lead.sourceSlug) {
      const res = await payload.find({
        collection: 'featured-projects',
        where: { slug: { equals: lead.sourceSlug } },
        depth: 1,
        limit: 1,
      })
      project = (res.docs[0] as FeaturedProject) ?? null
    }

    // brochureHeadline is the project name copied onto the lead at creation, so
    // it stays correct even when no project record resolves.
    const name = project?.title || lead.brochureHeadline || null
    if (!name) return fallback

    const image =
      shareImage(project?.socialShareImage, base) ??
      shareImage(project?.elevationImages?.[0]?.image, base) ??
      fallback.imageUrl

    const where = project?.location ? ` in ${project.location}, Karachi` : ''

    return {
      title: `${name} | Lateef Properties`,
      description: `View the ${name} brochure, floor plans, payment plan, project video and location${where}.`,
      imageUrl: image,
      canonical,
    }
  } catch {
    return fallback
  }
}
