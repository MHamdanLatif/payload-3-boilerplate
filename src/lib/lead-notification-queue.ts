import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { crmPushConfigured, sendCrmPush } from './crm-push'
import { leadNotificationMessage } from './lead-notification-message'
import { signLeadAction } from './lead-action-link'

// Reconcile from committed leads instead of relying on a detached afterChange promise.
// Unique event keys make this safe across restarts and multiple Railway replicas.
export async function reconcileLeadNotifications(payload: Payload) {
  // Also initialize a fresh install where migrations ran before any global existed.
  await payload.db.drizzle.execute(sql`
    INSERT INTO crm_settings (id, automatic_uncontacted_reminders, notification_start_at)
      SELECT 1, true, NOW() WHERE NOT EXISTS (SELECT 1 FROM crm_settings) ON CONFLICT (id) DO NOTHING;
    UPDATE crm_settings SET notification_start_at = NOW() WHERE notification_start_at IS NULL;
    UPDATE lead_notifications SET finished_at = NOW(), delivery_status = 'Expired: no app display confirmation within 24 hours'
      WHERE finished_at IS NULL AND expires_at <= NOW() AND (retry_at IS NULL OR retry_at <= NOW());
    UPDATE leads l SET owner_notify_status = 'CRM push: expired without app display confirmation'
      FROM lead_notifications n WHERE n.lead_id = l.id AND n.kind = 'new' AND l.owner_notified_at IS NULL
      AND n.delivery_status = 'Expired: no app display confirmation within 24 hours'
      AND l.owner_notify_status IS DISTINCT FROM 'CRM push: expired without app display confirmation';
  `)

  await payload.db.drizzle.execute(sql`
    INSERT INTO lead_notifications (event_key, lead_id, kind, due_at, expires_at, attempts, receipts, created_at, updated_at)
    SELECT l.id::text || ':' || k.kind, l.id, k.kind, l.created_at + k.delay,
      l.created_at + k.delay + INTERVAL '24 hours', 0, '[]'::jsonb, NOW(), NOW()
    FROM leads l CROSS JOIN (VALUES ('new', INTERVAL '0 minutes'), ('30m', INTERVAL '30 minutes'), ('2h', INTERVAL '2 hours')) k(kind, delay)
    WHERE l.created_at >= COALESCE((SELECT notification_start_at FROM crm_settings LIMIT 1), NOW())
      AND l.created_at + k.delay + INTERVAL '24 hours' > NOW()
      AND ((k.kind = 'new' AND l.owner_notified_at IS NULL) OR
        (k.kind <> 'new' AND l.status = 'unqualified' AND
          COALESCE((SELECT automatic_uncontacted_reminders FROM crm_settings LIMIT 1), true)))
    ON CONFLICT (event_key) DO NOTHING
  `)
  // Do not send two overdue reminders together after a prolonged outage.
  await payload.db.drizzle.execute(sql`
    UPDATE lead_notifications n SET finished_at = NOW(), delivery_status = 'Superseded by 2-hour reminder'
    FROM leads l WHERE n.lead_id = l.id AND n.kind = '30m' AND n.finished_at IS NULL
      AND l.created_at <= NOW() - INTERVAL '2 hours' AND (n.retry_at IS NULL OR n.retry_at <= NOW())
  `)
}

export async function deliverLeadNotifications(payload: Payload) {
  if (!crmPushConfigured()) return
  await reconcileLeadNotifications(payload)
  for (let i = 0; i < 25; i++) {
    const claim = randomUUID()
    const result = await payload.db.drizzle.execute(sql`
      UPDATE lead_notifications SET claim = ${claim}, retry_at = NOW() + INTERVAL '5 minutes', attempts = attempts + 1
      WHERE id = (SELECT id FROM lead_notifications WHERE finished_at IS NULL AND due_at <= NOW()
        AND expires_at > NOW() AND (retry_at IS NULL OR retry_at <= NOW())
        ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id
    `)
    const row = result.rows[0] as { id: number } | undefined
    if (!row) return
    const job = await payload.findByID({ collection: 'lead-notifications', id: row.id, depth: 0 })
    if (job.claim !== claim) continue
    const id = typeof job.lead === 'object' ? job.lead?.id : job.lead
    const lead = id
      ? await payload.findByID({ collection: 'leads', id, depth: 0, disableErrors: true })
      : null
    const settings = await payload.findGlobal({ slug: 'crm-settings', depth: 0 })
    const cancelled =
      !lead ||
      (job.kind !== 'new' &&
        (lead.status !== 'unqualified' || settings.automaticUncontactedReminders === false))
    if (cancelled) {
      await payload.db.drizzle
        .execute(sql`UPDATE lead_notifications SET finished_at = NOW(), claim = NULL,
        delivery_status = 'Cancelled: lead contacted, deleted or automatic reminders disabled' WHERE id = ${job.id} AND claim = ${claim}`)
      continue
    }
    const receipts = Array.isArray(job.receipts)
      ? job.receipts.filter((v): v is string => typeof v === 'string')
      : []
    const response = await sendCrmPush(
      payload,
      leadNotificationMessage(lead!, job.kind),
      undefined,
      {
        id: job.id,
        exclude: receipts,
        receipt: (hash) =>
          `/api/crm/push/receipt?id=${job.id}&device=${hash}&sig=${signLeadAction(job.id, 'push-receipt:' + hash)}`,
      },
    )
    const complete = response.ok && response.pendingDevices === 0
    await payload.db.drizzle.execute(sql`
      UPDATE lead_notifications SET finished_at = ${complete ? new Date().toISOString() : null}::timestamptz,
        delivery_status = ${complete ? 'Displayed on subscribed devices' : response.status},
        claim = NULL WHERE id = ${job.id} AND claim = ${claim}
    `)
    if (job.kind === 'new')
      await payload.update({
        collection: 'leads',
        id: lead!.id,
        overrideAccess: true,
        context: { skipLeadHooks: true },
        data: {
          ...(complete ? { ownerNotifiedAt: new Date().toISOString() } : {}),
          ownerNotifyStatus: complete
            ? 'CRM push: display confirmed by app'
            : `CRM push: ${response.status}; awaiting display confirmation, retrying`,
        },
      })
  }
}
