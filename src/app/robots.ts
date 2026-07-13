import type { MetadataRoute } from 'next'
import { getServerSideURL } from '@/utilities/getURL'

export default function robots(): MetadataRoute.Robots {
  const base = getServerSideURL().replace(/\/$/, '')

  // Shared policy: crawl all public content, keep admin/API/thank-you private.
  const allow = ['/', '/properties', '/projects/', '/listings/', '/blog', '/blog/']
  const disallow = ['/admin', '/api/', '/next/', '/thank-you']

  return {
    rules: [
      { userAgent: '*', allow, disallow },
      // Explicitly welcome Apple's crawlers — Applebot (Siri, Spotlight, Safari
      // Suggestions) and Applebot-Extended (Apple Intelligence / AI features may
      // use our content) — plus Bing's crawler. A named group overrides the `*`
      // group for that bot, so we repeat the same protected-path disallows here
      // rather than exposing /admin and /api to them.
      { userAgent: ['Applebot', 'Applebot-Extended', 'Bingbot'], allow, disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
    // NOTE: no `host` field — it emits a non-standard `Host:` line that Bing's
    // robots.txt validator flags as a syntax error. Canonical host is enforced
    // via the www→apex redirect (redirects.js) and per-page canonical tags.
  }
}
