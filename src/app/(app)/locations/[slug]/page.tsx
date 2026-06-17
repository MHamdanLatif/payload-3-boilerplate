import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { fetchProjectsByLocation } from '@/lib/featured-projects'
import { fetchListingsByLocation } from '@/lib/property-listings'
import { LOCATION_ENTITIES, findEntityByLocationSlug } from '@/lib/project-mapper'
import { breadcrumbListSchema } from '@/lib/seo-jsonld'
import { JsonLd } from '@/components/shared/JsonLd'
import { SectionRule } from '@/components/landing/SectionRule'
import { FeaturedProjectCard } from '@/components/landing/FeaturedProjectCard'
import { PropertyListingCard } from '@/components/landing/PropertyListingCard'
import { FinalCTASection } from '@/components/shared/FinalCTASection'
import { getServerSideURL } from '@/utilities/getURL'

type Params = { slug: string }

export async function generateStaticParams() {
  return LOCATION_ENTITIES.map((e) => ({ slug: e.slug }))
}

export const dynamicParams = true
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const entry = findEntityByLocationSlug(slug)
  if (!entry) return { title: 'Location not found | Lateef Properties' }

  const canonical = `${getServerSideURL()}/locations/${entry.slug}`
  const title = `${entry.canonical} Properties — Verified Karachi Real Estate | Lateef Properties`
  const description =
    `Featured developments and ready-to-move properties in ${entry.canonical}, Karachi. ` +
    `Pre-launch allocations and curated resale inventory reviewed by Lateef Properties advisors.`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Lateef Properties',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    keywords: [
      `${entry.canonical} property`,
      `${entry.canonical} apartments`,
      `${entry.canonical} flats`,
      `${entry.canonical} plots`,
      `${entry.canonical} Karachi`,
      `${entry.canonical} real estate`,
      `pre-launch ${entry.canonical}`,
      `apartments for sale in ${entry.canonical}`,
      'Karachi real estate',
      'Lateef Properties',
    ],
  }
}

export default async function LocationLandingPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const entry = findEntityByLocationSlug(slug)
  if (!entry) notFound()

  const payload = await getPayload({ config })
  const [projects, listings] = await Promise.all([
    fetchProjectsByLocation(payload, entry.canonical),
    fetchListingsByLocation(payload, entry.canonical),
  ])

  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/locations/${entry.slug}`

  const schemas = [
    breadcrumbListSchema([
      { name: 'Home', url: `${base}/` },
      { name: 'Properties', url: `${base}/properties` },
      { name: entry.canonical, url: canonical },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: entry.canonical,
      address: {
        '@type': 'PostalAddress',
        addressLocality: entry.canonical,
        addressRegion: 'Sindh',
        addressCountry: 'PK',
      },
      url: canonical,
    },
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <section className="relative overflow-hidden bg-brand-gradient pb-20 pt-32 text-white md:pb-28 md:pt-40">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--gold)/0.18),transparent_55%)]" />
          <div className="container max-w-4xl">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              LOCATION · KARACHI
            </span>
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
              {entry.canonical}
            </h1>
            <SectionRule className="mt-7" />
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl">
              Verified developments and ready-to-move inventory in {entry.canonical}, curated by
              Lateef Properties advisors. Pre-launch allocations on partnered builder projects, and
              off-market resale opportunities, reviewed before recommendation.
            </p>
          </div>
        </section>

        {projects.length > 0 && (
          <section
            id="projects"
            className="bg-ivory py-20 md:py-28"
          >
            <div className="container">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                01 / DEVELOPMENTS
              </span>
              <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep md:text-5xl">
                Featured developments in {entry.canonical}.
              </h2>
              <SectionRule className="mt-6" />
              <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <FeaturedProjectCard key={p.id} project={p} />
                ))}
              </div>
            </div>
          </section>
        )}

        {listings.length > 0 && (
          <section
            id="listings"
            className="bg-cream py-20 md:py-28"
          >
            <div className="container">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                02 / READY INVENTORY
              </span>
              <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.1] tracking-tight text-brand-deep md:text-5xl">
                Ready-to-move properties in {entry.canonical}.
              </h2>
              <SectionRule className="mt-6" />
              <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((l) => (
                  <PropertyListingCard key={l.id} listing={l} />
                ))}
              </div>
            </div>
          </section>
        )}

        {projects.length === 0 && listings.length === 0 && (
          <section className="bg-ivory py-20 md:py-28">
            <div className="container max-w-2xl text-center">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                INVENTORY LOADING
              </span>
              <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-brand-deep md:text-5xl">
                New {entry.canonical} listings on the way.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-brand-deep/70">
                Our advisors are vetting {entry.canonical} inventory now. Drop your requirements and
                we'll match you to projects and off-market resale as they come online.
              </p>
            </div>
          </section>
        )}

        <FinalCTASection
          sourceName={entry.canonical}
          sourceSlug={entry.slug}
          sourceKind="location"
          sectionNumber="03 / ENQUIRE"
          intro={`Share your ${entry.canonical} buying brief — a senior advisor typically reaches you within 15 minutes with current availability and pricing.`}
        />
      </main>
    </>
  )
}
