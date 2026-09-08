import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { verifyLeadAction } from '@/lib/lead-action-link'
import { advanceLeadStatus } from '@/lib/lead-auto-status'
import {
  brochureLink,
  buildBrochureMessage,
  whatsappSendUrl,
} from '@/lib/brochure-message'

/**
 * One-tap brochure send, from the new-lead push notification.
 *
 * The push carries a "Send brochure" button. Tapping it lands here, and this
 * redirects on into WhatsApp with the message pre-typed — the owner still
 * reviews and taps send there, so there are no Meta per-message charges. Same
 * as the admin button, minus opening the CRM to reach it.
 *
 * WHY A REDIRECT RATHER THAN A LINK STRAIGHT TO wa.me: sending has to be
 * RECORDED. The link alone would open WhatsApp and leave brochureSentAt empty
 * and the lead stuck at Uncontacted, so the status pipeline would silently stop
 * reflecting reality for every lead sent this way — which, once the button
 * exists, is most of them. Passing through here keeps the one-tap experience and
 * the record in step.
 *
 * A GET that mutates is normally worth avoiding, but a notification action can
 * only open a URL, and this one is idempotent: re-stamping the sent time is
 * harmless and the status advance is a no-op once the lead is already there.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const base = getServerSideURL().replace(/\/$/, '')
  const adminUrl = `${base}/admin/collections/leads/${id}`
  const sig = new URL(req.url).searchParams.get('sig')

  // No session on a notification tap, so the signature IS the authorisation.
  if (!verifyLeadAction(id, 'send-brochure', sig)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
  }

  try {
    const payload = await getPayload({ config })
    const lead = (await payload
      .findByID({ collection: 'leads', id, depth: 0, overrideAccess: true })
      .catch(() => null)) as Lead | null

    // Anything missing sends the owner to the lead in the CRM rather than to a
    // dead end — from a phone, that is the only place they could fix it.
    if (!lead?.phone || !lead?.brochureId) return NextResponse.redirect(adminUrl, 302)

    let template: string | null = null
    try {
      const settings = await payload.findGlobal({ slug: 'crm-settings', depth: 0 })
      template = (settings as { whatsappMessageTemplate?: string })?.whatsappMessageTemplate ?? null
    } catch {
      // Falls back to the default wording rather than failing the send.
    }

    const link = brochureLink(base, lead.brochureId)
    const message = buildBrochureMessage({
      template,
      name: lead.name,
      project: lead.sourceName || lead.brochureHeadline,
      link,
    })

    // Recorded BEFORE redirecting: once the browser leaves for WhatsApp this
    // request may never finish, and an unrecorded send is what this endpoint
    // exists to prevent.
    await payload.update({
      collection: 'leads',
      id,
      overrideAccess: true,
      context: { skipLeadHooks: true },
      data: {
        brochureSentAt: new Date().toISOString(),
        brochureSendStatus: `sent via WhatsApp (from notification) → ${link}`,
      },
    })
    await advanceLeadStatus(payload, id, 'details-sent')

    return NextResponse.redirect(whatsappSendUrl(lead.phone, message), 302)
  } catch (e) {
    console.warn('[leads/send-brochure] failed:', (e as Error).message)
    return NextResponse.redirect(adminUrl, 302)
  }
}
