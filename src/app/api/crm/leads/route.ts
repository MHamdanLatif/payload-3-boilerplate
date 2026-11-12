import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { contactInput, manualAttribution, projectId } from '@/lib/crm-input'
import { getServerSideURL } from '@/utilities/getURL'
import { phoneKey } from '@/lib/phone-key'
import { leadsWithPhoneKey } from '@/lib/lead-duplicates'

export async function POST(req: Request) {
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
    const contact = contactInput(body)
    const marketed = typeof body.project === 'string' && /^marketed:[1-9]\d*$/.test(body.project)
    const id = projectId(marketed ? body.project.slice('marketed:'.length) : body.project)
    if (!id) throw new Error('Choose the project they are interested in.')
    const project = await payload.findByID({
      collection: marketed ? 'marketed-projects' : 'featured-projects',
      id,
      depth: 0,
      overrideAccess: false,
      user,
    })
    // Warn about earlier enquiries from the same number. Saving anyway is allowed: a new
    // enquiry (another project, a new source) is kept as its own record and never merged.
    if (body.confirmDuplicate !== true) {
      const duplicates = await leadsWithPhoneKey({ payload, user }, phoneKey(contact.phone))
      if (duplicates.length) return NextResponse.json({ duplicates }, { status: 409 })
    }
    const data = {
      ...contact,
      ...manualAttribution(body.source, project, marketed ? 'marketed-project' : 'project'),
      status: 'unqualified' as const,
    }
    const lead = await payload.create({ collection: 'leads', data, overrideAccess: false, user })
    return NextResponse.json({ id: lead.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save lead.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
