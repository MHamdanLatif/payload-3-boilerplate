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
      heading="Guides from our Karachi advisory desk."
      intro="Buyer playbooks, area deep-dives and pricing breakdowns — written by the team that sources the inventory."
      bg="bg-cream"
    />
  )
}
