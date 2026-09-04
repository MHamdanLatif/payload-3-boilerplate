import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { fetchMarketedProject, fetchMarketedSlugs } from '@/lib/marketed-projects'
import { heroImage } from '@/lib/featured-projects'
import { MarketedHeader } from '@/components/marketed/MarketedHeader'
import { MarketedFooter } from '@/components/marketed/MarketedFooter'
import { MarketedHero, REGISTER_ANCHOR } from '@/components/marketed/MarketedHero'
import { MarketedCta } from '@/components/marketed/MarketedCta'
import { StickyActionBar } from '@/components/marketed/StickyActionBar'
import { UnitTypesTable } from '@/components/projects/UnitTypesTable'
import { PaymentPlanCalculator } from '@/components/projects/PaymentPlanCalculator'
import { BuilderTrackRecord } from '@/components/projects/BuilderTrackRecord'
import { PhotoGallerySection } from '@/components/shared/PhotoGallerySection'
import { MapSection } from '@/components/shared/MapSection'
import { getServerSideURL } from '@/utilities/getURL'

type Params = { adSlug: string }

/**
 * Cheap rejection of anything that cannot be a landing-page slug, BEFORE any
 * database work.
 *
 * This route owns every unmatched root path, which means scanners probing
 * `/wp-login.php`, `/.env` and friends land here. Without this they would each
 * open a Postgres query on the way to a 404.
 */
const PLAUSIBLE_SLUG = /^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const slugs = await fetchMarketedSlugs(payload)
    return slugs.map((adSlug) => ({ adSlug }))
  } catch {
    return []
  }
}

// `true` so a page added in the CMS is live without a redeploy — the whole point
// of the collection. The regex guard above is what keeps that affordable.
export const dynamicParams = true
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { adSlug } = await params
  if (!PLAUSIBLE_SLUG.test(adSlug)) return { title: 'Not found' }

  const payload = await getPayload({ config })
  const project = await fetchMarketedProject(payload, adSlug)
  if (!project) return { title: 'Not found', robots: { index: false, follow: false } }

  const title = `${project.title} | Lateef Properties`
  const description =
    project.summary ??
    `${project.title} by ${project.builderName} in ${project.location}. Pricing, payment plans and availability.`
  const image = heroImage(project)

  return {
    title,
    description,
    // Repeated from the layout on purpose. Layout metadata is inherited, but a
    // page that later sets its own `robots` would silently override it, so the
    // guarantee is restated where the page is defined.
    robots: { index: false, follow: false },
    // Open Graph is kept rich even though the page is noindex: messaging
    // crawlers ignore robots directives, and a link pasted into WhatsApp should
    // still preview the building.
    openGraph: {
      title,
      description,
      url: `${getServerSideURL()}/${project.slug}`,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
      siteName: 'Lateef Properties',
    },
  }
}

export default async function MarketedLandingPage({ params }: { params: Promise<Params> }) {
  const { adSlug } = await params
  if (!PLAUSIBLE_SLUG.test(adSlug)) notFound()

  const payload = await getPayload({ config })
  const project = await fetchMarketedProject(payload, adSlug)

  // Unknown root paths used to be handled by the stock `pages` route, which
  // checked the Payload redirects collection before 404ing. That check moves
  // here along with ownership of the root segment.
  if (!project || project.active === false) {
    return <PayloadRedirects url={`/${adSlug}`} />
  }

  // One canonical URL. `/tulipcomforts` and `/tulip-comforts` both resolve to
  // the same document, and are sent to the spelling the CMS holds — otherwise
  // three URLs would each collect their own pixel and analytics data for one page.
  if (project.slug !== adSlug) permanentRedirect(`/${project.slug}`)

  return (
    <>
      <main>
        {/* The header is absolutely positioned, so it needs a positioned
            ancestor scoped to the hero — otherwise it would anchor to the page
            and scroll away from the image it sits on. */}
        <div className="relative">
          <MarketedHeader />
          <MarketedHero project={project} />
        </div>
        <UnitTypesTable
          project={project}
          sectionNumber="01 / AVAILABLE UNITS"
          // The generated prose exists to win organic long-tail queries. This
          // page is noindex, so it would only delay the table.
          showProse={false}
          footerCta={
            <a
              href={`#${REGISTER_ANCHOR}`}
              className="inline-flex items-center justify-center rounded-full bg-gold px-7 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover"
            >
              Register Interest
            </a>
          }
        />
        <PaymentPlanCalculator
          project={project}
          sectionNumber="02 / PAYMENT PLAN"
          // Without this the PDF endpoint looks this slug up in
          // `featured-projects`, misses, and the download fails.
          collection="marketed-projects"
        />
        <PhotoGallerySection
          photos={project.photoGallery}
          itemTitle={project.title}
          sectionNumber="03 / GALLERY"
        />
        <MapSection
          embedUrl={project.googleMapsEmbedUrl}
          itemTitle={project.title}
          location={project.location}
          sectionNumber="04 / LOCATION"
        />
        <BuilderTrackRecord project={project} sectionNumber="05 / THE BUILDER" />
        <MarketedCta project={project} sectionNumber="06 / REGISTER INTEREST" />
      </main>
      <MarketedFooter />
      <StickyActionBar
        projectTitle={project.title}
        projectSlug={project.slug}
        targetId={REGISTER_ANCHOR}
      />
    </>
  )
}
