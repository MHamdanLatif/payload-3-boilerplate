'use client'

import { useEffect } from 'react'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  mergeAttribution,
  parseAttribution,
  serialiseAttribution,
  touchFromUrl,
} from '@/lib/attribution'

/**
 * Captures campaign attribution on the first page of a visit and keeps it in a
 * first-party cookie.
 *
 * Mounted once in the root layout. It renders nothing.
 *
 * Why a cookie rather than reading the URL at submit time: a visitor lands on
 * /projects/tulip-comfort?utm_source=meta..., browses to the gallery, opens the
 * calculator, and only then fills in the form. By that point the parameters are
 * long gone from the URL. Capturing at landing is the only reliable moment.
 *
 * Why not sessionStorage: it dies with the tab, and the form is submitted
 * server-side where a cookie is readable but storage is not.
 *
 * Runs on every route change, not just mount, because this is a client-side
 * router - a visitor can land on an ad URL and navigate away without a full
 * page load. `mergeAttribution` is idempotent, so repeated runs are harmless.
 */
export function AttributionCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const existingRaw = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${ATTRIBUTION_COOKIE}=`))
        ?.slice(ATTRIBUTION_COOKIE.length + 1)

      const existing = parseAttribution(existingRaw)
      const incoming = touchFromUrl(window.location.href, document.referrer)
      const next = mergeAttribution(existing, incoming)

      // Skip the write when nothing changed, so we are not rewriting a cookie
      // on every navigation.
      const serialised = serialiseAttribution(next)
      if (existingRaw === serialised) return

      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie =
        `${ATTRIBUTION_COOKIE}=${serialised}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
    } catch {
      // Attribution is diagnostic. It must never break a page for a visitor.
    }
  })

  return null
}
