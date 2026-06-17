import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  fetchProjectBySlug,
  fetchPublishedProjectSlugs,
  heroImage,
  richTextExcerpt,
} from '@/lib/featured-projects'
import {
  realEstateListingSchema,
  breadcrumbListSchema,
  faqPageSchema,
} from '@/lib/seo-jsonld'
import { deriveProjectKeywords } from '@/lib/seo-keywords'
import { ProjectHero } from '@/components/projects/ProjectHero'
import { ProjectOverview } from '@/components/projects/ProjectOverview'
import { PaymentPlanCalculator } from '@/components/projects/PaymentPlanCalculator'
import { NightElevationCard } from '@/components/projects/NightElevationCard'
import { AmenitiesSection } from '@/components/shared/AmenitiesSection'
import { PhotoGallerySection } from '@/components/shared/PhotoGallerySection'
import { MapSection } from '@/components/shared/MapSection'
import { FaqSection } from '@/components/shared/FaqSection'
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
  const seoDescription =
    project.meta?.description ??
    project.summary ??
    richTextExcerpt(project.description, 160)
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

  const base = getServerSideURL().replace(/\/$/, '')
  const canonical = `${base}/projects/${project.slug}`

  const schemas = [
    realEstateListingSchema(project),
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
        <PaymentPlanCalculator project={project} sectionNumber="02 / PAYMENT PLAN" />
        <NightElevationCard project={project} />
        <AmenitiesSection amenities={project.amenities} sectionNumber="03 / AMENITIES" />
        <PhotoGallerySection
          photos={project.photoGallery}
          itemTitle={project.title}
          sectionNumber="04 / GALLERY"
        />
        <MapSection
          embedUrl={project.googleMapsEmbedUrl}
          itemTitle={project.title}
          location={project.location}
          sectionNumber="05 / LOCATION"
        />
        <FaqSection faqs={project.faqs} sectionNumber="06 / FAQ" />
        <FinalCTASection
          sourceName={project.title}
          sourceSlug={project.slug ?? ''}
          sourceKind="project"
          sectionNumber="07 / ENQUIRE"
        />
      </main>
      <WhatsAppFloatingCta projectTitle={project.title} />
    </>
  )
}
