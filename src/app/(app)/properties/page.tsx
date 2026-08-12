import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import { SearchFilter } from '@/components/properties/SearchFilter'
import { PropertyResultsGrid } from '@/components/properties/PropertyResultsGrid'
import { ZeroResultsLeadTrap } from '@/components/properties/ZeroResultsLeadTrap'
import { CategoryHub } from '@/components/properties/CategoryHub'
import { fetchUnified, parseSearchParams, type RawSearchParams } from '@/lib/property-search'
import { breadcrumbListSchema } from '@/lib/seo-jsonld'
import { JsonLd } from '@/components/shared/JsonLd'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

const base = getServerSideURL().replace(/\/$/, '')

/**
 * Filtered views (?location=…&unitType=…) are noindexed but followed.
 *
 * Faceted navigation generates effectively unlimited URL permutations; left
 * indexable they compete with /properties itself and spread crawl budget across
 * near-identical result sets. `follow` keeps the links inside them live, so the
 * project and listing pages they point at still receive the equity.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}): Promise<Metadata> {
  const sp = await searchParams
  const isFiltered = Object.values(sp ?? {}).some((v) => v != null && v !== '')

  return {
    ...metadata,
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
  }
}

const metadata: Metadata = {
  title: 'Properties for Sale in Karachi | Flats, Plots, Offices, Shops | Lateef Properties',
  description:
    'Browse pre-launch allocations, ready-for-possession flats, plots, offices and shops across Karachi. Filter by location, type, status and budget. Curated, hand-picked inventory.',
  alternates: { canonical: `${base}/properties` },
  openGraph: {
    title: 'Properties for Sale in Karachi | Lateef Properties',
    description:
      'Browse pre-launch allocations, ready-for-possession listings, and off-market resale across Karachi.',
    url: `${base}/properties`,
    type: 'website',
    siteName: 'Lateef Properties',
  },
  keywords: [
    'properties for sale in Karachi',
    'flats for sale Karachi',
    'plots for sale Karachi',
    'commercial property Karachi',
    'office for sale Karachi',
    'shop for sale Karachi',
    'pre-launch projects Karachi',
    'ready to move flats',
    'off-market property',
    'curated property Karachi',
    'Gulshan-e-Iqbal properties',
    'Scheme 33 properties',
    'DHA Karachi property',
    'Lateef Properties',
  ],
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  const parsed = parseSearchParams(sp)
  const isFiltered = Object.values(sp ?? {}).some((v) => v != null && v !== '')

  const payload = await getPayload({ config })
  const items = await fetchUnified(payload, parsed)

  const defaults = {
    location: parsed.location ?? '',
    propertyType: parsed.propertyType ?? '',
    status: parsed.status ?? '',
    unitType: parsed.unitType ?? '',
    minPrice: parsed.minPrice != null ? String(parsed.minPrice) : '',
    maxPrice: parsed.maxPrice != null ? String(parsed.maxPrice) : '',
  }

  const breadcrumb = breadcrumbListSchema([
    { name: 'Home', url: `${base}/` },
    { name: 'Properties', url: `${base}/properties` },
  ])

  return (
    <>
      <JsonLd data={breadcrumb} />
      <main className="bg-ivory pb-24 pt-32 md:pb-32 md:pt-40">
        <div className="container">
          <div className="mb-10 max-w-3xl">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              01 / INVENTORY
            </span>
            <h1 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-6xl">
              Karachi apartments, plots and{' '}
              <span className="italic text-gold">commercial.</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-deep/70 md:text-lg">
              Pre-launch allocations, ready-to-move listings and off-market resale
              across Gulshan-e-Iqbal, Scheme 33, Gulistan-e-Johar, DHA and Clifton.
              Set your filters — we&rsquo;ll source what isn&rsquo;t here.
            </p>
          </div>

          <div className="mb-10">
            <SearchFilter defaults={defaults} />
          </div>

          {items.length > 0 ? (
            <PropertyResultsGrid items={items} />
          ) : (
            <ZeroResultsLeadTrap searchedParams={parsed} />
          )}

          {/* Crawlable category links + inventory summary. Rendered on the
              unfiltered hub only — on a filtered view it would repeat the same
              block across every permutation. */}
          {!isFiltered && <CategoryHub payload={payload} />}
        </div>
      </main>
    </>
  )
}
