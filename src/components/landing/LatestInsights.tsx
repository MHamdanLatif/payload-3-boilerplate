import { getPayload } from 'payload'
import config from '@payload-config'

import { fetchPublishedBlogs } from '@/lib/blogs'
import { InsightsSection } from '@/components/blog/InsightsSection'

/**
 * Homepage "Latest insights" strip — surfaces the 3 newest published articles
 * so the blog is reachable from the highest-authority page on the site (the
 * single biggest fix for getting posts crawled + indexed). Renders nothing
 * until at least one post is published.
 */
export async function LatestInsights() {
  const payload = await getPayload({ config })
  const blogs = await fetchPublishedBlogs(payload, 3)

  return (
    <InsightsSection
      blogs={blogs}
      eyebrow="LATEST INSIGHTS"
      heading="Property Guides for Karachi Buyers"
      intro="Practical guides to projects, payment plans, locations and the questions to ask before booking."
      bg="bg-cream"
    />
  )
}
