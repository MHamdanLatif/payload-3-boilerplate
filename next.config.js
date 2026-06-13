import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Order matters: Next negotiates the first format the browser supports.
    // AVIF first (smallest), WebP fallback, then the source.
    formats: ['image/avif', 'image/webp'],
    // Cache the optimized variants for 30 days at the CDN. Defaults to 60s,
    // which causes repeated re-encoding under load.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      { hostname: 'images.unsplash.com', protocol: 'https' },
      { hostname: 'img.youtube.com', protocol: 'https' },
      { hostname: 'i.ytimg.com', protocol: 'https' },
      { hostname: 'vumbnail.com', protocol: 'https' },
    ],
  },
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'node_modules')],
  },
  reactStrictMode: true,
  // Strip `X-Powered-By: Next.js` — small hygiene/security win.
  poweredByHeader: false,
  // gzip/brotli for HTML and static assets served by the Node server.
  compress: true,
  redirects,
}

export default withPayload(nextConfig)
