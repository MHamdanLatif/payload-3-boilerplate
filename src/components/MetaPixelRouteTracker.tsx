'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

/**
 * Fires `fbq('track', 'PageView')` on every client-side navigation in the App
 * Router. The base init pixel ([MetaPixel](./MetaPixel.tsx)) only fires once
 * on initial page load; soft-navigations between routes don't trigger a full
 * page load, so without this tracker, Meta would only count the entry page.
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function Tracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.fbq !== 'function') return
    window.fbq('track', 'PageView')
  }, [pathname, searchParams])

  return null
}

export function MetaPixelRouteTracker() {
  // `useSearchParams` suspends — wrap so it doesn't break SSR for the layout.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  )
}
