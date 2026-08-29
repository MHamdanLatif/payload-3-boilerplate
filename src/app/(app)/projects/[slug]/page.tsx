import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  areaRangeLabel,
  fetchProjectBySlug,
  fetchPublishedProjectSlugs,
  formatPkr,
  heroImage,
  richTextExcerpt,
  unitSummary,
} from '@/lib/featured-projects'
import {
  realEstateListingSchema,
  apartmentComplexSchema,
  breadcrumbListSchema,
  faqPageSchema,
} from '@/lib/seo-jsonld'
import { fetchRelatedBlogs } from '@/lib/blogs'
import { findEntityByProjectSlug } from '@/lib/project-mapper'
import { deriveProjectKeywords } from '@/lib/seo-keywords'
import { ProjectHero } from '@/components/projects/ProjectHero'
import { ProjectOverview } from '@/components/projects/ProjectOverview'
import { UnitTypesTable } from '@/components/projects/UnitTypesTable'
import { BuilderTrackRecord } from '@/components/projects/BuilderTrackRecord'
import { PaymentPlanCalculator } from '@/components/projects/PaymentPlanCalculator'
import { NightElevationCard } from '@/components/projects/NightElevationCard'
import { AmenitiesSection } from '@/components/shared/AmenitiesSection'
import { PhotoGallerySection } from '@/components/shared/PhotoGallerySection'
import { MapSection } from '@/components/shared/MapSection'
import { FaqSection } from '@/components/shared/FaqSection'
import { InsightsSection } from '@/components/blog/InsightsSection'
import { FinalCTASection } from '@/components/shared/FinalCTASection'
import { WhatsAppFloatingCta } from '@/components/projects/WhatsAppFloatingCta'
import { JsonLd } from '@/components/shared/JsonLd'
import { getServerSideURL } from '@/utilities/getURL'

type Params = { slug: string }

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const slugs = await fetchPublishedProjectSlugs(payload)
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
  const project = await fetchProjectBySlug(payload, slug)
  if (!project) return { title: 'Project not found | Lateef Properties' }

  const seoTitle = project.meta?.title ?? `${project.title} | Lateef Properties`

  // When no description is authored, enrich the fallback with derived unit
  // facts rather than shipping bare prose: these pages rank for price, size and
  // payment-plan queries, so those figures are what earns the click. An
  // explicitly authored meta.description always wins.
  const seoDescription = (() => {
    if (project.meta?.description) return project.meta.description
    const base = project.summary ?? richTextExcerpt(project.description, 160) ?? ''
    const s = unitSummary(project)
    if (!s) return base
    const facts = [
      `${s.count} unit ${s.count === 1 ? 'type' : 'types'}`,
      // Duplex ahead of area: it is the query cluster these pages need to win.
      s.duplexCount ? `${s.duplexCount} duplex` : null,
      areaRangeLabel(s),
      `from ${formatPkr(s.minPrice)}`,
    ]
      .filter(Boolean)
      .join(', ')
    const merged = `${base ? `${base.replace(/\s*[.·]\s*$/, '')}. ` : ''}${facts}. Installment plans available.`
    return merged.length > 155 ? `${merged.slice(0, 152).trimEnd()}…` : merged
  })()
  const ogImage =
    (typeof project.meta?.image === 'object' && project.meta?.image?.url) ||
    heroImage(project) ||
    undefined
  const canonical = `${getServerSideURL()}/projects/${project.slug}`

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
    keywords: deriveProjectKeywords(project),
  }
}

export const dynamicParams = true
export const revalidate = 60

export default async function ProjectLandingPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const project = await fetchProjectBySlug(payload, slug)
  if (!project) notFound()

  // Reverse internal links: surface articles that mention this project. Match on
  // the project title plus its entity aliases (so "Saima Elite" / "Tulip" hit too).
  const entity = project.slug ? findEntityByProjectSlug(project.slug) : null
  const relatedBlogs = await fetchRelatedBlogs(
    payload,
    [project.title, ...(entity?.aliases ?? [])],
    3,
  )

  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/projects/${project.slug}`

  const schemas = [
    realEstateListingSchema(project),
    // Null when the project has no unitTypes rows; JsonLd filters nulls.
    apartmentComplexSchema(project),
    breadcrumbListSchema([
      { name: 'Home', url: `${base}/` },
      { name: 'Properties', url: `${base}/properties` },
      { name: project.title, url: canonical },
    ]),
    faqPageSchema(project.faqs, canonical),
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <ProjectHero project={project} />
        <ProjectOverview project={project} />
        {/* Units sit directly after the overview and BEFORE the calculator:
            prices/sizes/availability are what the search queries reaching this
            page actually ask for, and this is server-rendered text whereas the
            calculator below is a client component. Renders nothing when the
            project has no unitTypes rows. */}
        <UnitTypesTable project={project} sectionNumber="02 / AVAILABLE UNITS" />
        {/* Placed immediately after the prices: seeing a pre-launch figure is
            exactly what prompts "but will they actually build it?" - answering
            it here, rather than at the foot of the page, meets the doubt where
            it arises. Renders nothing when a project has no track record. */}
        <BuilderTrackRecord project={project} sectionNumber="03 / THE BUILDER" />
        <PaymentPlanCalculator project={project} sectionNumber="04 / PAYMENT PLAN" />
        <NightElevationCard project={project} />
        <AmenitiesSection amenities={project.amenities} sectionNumber="05 / AMENITIES" />
        <PhotoGallerySection
          photos={project.photoGallery}
          itemTitle={project.title}
          sectionNumber="06 / GALLERY"
        />
        <MapSection
          embedUrl={project.googleMapsEmbedUrl}
          itemTitle={project.title}
          location={project.location}
          sectionNumber="07 / LOCATION"
        />
        <FaqSection faqs={project.faqs} sectionNumber="08 / FAQ" />
        <InsightsSection
          blogs={relatedBlogs}
          eyebrow="FURTHER READING"
          heading={`More on ${project.title}.`}
          intro={`Guides and pricing breakdowns that reference ${project.title} and its location.`}
          bg="bg-cream"
        />
        <FinalCTASection
          sourceName={project.title}
          sourceSlug={project.slug ?? ''}
          sourceKind="project"
          sectionNumber="09 / ENQUIRE"
        />
      </main>
      <WhatsAppFloatingCta projectTitle={project.title} projectSlug={project.slug ?? undefined} />
    </>
  )
}
