import { NextResponse } from 'next/server'
import { isDeepStrictEqual } from 'node:util'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { computeAdminPlan, validateAdminPlan, type AdminPlanInput } from '@/lib/admin-payment-plan'
import { getServerSideURL } from '@/utilities/getURL'

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
    const body = JSON.parse(text)
    const errors = validateAdminPlan(body?.plan)
    if (errors.length) throw new Error(errors.join(' '))
    const plan = body.plan as AdminPlanInput
    const computed = computeAdminPlan(plan)
    if (computed.plan.warnings.length) throw new Error(computed.plan.warnings.join(' '))
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
      throw new Error('Check the schedule name and client details.')
    const { id } = await params
    const lead = await payload.findByID({
      collection: 'leads',
      id,
      depth: 0,
      overrideAccess: false,
      user,
    })
    const project = await payload.findByID({
      collection: 'featured-projects',
      id: plan.projectId,
      depth: 0,
      overrideAccess: false,
      user,
    })
    if (!project.unitTypes?.some((u) => u.id === plan.unitId))
      throw new Error('The selected unit no longer exists.')
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
      throw new Error('This schedule belongs to another client.')
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
    if ((latest?.revision || 0) !== body.expectedRevision)
      return NextResponse.json(
        {
          error:
            'A newer revision was saved. Reload the latest schedule before saving your changes.',
        },
        { status: 409 },
      )
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
    if (transactionID) await payload.db.rollbackTransaction(transactionID)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not save schedule. Reload and try again.',
      },
      { status: 400 },
    )
  }
}
