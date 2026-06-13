import { NextResponse } from 'next/server'

/**
 * Lead webhook proxy. All site forms POST to /api/leads with a shared core
 * shape, then this route forwards a normalised payload to PRIVYR_WEBHOOK_URL.
 *
 * Core fields (every form sends these):
 *   - name       (required)
 *   - phone      (required)
 *   - email      (optional)
 *   - sourceKind (required) — one of: 'project' | 'listing' | 'location' | 'consultation' | 'zero-results'
 *   - source     (string) — fine-grained tag like "project-landing:hero", "home:consultation"
 *
 * Optional context fields:
 *   - sourceName / sourceSlug — what they're enquiring about
 *   - placement — "hero" | "final" | "modal"
 *   - notes — free text
 *   - propertyType / budget — for the home consultation form
 *   - searchedParams — for the zero-results trap
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Email looks invalid' }, { status: 400 })
  }

  const url = process.env.PRIVYR_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'Lead webhook not configured' },
      { status: 503 },
    )
  }

  const sourceKindRaw = typeof body.sourceKind === 'string' ? body.sourceKind : null
  const validKinds = [
    'project',
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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // ── Core (every form) ────────────────────────────────────────
        name,
        phone,
        email: email || null,
        sourceKind,
        source: typeof body.source === 'string' ? body.source : 'website',
        placement: typeof body.placement === 'string' ? body.placement : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        timestamp: new Date().toISOString(),
        // ── Source identification ───────────────────────────────────
        sourceName,
        sourceSlug,
        // CRM-friendly aliases so Privyr can display "Project Name" or
        // "Listing Name" columns without parsing sourceKind.
        projectName: sourceKind === 'project' ? sourceName : null,
        projectSlug: sourceKind === 'project' ? sourceSlug : null,
        listingName: sourceKind === 'listing' ? sourceName : null,
        listingSlug: sourceKind === 'listing' ? sourceSlug : null,
        locationName: sourceKind === 'location' ? sourceName : null,
        locationSlug: sourceKind === 'location' ? sourceSlug : null,
        // ── Home consultation form context ──────────────────────────
        propertyType: typeof body.propertyType === 'string' ? body.propertyType : null,
        budget: typeof body.budget === 'string' ? body.budget : null,
        // ── Zero-results context ────────────────────────────────────
        searchedParams: body.searchedParams ?? null,
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Upstream rejected lead' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Network error' }, { status: 502 })
  }
}
