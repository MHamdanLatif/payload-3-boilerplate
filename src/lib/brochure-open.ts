import { getPayload } from 'payload'
import config from '@payload-config'
import { sendNtfy } from '@/lib/ntfy'
import { getServerSideURL } from '@/utilities/getURL'
import type { Lead } from '@/payload-types'

const ASSETS = ['page', 'pdf1', 'pdf2', 'map', 'video'] as const
export type BrochureAsset = (typeof ASSETS)[number]

// Re-open cooldown: after alerting on an open, stay quiet this long, then alert
// again if the lead returns (a strong buying signal). 0 = alert on every open.
// Configured in MINUTES. `BROCHURE_REOPEN_COOLDOWN_HOURS` is the retired name,
// still honoured so an existing deployment doesn't silently change behaviour —
// but if it is set it WINS over the default, so delete it from the environment
// to pick up the 30-minute default.
const DEFAULT_COOLDOWN_MINUTES = 30

function cooldownMs(): number {
  const mins = process.env.BROCHURE_REOPEN_COOLDOWN_MINUTES
  if (mins != null && mins !== '') {
    const n = Number(mins)
    if (Number.isFinite(n)) return Math.max(0, n) * 60_000
  }
  const hours = process.env.BROCHURE_REOPEN_COOLDOWN_HOURS
  if (hours != null && hours !== '') {
    const n = Number(hours)
    if (Number.isFinite(n)) return Math.max(0, n) * 3_600_000
  }
  return DEFAULT_COOLDOWN_MINUTES * 60_000
}

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
  /** Per-render id, minted by the page and echoed by the dwell beacon so the
   *  time-on-page update can find exactly this row. Page opens only. */
  visitId?: string | null
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

      const cooldown = cooldownMs()
      if (cooldown <= 0) {
        notify = true
      } else {
        const since = new Date(Date.now() - cooldown).toISOString()
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
        visitId: asset === 'page' ? (opts.visitId ?? null) : null,
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

/** Ignore anything past this — a tab left open overnight is not "reading". */
export const MAX_DWELL_MS = 30 * 60_000

/**
 * Records how long a lead actually spent on their brochure page, against the
 * page-open row minted by this render (matched on visitId).
 *
 * The client reports a running total on a heartbeat and again as the page is
 * hidden/unloaded, so updates arrive repeatedly and out of order — we keep the
 * MAX so a late, smaller beacon can't shrink a longer session. Never creates a
 * row: if the open hasn't landed yet the sample is simply dropped, because
 * inventing one here would inflate the open count and fire a false alert.
 * Best-effort, never throws.
 */
export async function recordBrochureDwell(opts: {
  brochureId: string
  visitId: string
  ms: number
}): Promise<void> {
  if (!opts.visitId || !Number.isFinite(opts.ms)) return
  const ms = Math.min(Math.round(opts.ms), MAX_DWELL_MS)
  if (ms <= 0) return
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'link-opens',
      where: {
        and: [
          { visitId: { equals: opts.visitId } },
          { brochureId: { equals: opts.brochureId } },
        ],
      },
      depth: 0,
      limit: 1,
    })
    const row = res.docs[0] as { id: number | string; dwellMs?: number | null } | undefined
    if (!row) return
    if ((row.dwellMs ?? 0) >= ms) return
    await payload.update({
      collection: 'link-opens',
      id: row.id,
      overrideAccess: true,
      data: { dwellMs: ms },
    })
  } catch (e) {
    console.warn('[brochure-dwell] failed:', (e as Error).message)
  }
}
