import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { advanceLeadStatus } from '@/lib/lead-auto-status'

/**
 * Records a manual "Send File" action on a lead (fired by SendFileButton when
 * the owner opens WhatsApp with the brochure message pre-filled). Stamps the
 * lead's delivery log. No push confirmation: the person who sent it already
 * knows. Admin-only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })

  // Only authenticated admins can log a send.
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  let body: { link?: string } = {}
  try {
    body = (await req.json()) as { link?: string }
  } catch {
    /* no body */
  }

  try {
    await payload.update({
      collection: 'leads',
      id,
      overrideAccess: true,
      context: { skipLeadHooks: true },
      data: {
        brochureSentAt: new Date().toISOString(),
        brochureSendStatus: `sent via WhatsApp (manual)${body.link ? ` → ${body.link}` : ''}`,
      },
    })

    // The send is a fact, so the pipeline records it rather than waiting for
    // someone to remember. Only ever forward, and never over a terminal status.
    await advanceLeadStatus(payload, id, 'details-sent')
  } catch (e) {
    console.warn('[leads/log-send] failed:', (e as Error).message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
