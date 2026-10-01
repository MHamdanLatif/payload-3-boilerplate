import { leadProjectLabel, leadSourceLabel } from '@/lib/lead-labels'
import Link from 'next/link'
import type { Where } from 'payload'
import { Phone, MessageCircle, ArrowUpRight, Search } from 'lucide-react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { crmSession, crmProjects } from '@/lib/crm-server'
import { LEAD_STATUSES, statusLabel } from '@/lib/lead-status'

type Filters = {
  q?: string
  status?: string
  project?: string
  source?: string
  view?: string
  page?: string
}
export const dynamic = 'force-dynamic'
export default async function CrmHome({ searchParams }: { searchParams: Promise<Filters> }) {
  const { payload, user } = await crmSession()
  const filters = await searchParams
  const and: Where[] = []
  const q = (filters.q || '').trim().slice(0, 120)
  if (q) {
    const digits = q.replace(/[^0-9]/g, '')
    and.push({
      or: [
        { name: { contains: q } },
        { phone: { contains: digits || q } },
        ...(digits.startsWith('0') ? [{ phone: { contains: '92' + digits.slice(1) } }] : []),
      ],
    })
  }
  if (LEAD_STATUSES.includes(filters.status as (typeof LEAD_STATUSES)[number]))
    and.push({ status: { equals: filters.status } })
  if (filters.project && /^\d+$/.test(filters.project))
    and.push({ currentInterestedProject: { equals: Number(filters.project) } })
  if (
    ['whatsapp', 'call', 'referral', 'meta-ads', 'google-organic'].includes(filters.source || '')
  ) {
    and.push(
      filters.source === 'call'
        ? { source: { equals: 'call' } }
        : {
            or: [
              { source: { equals: filters.source } },
              { acquisitionSource: { equals: filters.source } },
            ],
          },
    )
  }
  const pending: Where = {
    and: [{ followUpAt: { exists: true } }, { followUpSentAt: { exists: false } }],
  }
  if (filters.view === 'followups') and.push(pending)
  const page = Math.max(1, Math.min(10000, Number.parseInt(filters.page || '1', 10) || 1))
  const [result, projects, all, fresh, due] = await Promise.all([
    payload.find({
      collection: 'leads',
      where: and.length ? { and } : {},
      limit: 24,
      page,
      depth: 1,
      sort: filters.view === 'followups' ? 'followUpAt' : '-createdAt',
      overrideAccess: false,
      user,
      select: {
        name: true,
        phone: true,
        status: true,
        sourceName: true,
        source: true,
        acquisitionSource: true,
        conversionSurface: true,
        sourceKind: true,
        metaAdName: true,
        brochureHeadline: true,
        currentInterestedProject: true,
        followUpAt: true,
        followUpSentAt: true,
        brochureOpenedAt: true,
        createdAt: true,
      },
    }),
    crmProjects(),
    payload.count({ collection: 'leads', overrideAccess: false, user }),
    payload.count({
      collection: 'leads',
      where: { status: { equals: 'unqualified' } },
      overrideAccess: false,
      user,
    }),
    payload.count({
      collection: 'leads',
      where: { and: [pending, { followUpAt: { less_than_equal: new Date().toISOString() } }] },
      overrideAccess: false,
      user,
    }),
  ])
  const href = (p: number) =>
    '/leads-dashboard?' +
    new URLSearchParams({
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))),
      page: String(p),
    }).toString()
  return (
    <main className="crm-wrap">
      <div className="crm-row">
        <div>
          <p className="crm-eyebrow">Your sales workspace</p>
          <h1 className="crm-title">
            {filters.view === 'followups' ? 'Follow-ups' : 'Your leads'}
          </h1>
        </div>
        <Link className="crm-button gold" href="/leads-dashboard/new">
          + Add lead
        </Link>
      </div>
      <p className="crm-muted mt-2">A little follow-up goes a long way.</p>
      <div className="crm-stats">
        <Link className="crm-stat" href="/leads-dashboard">
          <strong>{all.totalDocs}</strong>
          <span>Total leads</span>
        </Link>
        <Link className="crm-stat" href="/leads-dashboard?status=unqualified">
          <strong>{fresh.totalDocs}</strong>
          <span>Uncontacted</span>
        </Link>
        <Link className="crm-stat" href="/leads-dashboard?view=followups">
          <strong>{due.totalDocs}</strong>
          <span>Follow-ups due</span>
        </Link>
      </div>
      <form className="crm-stack" method="get">
        {filters.view && <input type="hidden" name="view" value={filters.view} />}
        <div className="flex gap-2">
          <label className="flex-1 relative">
            <span className="sr-only">Search leads</span>
            <Search className="absolute left-3 top-3.5 text-gray-400" size={19} />
            <input
              className="crm-field"
              style={{ paddingLeft: 40 }}
              name="q"
              defaultValue={q}
              placeholder="Search name or phone"
            />
          </label>
          <button className="crm-button" type="submit">
            Search
          </button>
        </div>
        <details
          className="crm-panel crm-details"
          open={Boolean(filters.status || filters.project || filters.source)}
        >
          <summary>Filter leads</summary>
          <div className="crm-filters crm-stack">
            <label className="crm-label">
              Status
              <select className="crm-field" name="status" defaultValue={filters.status || ''}>
                <option value="">All statuses</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-label">
              Project
              <select className="crm-field" name="project" defaultValue={filters.project || ''}>
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-label">
              Source
              <select className="crm-field" name="source" defaultValue={filters.source || ''}>
                <option value="">All sources</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Call</option>
                <option value="referral">Referral</option>
                <option value="meta-ads">Paid - Meta ads</option>
                <option value="google-organic">Organic - Google search</option>
              </select>
            </label>
            <div className="flex items-end gap-3">
              <button className="crm-button">Apply filters</button>
              <Link className="crm-muted underline" href="/leads-dashboard">
                Reset
              </Link>
            </div>
          </div>
        </details>
      </form>
      <div className="crm-tabs">
        <Link className={!filters.view && !filters.status ? 'active' : ''} href="/leads-dashboard">
          All leads
        </Link>
        <Link
          className={filters.status === 'unqualified' ? 'active' : ''}
          href="/leads-dashboard?status=unqualified"
        >
          Uncontacted
        </Link>
        <Link
          className={filters.view === 'followups' ? 'active' : ''}
          href="/leads-dashboard?view=followups"
        >
          Follow-ups
        </Link>
        <Link
          className={filters.status === 'closed-won' ? 'active' : ''}
          href="/leads-dashboard?status=closed-won"
        >
          Closed won
        </Link>
      </div>
      <p className="crm-muted mb-3">
        {result.totalDocs} {result.totalDocs === 1 ? 'lead' : 'leads'}
        {q ? ' matching: ' + q : ''}
      </p>
      <div className="crm-leads">
        {result.docs.map((lead) => {
          const project =
            typeof lead.currentInterestedProject === 'object'
              ? lead.currentInterestedProject?.title
              : null
          const phone = parsePhoneNumberFromString(lead.phone, 'PK')
          return (
            <article key={lead.id} className="crm-card">
              <Link className="crm-card-link" href={'/leads-dashboard/' + lead.id}>
                <div className="crm-row">
                  <h2>{lead.name}</h2>
                  <span className={'crm-badge ' + (lead.status === 'unqualified' ? 'new' : '')}>
                    {statusLabel(lead.status)}
                  </span>
                </div>
                <p className="crm-muted mt-1">
                  {leadProjectLabel(lead)}
                  {project && project !== lead.sourceName
                    ? ` | Currently interested in: ${project}`
                    : ''}
                </p>
                <p className="text-sm mt-3">{lead.phone}</p>
                <div className="crm-row mt-4">
                  <span className="crm-muted">{leadSourceLabel(lead)}</span>
                  <span className="crm-badge">
                    {lead.brochureOpenedAt ? 'Brochure opened' : 'Not opened yet'}
                  </span>
                </div>
                {lead.followUpAt && !lead.followUpSentAt && (
                  <p className="text-xs mt-3 text-amber-800">
                    Follow-up:{' '}
                    {new Date(lead.followUpAt).toLocaleString('en-GB', {
                      timeZone: 'Asia/Karachi',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    PKT
                  </p>
                )}
              </Link>
              <div className="crm-card-actions">
                {phone?.isValid() && (
                  <>
                    <a href={'tel:' + phone.number}>
                      <Phone size={14} className="inline mr-1" />
                      Call
                    </a>
                    <a
                      href={'https://wa.me/' + phone.number.replace(/\D/g, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={14} className="inline mr-1" />
                      WhatsApp
                    </a>
                  </>
                )}
                <Link href={'/leads-dashboard/' + lead.id}>
                  Open <ArrowUpRight size={14} className="inline" />
                </Link>
              </div>
            </article>
          )
        })}
      </div>
      {!result.docs.length && (
        <div className="crm-panel crm-empty">
          <h2 className="text-xl font-semibold">No leads here yet</h2>
          <p className="crm-muted mt-2">Try another filter, or add your next conversation.</p>
          <Link href="/leads-dashboard/new" className="crm-button mt-5">
            Add a lead
          </Link>
        </div>
      )}
      <div className="crm-row mt-6">
        {result.hasPrevPage ? (
          <Link className="crm-button secondary" href={href(page - 1)}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="crm-muted">
          Page {result.page || 1} of {Math.max(1, result.totalPages)}
        </span>
        {result.hasNextPage ? (
          <Link className="crm-button secondary" href={href(page + 1)}>
            Next
          </Link>
        ) : (
          <span />
        )}
      </div>
      <p className="crm-muted mt-6">Dates and filters use Pakistan time (PKT, UTC+5).</p>
    </main>
  )
}
