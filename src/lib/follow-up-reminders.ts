import { leadProjectLabel, leadSourceLabel } from './lead-labels'
import { deliverLeadNotifications } from './lead-notification-queue'
import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { crmPushConfigured, sendCrmPush } from './crm-push'
import { getServerSideURL } from '@/utilities/getURL'

// Postgres leases prevent simultaneous replicas from sending the same reminder
// and let another process retry after a crash. No timers contain lead state.
export async function deliverFollowUpReminders(payload: Payload) {
  if (!crmPushConfigured()) return
  for (let i = 0; i < 25; i++) {
    const claim = randomUUID()
    const result = await payload.db.drizzle.execute(sql`
      UPDATE leads SET follow_up_claim = ${claim}, follow_up_retry_at = NOW() + INTERVAL '5 minutes'
      WHERE id = (
        SELECT id FROM leads
        WHERE follow_up_at <= NOW() AND follow_up_sent_at IS NULL
          AND (follow_up_retry_at IS NULL OR follow_up_retry_at <= NOW())
        ORDER BY follow_up_at LIMIT 1 FOR UPDATE SKIP LOCKED
      ) RETURNING id
    `)
    const row = result.rows[0] as { id: number } | undefined
    if (!row) return
    const lead = await payload.findByID({ collection: 'leads', id: row.id, depth: 0 })
    if (lead.followUpClaim !== claim || !lead.followUpAt) continue
    const response = await sendCrmPush(payload, {
      title: 'Follow-up reminder',
      message: `Follow up with ${lead.name}\n${lead.phone}\n${leadProjectLabel(lead)}\n${leadSourceLabel(lead)}\nScheduled: ${new Date(lead.followUpAt).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })} PKT`,
      priority: 'high',
      tags: 'alarm_clock',
      clickUrl: `${getServerSideURL().replace(/\/$/, '')}/leads-dashboard/${lead.id}`,
    })
    // Never overwrite a reminder that was rescheduled during delivery.
    await payload.db.drizzle.execute(sql`
      UPDATE leads SET
        follow_up_sent_at = ${response.ok ? new Date().toISOString() : null}::timestamptz,
        follow_up_status = ${response.ok ? 'Sent' : `Delivery failed (${response.status}); retrying in 5 minutes`},
        follow_up_claim = NULL
      WHERE id = ${lead.id} AND follow_up_claim = ${claim}
    `)
  }
}

const state = globalThis as typeof globalThis & { followUpTimer?: ReturnType<typeof setInterval> }

export function startFollowUpReminders(getPayloadInstance: () => Promise<Payload>) {
  if (state.followUpTimer || !crmPushConfigured()) return
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const payload = await getPayloadInstance()
      // A failure in one queue must not stop the other.
      await Promise.allSettled([
        deliverFollowUpReminders(payload),
        deliverLeadNotifications(payload),
      ]).then((results) => {
        for (const result of results)
          if (result.status === 'rejected')
            console.error('[crm-notifications] Delivery pass failed')
      })
    } catch (error) {
      console.error('[follow-up-reminders] Delivery pass failed:', error)
    } finally {
      running = false
    }
  }
  state.followUpTimer = setInterval(() => void tick(), 30_000)
  state.followUpTimer.unref()
  void tick()
}
