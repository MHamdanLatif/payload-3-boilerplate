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

/**
 * Ad-platform click-ID query params. Each unique value (e.g. a new `fbclid` on
 * every ad click) otherwise splits one page into dozens of 1-session rows in
 * GA4 and fragments `generate_lead` by URL. We strip these from the URL we hand
 * to gtag only — NOT from the address bar (see cleanLocationForGA).
 *
 * `utm_*` params are deliberately NOT included — GA4 needs them for attribution.
 */
const CLICK_ID_PARAMS = [
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'dclid', 'msclkid', 'ttclid',
  'twclid', 'yclid', 'igshid', 'mc_eid', 'mc_cid', '_gl', 'brid',
]

/**
 * Return `raw` (or the current URL) with ad click-ID params removed, keeping
 * everything else — including `utm_*`. SSR-safe and never throws: malformed
 * URLs (e.g. a stray second `?`) fall back to the original string untouched.
 *
 * This only sanitises the STRING passed to gtag; it does not touch
 * window.location/history, so the Meta Pixel can still read the real `fbclid`.
 */
export function cleanLocationForGA(raw?: string): string {
  if (typeof window === 'undefined') return raw ?? ''
  const input = raw ?? window.location.href
  try {
    const url = new URL(input)
    CLICK_ID_PARAMS.forEach((p) => url.searchParams.delete(p))
    return url.toString()
  } catch {
    return input
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

/**
 * Fire the Meta Pixel `Lead` event from the browser, carrying the server's
 * `event_id`.
 *
 * `/thank-you` normally does this, and pages that navigate there should keep
 * letting it. This exists for the paid landing pages, which confirm in place and
 * therefore never load that page — without it Meta would receive only the
 * server-side CAPI half of the pair.
 *
 * Passing the same `eventID` the server used is the whole point: Meta collapses
 * the browser and server events into one conversion. Omit it and the same lead
 * is counted twice.
 *
 * Waits for `fbq` the same way the GA helper waits for `gtag`, and never throws.
 */
export function trackMetaLead(eventId?: string, contentName?: string): void {
  if (typeof window === 'undefined') return
  const deadline = Date.now() + GTAG_WAIT_MS
  const tick = () => {
    try {
      const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq
      if (typeof fbq === 'function') {
        fbq(
          'track',
          'Lead',
          contentName ? { content_name: contentName } : {},
          eventId ? { eventID: eventId } : {},
        )
        return
      }
      if (Date.now() >= deadline) return
      window.setTimeout(tick, GTAG_POLL_MS)
    } catch {
      // Swallow: a blocked pixel must never surface to the user.
    }
  }
  tick()
}
