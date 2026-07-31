import type { CollectionAfterChangeHook, Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { sendNtfy } from '@/lib/ntfy'
import { sendCapiEvent } from '@/lib/meta-capi'

/**
 * The heart of the native CRM.
 *   • On CREATE  → free ntfy push to the owner (new lead: name, project, source).
 *                  The brochure link is sent to the lead manually via the
 *                  "Send File" button (wa.me), so no auto-send / Meta charges.
 *   • On UPDATE  → when status flips to qualified/junk, push a Meta CAPI event so
 *                  ad optimisation learns from real outcomes.
 * Every outbound call is best-effort; results are logged onto the lead. The
 * `skipLeadHooks` context flag prevents the log write-back from re-triggering us.
 */
export const leadAfterChange: CollectionAfterChangeHook<Lead> = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.skipLeadHooks) return doc
  try {
    if (operation === 'create') {
      await onCreate(doc, req.payload)
    } else if (operation === 'update') {
      await onStatusChange(doc, previousDoc, req.payload)
    }
  } catch (e) {
    req.payload.logger?.warn?.(`[leads] afterChange error: ${(e as Error).message}`)
  }
  return doc
}

function nowIso(): string {
  return new Date().toISOString()
}

async function onCreate(doc: Lead, payload: Payload): Promise<void> {
  const base = getServerSideURL().replace(/\/$/, '')
  const adminUrl = `${base}/admin/collections/leads/${doc.id}`
  const project = doc.sourceName || doc.sourceSlug || doc.brochureHeadline || 'general enquiry'
  const source = doc.metaAdName || doc.source || doc.sourceKind || 'website'
  const ts = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })

  // Free owner alert via ntfy (replaces the WhatsApp Cloud API notification).
  const res = await sendNtfy({
    title: 'New Lead',
    message: `${doc.name} — ${project}\n📞 ${doc.phone}\n📍 ${source}\n🕐 ${ts}`,
    priority: 'high',
    tags: 'bell',
    clickUrl: adminUrl,
  })

  await payload.update({
    collection: 'leads',
    id: doc.id,
    overrideAccess: true,
    context: { skipLeadHooks: true },
    data: {
      ownerNotifiedAt: res.ok ? nowIso() : undefined,
      ownerNotifyStatus: `ntfy: ${res.status}`,
    },
  })
}

async function onStatusChange(
  doc: Lead,
  previousDoc: Lead | undefined,
  payload: Payload,
): Promise<void> {
  const now = doc.status
  const prev = previousDoc?.status
  if (now === prev) return
  if (now !== 'qualified' && now !== 'junk') return

  const eventName =
    now === 'qualified'
      ? process.env.META_CAPI_QUALIFIED_EVENT || 'QualifiedLead'
      : process.env.META_CAPI_JUNK_EVENT || 'DisqualifiedLead'

  const res = await sendCapiEvent({
    eventName,
    eventId: doc.eventId,
    email: doc.email,
    phone: doc.phone,
    fbc: doc.fbc,
    fbp: doc.fbp,
    fbclid: doc.fbclid,
    clientIp: doc.clientIp,
    userAgent: doc.userAgent,
    customData: {
      lead_status: now,
      lead_source: doc.metaAdName || doc.source || doc.sourceKind || 'website',
    },
  })

  await payload.update({
    collection: 'leads',
    id: doc.id,
    overrideAccess: true,
    context: { skipLeadHooks: true },
    data: {
      capiEventName: eventName,
      capiSentAt: nowIso(),
      capiStatus: res.status,
    },
  })
}
