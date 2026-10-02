import Link from 'next/link'
import { crmSession } from '@/lib/crm-server'
import { recentBrochureViewers } from '@/lib/recent-brochure-viewers'
import { fmtDurationLong } from '@/lib/engagement'

export const dynamic = 'force-dynamic'

const stamp = (date: string) =>
  new Date(date).toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' PKT'

export default async function BrochureViewers() {
  const { payload, user } = await crmSession('/leads-dashboard/brochures')
  const viewers = await recentBrochureViewers(payload, user)
  return (
    <main className="crm-wrap">
      <p className="crm-eyebrow">Past 7 days</p>
      <h1 className="crm-title">Brochure viewers</h1>
      <p className="crm-muted mt-2">
        People whose personal brochure links were opened, newest first. Counts and reading time
        cover the past seven days.
      </p>
      <p className="crm-muted my-5">
        {viewers.length} {viewers.length === 1 ? 'person' : 'people'}
      </p>
      <div className="crm-leads">
        {viewers.map(({ lead, visits, totalMs, captured }) => (
          <article className="crm-card" key={lead.id}>
            <Link className="crm-card-link" href={'/leads-dashboard/' + lead.id}>
              <div className="crm-row">
                <h2>{lead.name}</h2>
                {visits.length > 1 && <span className="crm-badge new">Repeat viewer</span>}
              </div>
              <p className="crm-muted mt-1">
                {lead.sourceName || lead.brochureHeadline || 'Personal brochure'}
              </p>
              <p className="text-sm mt-2">{lead.phone}</p>
              <p className="text-sm mt-3">
                {visits.length} {visits.length === 1 ? 'open' : 'opens'} ·{' '}
                {fmtDurationLong(totalMs)
                  ? `${fmtDurationLong(totalMs)} recorded reading time`
                  : 'Duration not captured'}
              </p>
              {captured > 0 && captured < visits.length && (
                <p className="crm-muted">
                  Duration available for {captured} of {visits.length} visits.
                </p>
              )}
              <p className="crm-muted mt-2">Last opened: {stamp(visits[0].createdAt)}</p>
            </Link>
            <details className="crm-details px-4 pb-3">
              <summary>Visit durations</summary>
              <ul className="crm-stack">
                {visits.map((visit) => (
                  <li key={visit.id} className="text-sm">
                    <time className="crm-muted" dateTime={visit.createdAt}>
                      {stamp(visit.createdAt)}
                    </time>
                    <p>{fmtDurationLong(visit.dwellMs) || 'Duration not captured'}</p>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      {!viewers.length && (
        <div className="crm-panel crm-empty">
          <h2 className="text-xl font-semibold">No brochure viewers in the past seven days</h2>
          <p className="crm-muted mt-2">
            Recent opens will appear here when someone opens their brochure link.
          </p>
        </div>
      )}
      <p className="crm-muted mt-6">
        Reading time counts foreground time, capped at 30 minutes per visit. Missing durations are
        shown as not captured. Shared links are attributed to the lead the link belongs to.
      </p>
    </main>
  )
}
