import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead, Media } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Serve a lead's brochure PDF through our own origin.
 *
 * The pack page draws the brochure onto a canvas with pdf.js, which `fetch`es
 * the file — where the old `<iframe>` merely pointed at it. That difference
 * matters twice over:
 *
 *   1. A cross-origin `fetch` needs CORS headers the media host does not send,
 *      so the render fails outright. Same-origin removes the problem rather
 *      than negotiating with it.
 *   2. Handing the raw R2/media URL to the browser put it in the page source,
 *      where it could be copied, shared, and opened by anyone — with none of
 *      the opens attributed to the lead it was sent to.
 *
 * So the URL the page sees is this route, and the real file location never
 * leaves the server. The brochure token is the credential, exactly as it is for
 * the page itself.
 *
 * `Content-Disposition: inline` because nothing here should offer a save
 * dialogue; the point is that reading the brochure and visiting the page stay
 * the same act.
 */

/** Which of the two slots to serve. Anything else is rejected. */
const SLOTS = { primary: 'brochurePdfPrimary', secondary: 'brochurePdfSecondary' } as const
type Slot = keyof typeof SLOTS

function resolveMediaUrl(m: number | Media | null | undefined): string | null {
  if (!m || typeof m !== 'object') return null
  if (!m.url) return null
  return m.url.startsWith('http') ? m.url : `${getServerSideURL().replace(/\/$/, '')}${m.url}`
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const slotParam = new URL(req.url).searchParams.get('slot') ?? 'primary'
  if (!(slotParam in SLOTS)) {
    return NextResponse.json({ error: 'Unknown slot' }, { status: 400 })
  }
  const field = SLOTS[slotParam as Slot]

  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'leads',
      where: { brochureId: { equals: id } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })
    const lead = res.docs[0] as Lead | undefined
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const url = resolveMediaUrl(lead[field] as number | Media | null | undefined)
    if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const upstream = await fetch(url)
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
    }

    // Streamed rather than buffered: these run to a few MB and the container
    // should not hold one in memory per concurrent reader.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        // Private: this URL is scoped to one lead's token and must not be held
        // by a shared cache.
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.warn('[brochure/file] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 })
  }
}
