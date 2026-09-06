import type { Payload } from 'payload'
import { atLeast, TERMINAL_STATUSES, type LeadStatus } from '@/lib/lead-status'

/**
 * Advance a lead's status automatically, but only ever forward.
 *
 * Two points in the journey are facts the system observes rather than judgements
 * a person makes: the brochure link was sent, and the lead opened it. Those are
 * worth recording without anyone remembering to, because a pipeline where the
 * early stages depend on the owner updating a dropdown drifts out of date within
 * a week and then cannot be trusted for anything.
 *
 * Everything past `engaged` stays manual. That boundary is deliberate: an
 * advance beyond this point means somebody formed a judgement about the buyer —
 * spoke to them, qualified them, showed them the site — and a system that
 * guesses at those would quietly overwrite the one part of the record that is
 * genuinely expert.
 *
 * THREE RULES, all of which exist to stop automation destroying information:
 *
 *   1. Never move backward. Re-sending the brochure to a lead who is already
 *      Qualified must not drag them back to Details Sent.
 *   2. Never touch a terminal status. A lead marked Junk or Lost who opens an
 *      old link is still junk or lost; resurrecting them into the active
 *      pipeline would put dead leads back in the follow-up queue.
 *   3. Never fail loudly. A status update is a convenience; it must not break
 *      the send, the page view, or the tracking that surrounds it.
 */
export async function advanceLeadStatus(
  payload: Payload,
  leadId: string | number,
  target: Extract<LeadStatus, 'details-sent' | 'engaged'>,
): Promise<void> {
  try {
    const lead = await payload
      .findByID({ collection: 'leads', id: leadId, depth: 0 })
      .catch(() => null)
    if (!lead) return

    const current = lead.status as string | null | undefined

    // Rule 2 — terminal outcomes are decisions, not stages.
    if (TERMINAL_STATUSES.includes((current ?? '') as LeadStatus)) return

    // Rule 1 — already here or further along, so there is nothing to add.
    if (atLeast(current, target)) return

    await payload.update({
      collection: 'leads',
      id: leadId,
      overrideAccess: true,
      // The lead hooks fire Meta CAPI events off status changes. `details-sent`
      // and `engaged` map to nothing there by design, but skipping the hooks
      // keeps this from becoming a surprise if that ever changes.
      context: { skipLeadHooks: true },
      data: { status: target },
    })
  } catch (e) {
    // Rule 3.
    console.warn('[lead-status] auto-advance failed:', (e as Error)?.message)
  }
}
