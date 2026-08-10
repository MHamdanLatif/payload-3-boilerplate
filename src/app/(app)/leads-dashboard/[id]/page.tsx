import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead, LinkOpen } from '@/payload-types'
import { fmtDurationLong, platformOf } from '@/lib/engagement'

export const metadata: Metadata = {
  title: 'Lead activity | Lateef Properties',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const fmtStamp = (d: string | null | undefined) =>
  d
    ? new Date(d)
        .toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        .replace(',', ' -')
    : '—'

type Row = {
  at: string
  kind: 'view' | 'asset' | 'sent'
  detail: string
  platform: string | null
}

const ASSET_LABEL: Record<string, string> = {
  pdf1: 'Opened the brochure PDF',
  pdf2: 'Opened the second PDF',
  map: 'Viewed the location map',
  video: 'Played the video',
}

export default async function LeadActivity({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const h = await nextHeaders()
  const { user } = await payload.auth({ headers: h })
  const { id } = await params
  if (!user) redirect(`/admin/login?redirect=/leads-dashboard/${id}`)

  let lead: Lead | null = null
  try {
    lead = (await payload.findByID({ collection: 'leads', id, depth: 0 })) as Lead
  } catch {
    notFound()
  }
  if (!lead) notFound()

  // Opens are matched on brochureId — that is what the tracking endpoints key
  // on, and it stays correct for rows written before the lead relationship was
  // populated. Without a brochureId there is nothing to show.
  const opens = lead.brochureId
    ? ((
        await payload.find({
          collection: 'link-opens',
          where: { brochureId: { equals: lead.brochureId } },
          depth: 0,
          limit: 500,
          pagination: false,
          sort: '-createdAt',
        })
      ).docs as LinkOpen[])
    : []

  const views = opens.filter((o) => o.asset === 'page')
  const totalMs = views.reduce((sum, o) => sum + (o.dwellMs ?? 0), 0)
  const totalLabel = fmtDurationLong(totalMs)

  const rows: Row[] = []
  for (const o of opens) {
    if (o.asset === 'page') {
      const d = fmtDurationLong(o.dwellMs)
      rows.push({
        at: o.createdAt,
        kind: 'view',
        // No reading means the visit ended before the first beacon — a bounce,
        // or a browser that killed the page. Saying "Viewed" without a made-up
        // duration is honest; claiming 0s would not be.
        detail: d ? `Viewed for ${d}` : 'Viewed (duration not captured)',
        platform: platformOf(o.userAgent),
      })
    } else {
      rows.push({
        at: o.createdAt,
        kind: 'asset',
        detail: ASSET_LABEL[o.asset ?? ''] ?? 'Engaged with an asset',
        platform: platformOf(o.userAgent),
      })
    }
  }
  if (lead.brochureSentAt) {
    rows.push({ at: lead.brochureSentAt, kind: 'sent', detail: 'Sent file', platform: null })
  }
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const th = 'px-3 py-2 text-left text-[0.7rem] uppercase tracking-[0.15em] text-brand-deep/55'
  const td = 'px-3 py-3 text-sm text-brand-deep align-top'

  return (
    <main className="min-h-screen bg-ivory px-4 py-10 md:px-8">
      <div className="mx-auto max-w-4xl">
        <a href="/leads-dashboard" className="text-xs text-brand-deep/55 underline">
          ← Back to dashboard
        </a>

        <h1 className="mt-4 font-serif text-3xl tracking-tight text-brand-deep md:text-4xl">
          {lead.sourceName || lead.brochureHeadline || 'Brochure activity'}
        </h1>
        <p className="mt-1 text-sm text-brand-deep/70">
          {views.length ? (
            <>
              Viewed {views.length} {views.length === 1 ? 'time' : 'times'}
              {totalLabel ? ` for ${totalLabel}` : ''} by{' '}
              <span className="font-medium text-brand-deep">{lead.name}</span>
            </>
          ) : (
            <>
              Not opened yet by <span className="font-medium text-brand-deep">{lead.name}</span>
            </>
          )}
        </p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-deep/55">
          <span>{lead.phone}</span>
          <span>Status: {lead.status ?? 'unqualified'}</span>
          <a className="text-gold underline" href={`/admin/collections/leads/${lead.id}`}>
            Open in admin
          </a>
        </div>

        <section className="mt-8 overflow-x-auto rounded-xl border border-brand-deep/10 bg-white">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-brand-deep/10">
                <th className={th}>Date</th>
                <th className={th}>Details</th>
                <th className={th}>Platform</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.at}-${i}`} className="border-b border-brand-deep/5">
                  <td className={`${td} whitespace-nowrap`}>{fmtStamp(r.at)}</td>
                  <td className={`${td} ${r.kind === 'sent' ? 'text-brand-deep/70' : 'text-blue-600'}`}>
                    {r.detail}
                  </td>
                  <td className={`${td} whitespace-nowrap text-brand-deep/70`}>{r.platform ?? '–'}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className={td} colSpan={3}>
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <p className="mt-4 text-xs text-brand-deep/45">
          Time on page counts foreground time only and is capped at 30 minutes per visit. Visits from
          before time-tracking shipped show no duration.
        </p>
      </div>
    </main>
  )
}
