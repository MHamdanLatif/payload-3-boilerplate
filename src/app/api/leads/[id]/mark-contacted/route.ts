import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getServerSideURL } from '@/utilities/getURL'

// Statuses a person pressing Mark contacted moves forward to `contacted`. Anything
// further along, or terminal, is left alone: this never moves a lead backwards.
const BEFORE_CONTACTED = ['unqualified', 'details-sent', 'engaged']

/**
 * Handles a follow-up: clears the reminder (prepareFollowUp resets its delivery
 * state, so no repeat push goes out) and records that someone spoke to the lead.
 * Status is manual from `contacted` on, and this is a person pressing a button.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin')
  if (!origin || ![new URL(req.url).origin, new URL(getServerSideURL()).origin].includes(origin))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const lead = await payload.findByID({
      collection: 'leads',
      id: Number(id),
      depth: 0,
      overrideAccess: false,
      user,
    })
    const updated = await payload.update({
      collection: 'leads',
      id: lead.id,
      overrideAccess: false,
      user,
      data: {
        followUpAt: null,
        ...(BEFORE_CONTACTED.includes(lead.status ?? 'unqualified')
          ? { status: 'contacted' as const }
          : {}),
      },
    })
    return NextResponse.json({ ok: true, status: updated.status })
  } catch {
    return NextResponse.json({ error: 'Could not update the lead. Try again.' }, { status: 400 })
  }
}
