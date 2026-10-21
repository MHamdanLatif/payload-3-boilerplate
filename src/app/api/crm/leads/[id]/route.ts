import { NextResponse } from 'next/server'
import { createLocalReq, getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { contactInput, projectId } from '@/lib/crm-input'
import { getServerSideURL } from '@/utilities/getURL'
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-status'
import type { Lead, User } from '@/payload-types'
import { hasFinanceAccess } from '@/access/finance'
import { rupees } from '@/lib/finance-query'
import { CRM_LEAD_DELETE } from '@/collections/Leads/hooks/guardLeadDelete'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin')
  if (!origin || ![new URL(req.url).origin, new URL(getServerSideURL()).origin].includes(origin)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error('Invalid lead details.')
    const data: Partial<Lead> = {}
    if ('name' in body || 'phone' in body) Object.assign(data, contactInput(body))
    if ('status' in body) {
      if (!LEAD_STATUSES.includes(body.status)) throw new Error('Choose a valid status.')
      data.status = body.status as LeadStatus
    }
    for (const key of ['currentInterestedProject', 'closedProject'] as const) {
      if (!(key in body)) continue
      const id = projectId(body[key])
      if (id)
        await payload.findByID({
          collection: 'featured-projects',
          id,
          depth: 0,
          overrideAccess: false,
          user,
        })
      data[key] = id
    }
    for (const key of ['interestedUnitType', 'unqualifiedReason', 'email'] as const) {
      if (!(key in body)) continue
      if (typeof body[key] !== 'string' || body[key].length > 2000)
        throw new Error('Invalid lead details.')
      data[key] = body[key].trim()
    }
    if (!Object.keys(data).length) throw new Error('No editable details supplied.')
    const { id } = await params
    const doc = await payload.update({ collection: 'leads', id, data, overrideAccess: false, user })
    return NextResponse.json({ id: doc.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save.' },
      { status: 400 },
    )
  }
}

const FINANCE_BLOCKED = 'This lead is linked to a finance record – ask a finance admin.'

/**
 * What deleting this lead would touch. Schedules (and their revisions) are
 * deleted with it; finance deals never are, they only lose the link. Users
 * without finance access learn only that a finance record exists.
 */
async function linkedRecords(payload: Payload, user: User, id: string) {
  const lead = await payload.findByID({
    collection: 'leads',
    id,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const [schedules, deals] = await Promise.all([
    payload.find({
      collection: 'lead-schedules',
      where: { lead: { equals: lead.id } },
      depth: 0,
      pagination: false,
      select: { entryKey: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'finance-deals',
      where: { lead: { equals: lead.id } },
      depth: 0,
      pagination: false,
      select: { clientName: true, saleValue: true },
      overrideAccess: true,
    }),
  ])
  return {
    lead,
    scheduleIds: schedules.docs.map((s) => s.id),
    deals: deals.docs.map((d) => `${d.clientName}, sale value ${rupees(d.saleValue)}`),
    financeAllowed: hasFinanceAccess(user),
  }
}

async function crmUser(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  return { payload, user: user?.collection === 'users' ? (user as User) : null }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await crmUser(req)
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const { scheduleIds, deals, financeAllowed } = await linkedRecords(
      payload,
      user,
      (await params).id,
    )
    return NextResponse.json(
      {
        schedules: scheduleIds.length,
        financeLinked: deals.length > 0,
        ...(financeAllowed ? { deals } : {}),
        blocked: deals.length > 0 && !financeAllowed ? FINANCE_BLOCKED : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin')
  if (!origin || ![new URL(req.url).origin, new URL(getServerSideURL()).origin].includes(origin)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const { payload, user } = await crmUser(req)
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  let transactionID: Awaited<ReturnType<typeof payload.db.beginTransaction>> = null
  try {
    const body = await req.json().catch(() => ({}))
    const { lead, scheduleIds, deals, financeAllowed } = await linkedRecords(
      payload,
      user,
      (await params).id,
    )
    if (deals.length && !financeAllowed)
      return NextResponse.json({ error: FINANCE_BLOCKED }, { status: 403 })
    // The user confirmed against what the first request showed; anything saved
    // since then must be shown to them before it is deleted.
    if (
      body?.schedules !== scheduleIds.length ||
      (deals.length > 0 && body?.keepFinanceDeals !== true)
    )
      return NextResponse.json(
        { error: 'Linked records changed. Review them and try again.' },
        { status: 409 },
      )
    transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error('Could not start a delete transaction.')
    const localReq = await createLocalReq({ user, context: { [CRM_LEAD_DELETE]: true } }, payload)
    localReq.transactionID = transactionID
    // Schedules are immutable through the API, so they are removed here
    // explicitly rather than relying on the database cascade alone.
    if (scheduleIds.length) {
      for (const collection of ['schedule-revisions', 'lead-schedules'] as const) {
        const result = await payload.delete({
          collection,
          where:
            collection === 'schedule-revisions'
              ? { schedule: { in: scheduleIds } }
              : { id: { in: scheduleIds } },
          overrideAccess: true,
          req: localReq,
        })
        if (result.errors.length) throw new Error('Could not delete the saved schedules.')
      }
    }
    // Finance deals are left untouched; finance_deals.lead_id is ON DELETE SET NULL.
    await payload.delete({ collection: 'leads', id: lead.id, overrideAccess: false, req: localReq })
    await payload.db.commitTransaction(transactionID)
    transactionID = null
    return NextResponse.json({ deleted: lead.id })
  } catch (error) {
    if (transactionID) await payload.db.rollbackTransaction(transactionID)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete the lead.' },
      { status: 400 },
    )
  }
}
