import webpush from 'web-push'
import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

export const crmPushConfigured = () => process.env.CRM_PUSH_DISABLED !== 'true'
export const endpointHash = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex')

export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname === 'web.push.apple.com' ||
        url.hostname === 'updates.push.services.mozilla.com' ||
        url.hostname.endsWith('.push.services.mozilla.com'))
    )
  } catch {
    return false
  }
}

export function parseSubscription(value: unknown) {
  const data = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  if (!validPushEndpoint(data?.endpoint)) throw Error('Invalid push service.')
  const p256dh = data?.keys?.p256dh
  const auth = data?.keys?.auth
  if (
    typeof p256dh !== 'string' ||
    !/^[A-Za-z0-9_-]{87}=?$/.test(p256dh) ||
    typeof auth !== 'string' ||
    !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)
  )
    throw Error('Invalid notification subscription.')
  return { endpoint: data.endpoint, endpointHash: endpointHash(data.endpoint), p256dh, auth }
}

export async function getPushKeys(
  payload: Payload,
): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await payload.db.drizzle.execute(
    sql`SELECT public_key, private_key FROM crm_push_settings WHERE id = 1`,
  )
  if (existing.rows[0])
    return {
      publicKey: String(existing.rows[0].public_key),
      privateKey: String(existing.rows[0].private_key),
    }
  const keys = webpush.generateVAPIDKeys()
  // First subscriber initializes this once. Concurrent requests retain the same key pair.
  await payload.db.drizzle.execute(sql`
    INSERT INTO crm_push_settings (id, public_key, private_key, created_at, updated_at)
    VALUES (1, ${keys.publicKey}, ${keys.privateKey}, NOW(), NOW()) ON CONFLICT (id) DO NOTHING
  `)
  const result = await payload.db.drizzle.execute(
    sql`SELECT public_key, private_key FROM crm_push_settings WHERE id = 1`,
  )
  return {
    publicKey: String(result.rows[0].public_key),
    privateKey: String(result.rows[0].private_key),
  }
}

export type CrmPushMessage = {
  title: string
  message: string
  clickUrl?: string
  priority?: string
  tags?: string
  actions?: { action: string; title: string; url: string }[]
}

export async function sendCrmPush(
  payload: Payload,
  message: CrmPushMessage,
  only?: { owner: number; endpointHash: string },
  delivery?: { id: number; exclude: string[]; receipt: (hash: string) => string },
): Promise<{ ok: boolean; status: string; pendingDevices?: number }> {
  if (!crmPushConfigured()) return { ok: false, status: 'Notifications disabled' }
  try {
    const where: Where | undefined = only
      ? {
          and: [{ owner: { equals: only.owner } }, { endpointHash: { equals: only.endpointHash } }],
        }
      : undefined
    const subscriptions = await payload.find({
      collection: 'push-subscriptions',
      where,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    if (!subscriptions.docs.length)
      return { ok: false, status: 'No devices enabled; enable notifications in the CRM' }
    const targets = subscriptions.docs.filter(
      (device) =>
        device.owner &&
        validPushEndpoint(device.endpoint) &&
        !delivery?.exclude.includes(endpointHash(device.endpoint)),
    )
    if (delivery && targets.length === 0 && delivery.exclude.length > 0)
      return { ok: true, status: 'Display confirmed', pendingDevices: 0 }
    const keys = await getPushKeys(payload)
    const body = {
      title: message.title.slice(0, 100),
      body: message.message.slice(0, 500),
      url: message.clickUrl || '/leads-dashboard',
      actions: message.actions || [],
    }
    let sent = 0
    for (let offset = 0; offset < targets.length; offset += 5) {
      await Promise.all(
        targets.slice(offset, offset + 5).map(async (device) => {
          if (!device.owner || !validPushEndpoint(device.endpoint)) return
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await webpush.sendNotification(
                { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
                JSON.stringify({
                  ...body,
                  ...(delivery
                    ? {
                        tag: `lead-event-${delivery.id}`,
                        receipt: delivery.receipt(endpointHash(device.endpoint)),
                      }
                    : {}),
                }),
                {
                  vapidDetails: { subject: getServerSideURL(), ...keys },
                  TTL: delivery ? 300 : 86400,
                  urgency: message.priority === 'low' ? 'low' : 'high',
                  timeout: 6000,
                },
              )
              sent++
              return
            } catch (error) {
              const code = (error as { statusCode?: number }).statusCode
              if (code === 404 || code === 410) {
                await payload.delete({
                  collection: 'push-subscriptions',
                  id: device.id,
                  overrideAccess: true,
                })
                return
              }
              if (code && code < 500 && code !== 429) return
              if (attempt < 2)
                await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
            }
          }
        }),
      )
    }
    return {
      ok: sent > 0,
      pendingDevices: targets.length,
      status: sent
        ? `Accepted by push service for ${sent}/${subscriptions.docs.length} devices`
        : 'Push service rejected delivery; enable notifications again',
    }
  } catch {
    // Do not log endpoints, subscription keys, or signed action URLs.
    payload.logger.warn('[crm-push] Unable to deliver notifications')
    return { ok: false, status: 'Notification delivery unavailable' }
  }
}
