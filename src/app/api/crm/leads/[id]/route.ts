import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { contactInput, projectId } from '@/lib/crm-input'
import { getServerSideURL } from '@/utilities/getURL'
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-status'
import type { Lead } from '@/payload-types'

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
