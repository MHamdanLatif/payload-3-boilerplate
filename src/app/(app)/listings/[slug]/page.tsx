import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import Link from 'next/link'
import {
  fetchListingBySlug,
  fetchListingsByLocation,
  fetchPublishedListingSlugs,
  listingHeroImage,
} from '@/lib/property-listings'
import { richTextExcerpt } from '@/lib/featured-projects'
import { fetchRelatedBlogs } from '@/lib/blogs'
import { findLocationSlugByCanonicalName } from '@/lib/project-mapper'
import { InsightsSection } from '@/components/blog/InsightsSection'
import { PropertyListingCard } from '@/components/landing/PropertyListingCard'
import {
  propertyListingSchema,
  breadcrumbListSchema,
  faqPageSchema,
} from '@/lib/seo-jsonld'
import { deriveListingKeywords } from '@/lib/seo-keywords'
import { ListingHero } from '@/components/listings/ListingHero'
import { ListingOverview } from '@/components/listings/ListingOverview'
import { ListingWalkthroughVideo } from '@/components/listings/ListingWalkthroughVideo'
import { AmenitiesSection } from '@/components/shared/AmenitiesSection'
import { PhotoGallerySection } from '@/components/shared/PhotoGallerySection'
import { MapSection } from '@/components/shared/MapSection'
import { FaqSection } from '@/components/shared/FaqSection'
import { FinalCTASection } from '@/components/shared/FinalCTASection'
import { JsonLd } from '@/components/shared/JsonLd'
import { getServerSideURL } from '@/utilities/getURL'

type Params = { slug: string }

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const slugs = await fetchPublishedListingSlugs(payload)
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config })
  const listing = await fetchListingBySlug(payload, slug)
  if (!listing) return { title: 'Listing not found | Lateef Properties' }

  const seoTitle = listing.meta?.title ?? `${listing.title} | Lateef Properties`
  const seoDescription =
    listing.meta?.description ??
    listing.summary ??
    richTextExcerpt(listing.description, 160)
  const ogImage =
    (typeof listing.meta?.image === 'object' && listing.meta?.image?.url) ||
    listingHeroImage(listing) ||
    undefined
  const canonical = `${getServerSideURL()}/listings/${listing.slug}`

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: { canonical },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonical,
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: 'Lateef Properties',
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    keywords: deriveListingKeywords(listing),
  }
}

export const dynamicParams = true
export const revalidate = 60

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const listing = await fetchListingBySlug(payload, slug)
  if (!listing) notFound()

  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/listings/${listing.slug}`

  // Listing pages had NO outbound internal links — every other template has a
  // related-reading strip, so these were link sinks: crawl equity arrived and
  // stopped. Related guides plus siblings in the same area give the listing
  // cluster some internal structure. Best-effort; both degrade to nothing.
  const [relatedBlogs, sameArea] = await Promise.all([
    fetchRelatedBlogs(
      payload,
      [listing.title, listing.location, listing.unitType].filter(Boolean) as string[],
      3,
    ).catch((): Awaited<ReturnType<typeof fetchRelatedBlogs>> => []),
    (listing.location
      ? fetchListingsByLocation(payload, listing.location)
      : Promise.resolve([])
    ).catch((): Awaited<ReturnType<typeof fetchListingsByLocation>> => []),
  ])
  const otherInArea = sameArea.filter((l) => l.id !== listing.id).slice(0, 3)
  const areaSlug = listing.location ? findLocationSlugByCanonicalName(listing.location) : null

  const schemas = [
    propertyListingSchema(listing),
    breadcrumbListSchema([
      { name: 'Home', url: `${base}/` },
      { name: 'Properties', url: `${base}/properties` },
      { name: listing.title, url: canonical },
    ]),
    faqPageSchema(listing.faqs, canonical),
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <ListingHero listing={listing} />
        <ListingOverview listing={listing} />
        <AmenitiesSection amenities={listing.amenities} sectionNumber="03 / AMENITIES" />
        <ListingWalkthroughVideo
          url={listing.walkthroughVideoUrl}
          itemTitle={listing.title}
        />
        <PhotoGallerySection
          photos={listing.additionalImages}
          itemTitle={listing.title}
          sectionNumber="04 / GALLERY"
        />
        <MapSection
          embedUrl={listing.googleMapsEmbedUrl}
          itemTitle={listing.title}
          location={listing.location}
          sectionNumber="05 / LOCATION"
        />
        <FaqSection faqs={listing.faqs} sectionNumber="06 / FAQ" />

        {otherInArea.length > 0 && (
          <section className="bg-white py-20 md:py-28">
            <div className="container">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                  07 / MORE IN {listing.location?.toUpperCase()}
                </span>
                <span className="h-px w-10 bg-gold" />
              </div>
              <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
                More property in {listing.location}.
              </h2>
              <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {otherInArea.map((l) => (
                  <PropertyListingCard key={l.id} listing={l} />
                ))}
              </div>
              {areaSlug && (
                <p className="mt-10">
                  <Link
                    className="text-sm text-gold underline underline-offset-4 hover:text-brand-deep"
                    href={`/locations/${areaSlug}`}
                  >
                    See everything for sale in {listing.location} →
                  </Link>
                </p>
              )}
            </div>
          </section>
        )}

        <InsightsSection
          blogs={relatedBlogs}
          eyebrow="FURTHER READING"
          heading="Before you decide."
          intro={`Buyer guides covering ${listing.location ?? 'Karachi'} and this kind of property.`}
          bg="bg-cream"
        />

        <FinalCTASection
          sourceName={listing.title}
          sourceSlug={listing.slug ?? ''}
          sourceKind="listing"
          sectionNumber="08 / ENQUIRE"
          intro="Share your details — a senior advisor typically reaches you within 15 minutes to schedule a viewing and answer questions on title, possession, or financing."
        />
      </main>
    </>
  )
}
