import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import { LOCATION_ENTITIES } from '@/lib/project-mapper'
import { locationContent } from '@/lib/location-content'
import { breadcrumbListSchema, itemListSchema } from '@/lib/seo-jsonld'
import { JsonLd } from '@/components/shared/JsonLd'
import { SectionRule } from '@/components/landing/SectionRule'
import { FinalCTASection } from '@/components/shared/FinalCTASection'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Hub for the location silo.
 *
 * This route did not exist — /locations returned a 404 — so the nine area pages
 * had exactly one inbound internal link each (the footer), and model-colony had
 * none at all. A hub gives the cluster a parent, spreads link equity, and gives
 * the "areas" branch of the site a crawlable entry point.
 */
export const metadata: Metadata = {
  title: 'Karachi Property by Area | Lateef Properties',
  description:
    'Browse property for sale across Karachi by area — Gulistan-e-Johar, Gulshan-e-Iqbal, Scheme 33, DHA, Clifton, Malir and more. Projects and resale listings.',
  alternates: { canonical: `${getServerSideURL().replace(/\/$/, '')}/locations` },
}

export const revalidate = 300

export default async function LocationsIndexPage() {
  const base = getServerSideURL().replace(/\/$/, '')

  // Counts per area so the hub shows which areas actually have inventory
  // rather than presenting nine identical links.
  let counts = new Map<string, number>()
  try {
    const payload = await getPayload({ config })
    const [projects, listings] = await Promise.all([
      payload.find({ collection: 'featured-projects', depth: 0, limit: 500, pagination: false }),
      payload.find({ collection: 'property-listings', depth: 0, limit: 500, pagination: false }),
    ])
    for (const d of [...projects.docs, ...listings.docs] as { location?: string | null }[]) {
      if (d.location) counts.set(d.location, (counts.get(d.location) ?? 0) + 1)
    }
  } catch {
    counts = new Map()
  }

  const areas = LOCATION_ENTITIES.map((e) => ({
    slug: e.slug,
    name: e.canonical,
    count: counts.get(e.canonical) ?? 0,
    blurb: locationContent(e.slug)?.metaDescription ?? null,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const schemas = [
    breadcrumbListSchema([
      { name: 'Home', url: `${base}/` },
      { name: 'Areas', url: `${base}/locations` },
    ]),
    itemListSchema(
      areas.map((a) => ({ name: a.name, url: `${base}/locations/${a.slug}` })),
      'Karachi property by area',
    ),
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <section className="relative overflow-hidden bg-brand-gradient pb-20 pt-32 text-white md:pb-28 md:pt-40">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="container max-w-4xl">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              AREAS · KARACHI
            </span>
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight text-balance md:text-6xl">
              Karachi Property by Area
            </h1>
            <SectionRule className="mt-7" />
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/85">
              Where you buy in Karachi changes the price, the commute and the resale market as much
              as the building itself does. Pick an area to see the projects and resale inventory we
              currently have there.
            </p>
          </div>
        </section>

        <section className="bg-ivory py-20 md:py-28">
          <div className="container">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((a) => (
                <Link
                  key={a.slug}
                  href={`/locations/${a.slug}`}
                  className="group rounded-xl border border-brand-deep/10 bg-white p-6 transition-colors hover:border-gold"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-serif text-2xl text-brand-deep group-hover:text-gold">
                      {a.name}
                    </h2>
                    <span className="shrink-0 text-[0.7rem] uppercase tracking-[0.15em] text-brand-deep/45">
                      {a.count > 0 ? `${a.count} listed` : 'Enquire'}
                    </span>
                  </div>
                  {a.blurb && (
                    <p className="mt-3 text-sm leading-relaxed text-brand-deep/65">{a.blurb}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <FinalCTASection
          sourceName="Karachi areas"
          sourceSlug="locations"
          sourceKind="location"
          sectionNumber="02 / ENQUIRE"
        />
      </main>
    </>
  )
}
