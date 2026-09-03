import type { Metadata } from 'next'
import { cn } from 'src/utilities/cn'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Playfair_Display, Poppins } from 'next/font/google'
import React from 'react'

import { MetaPixel } from '@/components/MetaPixel'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { AttributionCapture } from '@/components/AttributionCapture'
import { Providers } from '@/providers'

import '../(frontend)/globals.css'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Shell for paid-campaign landing pages (marketed-projects, served at /<Slug>).
 *
 * A separate root layout, for the same reason the pack pages have one: nested
 * layouts ADD to their parent, so the only way to drop the site header and
 * footer is to sit outside (frontend) entirely.
 *
 * The visitor here is cold — they clicked an ad and have no relationship with
 * the brand. Every navigation link is a way to leave without converting, so
 * there is no nav at all.
 *
 * Kept:
 *   - fonts and globals, so the page looks like the same company
 *   - Meta Pixel and GA — this is bought traffic; measuring it is the point
 *   - AttributionCapture, which the pack shell omits. It writes the `lp_attr`
 *     cookie that lead capture reads server-side. Without it every lead from
 *     this page records `acquisitionSource: 'unknown'`, and the ad spend that
 *     produced it becomes unattributable. This is the single most important
 *     line in this file.
 * Dropped:
 *   - Header / Footer navigation
 *   - Organisation JSON-LD (noindex pages; structured data is moot)
 *   - AdminBar / LivePreviewListener
 *   - Route trackers — nothing here navigates client-side
 */

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

export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
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
      <body className="bg-background text-foreground">
        <MetaPixel />
        <GoogleAnalytics />
        <AttributionCapture />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  // Belt and braces: each page sets its own noindex too, so a page added to this
  // group later cannot become indexable by omission.
  //
  // Deliberately NOT paired with a robots.txt Disallow — a disallowed crawler
  // never fetches the page and so never reads this tag, which is how noindexed
  // URLs end up indexed anyway.
  robots: { index: false, follow: false },
}
