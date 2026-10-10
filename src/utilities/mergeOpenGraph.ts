import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

// Branded defaults — pages override per-route via `metadata.openGraph` but the
// `siteName` and a fallback `images` entry survive into every share card. The
// previous defaults were leftover Payload boilerplate ("Payload Website
// Template" + the template's stock OG image) and were leaking onto the home
// page's social previews.
const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description:
    'Explore property projects in Karachi with Lateef Properties, from pre-launch to ready to move.',
  images: [
    {
      url: `${getServerSideURL()}/brand/og-default.png`,
      width: 1200,
      height: 630,
      alt: 'Lateef Properties — Your partner in property & prosperity',
    },
  ],
  siteName: 'Lateef Properties',
  title: 'Lateef Properties',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
