import type { Payload } from 'payload'
import type { User as CmsUser } from '@/payload-types'
import { computeAdminPlan, type AdminPlanInput } from '@/lib/admin-payment-plan'
import { formatPlanMoney } from '@/lib/payment-plan'

export async function LeadSchedules({
  leadId,
  payload,
  user,
  page = 1,
}: {
  leadId: number
  payload: Payload
  user: CmsUser
  page?: number
}) {
  const result = await payload.find({
    collection: 'lead-schedules',
    where: { lead: { equals: leadId } },
    sort: '-createdAt',
    limit: 5,
    page,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const entries = await Promise.all(
    result.docs.map(async (schedule) => {
      const latest = await payload.find({
        collection: 'schedule-revisions',
        where: { schedule: { equals: schedule.id } },
        sort: '-revision',
        limit: 1,
        depth: 0,
        overrideAccess: false,
        user,
      })
      return { schedule, latest: latest.docs[0] }
    }),
  )
  return (
    <section className="crm-panel mt-6" aria-label="Saved payment schedules">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Payment schedules</h2>
        <a className="crm-button" href={`/leads-dashboard/${leadId}/schedules/new`}>
          Make schedule
        </a>
      </div>
      {!entries.length && (
        <p className="crm-muted mt-3">
          Save the terms discussed with this client, then revisit or revise them here.
        </p>
      )}
      {entries.map(({ schedule, latest }) => (
        <div key={schedule.id} className="mt-4 border-t pt-4">
          <a
            className="font-semibold underline"
            href={`/leads-dashboard/${leadId}/schedules/${schedule.id}`}
          >
            {schedule.title}
          </a>
          {latest && (
            <>
              <p className="crm-muted mt-1">
                Revision {latest.revision} ·{' '}
                {formatPlanMoney(
                  computeAdminPlan(latest.settings as unknown as AdminPlanInput).finalPrice,
                )}{' '}
                ·{' '}
                {new Date(latest.createdAt).toLocaleDateString('en-GB', {
                  timeZone: 'Asia/Karachi',
                })}
              </p>
              {latest.note && <p className="mt-2 whitespace-pre-wrap text-sm">{latest.note}</p>}
            </>
          )}
        </div>
      ))}
      <div className="mt-3 flex gap-4 text-sm">
        {result.hasPrevPage && (
          <a className="underline" href={`?schedulePage=${page - 1}`}>
            Previous schedules
          </a>
        )}
        {result.hasNextPage && (
          <a className="underline" href={`?schedulePage=${page + 1}`}>
            More schedules
          </a>
        )}
      </div>
    </section>
  )
}
