import { leadProjectLabel, leadSourceLabel } from './lead-labels'
import { deliverLeadNotifications } from './lead-notification-queue'
import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { crmPushConfigured, sendCrmPush } from './crm-push'
import { getServerSideURL } from '@/utilities/getURL'

// Postgres leases prevent simultaneous replicas from sending the same reminder
// and let another process retry after a crash. No timers contain lead state.
// A reminder stays on the lead (shown as Overdue) until someone presses Mark
// contacted or reschedules it. If nobody has within 2 hours, one repeat push
// goes out; after that nothing more is sent. Each push is retried for 24 hours.
const pkt = (value: string) =>
  new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) + ' PKT'

export async function deliverFollowUpReminders(payload: Payload) {
  if (!crmPushConfigured()) return
  // Stop showing "retrying" once the 24-hour delivery window has closed.
  await payload.db.drizzle.execute(sql`
    UPDATE leads SET follow_up_status = CASE WHEN follow_up_sent_at IS NULL
        THEN 'Not delivered; stopped retrying after 24 hours'
        ELSE 'Sent; repeat reminder not delivered, stopped retrying after 24 hours' END
    WHERE follow_up_at IS NOT NULL AND follow_up_claim IS NULL AND follow_up_repeat_sent_at IS NULL
      AND follow_up_status LIKE '%retrying in 5 minutes'
      AND ((follow_up_sent_at IS NULL AND follow_up_at <= NOW() - INTERVAL '24 hours')
        OR GREATEST(follow_up_at, follow_up_sent_at) + INTERVAL '2 hours' + INTERVAL '24 hours' <= NOW())
  `)
  for (let i = 0; i < 25; i++) {
    const claim = randomUUID()
    // The repeat is due 2 hours after the reminder time, or after a late first
    // delivery, so the two pushes never arrive back to back.
    const result = await payload.db.drizzle.execute(sql`
      UPDATE leads SET follow_up_claim = ${claim}, follow_up_retry_at = NOW() + INTERVAL '5 minutes'
      WHERE id = (
        SELECT id FROM leads
        WHERE follow_up_at IS NOT NULL AND follow_up_repeat_sent_at IS NULL
          AND (follow_up_retry_at IS NULL OR follow_up_retry_at <= NOW())
          AND ((follow_up_sent_at IS NULL AND follow_up_at <= NOW()
              AND follow_up_at > NOW() - INTERVAL '24 hours')
            OR (follow_up_sent_at IS NOT NULL
              AND GREATEST(follow_up_at, follow_up_sent_at) + INTERVAL '2 hours' <= NOW()
              AND GREATEST(follow_up_at, follow_up_sent_at) + INTERVAL '2 hours' + INTERVAL '24 hours' > NOW()))
        ORDER BY follow_up_at LIMIT 1 FOR UPDATE SKIP LOCKED
      ) RETURNING id
    `)
    const row = result.rows[0] as { id: number } | undefined
    if (!row) return
    const lead = await payload.findByID({ collection: 'leads', id: row.id, depth: 0 })
    if (lead.followUpClaim !== claim || !lead.followUpAt) continue
    const repeat = Boolean(lead.followUpSentAt)
    const details = `${lead.phone}\n${leadProjectLabel(lead)}\n${leadSourceLabel(lead)}\nScheduled: ${pkt(lead.followUpAt)}`
    const response = await sendCrmPush(payload, {
      title: repeat ? 'Second reminder: follow-up overdue' : 'Follow-up reminder',
      message: repeat
        ? `Still not marked contacted: ${lead.name}\n${details}\nOpen the lead and press Mark contacted once done.`
        : `Follow up with ${lead.name}\n${details}`,
      priority: 'high',
      tags: 'alarm_clock',
      clickUrl: `${getServerSideURL().replace(/\/$/, '')}/leads-dashboard/${lead.id}`,
    })
    const sentAt = response.ok ? new Date().toISOString() : null
    // Never overwrite a reminder that was rescheduled during delivery.
    if (repeat)
      await payload.db.drizzle.execute(sql`
        UPDATE leads SET
          follow_up_repeat_sent_at = ${sentAt}::timestamptz,
          follow_up_status = ${response.ok ? 'Sent; repeat reminder sent' : `Repeat delivery failed (${response.status}); retrying in 5 minutes`},
          follow_up_claim = NULL
        WHERE id = ${lead.id} AND follow_up_claim = ${claim}
      `)
    else
      await payload.db.drizzle.execute(sql`
        UPDATE leads SET
          follow_up_sent_at = ${sentAt}::timestamptz,
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
