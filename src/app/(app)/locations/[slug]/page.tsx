import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { fetchProjectsByLocation } from '@/lib/featured-projects'
import { availableProjectsWhere } from '@/lib/project-visibility'
import { fetchRelatedBlogs } from '@/lib/blogs'
import { LOCATION_ENTITIES, findEntityByLocationSlug } from '@/lib/project-mapper'
import { locationContent } from '@/lib/location-content'
import { breadcrumbListSchema, faqPageSchema, itemListSchema } from '@/lib/seo-jsonld'
import { JsonLd } from '@/components/shared/JsonLd'
import { FaqSection } from '@/components/shared/FaqSection'
import { SectionRule } from '@/components/landing/SectionRule'
import { FeaturedProjectCard } from '@/components/landing/FeaturedProjectCard'
import { InsightsSection } from '@/components/blog/InsightsSection'
import { FinalCTASection } from '@/components/shared/FinalCTASection'
import { getServerSideURL } from '@/utilities/getURL'

type Params = { slug: string }

export async function generateStaticParams() {
  return LOCATION_ENTITIES.map((e) => ({ slug: e.slug }))
}

/**
 * Does this location have anything to show? Drives the noindex gate in
 * generateMetadata. Counts only — the page body does its own full fetches, and
 * Next dedupes within a request.
 */
async function locationHasInventory(canonical: string): Promise<boolean> {
  try {
    const payload = await getPayload({ config })
    const projects = await payload.count({ collection: 'featured-projects', overrideAccess: false, where: { and: [availableProjectsWhere, { location: { equals: canonical } }] } })
    return projects.totalDocs > 0
  } catch {
    // On a DB hiccup, prefer indexable over accidentally noindexing a good page.
    return true
  }
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
  const authored = locationContent(entry.slug)

  const title =
    authored?.metaTitle ??
    `${entry.canonical} Properties — Karachi Property Projects | Lateef Properties`
  const description =
    authored?.metaDescription ??
    `Featured developments and ready-to-move properties in ${entry.canonical}, Karachi. ` +
      `Builder-supplied apartments and commercial units marketed by Lateef Properties.`

  // Empty project locations stay out of search until builder inventory is available.
  const hasInventory = await locationHasInventory(entry.canonical)

  return {
    title,
    description,
    ...(hasInventory ? {} : { robots: { index: false, follow: true } }),
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
  const [projects, relatedBlogs] = await Promise.all([
    fetchProjectsByLocation(payload, entry.canonical),
    fetchRelatedBlogs(payload, [entry.canonical, ...entry.aliases], 3),
  ])

  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/locations/${entry.slug}`

  const authored = locationContent(entry.slug)

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
    // Tells Google these pages hold real inventory rather than being another
    // thin area page — previously only a breadcrumb and a bare Place were
    // emitted, which said nothing about what is actually for sale here.
    itemListSchema(
      [
        ...projects.map((p) => ({
          name: p.title,
          url: `${base}/projects/${p.slug}`,
        })),
      ],
      `Property for sale in ${entry.canonical}, Karachi`,
    ),
    faqPageSchema(authored?.faqs ?? [], canonical),
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
            {/* Keyword-qualified H1. Was the bare area name ("DHA"), which told
                Google nothing about what the page offers. */}
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
              {authored?.h1 ?? `Property for Sale in ${entry.canonical}, Karachi`}
            </h1>
            <SectionRule className="mt-7" />
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl">
              {authored?.intro ?? (
                <>
                  Explore projects in {entry.canonical}, from pre-launch to ready to move. Compare locations, layouts and payment options with Lateef Properties.
                </>
              )}
            </p>
            {authored?.detail && (
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                {authored.detail}
              </p>
            )}
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


        {projects.length === 0 && (
          <section className="bg-ivory py-20 md:py-28">
            <div className="container max-w-2xl text-center">
              <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
                INVENTORY LOADING
              </span>
              <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-brand-deep md:text-5xl">
                Explore project options in {entry.canonical}.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-brand-deep/70">
                We have no active property projects in this area at present. Share your requirements
                to discuss available projects in nearby locations or future launches.
              </p>
            </div>
          </section>
        )}

        {/* Authored FAQs — also emitted as FAQPage structured data above, so
            these can surface as rich results for the area's question queries. */}
        <FaqSection faqs={authored?.faqs} sectionNumber="03 / QUESTIONS" />

        <InsightsSection
          blogs={relatedBlogs}
          eyebrow={`READING · ${entry.canonical.toUpperCase()}`}
          heading={`${entry.canonical} buyer guides.`}
          intro={`Area deep-dives and pricing breakdowns to read before you buy in ${entry.canonical}.`}
        />

        <FinalCTASection
          sourceName={entry.canonical}
          sourceSlug={entry.slug}
          sourceKind="location"
          sectionNumber="03 / ENQUIRE"
          intro={`Share your ${entry.canonical} buying brief — an advisor can discuss current project availability and pricing.`}
        />
      </main>
    </>
  )
}
