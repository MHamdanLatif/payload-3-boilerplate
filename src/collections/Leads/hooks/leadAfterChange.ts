import type { CollectionAfterChangeHook, Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { sendCapiEvent } from '@/lib/meta-capi'
import { isQualifiedLead } from '@/lib/lead-status'

/**
 * The heart of the native CRM.
 * New-lead notifications and automatic reminders run in the durable background queue.
 *                  The brochure link is sent to the lead manually via the
 *                  "Send File" button (wa.me), so no auto-send / Meta charges.
 *   • On UPDATE  → when a lead becomes qualified or junk, push a Meta CAPI event so
 *                  ad optimisation learns from real outcomes.
 * Every outbound call is best-effort; results are logged onto the lead. The
 * `skipLeadHooks` context flag prevents the log write-back from re-triggering us.
 */
export const leadAfterChange: CollectionAfterChangeHook<Lead> = ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.skipLeadHooks) return doc

  // New-lead notifications are reconciled durably from committed lead records.
  // Detach Meta CAPI from the save. afterChange runs
  // inside the save request, so awaiting a slow network call here makes the
  // admin "Save" spin for seconds (e.g. qualifying a lead waited on the CAPI
  // POST). On our long-running Railway server the detached promise finishes
  // after the response; the lead's log fields update a moment later.
  void (async () => {
    try {
      if (operation === 'update') {
        await onStatusChange(doc, previousDoc, req.payload)
      }
    } catch (e) {
      req.payload.logger?.warn?.(`[leads] afterChange error: ${(e as Error).message}`)
    }
  })()

  return doc
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Which Meta CAPI event, if any, a status change should send.
 *
 * Two signals only, both about lead quality:
 *   • Qualified, Site Visited and Closed Won are all qualified leads. Meta hears
 *     QualifiedLead once, when the lead first enters that group; moving on from
 *     Qualified to Site Visited is the same lead, not a second good one.
 *   • Invalid / Junk is a disqualified lead.
 * Not a Fit is deliberately silent: a buyer who can afford the project but did
 * not like what was offered is still the kind of lead the ads should find.
 *
 * Event names can be changed from Railway without a deploy, and an empty string
 * switches one off: META_CAPI_QUALIFIED_EVENT, META_CAPI_JUNK_EVENT.
 */
function capiEventForStatus(
  status: Lead['status'],
  previous: Lead['status'] | undefined,
): string | null {
  let env: string
  let fallback: string
  if (isQualifiedLead(status)) {
    if (isQualifiedLead(previous)) return null
    env = 'META_CAPI_QUALIFIED_EVENT'
    fallback = 'QualifiedLead'
  } else if (status === 'junk') {
    env = 'META_CAPI_JUNK_EVENT'
    fallback = 'DisqualifiedLead'
  } else {
    return null
  }
  const override = process.env[env]
  if (override === '') return null
  return override || fallback
}

async function onStatusChange(
  doc: Lead,
  previousDoc: Lead | undefined,
  payload: Payload,
): Promise<void> {
  const now = doc.status
  const prev = previousDoc?.status
  if (now === prev) return
  const eventName = capiEventForStatus(now, prev)
  if (!eventName) return

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
