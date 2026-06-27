import {
  BadgeCheck,
  BedDouble,
  Bath,
  Building2,
  Maximize2,
  MapPin,
  Banknote,
  Building,
} from 'lucide-react'
import type { PropertyListing } from '@/payload-types'
import { SectionRule } from '@/components/landing/SectionRule'
import { formatPkr } from '@/lib/featured-projects'
import { getSocietyOrProject } from '@/lib/property-listings'
import RichText from '@/components/RichText'

const FACT_ICON = {
  status: BadgeCheck,
  type: Building2,
  society: Building,
  location: MapPin,
  price: Banknote,
  rooms: BedDouble,
  bathrooms: Bath,
  area: Maximize2,
}

export function ListingOverview({ listing }: { listing: PropertyListing }) {
  const society = getSocietyOrProject(listing)
  const facts: { icon: keyof typeof FACT_ICON; label: string; value: string }[] = [
    { icon: 'status', label: 'Status', value: listing.status ?? '—' },
    listing.propertyType && {
      icon: 'type' as const,
      label: 'Type',
      value: listing.propertyType,
    },
    society && { icon: 'society' as const, label: 'Society / Project', value: society },
    { icon: 'location', label: 'Location', value: listing.location ?? '—' },
    listing.price != null && {
      icon: 'price' as const,
      label: 'Price',
      value: formatPkr(listing.price),
    },
    listing.rooms != null && {
      icon: 'rooms' as const,
      label: 'Rooms',
      value: `${listing.rooms}`,
    },
    listing.bathrooms != null && {
      icon: 'bathrooms' as const,
      label: 'Bathrooms',
      value: `${listing.bathrooms}`,
    },
    listing.areaSqFt != null && {
      icon: 'area' as const,
      label: 'Area',
      value: `${listing.areaSqFt.toLocaleString()} sq ft`,
    },
  ].filter(Boolean) as { icon: keyof typeof FACT_ICON; label: string; value: string }[]

  return (
    <section className="bg-ivory py-20 md:py-28">
      <div className="container grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              01 / OVERVIEW
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep text-balance md:text-5xl">
            About this property
          </h2>
          <SectionRule className="mt-6" />

          {listing.description ? (
            <div className="mt-8 max-w-none text-brand-deep/80">
              <RichText
                content={listing.description as Record<string, unknown>}
                enableGutter={false}
              />
            </div>
          ) : (
            <p className="mt-8 text-base leading-relaxed text-brand-deep/70 md:text-lg">
              {listing.summary || `${listing.title} in ${listing.location}.`}
            </p>
          )}
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-28 rounded-2xl border border-brand-deep/10 bg-white p-6 shadow-luxe-sm md:p-8">
            <p className="eyebrow text-gold">Key Facts</p>
            <h3 className="mt-3 font-serif text-xl tracking-tight text-brand-deep">
              At a glance
            </h3>

            <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border">
              {facts.map(({ icon, label, value }) => {
                const Icon = FACT_ICON[icon]
                return (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 bg-white px-4 py-3.5"
                  >
                    <dt className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.2em] text-brand-deep/55">
                      <Icon className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.6} />
                      {label}
                    </dt>
                    <dd className="text-right font-medium text-brand-deep">{value}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </aside>
      </div>
    </section>
  )
}
