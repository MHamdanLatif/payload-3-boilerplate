import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendNtfy } from '@/lib/ntfy'
import { advanceLeadStatus } from '@/lib/lead-auto-status'
import type { Lead } from '@/payload-types'

/**
 * Records a manual "Send File" action on a lead (fired by SendFileButton when
 * the owner opens WhatsApp with the brochure message pre-filled). Stamps the
 * lead's delivery log and pushes an optional ntfy confirmation. Admin-only.
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
    const lead = (await payload
      .findByID({ collection: 'leads', id, depth: 0 })
      .catch(() => null)) as Lead | null

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

    // Optional owner confirmation.
    await sendNtfy({
      title: 'Brochure Sent',
      message: `Brochure link sent to ${lead?.name ?? 'a lead'} via WhatsApp.`,
      priority: 'low',
      tags: 'outbox_tray',
    })
  } catch (e) {
    console.warn('[leads/log-send] failed:', (e as Error).message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
