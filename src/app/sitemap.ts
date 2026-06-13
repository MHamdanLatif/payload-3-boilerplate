import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getServerSideURL } from '@/utilities/getURL'
import { heroImage } from '@/lib/featured-projects'
import { listingHeroImage } from '@/lib/property-listings'
import { blogImage } from '@/lib/blogs'
import { LOCATION_ENTITIES } from '@/lib/project-mapper'
import type { FeaturedProject, PropertyListing, Blog } from '@/payload-types'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerSideURL().replace(/\/$/, '')
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/properties`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ]

  const locationEntries: MetadataRoute.Sitemap = LOCATION_ENTITIES.map((e) => ({
    url: `${base}/locations/${e.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  try {
    const payload = await getPayload({ config })

    const [projects, listings, blogs] = await Promise.all([
      payload.find({
        collection: 'featured-projects',
        depth: 1,
        limit: 500,
        pagination: false,
      }),
      payload.find({
        collection: 'property-listings',
        depth: 1,
        limit: 500,
        pagination: false,
      }),
      payload.find({
        collection: 'blogs',
        where: { status: { equals: 'published' } },
        depth: 1,
        limit: 500,
        pagination: false,
      }),
    ])

    const projectEntries: MetadataRoute.Sitemap = projects.docs
      .filter((d) => Boolean(d.slug))
      .map((d) => {
        const project = d as FeaturedProject
        const img = heroImage(project)
        return {
          url: `${base}/projects/${project.slug}`,
          lastModified: project.updatedAt ? new Date(project.updatedAt) : now,
          changeFrequency: 'weekly' as const,
          priority: 0.85,
          ...(img && { images: [img] }),
        }
      })

    const listingEntries: MetadataRoute.Sitemap = listings.docs
      .filter((d) => Boolean(d.slug))
      .map((d) => {
        const listing = d as PropertyListing
        const img = listingHeroImage(listing)
        return {
          url: `${base}/listings/${listing.slug}`,
          lastModified: listing.updatedAt ? new Date(listing.updatedAt) : now,
          changeFrequency: 'daily' as const,
          priority: 0.8,
          ...(img && { images: [img] }),
        }
      })

    const blogEntries: MetadataRoute.Sitemap = blogs.docs
      .filter((d) => Boolean(d.slug))
      .map((d) => {
        const blog = d as Blog
        const img = blogImage(blog)
        return {
          url: `${base}/blog/${blog.slug}`,
          lastModified: blog.updatedAt ? new Date(blog.updatedAt) : now,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
          ...(img && { images: [img] }),
        }
      })

    return [
      ...staticEntries,
      ...locationEntries,
      ...projectEntries,
      ...listingEntries,
      ...blogEntries,
    ]
  } catch {
    return [...staticEntries, ...locationEntries]
  }
}
