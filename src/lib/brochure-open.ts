import { getPayload } from 'payload'
import config from '@payload-config'
import { sendNtfy } from '@/lib/ntfy'
import { getServerSideURL } from '@/utilities/getURL'
import type { Lead } from '@/payload-types'

const ASSETS = ['page', 'pdf1', 'pdf2', 'map', 'video'] as const
export type BrochureAsset = (typeof ASSETS)[number]

// Re-open cooldown: after alerting on an open, stay quiet this many hours, then
// alert again if the lead returns (a strong buying signal). 0 = every open.
const DEFAULT_COOLDOWN_HOURS = 2

// Link-preview scrapers (WhatsApp, Meta, etc.) fetch the brochure URL to build
// the chat preview card — that must NOT count as the lead opening it. A missing
// UA is treated as a bot too (real browsers always send one).
const CRAWLER_RE =
  /whatsapp|facebookexternalhit|facebot|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|pinterest|redditbot|googlebot|bingbot|yandex|baiduspider|duckduckbot|embedly|vkshare|bot\b|crawler|spider|scraper|preview/i

export function isCrawler(ua?: string | null): boolean {
  if (!ua) return true
  return CRAWLER_RE.test(ua)
}

export function normalizeAsset(a?: string | null): BrochureAsset {
  return (ASSETS as readonly string[]).includes(a ?? '') ? (a as BrochureAsset) : 'page'
}

/**
 * Records a brochure engagement event and — on a page open, throttled by the
 * re-open cooldown — stamps the lead's read receipt and pushes an ntfy alert to
 * the owner. Best-effort: never throws. Shared by the server page render (the
 * reliable path, works on iOS where client beacons don't) and the client asset
 * beacons (pdf/map/video).
 */
export async function logBrochureOpen(opts: {
  brochureId: string
  asset?: string | null
  ip?: string | null
  userAgent?: string | null
  referrer?: string | null
}): Promise<void> {
  const asset = normalizeAsset(opts.asset)
  try {
    const payload = await getPayload({ config })

    const leadRes = await payload.find({
      collection: 'leads',
      where: { brochureId: { equals: opts.brochureId } },
      depth: 0,
      limit: 1,
    })
    const lead = leadRes.docs[0] as Lead | undefined

    let firstEver = false
    let notify = false
    if (asset === 'page') {
      const total = await payload.count({
        collection: 'link-opens',
        where: { and: [{ brochureId: { equals: opts.brochureId } }, { asset: { equals: 'page' } }] },
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
              { brochureId: { equals: opts.brochureId } },
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
      data: {
        lead: lead?.id ?? undefined,
        brochureId: opts.brochureId,
        asset,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        referrer: opts.referrer ?? null,
      },
    })

    if (asset === 'page' && lead) {
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
    console.warn('[brochure-open] failed:', (e as Error).message)
  }
}
