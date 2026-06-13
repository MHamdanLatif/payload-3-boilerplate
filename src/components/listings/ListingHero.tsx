import Image from 'next/image'
import { MapPin } from 'lucide-react'
import type { PropertyListing } from '@/payload-types'
import { LeadForm } from '@/components/forms/LeadForm'
import { listingHeroImage, getSocietyOrProject, imageAlt } from '@/lib/property-listings'
import { formatPkr } from '@/lib/featured-projects'

const STATUS_TONE: Record<string, string> = {
  'Ready for Possession': 'bg-gold text-brand-deep',
  Resale: 'bg-white/15 text-white backdrop-blur-sm border border-white/30',
  'Urgent Sale': 'bg-[#c25b3a] text-white',
}

export function ListingHero({ listing }: { listing: PropertyListing }) {
  const bg = listingHeroImage(listing)
  const alt = imageAlt(listing.mainImage, listing.title)
  const society = getSocietyOrProject(listing)
  const statusTone = STATUS_TONE[listing.status ?? ''] ?? 'bg-gold text-brand-deep'

  return (
    <section className="relative isolate min-h-[85vh] overflow-hidden bg-brand-deep text-white">
      {bg && (
        <Image
          src={bg}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover"
        />
      )}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-brand-deep/95 via-brand-deep/75 to-brand-deep/30" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep/90 via-transparent to-transparent" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="container relative grid grid-cols-1 items-center gap-12 py-28 lg:grid-cols-12 lg:gap-16 lg:py-32">
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-center gap-3">
            {listing.status && (
              <span
                className={
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] ' +
                  statusTone
                }
              >
                <span className="h-1 w-1 rounded-full bg-current" />
                {listing.status}
              </span>
            )}
            {listing.propertyType && (
              <span className="rounded-full border border-white/30 px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-white/85">
                {listing.propertyType}
              </span>
            )}
            {society && (
              <span className="text-[0.7rem] uppercase tracking-[0.25em] text-white/55">
                {society}
              </span>
            )}
          </div>

          <h1 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-6xl">
            {listing.title}
          </h1>

          {listing.location && (
            <p className="mt-4 flex items-center gap-2 text-base text-white/85 md:text-lg">
              <MapPin className="h-4 w-4 text-gold" />
              {listing.location}
            </p>
          )}

          {listing.summary && (
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
              {listing.summary}
            </p>
          )}

          {listing.price != null && (
            <div className="mt-8 inline-flex items-baseline gap-3 rounded-lg border border-white/15 bg-white/[0.06] px-5 py-3 backdrop-blur-sm">
              <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/55">
                Price
              </span>
              <span className="font-serif text-2xl text-gold">{formatPkr(listing.price)}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="relative">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-gold/40 via-transparent to-transparent" />
            <div className="relative rounded-2xl border border-white/10 bg-white/95 p-6 text-brand-deep shadow-luxe sm:p-7">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 bg-gold" />
                <span className="eyebrow text-gold">Get a Callback</span>
              </div>
              <h2 className="font-serif text-2xl leading-tight tracking-tight text-brand-deep">
                Schedule a viewing.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-deep/65">
                A senior advisor will call within 24 hours to arrange a visit and answer
                any questions on title, financing, or possession.
              </p>
              <div className="mt-5">
                <LeadForm
                  sourceName={listing.title}
                  sourceSlug={listing.slug ?? ''}
                  sourceKind="listing"
                  placement="hero"
                  tone="light"
                  submitLabel="Request a Callback"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
