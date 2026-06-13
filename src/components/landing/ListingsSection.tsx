import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { fetchPublishedListings } from '@/lib/property-listings'
import { PropertyListingCard } from './PropertyListingCard'
import { SectionRule } from './SectionRule'
import { FeaturedListingsReveal } from './FeaturedListingsReveal'

export async function ListingsSection() {
  let listings = [] as Awaited<ReturnType<typeof fetchPublishedListings>>
  try {
    const payload = await getPayload({ config })
    listings = await fetchPublishedListings(payload)
  } catch {
    listings = []
  }

  return (
    <section id="listings-section" className="relative bg-cream py-24 md:py-32">
      <div className="container">
        <div className="mb-16 grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                03 / LISTINGS
              </span>
              <span className="h-px w-10 bg-gold" />
            </div>
            <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl lg:text-6xl">
              Ready-to-move flats and shops in{' '}
              <span className="italic text-gold">Karachi.</span>
            </h2>
            <SectionRule className="mt-6" />
          </div>
          <p className="text-base leading-relaxed text-brand-deep/70 lg:col-span-5 lg:text-lg">
            Apartments, plots, offices and shops for sale across Gulshan-e-Iqbal,
            Gulistan-e-Jauhar, Scheme 33, DHA, Clifton, M.A. Jinnah Road, Jinnah
            Avenue and Malir. Viewings within 48 hours.
          </p>
        </div>

        {listings.length > 0 ? (
          <FeaturedListingsReveal>
            {listings.map((listing) => (
              <PropertyListingCard key={listing.id} listing={listing} />
            ))}
          </FeaturedListingsReveal>
        ) : (
          <div className="rounded-3xl border border-dashed border-brand-deep/15 bg-white px-8 py-16 text-center">
            <p className="eyebrow text-gold">Ready-to-Move Inventory</p>
            <h3 className="mt-3 font-serif text-2xl text-brand-deep md:text-3xl">
              New listings landing soon.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-brand-deep/65">
              Fresh Karachi listings are being added — apartments, plots, offices
              and shops. Send your brief and we&rsquo;ll match you off-market.
            </p>
            <Link
              href="/properties"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-gold hover:text-brand-deep"
            >
              Source my match
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-border pt-10 sm:flex-row sm:items-center">
          <p className="max-w-md text-sm leading-relaxed text-brand-deep/70">
            Looking for off-market deals? We source ready-to-move flats, plots and
            commercial units across Karachi that don&rsquo;t hit public portals.
          </p>
          <Link
            href="/properties"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-gold hover:text-brand-deep"
          >
            Browse all properties
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
