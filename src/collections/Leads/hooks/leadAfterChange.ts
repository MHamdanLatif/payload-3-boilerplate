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
 * All four funnel outcomes now report. "Closed Won" maps to Purchase — the
 * strongest signal available, because it teaches Meta what an actual BUYER
 * looks like rather than merely what a lead looks like. "Site Visit" maps to
 * Schedule, the standard event for a booked appointment.
 *
 * Every mapping is overridable, and setting a var to an empty string disables
 * that status outright — so any of these can be renamed or switched off from
 * Railway without a deploy:
 *   META_CAPI_QUALIFIED_EVENT, META_CAPI_JUNK_EVENT,
 *   META_CAPI_SITE_VISIT_EVENT, META_CAPI_CLOSED_WON_EVENT
 *
 * KNOWN GAP: Purchase is sent without value/currency, because nothing in the
 * Leads collection records what a deal actually closed for. `budget` is what
 * the buyer said they'd spend, not what they paid, so using it would put a
 * fabricated revenue figure into Meta's reporting. Meta accepts a valueless
 * Purchase and will still optimise toward it; adding a real "sale value" field
 * later would make it considerably more powerful.
 */
function capiEventForStatus(status: Lead['status']): string | null {
  const configured: Record<string, { env: string; fallback: string | null }> = {
    qualified: { env: 'META_CAPI_QUALIFIED_EVENT', fallback: 'QualifiedLead' },
    junk: { env: 'META_CAPI_JUNK_EVENT', fallback: 'DisqualifiedLead' },
    // NOTE: 'unqualified' is absent on purpose. It is now labelled "Uncontacted"
    // and is the default every lead is created with - reporting it would fire a
    // disqualification for every new enquiry. Its old "does not fit" meaning
    // moved to 'not-a-fit' below.
    'site-visit': { env: 'META_CAPI_SITE_VISIT_EVENT', fallback: 'Schedule' },
    'closed-won': { env: 'META_CAPI_CLOSED_WON_EVENT', fallback: 'Purchase' },
    // Deeper funnel stages. Silent by default: adding a status to the CRM must
    // not change what the ad account optimises for as a side effect. Set the
    // env var to switch one on, e.g. META_CAPI_BOOKING_PENDING_EVENT=InitiateCheckout.
    negotiation: { env: 'META_CAPI_NEGOTIATION_EVENT', fallback: null },
    'booking-pending': { env: 'META_CAPI_BOOKING_PENDING_EVENT', fallback: null },
    // Negative outcomes. 'not-a-fit' mirrors the old 'unqualified' meaning, so
    // it reports as a disqualification; 'lost', 'unresponsive' and 'nurture'
    // stay silent because a stalled deal is not a signal Meta can act on.
    'not-a-fit': { env: 'META_CAPI_NOT_A_FIT_EVENT', fallback: 'DisqualifiedLead' },
    lost: { env: 'META_CAPI_LOST_EVENT', fallback: null },
    unresponsive: { env: 'META_CAPI_UNRESPONSIVE_EVENT', fallback: null },
    nurture: { env: 'META_CAPI_NURTURE_EVENT', fallback: null },
    // Early stages are internal pipeline movement, not conversions. Behaviour
    // is intent data; qualification stays a human decision.
    'details-sent': { env: 'META_CAPI_DETAILS_SENT_EVENT', fallback: null },
    engaged: { env: 'META_CAPI_ENGAGED_EVENT', fallback: null },
    contacted: { env: 'META_CAPI_CONTACTED_EVENT', fallback: null },
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
