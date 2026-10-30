import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { LEAD_STATUSES } from './lead-status'
import { brochureOpenTotals, leadReportWhere, reportRange } from './lead-report'
import {
  CHANNELS,
  PERIODS,
  channelOf,
  countLeads,
  periodDates,
  projectKeyLabel,
  projectOptions,
  reportProjectKey,
  type Channel,
  type ReportMarketed,
  type ReportProject,
} from './lead-report-groups'

/**
 * Loads one leads report from its URL parameters. The Reports page, the CSV
 * and the PDF all call this, so a download always holds exactly what the
 * screen showed.
 */

export type ReportParams = {
  period?: string | null
  from?: string | null
  to?: string | null
  status?: string | null
  project?: string | null
  channel?: string | null
}

const pick = (sp: URLSearchParams | Record<string, string | undefined>, k: string) =>
  (sp instanceof URLSearchParams ? sp.get(k) : sp[k]) ?? undefined

export function readReportParams(
  sp: URLSearchParams | Record<string, string | undefined>,
): ReportParams {
  return {
    period: pick(sp, 'period'),
    from: pick(sp, 'from'),
    to: pick(sp, 'to'),
    status: pick(sp, 'status'),
    project: pick(sp, 'project'),
    channel: pick(sp, 'channel'),
  }
}

export async function loadLeadReport(payload: Payload, params: ReportParams, now = new Date()) {
  const period = PERIODS.some((p) => p.value === params.period)
    ? (params.period as string)
    : params.from || params.to
      ? 'custom'
      : 'all'
  const preset = periodDates(period, now)
  const range =
    period === 'all'
      ? reportRange(undefined, undefined)
      : preset
        ? reportRange(preset.from, preset.to)
        : reportRange(params.from, params.to)
  const status =
    params.status && (LEAD_STATUSES as readonly string[]).includes(params.status)
      ? params.status
      : undefined
  const channel = CHANNELS.some((c) => c.key === params.channel)
    ? (params.channel as Channel)
    : undefined

  const [leadsRes, projectsRes, marketedRes, totals] = await Promise.all([
    payload.find({
      collection: 'leads',
      where: leadReportWhere(range, status),
      depth: 0,
      limit: 0,
      pagination: false,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'featured-projects',
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'title',
      select: { title: true, slug: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'marketed-projects',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { slug: true, linkedProject: true },
      overrideAccess: true,
    }),
    brochureOpenTotals(payload, range, status),
  ])

  const projects: ReportProject[] = projectsRes.docs.map((p) => ({
    id: p.id as number,
    title: String(p.title ?? 'Untitled project'),
    slug: p.slug as string | null,
  }))
  const marketed: ReportMarketed[] = marketedRes.docs.map((m) => ({
    id: m.id as number,
    slug: m.slug as string | null,
    linkedProject:
      typeof m.linkedProject === 'object' ? (m.linkedProject?.id ?? null) : (m.linkedProject ?? null),
  }))

  const all = (leadsRes.docs as Lead[]).map((lead) => ({
    lead,
    projectKey: reportProjectKey(lead, projects, marketed),
  }))
  const projectFilter =
    params.project &&
    (params.project === 'general' ||
      params.project === 'other' ||
      projects.some((p) => `p:${p.id}` === params.project))
      ? params.project
      : undefined

  const inProject = projectFilter ? all.filter((r) => r.projectKey === projectFilter) : all
  const rows = channel ? inProject.filter((r) => channelOf(r.lead) === channel) : inProject

  return {
    period,
    range,
    status,
    channel,
    project: projectFilter,
    projectLabel: projectFilter ? projectKeyLabel(projectFilter, projects) : 'All projects',
    projects,
    /** Leads after every filter. */
    leads: rows.map((r) => r.lead),
    /** Project bucket per lead id, for the by-project table and CSV. */
    projectKeyOf: new Map(all.map((r) => [r.lead.id, r.projectKey])),
    opens: totals.opens,
    dwell: totals.dwell,
  }
}
export type LeadReport = Awaited<ReturnType<typeof loadLeadReport>>

/** Leads who opened their brochure, and their average total time on it. */
export function brochureStats(r: LeadReport) {
  const opened = r.leads.filter((l) => l.brochureId && r.opens.has(l.brochureId))
  // Average across leads we actually have a reading for — averaging over every
  // opener would silently drag the number down with un-measurable visits.
  const samples = opened
    .map((l) => (l.brochureId ? (r.dwell.get(l.brochureId) ?? 0) : 0))
    .filter((ms) => ms > 0)
  const avgDwell = samples.length
    ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    : 0
  return { opened: opened.length, avgDwell }
}

/** CRM conversation notes first, then whatever the buyer wrote on the enquiry. */
export function leadNotes(l: Lead): string {
  return [l.conversationNotes, l.notes]
    .map((n) => (n ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Per-project counts in filter order, skipping empty buckets. */
export function projectRows(r: LeadReport) {
  return projectOptions(r.projects)
    .map((o) => ({
      label: o.label,
      counts: countLeads(r.leads.filter((l) => r.projectKeyOf.get(l.id) === o.value)),
    }))
    .filter((row) => row.counts.leads > 0)
}

/** Query string carrying the same filters, for the CSV and PDF links. */
export function reportQuery(r: LeadReport): string {
  const entries: [string, string | undefined][] = [
    ['period', r.period],
    ['from', r.period === 'custom' ? r.range.from : undefined],
    ['to', r.period === 'custom' ? r.range.to : undefined],
    ['status', r.status],
    ['project', r.project],
    ['channel', r.channel],
  ]
  return new URLSearchParams(entries.filter((e): e is [string, string] => Boolean(e[1]))).toString()
}

const fmtDay = (ymd: string) => {
  const [date, time] = ymd.split('T')
  const d = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return time ? `${d}, ${time}` : d
}

/** "1 Oct 2026 – 31 Oct 2026 (This month)" in PKT. */
export function periodText(r: LeadReport): string {
  const name = PERIODS.find((p) => p.value === r.period)?.label ?? ''
  const { from, to } = r.range
  if (!from && !to) return 'All time'
  const span =
    from && to
      ? from === to
        ? fmtDay(from)
        : `${fmtDay(from)} – ${fmtDay(to)}`
      : from
        ? `From ${fmtDay(from)}`
        : `Up to ${fmtDay(to!)}`
  return r.period === 'custom' ? `${span} (PKT)` : `${span} (${name}, PKT)`
}
