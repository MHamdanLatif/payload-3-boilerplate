'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { GA_MEASUREMENT_ID } from './GoogleAnalytics'

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

    const query = searchParams?.toString()
    const path = query ? `${pathname}?${query}` : pathname

    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
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
