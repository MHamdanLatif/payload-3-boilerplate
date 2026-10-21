import { NextResponse } from 'next/server'
import { isDeepStrictEqual } from 'node:util'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import {
  computeAdminPlan,
  validateAdminPlan,
  withUnitLoan,
  type AdminPlanInput,
} from '@/lib/admin-payment-plan'
import { getServerSideURL } from '@/utilities/getURL'

/** Messages written for staff; anything else is logged and replaced with a generic reply. */
class ScheduleError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const STALE = 'Someone saved a newer version of this schedule – reload to see it.'

/** Unique revisionKey/entryKey rejects a concurrent save from the same starting revision. */
function isUniqueViolation(error: unknown) {
  const e = error as {
    code?: string
    cause?: { code?: string }
    data?: { errors?: { path?: string }[] }
  } | null
  return (
    e?.code === '23505' ||
    e?.cause?.code === '23505' ||
    Boolean(
      e?.data?.errors?.some((x) =>
        ['revisionKey', 'revision_key', 'entryKey', 'entry_key'].includes(x?.path ?? ''),
      ),
    )
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (user?.collection !== 'users')
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (
    ![new URL(req.url).origin, new URL(getServerSideURL()).origin].includes(
      req.headers.get('origin') || '',
    )
  )
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  let transactionID: Awaited<ReturnType<typeof payload.db.beginTransaction>> = null
  try {
    const text = await req.text()
    if (text.length > 200_000)
      return NextResponse.json({ error: 'Schedule is too large.' }, { status: 413 })
    const body = (() => {
      try {
        return JSON.parse(text)
      } catch {
        throw new ScheduleError('Invalid JSON.')
      }
    })()
    const errors = validateAdminPlan(body?.plan)
    if (errors.length) throw new ScheduleError(errors.join(' '))
    if (
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      body.title.length > 120 ||
      typeof body.note !== 'string' ||
      body.note.length > 1000 ||
      typeof body.buyer?.name !== 'string' ||
      !body.buyer.name.trim() ||
      body.buyer.name.length > 120 ||
      typeof body.buyer?.phone !== 'string' ||
      !body.buyer.phone.trim() ||
      body.buyer.phone.length > 60 ||
      typeof body.entryKey !== 'string' ||
      !/^[a-f\d-]{36}$/i.test(body.entryKey) ||
      !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0
    )
      throw new ScheduleError('Check the schedule name and client details.')
    const { id } = await params
    const lead = await payload
      .findByID({ collection: 'leads', id, depth: 0, overrideAccess: false, user })
      .catch(() => null)
    if (!lead) throw new ScheduleError('This client no longer exists.', 404)
    const project = await payload
      .findByID({
        collection: 'featured-projects',
        id: (body.plan as AdminPlanInput).projectId,
        depth: 0,
        overrideAccess: false,
        user,
      })
      .catch(() => null)
    const unit = project?.unitTypes?.find((u) => u.id === body.plan.unitId)
    if (!unit) throw new ScheduleError('The selected project or unit no longer exists.', 404)
    // The loan amount always comes from the CMS unit, never from the request.
    const plan = withUnitLoan(body.plan as AdminPlanInput, unit.loanAmount)
    const loanErrors = validateAdminPlan(plan)
    if (loanErrors.length) throw new ScheduleError(loanErrors.join(' '))
    const computed = computeAdminPlan(plan)
    if (computed.plan.warnings.length) throw new ScheduleError(computed.plan.warnings.join(' '))
    const existing = await payload.find({
      collection: 'lead-schedules',
      where: { entryKey: { equals: body.entryKey } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
      user,
    })
    let schedule = existing.docs[0]
    if (schedule && schedule.lead !== lead.id)
      throw new ScheduleError('This schedule was not found for this client.', 404)
    const latest = schedule
      ? (
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
      : null
    // Repeated saves of unchanged settings do not grow revision history.
    if (
      latest &&
      isDeepStrictEqual(latest.settings, plan) &&
      latest.buyerName === body.buyer.name.trim() &&
      latest.buyerPhone === body.buyer.phone.trim() &&
      (latest.note || '') === body.note.trim()
    )
      return NextResponse.json({ id: schedule.id, revision: latest.revision })
    if ((latest?.revision || 0) !== body.expectedRevision) throw new ScheduleError(STALE, 409)
    transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error('Could not start a save transaction.')
    const localReq = await createLocalReq({ user }, payload)
    localReq.transactionID = transactionID
    if (!schedule)
      schedule = await payload.create({
        collection: 'lead-schedules',
        data: { lead: lead.id, title: body.title.trim(), entryKey: body.entryKey },
        req: localReq,
      })
    const revision = (latest?.revision || 0) + 1
    // Unique revisionKey rejects concurrent writes against the same starting revision.
    await payload.create({
      collection: 'schedule-revisions',
      req: localReq,
      data: {
        schedule: schedule.id,
        revision,
        revisionKey: `${schedule.id}:${revision}`,
        settings: JSON.parse(JSON.stringify(plan)),
        buyerName: body.buyer.name.trim(),
        buyerPhone: body.buyer.phone.trim(),
        note: body.note.trim(),
        createdBy: user.id,
      },
    })
    await payload.db.commitTransaction(transactionID)
    transactionID = null
    return NextResponse.json({ id: schedule.id, revision })
  } catch (error) {
    if (transactionID)
      await payload.db.rollbackTransaction(transactionID).catch((rollbackError: unknown) => {
        console.error('[crm/schedules] rollback failed', rollbackError)
      })
    if (error instanceof ScheduleError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    if (isUniqueViolation(error)) return NextResponse.json({ error: STALE }, { status: 409 })
    console.error('[crm/schedules] save failed', error)
    return NextResponse.json(
      { error: 'Could not save schedule. Reload and try again.' },
      { status: 500 },
    )
  }
}
