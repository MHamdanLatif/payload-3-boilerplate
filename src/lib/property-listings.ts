import type { Payload } from 'payload'
import type { PropertyListing, FeaturedProject, Media } from '@/payload-types'
import { imageUrl, imageAlt } from './featured-projects'

export { imageUrl, imageAlt }

/** Hero image URL for a listing: the main cover photo. */
export function listingHeroImage(listing: PropertyListing): string | null {
  return imageUrl(listing.mainImage as Media | null | undefined)
}

/** "Saima Elite Enclave" if parentProject set, else `societyName`, else null. */
export function getSocietyOrProject(listing: PropertyListing): string | null {
  const p = listing.parentProject as FeaturedProject | number | null | undefined
  if (p && typeof p === 'object' && p.title) return p.title
  return listing.societyName ?? null
}

/** Fetch all listings sorted newest first. */
export async function fetchPublishedListings(payload: Payload): Promise<PropertyListing[]> {
  const res = await payload.find({
    collection: 'property-listings',
    depth: 2,
    limit: 250,
    sort: '-updatedAt',
  })
  return res.docs as PropertyListing[]
}

/** Fetch a single listing by slug. */
export async function fetchListingBySlug(
  payload: Payload,
  slug: string,
): Promise<PropertyListing | null> {
  const res = await payload.find({
    collection: 'property-listings',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
  })
  return (res.docs[0] as PropertyListing) ?? null
}

/** Fetch all property listings in a given location (canonical name). */
export async function fetchListingsByLocation(
  payload: Payload,
  location: string,
): Promise<PropertyListing[]> {
  const res = await payload.find({
    collection: 'property-listings',
    where: { location: { equals: location } },
    depth: 2,
    limit: 50,
    sort: '-updatedAt',
  })
  return res.docs as PropertyListing[]
}

/** Used by generateStaticParams: just the slugs. */
export async function fetchPublishedListingSlugs(payload: Payload): Promise<string[]> {
  const res = await payload.find({
    collection: 'property-listings',
    depth: 0,
    limit: 250,
    pagination: false,
    select: { slug: true },
  })
  return res.docs.map((d) => d.slug).filter((s): s is string => Boolean(s))
}

/** Extract a YouTube/Vimeo video ID from a URL. Returns provider + id, or null. */
export function parseVideoUrl(
  url: string | null | undefined,
): { provider: 'youtube' | 'vimeo'; id: string } | null {
  if (!url) return null
  try {
    const u = new URL(url)
    // YouTube formats: youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/embed/<id>, youtube.com/shorts/<id>
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0]
      if (id) return { provider: 'youtube', id }
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return { provider: 'youtube', id: v }
      const m = u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)
      if (m) return { provider: 'youtube', id: m[1] }
    }
    // Vimeo: vimeo.com/<id>
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.slice(1).split('/')[0]
      if (id && /^\d+$/.test(id)) return { provider: 'vimeo', id }
    }
  } catch {
    return null
  }
  return null
}
