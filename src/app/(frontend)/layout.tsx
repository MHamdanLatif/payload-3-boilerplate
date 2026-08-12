import type { Metadata } from 'next'

import { cn } from 'src/utilities/cn'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Playfair_Display, Poppins } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { MetaPixel } from '@/components/MetaPixel'
import { MetaPixelRouteTracker } from '@/components/MetaPixelRouteTracker'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { GoogleAnalyticsRouteTracker } from '@/components/GoogleAnalyticsRouteTracker'
import { Providers } from '@/providers'
// SplashLoader is intentionally NOT mounted — see the note at its usage site below.
import { JsonLd } from '@/components/shared/JsonLd'
import { organizationSchema } from '@/lib/seo-jsonld'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        playfair.variable,
        poppins.variable,
        'font-sans',
      )}
      data-theme="light"
      lang="en"
      suppressHydrationWarning
    >
      <head>{/* Favicon auto-injected by Next.js from src/app/icon.png + apple-icon.png */}</head>
      <body className="bg-background text-foreground">
        {/* Sitewide RealEstateAgent / LocalBusiness JSON-LD — every public page
            renders this so Google can attach the brand entity to any URL. */}
        <JsonLd data={organizationSchema()} />
        <MetaPixel />
        <MetaPixelRouteTracker />
        <GoogleAnalytics />
        <GoogleAnalyticsRouteTracker />
        <Providers>
          {/*
            <SplashLoader /> was mounted here and is deliberately removed.

            It rendered null on the server, then on hydration painted a
            full-viewport `fixed inset-0` gradient for 1500ms. A full-viewport
            element is by definition the Largest Contentful Paint candidate, and
            it could not paint until React and framer-motion had mounted — so it
            set the LCP clock for every first-time visitor on every page,
            including the three project pages that earn 74% of our organic
            clicks. It also set documentElement.style.overflow = 'hidden',
            locking scroll for 1.5s, which hurt INP too.

            Search Console showed 24 mobile URLs "needs improvement" and zero
            "good" while this was mounted. The component file is kept — restore
            by re-adding the import and this line, but read SplashLoader's own
            header comment first for the CSS-only approach.
          */}
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />
          <LivePreviewListener />

          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@lateefproperties',
  },
  verification: {
    // Google Search Console meta-tag verification. Public token (visible in
    // any view-source), so hardcoded as the default; override via env if a
    // future deploy ever needs a different one.
    google:
      process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ||
      'B51TUGaIkFBwKj0kMH9JWAFA61PViu4c8ve0Y9KC510',
    other: process.env.NEXT_PUBLIC_BING_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION }
      : undefined,
  },
}
