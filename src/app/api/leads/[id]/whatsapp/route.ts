import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import config from '@payload-config'
import { verifyLeadAction } from '@/lib/lead-action-link'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

/** Owner-initiated chat from NTFY; the action-scoped signature replaces a session. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!verifyLeadAction(id, 'whatsapp', new URL(req.url).searchParams.get('sig'))) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 403 })
  }

  const adminUrl = `${getServerSideURL().replace(/\/$/, '')}/admin/collections/leads/${id}`
  try {
    const payload = await getPayload({ config })
    const lead = await payload.findByID({ collection: 'leads', id, depth: 0, overrideAccess: true })
    const phone = parsePhoneNumberFromString(lead.phone || '', 'PK')
    if (!phone?.isValid()) return NextResponse.redirect(adminUrl, 302)

    // Opening chat is the owner's Contacted action, not proof of a reply.
    // Only advance early stages; preserve later stages and terminal decisions.
    // Normal status hooks run, including Contacted CAPI if explicitly configured.
    const result = await payload.update({
      collection: 'leads',
      where: {
        and: [
          { id: { equals: lead.id } },
          { status: { in: ['unqualified', 'details-sent', 'engaged'] } },
        ],
      },
      overrideAccess: true,
      data: { status: 'contacted' },
    })
    if (result.errors.length) throw new Error('Could not mark lead as contacted')

    return NextResponse.redirect(`https://wa.me/${phone.number.replace(/\D/g, '')}`, 302)
  } catch (e) {
    console.warn('[leads/whatsapp] failed:', (e as Error).message)
    return NextResponse.redirect(adminUrl, 302)
  }
}
