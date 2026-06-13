import type { MetadataRoute } from 'next'
import { getServerSideURL } from '@/utilities/getURL'

export default function robots(): MetadataRoute.Robots {
  const base = getServerSideURL().replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/properties', '/projects/', '/listings/', '/blog', '/blog/'],
        disallow: ['/admin', '/api/', '/next/', '/thank-you'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
