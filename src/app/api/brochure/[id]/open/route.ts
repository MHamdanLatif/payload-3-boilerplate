import { NextResponse } from 'next/server'
import { logBrochureOpen } from '@/lib/brochure-open'

/**
 * Client beacon endpoint for ASSET engagement (pdf/map/video scroll/click).
 * The page-open event itself is logged server-side on render (see the brochure
 * page), which is reliable on iOS where client beacons are not. Best-effort.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: { asset?: string } = {}
  try {
    body = (await req.json()) as { asset?: string }
  } catch {
    // no body
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  const userAgent = req.headers.get('user-agent') || null
  const referrer = req.headers.get('referer') || null

  await logBrochureOpen({ brochureId: id, asset: body.asset, ip, userAgent, referrer })
  return NextResponse.json({ ok: true })
}
