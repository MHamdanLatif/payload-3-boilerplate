import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { availableProjectsWhere } from '@/lib/project-visibility'
import { FOOTER_PROJECT_CATEGORIES_TAG } from '@/hooks/revalidateProjectInventory'

export type FooterProjectFacet = {
  status?: string | null
  highlightTag?: string | null
  propertyType?: string | null
}

/**
 * The footer renders on every page, including every 404, so it reads only the
 * three fields its category links need, at depth 0, and caches the result.
 */
export const getFooterProjectFacets = unstable_cache(
  async (): Promise<FooterProjectFacet[]> => {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'featured-projects',
      overrideAccess: false,
      where: availableProjectsWhere,
      depth: 0,
      pagination: false,
      select: { status: true, highlightTag: true, propertyType: true },
    })
    return res.docs.map(({ status, highlightTag, propertyType }) => ({
      status,
      highlightTag,
      propertyType,
    }))
  },
  [FOOTER_PROJECT_CATEGORIES_TAG],
  { tags: [FOOTER_PROJECT_CATEGORIES_TAG], revalidate: 3600 },
)
