import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendNtfy } from '@/lib/ntfy'
import { getServerSideURL } from '@/utilities/getURL'
import type { Lead } from '@/payload-types'

const ASSETS = ['page', 'pdf1', 'pdf2', 'map', 'video'] as const

// Re-open cooldown: after alerting on an open, stay quiet for this many hours,
// then alert again if the lead comes back (a strong buying signal). 0 = every open.
const DEFAULT_COOLDOWN_HOURS = 2

/**
 * Logs a brochure engagement event (page open or asset click/play) into
 * `link-opens`. On a page open it stamps the lead's `brochureOpenedAt` read
 * receipt (first open) and pushes a free ntfy alert to the owner — throttled by
 * a re-open cooldown so refreshes don't spam, but genuine return visits do
 * notify. Best-effort; never blocks the response.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: { asset?: string } = {}
  try {
    body = (await req.json()) as { asset?: string }
  } catch {
    // no body → treat as a page open
  }
  const asset = (ASSETS as readonly string[]).includes(body.asset ?? '')
    ? (body.asset as (typeof ASSETS)[number])
    : 'page'

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  const userAgent = req.headers.get('user-agent') || null
  const referrer = req.headers.get('referer') || null

  try {
    const payload = await getPayload({ config })

    const leadRes = await payload.find({
      collection: 'leads',
      where: { brochureId: { equals: id } },
      depth: 0,
      limit: 1,
    })
    const lead = leadRes.docs[0] as Lead | undefined

    // Decide whether to notify (page opens only): first-ever open, or a return
    // visit after the cooldown window.
    let firstEver = false
    let notify = false
    if (asset === 'page') {
      const total = await payload.count({
        collection: 'link-opens',
        where: { and: [{ brochureId: { equals: id } }, { asset: { equals: 'page' } }] },
      })
      firstEver = (total?.totalDocs ?? 0) === 0

      const cooldownH = Number(process.env.BROCHURE_REOPEN_COOLDOWN_HOURS ?? DEFAULT_COOLDOWN_HOURS)
      if (!Number.isFinite(cooldownH) || cooldownH <= 0) {
        notify = true
      } else {
        const since = new Date(Date.now() - cooldownH * 3600_000).toISOString()
        const recent = await payload.count({
          collection: 'link-opens',
          where: {
            and: [
              { brochureId: { equals: id } },
              { asset: { equals: 'page' } },
              { createdAt: { greater_than_equal: since } },
            ],
          },
        })
        notify = (recent?.totalDocs ?? 0) === 0
      }
    }

    await payload.create({
      collection: 'link-opens',
      overrideAccess: true,
      data: { lead: lead?.id ?? undefined, brochureId: id, asset, ip, userAgent, referrer },
    })

    if (asset === 'page' && lead) {
      // Read receipt: stamp the first-open time on the lead.
      if (firstEver) {
        await payload.update({
          collection: 'leads',
          id: lead.id,
          overrideAccess: true,
          context: { skipLeadHooks: true },
          data: { brochureOpenedAt: new Date().toISOString() },
        })
      }

      if (notify && process.env.NTFY_TOPIC) {
        const project = lead.sourceName || lead.brochureHeadline || 'their brochure'
        const base = getServerSideURL().replace(/\/$/, '')
        await sendNtfy({
          title: firstEver ? 'Brochure Opened' : 'Brochure Re-opened',
          message: `${lead.name} ${firstEver ? 'just opened' : 'came back to'} ${project}. Good moment to call.`,
          priority: 'high',
          tags: firstEver ? 'eyes' : 'fire',
          clickUrl: `${base}/admin/collections/leads/${lead.id}`,
        })
      }
    }
  } catch (e) {
    console.warn('[brochure/open] failed:', (e as Error).message)
  }

  return NextResponse.json({ ok: true })
}
