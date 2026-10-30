import type { Lead } from '@/payload-types'
import { atLeast } from './lead-status'

/**
 * How the CRM report groups leads: first by PROJECT, then by SOURCE.
 *
 * Shared by the Reports page, its CSV and the investor PDF so all three count
 * the same lead in the same place.
 *
 * Which form a lead used (top/bottom/popup) is deliberately absent. It is
 * backend detail, kept on the lead and in the CSV, and means nothing to the
 * people these reports are for.
 */

type L = Partial<Lead>

export type ReportProject = { id: number; title: string; slug?: string | null }
export type ReportMarketed = { id: number; slug?: string | null; linkedProject?: number | null }

/** `p:<id>` for a featured project, else one of the two catch-all buckets. */
export type ProjectKey = `p:${number}` | 'general' | 'other'

export const GENERAL_LABEL = 'General enquiry (website)'
export const OTHER_LABEL = 'Other (old listing leads)'

const relId = (rel: unknown): number | null => {
  if (typeof rel === 'number') return rel
  if (rel && typeof rel === 'object' && typeof (rel as { id?: unknown }).id === 'number')
    return (rel as { id: number }).id
  return null
}

/**
 * The project that ACQUIRED the lead, falling back through older fields for
 * leads created before the project relationships existed. Acquired rather than
 * current interest: a report on what a campaign brought in must not move when
 * sales later cross-sells the buyer.
 */
export function reportProjectKey(
  lead: L,
  projects: ReportProject[],
  marketed: ReportMarketed[] = [],
): ProjectKey {
  const known = new Set(projects.map((p) => p.id))
  const hit = (id: number | null): ProjectKey | null => (id != null && known.has(id) ? `p:${id}` : null)

  const direct = hit(relId(lead.acquiredProject))
  if (direct) return direct

  const mpId = relId(lead.marketedProject)
  const mp =
    marketed.find((m) => m.id === mpId) ??
    (lead.sourceKind === 'marketed-project' && lead.sourceSlug
      ? marketed.find((m) => m.slug === lead.sourceSlug)
      : undefined)
  const viaMarketed = hit(mp?.linkedProject ?? null)
  if (viaMarketed) return viaMarketed

  if (lead.sourceKind === 'project' && lead.sourceSlug) {
    const bySlug = projects.find((p) => p.slug === lead.sourceSlug)
    if (bySlug) return `p:${bySlug.id}`
  }

  // Meta instant forms carry only the project's name.
  const name = (lead.sourceName || lead.brochureHeadline || '').trim().toLowerCase()
  if (name) {
    const byName = projects.find((p) => p.title.trim().toLowerCase() === name)
    if (byName) return `p:${byName.id}`
  }

  const legacy = lead.source || ''
  if (
    lead.sourceKind === 'listing' ||
    legacy.startsWith('listing') ||
    lead.conversionSurface === 'listing-form' ||
    // A project lead whose project no longer exists is history, not a general enquiry.
    lead.sourceKind === 'project' ||
    lead.sourceKind === 'marketed-project'
  )
    return 'other'
  return 'general'
}

export function projectKeyLabel(key: string, projects: ReportProject[]): string {
  if (key === 'general') return GENERAL_LABEL
  if (key === 'other') return OTHER_LABEL
  const id = Number(key.slice(2))
  return projects.find((p) => p.id === id)?.title ?? 'Project'
}

/** Filter options in the order the owner reads them: projects, then general, then old. */
export function projectOptions(projects: ReportProject[]) {
  return [
    ...projects.map((p) => ({ value: `p:${p.id}`, label: p.title })),
    { value: 'general', label: GENERAL_LABEL },
    { value: 'other', label: OTHER_LABEL },
  ]
}

// ── Source ────────────────────────────────────────────────────────────────

export type Channel = 'meta' | 'google' | 'referral' | 'whatsapp' | 'other'

export const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'meta', label: 'Meta paid ads' },
  { key: 'google', label: 'Google search & website' },
  { key: 'referral', label: 'Referral' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'other', label: 'Other' },
]
export const channelLabel = (c: Channel) => CHANNELS.find((x) => x.key === c)!.label

const isMeta = (l: L) =>
  l.acquisitionSource === 'meta-ads' || l.sourceKind === 'meta-ad' || Boolean(l.metaAdName)

/**
 * acquisitionSource 'referral' means two different things: a person who sent
 * the buyer (entered by hand in the CRM) or another website linking to ours
 * (derived from the visit). Only the first is a Referral here; a linking site
 * belongs with the website traffic.
 */
const isWebsiteReferral = (l: L) =>
  l.acquisitionSource === 'referral' &&
  Boolean(l.firstTouchReferrer) &&
  l.conversionSurface !== 'crm-manual'

export function channelOf(l: L): Channel {
  if (isMeta(l)) return 'meta'
  const a = l.acquisitionSource
  if (a === 'google-organic' || a === 'google-ads' || a === 'direct' || isWebsiteReferral(l))
    return 'google'
  if (a === 'referral') return 'referral'
  if (a === 'whatsapp') return 'whatsapp'
  return 'other'
}

/** Meta ad hierarchy from the ad URL parameters, or the instant-form ad name. */
export function metaPath(l: L) {
  return {
    campaign: l.firstTouchCampaign || 'Campaign not recorded',
    adSet: l.firstTouchTerm || 'Ad set not recorded',
    ad: l.metaAdName || l.firstTouchContent || 'Ad not recorded',
  }
}

function googleDetail(l: L): string {
  switch (l.acquisitionSource) {
    case 'google-organic':
      return 'Organic search (SEO)'
    case 'google-ads':
      return 'Google Ads'
    case 'direct':
      return 'Direct website visit'
    default:
      return 'Link from another website'
  }
}

function otherDetail(l: L): string {
  if (l.source === 'call') return 'Phone call'
  switch (l.acquisitionSource) {
    case 'instagram-organic':
      return 'Instagram (organic)'
    case 'manual':
      return 'Added by hand'
    default:
      return 'Source not recorded'
  }
}

/** The labels from channel down to the most specific level known for this lead. */
export function sourcePath(l: L): string[] {
  const c = channelOf(l)
  if (c === 'meta') {
    const m = metaPath(l)
    return [channelLabel(c), m.campaign, m.adSet, m.ad]
  }
  if (c === 'google') return [channelLabel(c), googleDetail(l)]
  if (c === 'other') return [channelLabel(c), otherDetail(l)]
  return [channelLabel(c)]
}

/** One line for a lead row: "Meta paid ads · Campaign › Ad set › Ad". */
export function sourceSummary(l: L): string {
  const [head, ...rest] = sourcePath(l)
  return rest.length ? `${head} · ${rest.join(' › ')}` : head
}

// ── Counting ──────────────────────────────────────────────────────────────

export type Counts = {
  leads: number
  contacted: number
  qualified: number
  siteVisits: number
  closedWon: number
  junk: number
}

export const emptyCounts = (): Counts => ({
  leads: 0,
  contacted: 0,
  qualified: 0,
  siteVisits: 0,
  closedWon: 0,
  junk: 0,
})

export function addLead(c: Counts, l: L) {
  c.leads++
  if (l.status && l.status !== 'unqualified') c.contacted++
  if (atLeast(l.status, 'qualified')) c.qualified++
  if (atLeast(l.status, 'site-visit')) c.siteVisits++
  if (l.status === 'closed-won') c.closedWon++
  if (l.status === 'junk') c.junk++
}

export function countLeads(leads: L[]): Counts {
  const c = emptyCounts()
  for (const l of leads) addLead(c, l)
  return c
}

export type SourceRow = { label: string; depth: number; counts: Counts }

/**
 * Flattened source tree: each channel, then its levels nested beneath it.
 * Channels keep a fixed order (an investor compares reports side by side);
 * everything below a channel is sorted by lead count.
 */
export function sourceRows(leads: L[]): SourceRow[] {
  type Node = { counts: Counts; children: Map<string, Node> }
  const node = (): Node => ({ counts: emptyCounts(), children: new Map() })
  const root = node()
  for (const l of leads) {
    let at = root
    for (const label of sourcePath(l)) {
      if (!at.children.has(label)) at.children.set(label, node())
      at = at.children.get(label)!
      addLead(at.counts, l)
    }
  }
  const order = CHANNELS.map((c) => c.label)
  const rows: SourceRow[] = []
  const walk = (n: Node, depth: number) => {
    const entries = [...n.children.entries()]
    if (depth === 0) entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    else entries.sort((a, b) => b[1].counts.leads - a[1].counts.leads || a[0].localeCompare(b[0]))
    for (const [label, child] of entries) {
      rows.push({ label, depth, counts: child.counts })
      walk(child, depth + 1)
    }
  }
  walk(root, 0)
  return rows
}

// ── Periods ───────────────────────────────────────────────────────────────

export const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom dates & times' },
] as const
export type Period = (typeof PERIODS)[number]['value']

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/**
 * The PKT calendar dates a preset covers, or null for "all"/"custom" (which
 * use the from/to the user typed). Weeks start on Monday.
 */
export function periodDates(period: string | undefined, now = new Date()) {
  // Shift to PKT once, then do plain UTC date arithmetic on the shifted value.
  const pkt = new Date(now.getTime() + 5 * 3600000)
  const day = (offset: number) => {
    const d = new Date(pkt)
    d.setUTCDate(d.getUTCDate() + offset)
    return ymd(d)
  }
  switch (period) {
    case 'today':
      return { from: day(0), to: day(0) }
    case 'yesterday':
      return { from: day(-1), to: day(-1) }
    case '7d':
      return { from: day(-6), to: day(0) }
    case 'week':
      return { from: day(-((pkt.getUTCDay() + 6) % 7)), to: day(0) }
    case 'month':
      return { from: ymd(new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), 1))), to: day(0) }
    case 'last-month':
      return {
        from: ymd(new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth() - 1, 1))),
        to: ymd(new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), 0))),
      }
    default:
      return null
  }
}
