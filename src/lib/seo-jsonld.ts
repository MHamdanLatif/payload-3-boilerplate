import type { FeaturedProject, PropertyListing, Blog, Media } from '@/payload-types'
import { heroImage, formatPkr, richTextExcerpt, imageUrl, smallestUnit } from './featured-projects'
import { listingHeroImage, getSocietyOrProject } from './property-listings'
import { getServerSideURL } from '@/utilities/getURL'

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Extract `{ lat, lng }` from a Google Maps embed URL.
 * Handles both `!3d<lat>!2d<lng>` (most common) and `@<lat>,<lng>` formats.
 */
export function parseLatLngFromMapsUrl(
  url: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!url) return null
  // `!3d24.948!2d67.157` — newer embed format
  const exclaim = url.match(/!3d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/)
  if (exclaim) {
    const lat = Number(exclaim[1])
    const lng = Number(exclaim[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  // `@24.948,67.157` — older share-link format
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at) {
    const lat = Number(at[1])
    const lng = Number(at[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  return null
}

function postalAddress(
  addressLine: string | null | undefined,
  location: string | null | undefined,
) {
  return {
    '@type': 'PostalAddress',
    ...(addressLine && { streetAddress: addressLine }),
    addressLocality: location ?? 'Karachi',
    addressRegion: 'Sindh',
    addressCountry: 'PK',
  }
}

function geoCoordinates(url: string | null | undefined) {
  const coords = parseLatLngFromMapsUrl(url)
  if (!coords) return null
  return {
    '@type': 'GeoCoordinates',
    latitude: coords.lat,
    longitude: coords.lng,
  }
}

/* -------------------------------------------------------------------------- */
/* Project schema — RealEstateListing                                         */
/*                                                                             */
/* Previously multi-typed as ['Product', 'RealEstateListing']. Search Console  */
/* then expected the Product fields review + aggregateRating on every project; */
/* fabricating those would violate Google's structured-data guidelines. We     */
/* drop Product since real estate isn't a product in schema.org's sense — the  */
/* offer/price still surfaces because RealEstateListing supports `offers`.     */
/* -------------------------------------------------------------------------- */

export function realEstateListingSchema(project: FeaturedProject) {
  const url = `${getServerSideURL()}/projects/${project.slug}`
  const image = heroImage(project)
  const description =
    project.summary?.trim() ||
    richTextExcerpt(project.description, 200) ||
    `${project.title} — ${project.propertyType} in ${project.location}.`

  const offers = project.startingPrice
    ? {
        '@type': 'Offer',
        priceCurrency: 'PKR',
        price: project.startingPrice,
        availability: 'https://schema.org/InStock',
        url,
      }
    : undefined

  const small = smallestUnit(project)
  const geo = geoCoordinates(project.googleMapsEmbedUrl)

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    name: project.title,
    description,
    image: image ? [image] : undefined,
    url,
    category: project.propertyType,
    address: postalAddress(project.addressLine, project.location),
    ...(geo && { geo }),
    ...(small != null && { numberOfRooms: small.rooms }),
    ...(offers && { offers }),
    additionalProperty: [
      project.location && {
        '@type': 'PropertyValue',
        name: 'Location',
        value: project.location,
      },
      project.status && {
        '@type': 'PropertyValue',
        name: 'Status',
        value: project.status,
      },
      project.projectType && {
        '@type': 'PropertyValue',
        name: 'Project Category',
        value: project.projectType,
      },
      project.builderName && {
        '@type': 'PropertyValue',
        name: 'Builder',
        value: project.builderName,
      },
      project.startingPrice && {
        '@type': 'PropertyValue',
        name: 'Starting Price',
        value: formatPkr(project.startingPrice),
      },
      small && {
        '@type': 'PropertyValue',
        name: 'Smallest Unit',
        value: small.type,
      },
    ].filter(Boolean),
  }
}

/* -------------------------------------------------------------------------- */
/* Listing schema — RealEstateListing                                         */
/* (See note on the project schema above re: why Product was removed.)        */
/* -------------------------------------------------------------------------- */

export function propertyListingSchema(listing: PropertyListing) {
  const url = `${getServerSideURL()}/listings/${listing.slug}`
  const image = listingHeroImage(listing)
  const description =
    listing.summary?.trim() ||
    richTextExcerpt(listing.description, 200) ||
    `${listing.title} — ${listing.propertyType ?? 'Property'} in ${listing.location ?? 'Karachi'}.`
  const society = getSocietyOrProject(listing)
  const geo = geoCoordinates(listing.googleMapsEmbedUrl)

  const offers = listing.price
    ? {
        '@type': 'Offer',
        priceCurrency: 'PKR',
        price: listing.price,
        availability: 'https://schema.org/InStock',
        url,
      }
    : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    name: listing.title,
    description,
    image: image ? [image] : undefined,
    url,
    category: listing.propertyType,
    address: postalAddress(listing.addressLine, listing.location),
    ...(geo && { geo }),
    ...(listing.rooms != null && { numberOfRooms: listing.rooms }),
    ...(listing.areaSqFt != null && {
      floorSize: {
        '@type': 'QuantitativeValue',
        value: listing.areaSqFt,
        unitCode: 'FTK',
      },
    }),
    ...(offers && { offers }),
    additionalProperty: [
      listing.location && {
        '@type': 'PropertyValue',
        name: 'Location',
        value: listing.location,
      },
      listing.status && {
        '@type': 'PropertyValue',
        name: 'Status',
        value: listing.status,
      },
      listing.rooms != null && {
        '@type': 'PropertyValue',
        name: 'Rooms',
        value: listing.rooms,
      },
      listing.bathrooms != null && {
        '@type': 'PropertyValue',
        name: 'Bathrooms',
        value: listing.bathrooms,
      },
      listing.areaSqFt != null && {
        '@type': 'PropertyValue',
        name: 'Area (sq ft)',
        value: listing.areaSqFt,
      },
      society && {
        '@type': 'PropertyValue',
        name: 'Society / Project',
        value: society,
      },
      listing.price && {
        '@type': 'PropertyValue',
        name: 'Price',
        value: formatPkr(listing.price),
      },
    ].filter(Boolean),
  }
}

/* -------------------------------------------------------------------------- */
/* FAQPage schema — Google's drop-down rich result                            */
/* -------------------------------------------------------------------------- */

export type FaqRow = { question: string; answer: string }

export function faqPageSchema(
  faqs: FaqRow[] | null | undefined,
  contextUrl?: string,
) {
  if (!faqs || !faqs.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(contextUrl && { mainEntityOfPage: { '@type': 'WebPage', '@id': contextUrl } }),
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  }
}

/* -------------------------------------------------------------------------- */
/* BreadcrumbList schema — SERP hierarchy display                             */
/* -------------------------------------------------------------------------- */

export function breadcrumbListSchema(items: { name: string; url: string }[]) {
  if (!items?.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

/* -------------------------------------------------------------------------- */
/* Organization / RealEstateAgent schema — sitewide NAP                       */
/* -------------------------------------------------------------------------- */

/**
 * Multi-typed LocalBusiness + RealEstateAgent entity emitted on the home page.
 * Google's LocalBusiness rich-result eligibility requires the LocalBusiness type
 * (or one of its subtypes — RealEstateAgent qualifies, but listing both keeps
 * the document discoverable via either Schema.org query path).
 *
 * Edit the constants below when business details change. The constants are
 * intentionally at the top of the function for one-line edits.
 */
export function organizationSchema() {
  const url = getServerSideURL().replace(/\/$/, '')

  // ── EDIT THESE WHEN BUSINESS DETAILS CHANGE ───────────────────────────────
  const NAME = 'Lateef Properties'
  const PHONE_E164 = '+923363528333'
  const EMAIL = 'info.lateefproperties@gmail.com'
  const STREET = 'Ground Floor Office, Four Seasons Apartment, Block 16, Gulshan-e-Iqbal'
  const CITY = 'Karachi'
  const REGION = 'Sindh'
  const COUNTRY = 'PK'
  // Block 16, Gulshan-e-Iqbal centroid. Swap in a precise pin if you have one.
  const GEO_LAT = 24.917
  const GEO_LNG = 67.0857
  const MAPS_URL = 'https://maps.app.goo.gl/RTVU2EMN8bzqwbQL9'
  const WHATSAPP_URL = 'https://wa.me/923363528333'
  // priceRange: a qualitative band ($, $$, $$$, $$$$) or a literal range string.
  const PRICE_RANGE = 'PKR 80 Lac+'
  // Real socials. WhatsApp first (it's the primary contact channel) then the
  // public social profiles Google uses for the Knowledge Panel.
  const SAME_AS: string[] = [
    WHATSAPP_URL,
    'https://www.instagram.com/lateefproperties',
    'https://www.facebook.com/lateefpropertiespk',
  ]
  // ──────────────────────────────────────────────────────────────────────────

  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'RealEstateAgent'],
    '@id': `${url}/#organization`,
    name: NAME,
    legalName: NAME,
    url,
    logo: { '@type': 'ImageObject', url: `${url}/brand/lateef-logo.png` },
    image: `${url}/brand/lateef-logo.png`,
    telephone: PHONE_E164,
    email: EMAIL,
    description:
      'Authorised marketing agency for Karachi real estate. Apartments, plots, offices and shops across Gulshan-e-Iqbal, Gulistan-e-Jauhar, Scheme 33, DHA, Clifton, M.A. Jinnah Road, Jinnah Avenue and Malir. Pre-launch allocations on Karachi’s leading developments and off-market resale.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: STREET,
      addressLocality: CITY,
      addressRegion: REGION,
      addressCountry: COUNTRY,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: GEO_LAT,
      longitude: GEO_LNG,
    },
    hasMap: MAPS_URL,
    areaServed: [
      { '@type': 'City', name: 'Karachi' },
      { '@type': 'City', name: 'Sukkur' },
      { '@type': 'Place', name: 'Gulshan-e-Iqbal' },
      { '@type': 'Place', name: 'Gulistan-e-Jauhar' },
      { '@type': 'Place', name: 'Scheme 33' },
      { '@type': 'Place', name: 'DHA Karachi' },
      { '@type': 'Place', name: 'Clifton' },
      { '@type': 'Place', name: 'Jinnah Avenue' },
      { '@type': 'Place', name: 'Model Colony' },
      { '@type': 'Place', name: 'Malir' },
    ],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '10:00',
        closes: '19:00',
      },
      // Sunday: office closed.
    ],
    priceRange: PRICE_RANGE,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: PHONE_E164,
        email: EMAIL,
        areaServed: 'PK',
        availableLanguage: ['en', 'ur'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        url: WHATSAPP_URL,
        areaServed: 'PK',
        availableLanguage: ['en', 'ur'],
      },
    ],
    sameAs: SAME_AS,
    knowsAbout: [
      'Karachi real estate',
      'Pre-launch property allocations',
      'Under-construction projects Karachi',
      'Ready-for-possession apartments Karachi',
      'Off-market resale',
      'Property investment Karachi',
      'Apartments in Gulshan-e-Iqbal',
      'Apartments in Gulistan-e-Jauhar',
      'Apartments in Scheme 33',
      'Apartments in DHA Karachi',
      'Apartments in Clifton',
      'M.A. Jinnah Road property',
      'Jinnah Avenue commercial property',
      'Malir property',
    ],
  }
}

/* -------------------------------------------------------------------------- */
/* Article schema — Blog post structured data                                 */
/* -------------------------------------------------------------------------- */

export function articleSchema(blog: Blog) {
  const url = `${getServerSideURL()}/blog/${blog.slug}`
  const featured = blog.featuredImage as Media | number | null | undefined
  const imageObj = typeof featured === 'object' && featured ? featured : null
  const image = imageObj?.url ?? null
  const published = blog.publishedAt ?? blog.createdAt
  const modified = blog.updatedAt ?? published

  return {
    '@context': 'https://schema.org',
    '@type': ['BlogPosting', 'Article'],
    '@id': url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: blog.title,
    description:
      blog.meta?.description ?? blog.excerpt ?? `${blog.title} — Lateef Properties`,
    inLanguage: 'en-PK',
    url,
    datePublished: published,
    dateModified: modified,
    ...(image && {
      image: [
        {
          '@type': 'ImageObject',
          url: image,
          ...(imageObj?.width && { width: imageObj.width }),
          ...(imageObj?.height && { height: imageObj.height }),
        },
      ],
    }),
    author: {
      '@type': 'Organization',
      '@id': `${getServerSideURL()}/#organization`,
      name: 'Lateef Properties',
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${getServerSideURL()}/#organization`,
      name: 'Lateef Properties',
      logo: {
        '@type': 'ImageObject',
        url: `${getServerSideURL()}/brand/lateef-logo.png`,
      },
    },
    ...(blog.keywords?.length && {
      keywords: blog.keywords.map((k) => k.keyword).filter(Boolean).join(', '),
    }),
  }
}
