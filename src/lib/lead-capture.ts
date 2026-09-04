import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import { sendCapiEvent } from '@/lib/meta-capi'
import config from '@payload-config'
import { isValidPhoneNumber } from 'libphonenumber-js'
import {
  ATTRIBUTION_COOKIE,
  acquisitionSourceFromTouch,
  CONVERSION_SURFACES,
  parseAttribution,
  type ConversionSurface,
  type Touch,
} from '@/lib/attribution'

const PRIVYR_TIMEOUT_MS = 5000

/**
 * Flatten a Touch into the lead's prefixed columns.
 *
 * Undefined values are omitted rather than written as null, so a partial touch
 * never blanks a field that another code path populated.
 */
export function touchColumns(prefix: 'firstTouch' | 'latestTouch', t: Touch | null): Record<string, unknown> {
  if (!t) return {}
  const out: Record<string, unknown> = {}
  const put = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== '') out[prefix + k] = v }
  put('Source', t.source)
  put('Medium', t.medium)
  put('Campaign', t.campaign)
  put('Content', t.content)
  put('Term', t.term)
  put('LandingPath', t.landingPath)
  put('Referrer', t.referrer)
  put('Fbclid', t.fbclid)
  put('Gclid', t.gclid)
  put('At', t.at)
  return out
}

/** Parse a Cookie header into a name→value map. */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

/**
 * Lead webhook proxy + backup — shared implementation.
 *
 * Lives here rather than in a route file because it is served from TWO URLs
 * during a migration: the new /api/lead-capture, and the legacy /api/leads.
 *
 * WHY THE MIGRATION: a route file at src/app/api/leads/route.ts shadows
 * Payload's own REST endpoint for the leads collection — a specific route beats
 * the [...slug] catch-all — so Payload never receives those requests. That
 * silently broke lead creation in the admin panel: the admin posts
 * multipart/form-data, this handler calls req.json(), and the visitor got a
 * 400 "Invalid JSON" no matter what they typed.
 *
 * The legacy path stays live on purpose. Site JavaScript is cached in
 * visitors' browsers, so deleting /api/leads in the same release would send
 * every stale bundle's submission to Payload's authenticated endpoint, which
 * 401s anonymous callers — losing real leads silently. Once traffic to the old
 * path has drained, delete src/app/api/leads/route.ts and Payload reclaims it.
 *
 * Lead webhook proxy + backup.
 *
 * All site forms POST here. Every submission is (1) saved to the `leads`
 * collection as a durable backup — visible in the admin, independent of the CRM
 * — and (2) forwarded to PRIVYR_WEBHOOK_URL. The request succeeds if EITHER the
 * backup was saved or Privyr accepted the lead, so a Privyr outage never loses
 * a lead or shows the visitor an error. `privyrForwarded` on the saved row
 * records whether the CRM accepted it, so the team can follow up on any misses.
 *
 * Core fields (every form sends these):
 *   - name       (required)
 *   - phone      (required)
 *   - email      (optional)
 *   - sourceKind (required) — 'project' | 'listing' | 'location' | 'consultation' | 'zero-results'
 *   - source     (string) — fine-grained tag like "project-landing:hero", "home:consultation"
 *
 * Optional context fields:
 *   - sourceName / sourceSlug — what they're enquiring about
 *   - placement — "hero" | "final" | "modal"
 *   - notes — free text
 *   - propertyType / budget — for the home consultation form
 *   - searchedParams — for the zero-results trap
 */
export async function handleLeadCapture(req: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  // Validated against the allowed list rather than trusted: this arrives in the
  // request body, so an arbitrary string would otherwise be written straight to
  // an enum column and fail at the database.
  const rawSurface = typeof body.conversionSurface === 'string' ? body.conversionSurface.trim() : ''
  const conversionSurface = (CONVERSION_SURFACES as readonly string[]).includes(rawSurface)
    ? (rawSurface as ConversionSurface)
    : null

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 400 })
  }
  // Server-side guard against malformed / junk numbers (the client validates too,
  // but a script or JS-off browser can post anything). Defaults to Pakistan for
  // bare local numbers; any +country-code number validates against its country.
  if (!isValidPhoneNumber(phone, 'PK')) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid phone number' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Email looks invalid' }, { status: 400 })
  }

  const sourceKindRaw = typeof body.sourceKind === 'string' ? body.sourceKind : null
  const validKinds = [
    'project',
    'marketed-project',
    'listing',
    'location',
    'payment-plan',
    'consultation',
    'zero-results',
  ] as const
  const sourceKind = (validKinds as readonly string[]).includes(sourceKindRaw as string)
    ? (sourceKindRaw as (typeof validKinds)[number])
    : 'unknown'

  const sourceName = typeof body.sourceName === 'string' ? body.sourceName : null
  const sourceSlug = typeof body.sourceSlug === 'string' ? body.sourceSlug : null
  // Free text by design (options are per-project), so it is length-capped here
  // rather than validated against a list.
  const interestedUnitType =
    typeof body.interestedUnitType === 'string' && body.interestedUnitType.trim()
      ? body.interestedUnitType.trim().slice(0, 120)
      : null
  const placement = typeof body.placement === 'string' ? body.placement : null
  const source = typeof body.source === 'string' ? body.source : 'website'
  const notes = typeof body.notes === 'string' ? body.notes : null
  const propertyType = typeof body.propertyType === 'string' ? body.propertyType : null
  const budget = typeof body.budget === 'string' ? body.budget : null
  const searchedParams =
    body.searchedParams && typeof body.searchedParams === 'object'
      ? (body.searchedParams as Record<string, unknown>)
      : null

  // ── Meta attribution — captured now, reused for the CAPI event on qualify.
  // The Pixel sets _fbc / _fbp as first-party cookies, sent with this same-origin
  // POST, so we read them server-side (plus IP/UA from headers) without touching
  // the form components. _fbc embeds the original fbclid.
  const cookies = parseCookies(req.headers.get('cookie'))
  // Attribution comes from OUR cookie, not the request body: the browser should
  // not be able to claim it arrived from a campaign it did not.
  const attribution = parseAttribution(cookies[ATTRIBUTION_COOKIE])
  const firstTouch = attribution?.f ?? null
  const latestTouch = attribution?.l ?? firstTouch

  const fbc = cookies['_fbc'] || (typeof body.fbc === 'string' ? body.fbc : null)
  const fbp = cookies['_fbp'] || (typeof body.fbp === 'string' ? body.fbp : null)
  const fbclid =
    (typeof body.fbclid === 'string' && body.fbclid) ||
    (fbc ? fbc.split('.').slice(3).join('.') || null : null)
  const clientIp =
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent') || null
  // Reuse a client-supplied event id if present (dedup with the browser Pixel),
  // else mint one so the lead always has a stable id for CAPI.
  const eventId =
    (typeof body.eventId === 'string' && body.eventId) || crypto.randomUUID()
  const metaAdName = typeof body.metaAdName === 'string' ? body.metaAdName : null

  // ── 1. Forward to Privyr (bounded; capture the outcome for the backup row) ──
  const url = process.env.PRIVYR_WEBHOOK_URL
  let privyrOk = false
  let privyrStatus = 'not-configured'
  if (url) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PRIVYR_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name,
          phone,
          email: email || null,
          sourceKind,
          source,
          placement,
          notes,
          timestamp: new Date().toISOString(),
          sourceName,
          sourceSlug,
          // CRM-friendly aliases so Privyr can show "Project/Listing Name" columns.
          projectName: sourceKind === 'project' ? sourceName : null,
          projectSlug: sourceKind === 'project' ? sourceSlug : null,
          listingName: sourceKind === 'listing' ? sourceName : null,
          listingSlug: sourceKind === 'listing' ? sourceSlug : null,
          locationName: sourceKind === 'location' ? sourceName : null,
          locationSlug: sourceKind === 'location' ? sourceSlug : null,
          // Sales routing depends on this, so it has to reach the CRM, not just
          // the backup row.
          interestedUnitType,
          propertyType,
          budget,
          searchedParams,
        }),
      })
      privyrOk = res.ok
      privyrStatus = `${res.status} ${res.statusText}`.trim()
      if (!res.ok) {
        console.warn(`[api/leads] Privyr rejected (${sourceKind}/${sourceSlug ?? '-'}): ${privyrStatus}`)
      }
    } catch (e) {
      privyrStatus = (e as Error).name === 'AbortError' ? 'timeout' : `error: ${(e as Error).message}`
      console.warn('[api/leads] Privyr forward failed:', privyrStatus)
    } finally {
      clearTimeout(timer)
    }
  }

  // ── 2. Always save a backup row (independent of Privyr) ─────────────────────
  let backedUp = false
  try {
    const payload = await getPayload({ config })
    await payload.create({
      collection: 'leads',
      data: {
        name,
        phone,
        email: email || undefined,
        sourceKind,
        sourceName: sourceName ?? undefined,
        sourceSlug: sourceSlug ?? undefined,
        placement: placement ?? undefined,
        source,
        interestedUnitType: interestedUnitType ?? undefined,
        notes: notes ?? undefined,
        propertyType: propertyType ?? undefined,
        budget: budget ?? undefined,
        searchedParams: searchedParams ?? undefined,
        // Structured attribution. First touch is what ad spend is judged
        // against; latest touch shows what re-engaged a dormant buyer.
        ...touchColumns('firstTouch', firstTouch),
        ...touchColumns('latestTouch', latestTouch),
        acquisitionSource: acquisitionSourceFromTouch(firstTouch),
        conversionSurface: conversionSurface ?? undefined,
        // Meta attribution (for the CAPI event when the lead is later qualified)
        eventId,
        fbc: fbc ?? undefined,
        fbp: fbp ?? undefined,
        fbclid: fbclid ?? undefined,
        clientIp: clientIp ?? undefined,
        userAgent: userAgent ?? undefined,
        metaAdName: metaAdName ?? undefined,
        privyrForwarded: privyrOk,
        privyrStatus,
      },
      overrideAccess: true,
    })
    backedUp = true
  } catch (e) {
    console.warn('[api/leads] backup persist failed:', (e as Error).message)
  }

  // Success if the lead landed anywhere. Only fail if BOTH the CRM and the
  // backup failed — otherwise a Privyr outage would needlessly lose the lead.
  if (!privyrOk && !backedUp) {
    return NextResponse.json({ ok: false, error: 'Could not record lead' }, { status: 502 })
  }
  // Server-side Lead, deduplicated against the browser pixel by event_id.
  //
  // Previously ONLY the browser fired Lead, which loses every conversion from
  // an ad blocker or from iOS tracking prevention - precisely the traffic paid
  // social delivers. Firing both and letting Meta deduplicate recovers those
  // without double-counting.
  //
  // Deliberately after the lead is saved and never awaited into the response
  // path's failure modes: a Meta outage must not cost us a lead.
  void sendCapiEvent({
    eventName: process.env.META_CAPI_LEAD_EVENT || 'Lead',
    eventId,
    email: email || null,
    phone,
    fbc,
    fbp,
    fbclid,
    clientIp,
    userAgent,
    customData: {
      lead_source: metaAdName || source || sourceKind || 'website',
      ...(sourceName ? { content_name: sourceName } : {}),
    },
  }).catch((err) => {
    console.warn('[lead-capture] CAPI Lead failed:', (err as Error)?.message)
  })

  // eventId goes back to the caller so the browser pixel can fire with the SAME
  // id. Without that the two events are counted twice. It is a random UUID, not
  // personal data, so putting it in the redirect URL is safe.
  return NextResponse.json({ ok: true, eventId })
}
