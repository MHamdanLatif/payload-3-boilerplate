import Script from 'next/script'

/**
 * Google Analytics 4 — fires the initial pageview on first paint via gtag.
 * Pair with [GoogleAnalyticsRouteTracker](./GoogleAnalyticsRouteTracker.tsx)
 * which fires `page_view` on every App-Router soft navigation; without it
 * GA4 would only count the entry URL because subsequent route changes don't
 * trigger a full page load.
 *
 * Measurement IDs are public (visible in any browser devtools), so it's safe
 * to keep `G-3SH3KB0RZS` (the property carried over from the old site) as the
 * default. Override per environment with `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-3SH3KB0RZS'

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });`}
      </Script>
    </>
  )
}
