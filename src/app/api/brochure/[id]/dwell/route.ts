import { NextResponse } from 'next/server'
import { recordBrochureDwell, isCrawler } from '@/lib/brochure-open'

/**
 * Client beacon endpoint for TIME ON PAGE. Fired on a heartbeat while the
 * brochure is visible and again as it is hidden/unloaded, so the same visit
 * reports several times — recordBrochureDwell keeps the longest.
 *
 * Deliberately never creates a link-open row: this only ever updates the one
 * the server render already logged. Best-effort, always 200s so a failure here
 * can never surface to the lead.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (isCrawler(req.headers.get('user-agent'))) return NextResponse.json({ ok: true })

  let body: { visitId?: string; ms?: number } = {}
  try {
    body = (await req.json()) as { visitId?: string; ms?: number }
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (typeof body.visitId !== 'string' || typeof body.ms !== 'number') {
    return NextResponse.json({ ok: true })
  }

  await recordBrochureDwell({ brochureId: id, visitId: body.visitId, ms: body.ms })
  return NextResponse.json({ ok: true })
}
