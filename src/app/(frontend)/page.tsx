import type { Metadata } from 'next'

import { Hero } from '@/components/landing/Hero'
import { HomeSearch } from '@/components/landing/HomeSearch'
import { FeaturedListings } from '@/components/landing/FeaturedListings'
import { About } from '@/components/landing/About'
import { Services } from '@/components/landing/Services'
import { LatestInsights } from '@/components/landing/LatestInsights'
import { ConsultationForm } from '@/components/landing/ConsultationForm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchPublishedProjects } from '@/lib/featured-projects'
import { projectFilterOptions } from '@/lib/property-search'
import { JsonLd } from '@/components/shared/JsonLd'
// organizationSchema is mounted in the root layout (sitewide); emitting it
// again here would produce a duplicate JSON-LD block on the home page.
import { breadcrumbListSchema } from '@/lib/seo-jsonld'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { getServerSideURL } from '@/utilities/getURL'

const base = getServerSideURL().replace(/\/$/, '')

// ISR: rebuild every 60s so newly-added builder projects
// surface on the home page without waiting for the next deploy.
export const revalidate = 60

export default async function HomePage() {
  const payload = await getPayload({ config })
  const projects = await fetchPublishedProjects(payload)
  const options = projectFilterOptions(projects)
  const schemas = [breadcrumbListSchema([{ name: 'Home', url: `${base}/` }])]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <Hero />
        <HomeSearch options={options} />
        <FeaturedListings projects={projects.slice(0, 12)} />
        <About />
        <Services />
        <LatestInsights />
        <ConsultationForm
          projects={projects.map(({ id, title, slug }) => ({
            id,
            title,
            slug: slug || String(id),
          }))}
          locations={options.locations}
        />
      </main>
    </>
  )
}

const title = 'Property for Sale in Karachi | Lateef Properties'
const description =
  'Explore apartments and commercial property projects in Karachi, from pre-launch to ready to move. Compare prices, floor plans and payment options.'
export const metadata: Metadata = {
  title,
  description,
  openGraph: mergeOpenGraph({ title, description, url: `${base}/` }),
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [`${base}/brand/og-default.png`],
  },
  alternates: { canonical: `${base}/` },
}
