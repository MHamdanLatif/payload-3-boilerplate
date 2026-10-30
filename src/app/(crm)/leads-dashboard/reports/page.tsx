import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fmtDuration } from '@/lib/engagement'
import { LEAD_STATUSES, statusLabel } from '@/lib/lead-status'
import {
  CHANNELS,
  countLeads,
  projectKeyLabel,
  projectOptions,
  sourceRows,
  sourceSummary,
  type Counts,
} from '@/lib/lead-report-groups'
import {
  brochureStats,
  loadLeadReport,
  periodText,
  projectRows,
  readReportParams,
  reportQuery,
} from '@/lib/lead-report-data'
import { ReportPeriodFields } from '@/components/crm/ReportPeriodFields'

export const metadata: Metadata = {
  title: 'Leads Dashboard | Lateef Properties',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        timeZone: 'Asia/Karachi',
      })
    : '—'

/** datetime-local wants a time; a bare date means the whole day. */
const asInput = (v: string | undefined, end: boolean) =>
  v ? (v.includes('T') ? v : `${v}T${end ? '23:59' : '00:00'}`) : undefined

export default async function LeadsReports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const payload = await getPayload({ config })
  const h = await nextHeaders()
  const { user } = await payload.auth({ headers: h })
  if (!user) redirect('/leads-dashboard/login?next=/leads-dashboard/reports')

  const report = await loadLeadReport(payload, readReportParams(await searchParams))
  const { leads, opens: opensByBrochure, dwell: dwellByBrochure } = report
  const { opened: openedCount, avgDwell } = brochureStats(report)

  const totals = countLeads(leads)
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

  const byProject = report.project ? [] : projectRows(report)
  const sources = sourceRows(leads)
  const query = reportQuery(report)
  const qs = query ? `?${query}` : ''

  const th = 'px-3 py-2 text-left text-[0.7rem] uppercase tracking-[0.15em] text-brand-deep/55'
  const td = 'px-3 py-2.5 text-sm text-brand-deep'
  const field = 'rounded-md border border-brand-deep/15 px-2 py-1.5 text-sm'
  const fieldLabel = 'flex flex-col gap-1 text-xs text-brand-deep/60'
  const badge: Record<string, string> = {
    'details-sent': 'bg-sky-100 text-sky-700',
    engaged: 'bg-indigo-100 text-indigo-700',
    'not-a-fit': 'bg-rose-100 text-rose-600',
    unqualified: 'bg-brand-deep/10 text-brand-deep/70',
    contacted: 'bg-blue-100 text-blue-700',
    qualified: 'bg-green-100 text-green-700',
    'site-visit': 'bg-amber-100 text-amber-700',
    'closed-won': 'bg-emerald-600 text-white',
    junk: 'bg-red-100 text-red-600',
  }

  const countHead = (
    <>
      <th className={th}>Leads</th>
      <th className={th}>Contacted</th>
      <th className={th}>Qualified</th>
      <th className={th}>Site visits</th>
      <th className={th}>Closed won</th>
      <th className={th}>Qualify rate</th>
    </>
  )
  const countCells = (c: Counts) => (
    <>
      <td className={td}>{c.leads}</td>
      <td className={td}>{c.contacted}</td>
      <td className={td}>{c.qualified}</td>
      <td className={td}>{c.siteVisits}</td>
      <td className={td}>{c.closedWon}</td>
      <td className={td}>{pct(c.qualified, c.leads)}%</td>
    </>
  )

  return (
    <main className="crm-wrap">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-3xl tracking-tight text-brand-deep md:text-4xl">
          Leads report
        </h1>
        <p className="mt-1 text-sm text-brand-deep/60">
          {report.projectLabel} · {periodText(report)}
        </p>

        {/* Filters */}
        <form
          method="get"
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-brand-deep/10 bg-white p-4"
        >
          <ReportPeriodFields
            period={report.period}
            from={asInput(report.range.from, false)}
            to={asInput(report.range.to, true)}
          />
          <label className={fieldLabel}>
            Project
            <select name="project" defaultValue={report.project ?? ''} className={field}>
              <option value="">All projects</option>
              {projectOptions(report.projects).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Status
            <select name="status" defaultValue={report.status ?? ''} className={field}>
              <option value="">All</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Source
            <select name="channel" defaultValue={report.channel ?? ''} className={field}>
              <option value="">All</option>
              {CHANNELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-brand-deep px-5 py-2 text-xs font-medium uppercase tracking-[0.15em] text-white"
          >
            Apply
          </button>
          <a href="/leads-dashboard/reports" className="text-xs text-brand-deep/55 underline">
            Reset
          </a>
          {/* Same filters as the view above, so a download is exactly what is on screen. */}
          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <a
              href={`/leads-dashboard/export${qs}`}
              className="rounded-full border border-brand-deep/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-brand-deep transition-colors hover:border-gold hover:text-gold"
            >
              Download CSV
            </a>
            <a
              href={`/leads-dashboard/reports/pdf${qs}`}
              className="rounded-full border border-brand-deep/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-brand-deep transition-colors hover:border-gold hover:text-gold"
            >
              Download PDF
            </a>
          </div>
        </form>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Total leads', value: totals.leads },
            { label: 'Contacted', value: `${totals.contacted} (${pct(totals.contacted, totals.leads)}%)` },
            { label: 'Qualified', value: `${totals.qualified} (${pct(totals.qualified, totals.leads)}%)` },
            { label: 'Site visits', value: totals.siteVisits },
            { label: 'Closed won', value: `${totals.closedWon} (${pct(totals.closedWon, totals.leads)}%)` },
            { label: 'Junk', value: totals.junk },
            { label: 'Opened brochure', value: `${openedCount} (${pct(openedCount, totals.leads)}%)` },
            { label: 'Avg time on page', value: fmtDuration(avgDwell) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-brand-deep/10 bg-white p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/50">
                {k.label}
              </p>
              <p className="mt-1 font-serif text-2xl text-brand-deep">{k.value}</p>
            </div>
          ))}
        </div>

        {/* By project (only when not already filtered to one) */}
        {!report.project && (
          <section className="mt-8 overflow-x-auto rounded-xl border border-brand-deep/10 bg-white">
            <p className="px-4 pt-4 font-serif text-lg text-brand-deep">By project</p>
            <table className="mt-2 w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-brand-deep/10">
                  <th className={th}>Project</th>
                  {countHead}
                </tr>
              </thead>
              <tbody>
                {byProject.map((r) => (
                  <tr key={r.label} className="border-b border-brand-deep/5">
                    <td className={td}>{r.label}</td>
                    {countCells(r.counts)}
                  </tr>
                ))}
                {!byProject.length && (
                  <tr>
                    <td className={td} colSpan={7}>
                      No leads in range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* By source: channel, then campaign › ad set › ad for Meta */}
        <section className="mt-8 overflow-x-auto rounded-xl border border-brand-deep/10 bg-white">
          <p className="px-4 pt-4 font-serif text-lg text-brand-deep">By source</p>
          <p className="px-4 pt-1 text-xs text-brand-deep/50">
            Meta paid ads break down into campaign, then ad set, then ad, where the ad recorded them.
          </p>
          <table className="mt-2 w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-brand-deep/10">
                <th className={th}>Source</th>
                {countHead}
              </tr>
            </thead>
            <tbody>
              {sources.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-brand-deep/5 ${r.depth === 0 ? 'bg-ivory/60 font-medium' : ''}`}
                >
                  <td className={td} style={{ paddingLeft: `${0.75 + r.depth * 1.1}rem` }}>
                    {r.depth > 0 && <span className="mr-1 text-brand-deep/35">›</span>}
                    {r.label}
                  </td>
                  {countCells(r.counts)}
                </tr>
              ))}
              {!sources.length && (
                <tr>
                  <td className={td} colSpan={7}>
                    No leads in range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Leads */}
        <section className="mt-8 overflow-x-auto rounded-xl border border-brand-deep/10 bg-white">
          <p className="px-4 pt-4 font-serif text-lg text-brand-deep">Leads ({totals.leads})</p>
          <p className="px-4 pt-1 text-xs text-brand-deep/50">
            Time on page is the total across every visit — click a name for the per-visit breakdown.
          </p>
          <table className="mt-2 w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-brand-deep/10">
                <th className={th}>Name</th>
                <th className={th}>Phone</th>
                <th className={th}>Project</th>
                <th className={th}>Source</th>
                <th className={th}>Status</th>
                <th className={th}>Opens</th>
                <th className={th}>Time on page</th>
                <th className={th}>Created</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 200).map((l) => (
                <tr key={l.id} className="border-b border-brand-deep/5">
                  <td className={td}>
                    <a
                      className="underline decoration-brand-deep/25 underline-offset-2 hover:text-gold"
                      href={`/leads-dashboard/${l.id}`}
                    >
                      {l.name}
                    </a>
                    <p className="mt-1 text-xs text-brand-deep/55">
                      {l.followUpAt
                        ? `${l.followUpSentAt ? 'Reminder sent' : 'Follow up'}: ${new Date(l.followUpAt).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'short', timeStyle: 'short' })} PKT`
                        : 'No reminder'}
                    </p>
                  </td>
                  <td className={td}>{l.phone}</td>
                  <td className={td}>
                    {projectKeyLabel(report.projectKeyOf.get(l.id) ?? 'general', report.projects)}
                  </td>
                  <td className={td}>{sourceSummary(l)}</td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-wide ${badge[l.status ?? 'unqualified']}`}
                    >
                      {statusLabel(l.status)}
                    </span>
                  </td>
                  <td className={td}>
                    {l.brochureId ? (opensByBrochure.get(l.brochureId) ?? 0) : 0}
                  </td>
                  <td className={td}>
                    {fmtDuration(l.brochureId ? (dwellByBrochure.get(l.brochureId) ?? 0) : 0)}
                  </td>
                  <td className={td}>{fmtDate(l.createdAt)}</td>
                  <td className={td}>
                    <a className="text-gold underline" href={`/admin/collections/leads/${l.id}`}>
                      Edit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totals.leads > 200 && (
            <p className="px-4 py-3 text-xs text-brand-deep/55">
              Showing the newest 200. The CSV has all {totals.leads}.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
