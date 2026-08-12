import type { Metadata } from 'next'

import { Hero } from '@/components/landing/Hero'
import { HomeSearch } from '@/components/landing/HomeSearch'
import { FeaturedListings } from '@/components/landing/FeaturedListings'
import { ListingsSection } from '@/components/landing/ListingsSection'
import { About } from '@/components/landing/About'
import { Services } from '@/components/landing/Services'
import { LatestInsights } from '@/components/landing/LatestInsights'
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
        <LatestInsights />
        <ConsultationForm />
      </main>
    </>
  )
}

// Title and description are length-budgeted for the SERP: Google truncates
// titles past ~60 chars and descriptions past ~155, and the previous values
// (97 / 253) were cut mid-phrase — the old description lost its entire location
// list. Front-loads "Property for Sale in Karachi", the commercial phrase the
// home page already ranks for (926 impressions at position 8.66, 1.73% CTR).
export const metadata: Metadata = {
  title: 'Property for Sale in Karachi | Apartments, Plots & Shops',
  description:
    'Verified apartments, plots and commercial property for sale across Karachi. Pre-launch, under construction and ready to move, on flexible payment plans.',
  openGraph: mergeOpenGraph({
    title: 'Property for Sale in Karachi | Lateef Properties',
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
