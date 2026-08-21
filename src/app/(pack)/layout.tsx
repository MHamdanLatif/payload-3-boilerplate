import type { Metadata } from 'next'
import { cn } from 'src/utilities/cn'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Playfair_Display, Poppins } from 'next/font/google'
import React from 'react'

import { MetaPixel } from '@/components/MetaPixel'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { Providers } from '@/providers'
import { PackHeader } from '@/components/pack/PackHeader'
import { PackFooter } from '@/components/pack/PackFooter'

import '../(frontend)/globals.css'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Shell for personalised project packs (/brochure/[token]).
 *
 * A separate root layout — not a nested one — because nested layouts ADD to
 * their parent rather than replacing it, so the only way to drop the main site
 * header and footer is to sit outside (frontend) entirely. Route groups do not
 * affect the URL, so every link already sent to a lead keeps working.
 *
 * These pages are reached by people who have already enquired. The job is
 * project information → engagement → conversation, so the full site navigation
 * (projects, blogs, neighbourhoods, guides) is deliberately absent: it exists
 * to help strangers discover the site, and here it only invites the lead to
 * wander away mid-consideration.
 *
 * Kept from the main shell:
 *   - fonts and globals, so the pack looks like the same company
 *   - Meta Pixel and GA, because pack engagement is worth retargeting on
 * Dropped:
 *   - Header / Footer navigation
 *   - Organisation JSON-LD (these pages are noindex; structured data is moot)
 *   - AdminBar / LivePreviewListener (never previewed through the CMS)
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

export default function PackLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={cn(GeistSans.variable, GeistMono.variable, playfair.variable, poppins.variable, 'font-sans')}
      data-theme="light"
      lang="en"
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground">
        <MetaPixel />
        <GoogleAnalytics />
        <Providers>
          <PackHeader />
          {children}
          <PackFooter />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  // Belt and braces: each pack page sets its own noindex, but declaring it on
  // the shell means a future page added under this group cannot be indexed by
  // omission.
  robots: { index: false, follow: false },
}
