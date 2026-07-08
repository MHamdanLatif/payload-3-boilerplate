import { GA_MEASUREMENT_ID } from '@/components/GoogleAnalytics'

/**
 * Client-side analytics helpers.
 *
 * GA4 is installed via gtag.js (see components/GoogleAnalytics.tsx —
 * `gtag('config', 'G-…')`), mounted in BOTH the (app) and (frontend) root
 * layouts, so every page — including project/listing/location landing pages —
 * loads it. There is no GTM container, so we do NOT push to `dataLayer` directly.
 *
 * `gtag` is declared here (identical signature to the one in
 * GoogleAnalyticsRouteTracker.tsx — interface declaration-merging keeps both
 * valid) so this module type-checks standalone.
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export type LeadParams = {
  /** Which form fired it, e.g. 'contact', 'project_enquiry', 'brochure_download'. */
  form_name: string
  /** Project/page slug the form is tied to, when there is one. Omitted otherwise. */
  project?: string
}

/** How long to keep waiting for gtag.js to initialise before giving up. */
const GTAG_WAIT_MS = 4000
const GTAG_POLL_MS = 200

/**
 * Run `cb` once `window.gtag` exists, or give up after GTAG_WAIT_MS.
 *
 * Why wait rather than fire-and-forget: the GA scripts load with
 * `strategy="afterInteractive"`, so a very fast submission can land before
 * `window.gtag` is defined — in which case the old `window.gtag?.(...)` call
 * silently dropped the conversion. Waiting is also *ordering-safe*: the
 * `ga4-init` snippet defines `gtag` and then synchronously calls
 * `gtag('js')` + `gtag('config')`, so by the time `gtag` is a function the
 * config has already been queued. Events therefore never arrive before config.
 *
 * Never throws — analytics must not interfere with a lead submission.
 */
function whenGtagReady(cb: (gtag: NonNullable<Window['gtag']>) => void): void {
  if (typeof window === 'undefined') return
  const deadline = Date.now() + GTAG_WAIT_MS
  const tick = () => {
    try {
      if (typeof window.gtag === 'function') {
        cb(window.gtag)
        return
      }
      if (Date.now() >= deadline) return
      window.setTimeout(tick, GTAG_POLL_MS)
    } catch {
      // Swallow: a broken/blocked gtag must never surface to the user.
    }
  }
  tick()
}

/**
 * Fire the GA4 `generate_lead` conversion.
 *
 * Call ONLY from a form's confirmed success branch (after the Privyr response
 * resolves OK) — never on validation errors, failed/rejected requests, mount,
 * or render. Safe during SSR, before gtag has loaded, and when gtag is blocked
 * by an extension: it no-ops and never throws.
 *
 * Mark `generate_lead` as a key event in GA4, and register `form_name` +
 * `project` as custom dimensions to see them in reports.
 */
export function trackLead(params: LeadParams): void {
  whenGtagReady((gtag) => {
    gtag('event', 'generate_lead', {
      form_name: params.form_name,
      ...(params.project ? { project: params.project } : {}),
      // Route explicitly at the measurement ID so the event can't be swallowed
      // if another gtag config is ever added to the page.
      send_to: GA_MEASUREMENT_ID,
    })
  })
}
