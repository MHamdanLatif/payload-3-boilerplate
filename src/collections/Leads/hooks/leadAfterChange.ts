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
export const leadAfterChange: CollectionAfterChangeHook<Lead> = ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.skipLeadHooks) return doc

  // Detach all outbound work (Meta CAPI, ntfy) from the save. afterChange runs
  // inside the save request, so awaiting a slow network call here makes the
  // admin "Save" spin for seconds (e.g. qualifying a lead waited on the CAPI
  // POST). On our long-running Railway server the detached promise finishes
  // after the response; the lead's log fields update a moment later.
  void (async () => {
    try {
      if (operation === 'create') {
        await onCreate(doc, req.payload)
      } else if (operation === 'update') {
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

/**
 * Which Meta CAPI event, if any, a status change should send.
 *
 * "qualified" and "junk" have always fired and keep their behaviour. The later
 * funnel stages are OPT-IN: firing a Purchase event the moment "Closed Won"
 * existed would have silently changed what the ad account optimises for, so
 * they stay off until their env var is set.
 *
 * Suggested values if you do want them:
 *   META_CAPI_SITE_VISIT_EVENT=Schedule
 *   META_CAPI_CLOSED_WON_EVENT=Purchase   (the strongest signal you can send)
 *
 * Setting a var to an empty string disables that status explicitly — which is
 * how "qualified" or "junk" can be turned off without a code change.
 */
function capiEventForStatus(status: Lead['status']): string | null {
  const configured: Record<string, { env: string; fallback: string | null }> = {
    qualified: { env: 'META_CAPI_QUALIFIED_EVENT', fallback: 'QualifiedLead' },
    junk: { env: 'META_CAPI_JUNK_EVENT', fallback: 'DisqualifiedLead' },
    'site-visit': { env: 'META_CAPI_SITE_VISIT_EVENT', fallback: null },
    'closed-won': { env: 'META_CAPI_CLOSED_WON_EVENT', fallback: null },
  }
  const entry = status ? configured[status] : undefined
  if (!entry) return null
  const override = process.env[entry.env]
  if (override === '') return null
  return override || entry.fallback
}

async function onStatusChange(
  doc: Lead,
  previousDoc: Lead | undefined,
  payload: Payload,
): Promise<void> {
  const now = doc.status
  const prev = previousDoc?.status
  if (now === prev) return
  const eventName = capiEventForStatus(now)
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
