import type { Metadata } from 'next'

import { Hero } from '@/components/landing/Hero'
import { HomeSearch } from '@/components/landing/HomeSearch'
import { FeaturedListings } from '@/components/landing/FeaturedListings'
import { ListingsSection } from '@/components/landing/ListingsSection'
import { About } from '@/components/landing/About'
import { Services } from '@/components/landing/Services'
import { ConsultationForm } from '@/components/landing/ConsultationForm'
import { JsonLd } from '@/components/shared/JsonLd'
// organizationSchema is mounted in the root layout (sitewide); emitting it
// again here would produce a duplicate JSON-LD block on the home page.
import { breadcrumbListSchema } from '@/lib/seo-jsonld'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { getServerSideURL } from '@/utilities/getURL'

const base = getServerSideURL().replace(/\/$/, '')

// ISR: rebuild every 60s so newly-added FeaturedProjects + PropertyListings
// surface on the home page without waiting for the next deploy.
export const revalidate = 60

export default function HomePage() {
  const schemas = [breadcrumbListSchema([{ name: 'Home', url: `${base}/` }])]

  return (
    <>
      <JsonLd data={schemas} />
      <main className="overflow-x-clip">
        <Hero />
        <HomeSearch />
        <FeaturedListings />
        <ListingsSection />
        <About />
        <Services />
        <ConsultationForm />
      </main>
    </>
  )
}

export const metadata: Metadata = {
  title: 'Lateef Properties | Karachi Apartments, Plots & Commercial Property | Authorised Marketing Agency',
  description:
    'Karachi apartments, plots, offices and shops for sale in Gulshan-e-Iqbal, Gulistan-e-Johar, Scheme 33, DHA, Clifton, M.A. Jinnah Road, Jinnah Avenue and Malir. Pre-launch, under-construction and ready-for-possession projects with flexible payment plans.',
  openGraph: mergeOpenGraph({
    title: 'Lateef Properties | Karachi Apartments, Plots & Commercial Property | Authorised Marketing Agency',
    description:
      'Pre-launch apartments, ready-to-move flats, plots, offices and shops across Karachi. Authorised marketing agency for Karachi’s leading developers.',
    url: `${base}/`,
  }),
  alternates: {
    canonical: `${base}/`,
  },
  keywords: [
    'Lateef Properties',
    'Karachi real estate',
    'real estate agency Karachi',
    'property for sale in Karachi',
    'flats for sale Karachi',
    'apartments for sale in Karachi',
    'plots for sale Karachi',
    'commercial property Karachi',
    'offices for sale Karachi',
    'shops for sale Karachi',
    'Gulshan-e-Iqbal apartments',
    'Gulistan-e-Johar apartments',
    'Scheme 33 Karachi',
    'DHA Karachi apartments',
    'Clifton Karachi apartments',
    'M.A. Jinnah Road property',
    'Jinnah Avenue commercial Karachi',
    'Malir apartments Karachi',
    'pre-launch projects Karachi',
    'under-construction projects Karachi',
    'ready-for-possession Karachi',
    'flexible payment plan Karachi',
    'off-market property Karachi',
  ],
}
