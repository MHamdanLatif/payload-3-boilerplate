import { randomUUID } from 'node:crypto'
import { notFound } from 'next/navigation'
import { crmSession } from '@/lib/crm-server'
import { PaymentPlanStudio, type StudioClient } from '@/components/admin/PaymentPlanStudio'
import { computeAdminPlan, type AdminPlanInput } from '@/lib/admin-payment-plan'
import { formatPlanMoney } from '@/lib/payment-plan'

export const dynamic = 'force-dynamic'
export default async function ClientSchedule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; scheduleId: string }>
  searchParams: Promise<{ revision?: string; history?: string }>
}) {
  const { id, scheduleId } = await params
  const query = await searchParams
  const { payload, user } = await crmSession(`/leads-dashboard/${id}/schedules/${scheduleId}`)
  if (user.collection !== 'users') notFound()
  const lead = await payload
    .findByID({ collection: 'leads', id, depth: 0, overrideAccess: false, user })
    .catch(() => null)
  if (!lead) notFound()
  const projects = await payload.find({
    collection: 'featured-projects',
    pagination: false,
    sort: 'title',
    depth: 0,
    overrideAccess: false,
    user,
    select: { title: true, slug: true, unitTypes: true, paymentPlan: true },
  })
  const client: StudioClient = {
    leadId: lead.id,
    name: lead.name,
    phone: lead.phone,
    entryKey: randomUUID(),
    projectId:
      typeof lead.currentInterestedProject === 'number' ? lead.currentInterestedProject : undefined,
  }
  let history: {
    id: number
    revision: number
    createdAt: string
    note?: string | null
    total: number
    author: string
  }[] = []
  let hasNext = false
  const historyPage = Math.max(1, Math.min(100000, Number(query.history) || 1))
  if (scheduleId !== 'new') {
    const schedule = await payload
      .findByID({
        collection: 'lead-schedules',
        id: scheduleId,
        depth: 0,
        overrideAccess: false,
        user,
      })
      .catch(() => null)
    if (!schedule || schedule.lead !== lead.id) notFound()
    const latest = (
      await payload.find({
        collection: 'schedule-revisions',
        where: { schedule: { equals: schedule.id } },
        sort: '-revision',
        limit: 1,
        depth: 0,
        overrideAccess: false,
        user,
      })
    ).docs[0]
    if (!latest) notFound()
    const selected = query.revision
      ? (
          await payload.find({
            collection: 'schedule-revisions',
            where: {
              and: [
                { schedule: { equals: schedule.id } },
                { revision: { equals: Number(query.revision) } },
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: false,
            user,
          })
        ).docs[0]
      : latest
    if (!selected) notFound()
    Object.assign(client, {
      title: schedule.title,
      entryKey: schedule.entryKey,
      plan: selected.settings as unknown as AdminPlanInput,
      buyer: { name: selected.buyerName, phone: selected.buyerPhone },
      note: selected.note || '',
      revision: latest.revision,
      historical: selected.id !== latest.id,
    })
    if (query.history) {
      const revisions = await payload.find({
        collection: 'schedule-revisions',
        where: { schedule: { equals: schedule.id } },
        sort: '-revision',
        page: historyPage,
        limit: 10,
        depth: 1,
        overrideAccess: false,
        user,
      })
      hasNext = revisions.hasNextPage
      history = revisions.docs.map((r) => ({
        id: r.id,
        revision: r.revision,
        createdAt: r.createdAt,
        note: r.note,
        total: computeAdminPlan(r.settings as unknown as AdminPlanInput).finalPrice,
        author: typeof r.createdBy === 'object' ? r.createdBy.name || r.createdBy.email : 'Staff',
      }))
    }
  }
  return (
    <>
      {scheduleId !== 'new' && (
        <section className="mx-auto max-w-7xl px-4 pt-6 md:px-8" aria-label="Schedule history">
          <a className="underline text-sm" href={`?history=1`}>
            View revision history
          </a>
          {query.revision && (
            <a
              className="ml-4 underline text-sm"
              href={`/leads-dashboard/${id}/schedules/${scheduleId}`}
            >
              Open latest revision
            </a>
          )}
          {history.map((r) => (
            <div key={r.id} className="mt-3 rounded-lg border bg-white p-4 text-sm">
              <a
                className="font-semibold underline"
                href={`?revision=${r.revision}&history=${historyPage}`}
              >
                Open revision {r.revision}
              </a>
              <p className="mt-1">
                {formatPlanMoney(r.total)} ·{' '}
                {new Date(r.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })} PKT ·{' '}
                {r.author}
              </p>
              {r.note && <p className="mt-1 whitespace-pre-wrap">{r.note}</p>}
            </div>
          ))}
          {query.history && (
            <div className="mt-3 flex gap-4 text-sm">
              {historyPage > 1 && <a href={`?history=${historyPage - 1}`}>Newer revisions</a>}
              {hasNext && <a href={`?history=${historyPage + 1}`}>Older revisions</a>}
            </div>
          )}
        </section>
      )}
      <PaymentPlanStudio
        key={`${scheduleId}:${query.revision || 'latest'}`}
        projects={projects.docs}
        client={client}
      />
    </>
  )
}
