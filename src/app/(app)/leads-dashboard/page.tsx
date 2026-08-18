import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Lead } from '@/payload-types'
import { fmtDuration } from '@/lib/engagement'

export const metadata: Metadata = {
  title: 'Leads Dashboard | Lateef Properties',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

type SP = { from?: string; to?: string; status?: string; source?: string }

const STATUSES = [
  'unqualified',
  'contacted',
  'qualified',
  'site-visit',
  'closed-won',
  'junk',
] as const

// Funnel stages a lead passes THROUGH, in order. 'junk' is excluded on purpose:
// it is a terminal outcome, not a stage, so it must not count as progress.
const FUNNEL: readonly string[] = ['contacted', 'qualified', 'site-visit', 'closed-won']

/**
 * Counting is cumulative, which matters now that the funnel is longer than one
 * step: a lead marked "Closed Won" has self-evidently been qualified, so a
 * strict `status === 'qualified'` check would quietly shrink the qualified
 * count every time a deal progressed.
 */
const atLeast = (status: string | null | undefined, stage: string) => {
  const i = FUNNEL.indexOf(status ?? '')
  return i >= 0 && i >= FUNNEL.indexOf(stage)
}
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
const sourceOf = (l: Lead) => l.metaAdName || l.source || l.sourceKind || 'unknown'

export default async function LeadsDashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const payload = await getPayload({ config })
  const h = await nextHeaders()
  const { user } = await payload.auth({ headers: h })
  if (!user) redirect('/admin/login?redirect=/leads-dashboard')

  const sp = await searchParams
  const and: Where[] = []
  if (sp.from) and.push({ createdAt: { greater_than_equal: new Date(sp.from).toISOString() } })
  if (sp.to) {
    const to = new Date(sp.to)
    to.setHours(23, 59, 59, 999)
    and.push({ createdAt: { less_than_equal: to.toISOString() } })
  }
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) {
    and.push({ status: { equals: sp.status } })
  }
  const where: Where = and.length ? { and } : {}

  const [leadsRes, opensRes] = await Promise.all([
    payload.find({ collection: 'leads', where, depth: 0, limit: 1000, pagination: false, sort: '-createdAt' }),
    payload.find({ collection: 'link-opens', where: { asset: { equals: 'page' } }, depth: 0, limit: 5000, pagination: false }),
  ])
  let leads = leadsRes.docs as Lead[]
  if (sp.source) leads = leads.filter((l) => sourceOf(l) === sp.source)

  // opens + total time on page per brochureId. Dwell is summed across visits,
  // so the column answers "how long has this lead spent with the brochure", not
  // "how long was one sitting". Opens with no beacon (bounced instantly, or the
  // browser killed the page before the first heartbeat) contribute 0.
  const opensByBrochure = new Map<string, number>()
  const dwellByBrochure = new Map<string, number>()
  for (const o of opensRes.docs as { brochureId?: string | null; dwellMs?: number | null }[]) {
    if (!o.brochureId) continue
    opensByBrochure.set(o.brochureId, (opensByBrochure.get(o.brochureId) ?? 0) + 1)
    if (o.dwellMs) dwellByBrochure.set(o.brochureId, (dwellByBrochure.get(o.brochureId) ?? 0) + o.dwellMs)
  }
  const openedLeads = leads.filter((l) => l.brochureId && opensByBrochure.has(l.brochureId))
  const openedCount = openedLeads.length

  // Average across leads we actually have a reading for — averaging over every
  // opener would silently drag the number down with un-measurable visits.
  const dwellSamples = openedLeads
    .map((l) => (l.brochureId ? (dwellByBrochure.get(l.brochureId) ?? 0) : 0))
    .filter((ms) => ms > 0)
  const avgDwell = dwellSamples.length
    ? Math.round(dwellSamples.reduce((a, b) => a + b, 0) / dwellSamples.length)
    : 0

  const total = leads.length
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]))
  const contacted = total - byStatus.unqualified // anyone past unqualified
  const qualified = leads.filter((l) => atLeast(l.status, 'qualified')).length
  const siteVisits = leads.filter((l) => atLeast(l.status, 'site-visit')).length
  const closedWon = byStatus['closed-won']
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

  // source breakdown
  const bySource = new Map<string, { total: number; contacted: number; qualified: number }>()
  for (const l of leads) {
    const s = sourceOf(l)
    const row = bySource.get(s) ?? { total: 0, contacted: 0, qualified: 0 }
    row.total++
    if (atLeast(l.status, 'contacted') || l.status === 'junk') row.contacted++
    if (atLeast(l.status, 'qualified')) row.qualified++
    bySource.set(s, row)
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1].total - a[1].total)
  const allSources = [...new Set((leadsRes.docs as Lead[]).map(sourceOf))].sort()

  const exportQuery = new URLSearchParams(
    Object.entries({ from: sp.from, to: sp.to, status: sp.status, source: sp.source }).filter(
      (e): e is [string, string] => Boolean(e[1]),
    ),
  ).toString()

  const th = 'px-3 py-2 text-left text-[0.7rem] uppercase tracking-[0.15em] text-brand-deep/55'
  const td = 'px-3 py-2.5 text-sm text-brand-deep'
  const badge: Record<string, string> = {
    unqualified: 'bg-brand-deep/10 text-brand-deep/70',
    contacted: 'bg-blue-100 text-blue-700',
    qualified: 'bg-green-100 text-green-700',
    'site-visit': 'bg-amber-100 text-amber-700',
    'closed-won': 'bg-emerald-600 text-white',
    junk: 'bg-red-100 text-red-600',
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-3xl tracking-tight text-brand-deep md:text-4xl">Leads Dashboard</h1>
        <p className="mt-1 text-sm text-brand-deep/60">Native CRM reporting — leads, sources, qualification funnel & brochure opens.</p>

        {/* Filters */}
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-brand-deep/10 bg-white p-4">
          <label className="flex flex-col gap-1 text-xs text-brand-deep/60">From
            <input type="date" name="from" defaultValue={sp.from} className="rounded-md border border-brand-deep/15 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-brand-deep/60">To
            <input type="date" name="to" defaultValue={sp.to} className="rounded-md border border-brand-deep/15 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-brand-deep/60">Status
            <select name="status" defaultValue={sp.status ?? ''} className="rounded-md border border-brand-deep/15 px-2 py-1.5 text-sm">
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-brand-deep/60">Source
            <select name="source" defaultValue={sp.source ?? ''} className="rounded-md border border-brand-deep/15 px-2 py-1.5 text-sm">
              <option value="">All</option>
              {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-brand-deep px-5 py-2 text-xs font-medium uppercase tracking-[0.15em] text-white">Apply</button>
          <a href="/leads-dashboard" className="text-xs text-brand-deep/55 underline">Reset</a>
          {/* Same params as the view above, so you export exactly what you filtered
              to rather than a full dump you then clean up in a spreadsheet. */}
          <a
            href={`/leads-dashboard/export${exportQuery ? `?${exportQuery}` : ''}`}
            className="ml-auto rounded-full border border-brand-deep/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-brand-deep transition-colors hover:border-gold hover:text-gold"
          >
            Download CSV
          </a>
        </form>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Total leads', value: total },
            { label: 'Contacted', value: `${contacted} (${pct(contacted, total)}%)` },
            { label: 'Qualified', value: `${qualified} (${pct(qualified, total)}%)` },
            { label: 'Site visits', value: siteVisits },
            { label: 'Closed won', value: `${closedWon} (${pct(closedWon, total)}%)` },
            { label: 'Junk', value: byStatus.junk },
            { label: 'Opened brochure', value: `${openedCount} (${pct(openedCount, total)}%)` },
            { label: 'Avg time on page', value: fmtDuration(avgDwell) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-brand-deep/10 bg-white p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/50">{k.label}</p>
              <p className="mt-1 font-serif text-2xl text-brand-deep">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Source funnel */}
        <section className="mt-8 overflow-x-auto rounded-xl border border-brand-deep/10 bg-white">
          <p className="px-4 pt-4 font-serif text-lg text-brand-deep">Source / campaign funnel</p>
          <table className="mt-2 w-full min-w-[520px]">
            <thead><tr className="border-b border-brand-deep/10"><th className={th}>Source</th><th className={th}>Leads</th><th className={th}>Contacted</th><th className={th}>Qualified</th><th className={th}>Qualify rate</th></tr></thead>
            <tbody>
              {sources.map(([s, r]) => (
                <tr key={s} className="border-b border-brand-deep/5">
                  <td className={td}>{s}</td><td className={td}>{r.total}</td><td className={td}>{r.contacted}</td><td className={td}>{r.qualified}</td>
                  <td className={td}>{pct(r.qualified, r.total)}%</td>
                </tr>
              ))}
              {!sources.length && <tr><td className={td} colSpan={5}>No leads in range.</td></tr>}
            </tbody>
          </table>
        </section>

        {/* Recent leads */}
        <section className="mt-8 overflow-x-auto rounded-xl border border-brand-deep/10 bg-white">
          <p className="px-4 pt-4 font-serif text-lg text-brand-deep">Leads ({total})</p>
          <p className="px-4 pt-1 text-xs text-brand-deep/50">
            Time on page is the total across every visit — click a name for the per-visit breakdown.
          </p>
          <table className="mt-2 w-full min-w-[820px]">
            <thead><tr className="border-b border-brand-deep/10"><th className={th}>Name</th><th className={th}>Phone</th><th className={th}>Source</th><th className={th}>Status</th><th className={th}>Opens</th><th className={th}>Time on page</th><th className={th}>Created</th><th className={th}></th></tr></thead>
            <tbody>
              {leads.slice(0, 200).map((l) => (
                <tr key={l.id} className="border-b border-brand-deep/5">
                  <td className={td}>
                    <a className="underline decoration-brand-deep/25 underline-offset-2 hover:text-gold" href={`/leads-dashboard/${l.id}`}>
                      {l.name}
                    </a>
                  </td>
                  <td className={td}>{l.phone}</td>
                  <td className={td}>{sourceOf(l)}</td>
                  <td className={td}><span className={`rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-wide ${badge[l.status ?? 'unqualified']}`}>{l.status}</span></td>
                  <td className={td}>{l.brochureId ? opensByBrochure.get(l.brochureId) ?? 0 : 0}</td>
                  <td className={td}>{fmtDuration(l.brochureId ? dwellByBrochure.get(l.brochureId) ?? 0 : 0)}</td>
                  <td className={td}>{fmtDate(l.createdAt)}</td>
                  <td className={td}><a className="text-gold underline" href={`/admin/collections/leads/${l.id}`}>Edit</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}
