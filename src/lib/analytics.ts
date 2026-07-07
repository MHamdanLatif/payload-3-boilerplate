/**
 * Client-side analytics helpers.
 *
 * GA4 is installed via gtag.js (see components/GoogleAnalytics.tsx —
 * `gtag('config', 'G-…')`), so events go through `window.gtag`. There is no GTM
 * container, so we do NOT push to `dataLayer` directly.
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

/**
 * Fire the GA4 `generate_lead` conversion.
 *
 * Call ONLY from a form's confirmed success branch (after the Privyr response
 * resolves OK) — never on validation errors, failed/rejected requests, mount,
 * or render. Safe during SSR and before gtag has loaded: it no-ops and never
 * throws, so it can't break a submission.
 */
export function trackLead(params: LeadParams): void {
  if (typeof window === 'undefined') return
  try {
    window.gtag?.('event', 'generate_lead', {
      form_name: params.form_name,
      ...(params.project ? { project: params.project } : {}),
    })
  } catch {
    // Analytics must never interfere with a lead submission.
  }
}
