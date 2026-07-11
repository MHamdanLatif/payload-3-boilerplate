'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { GA_MEASUREMENT_ID } from './GoogleAnalytics'
import { cleanLocationForGA } from '@/lib/analytics'

/**
 * Fires GA4 `page_view` on the initial load AND on every client-side
 * navigation. The base [GoogleAnalytics](./GoogleAnalytics.tsx) script sets
 * `send_page_view: false` in its `gtag('config', ...)` call so this tracker
 * is the single source of pageview signals — no double-counting on entry.
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function Tracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.gtag !== 'function') return
    if (!GA_MEASUREMENT_ID) return

    // Strip ad click-IDs (fbclid/gclid/…) so GA4 doesn't fragment one page into
    // dozens of 1-session rows. utm_* params survive for attribution.
    const cleanLocation = cleanLocationForGA()
    // Derive the matching page_path from the cleaned URL so it's stripped too;
    // fall back to the raw path if the URL couldn't be parsed.
    let cleanPath: string
    try {
      const u = new URL(cleanLocation)
      cleanPath = `${u.pathname}${u.search}`
    } catch {
      const query = searchParams?.toString()
      cleanPath = query ? `${pathname}?${query}` : pathname
    }

    // Set page_location globally first so every subsequent event on this page
    // (including generate_lead) inherits the cleaned URL, then fire the pageview.
    window.gtag('set', { page_location: cleanLocation })
    window.gtag('event', 'page_view', {
      page_path: cleanPath,
      page_location: cleanLocation,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    })
  }, [pathname, searchParams])

  return null
}

export function GoogleAnalyticsRouteTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  )
}
