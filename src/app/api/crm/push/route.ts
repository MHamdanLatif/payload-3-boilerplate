import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  crmPushConfigured,
  endpointHash,
  getPushKeys,
  parseSubscription,
  sendCrmPush,
  validPushEndpoint,
} from '@/lib/crm-push'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

async function handle(req: Request) {
  if (req.method !== 'GET') {
    const origin = req.headers.get('origin')
    if (!origin || ![new URL(req.url).origin, new URL(getServerSideURL()).origin].includes(origin))
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    if (req.method === 'GET') {
      if (!crmPushConfigured())
        return NextResponse.json({ disabled: true }, { headers: { 'Cache-Control': 'no-store' } })
      const keys = await getPushKeys(payload)
      return NextResponse.json(
        { publicKey: keys.publicKey },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const body = await req.json()
    if (!validPushEndpoint(body?.endpoint)) throw Error('Invalid notification subscription.')
    const hash = endpointHash(body.endpoint)
    const existing = await payload.find({
      collection: 'push-subscriptions',
      where: { endpointHash: { equals: hash } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const device = existing.docs[0]
    const owner = typeof device?.owner === 'object' ? device.owner?.id : device?.owner
    if (device && owner !== user.id)
      return NextResponse.json(
        { error: 'Sign out of the previous account on this device before enabling notifications.' },
        { status: 409 },
      )
    if (req.method === 'DELETE') {
      if (device)
        await payload.delete({
          collection: 'push-subscriptions',
          id: device.id,
          overrideAccess: true,
        })
      return NextResponse.json({ ok: true })
    }
    if (!crmPushConfigured()) throw Error('Notifications are disabled on the server.')
    if (body.test === true) {
      if (!device) throw Error('Enable notifications first.')
      const result = await sendCrmPush(
        payload,
        {
          title: 'Lateef CRM',
          message:
            'Notifications are working. New leads, brochure opens and follow-up reminders will arrive here.',
          clickUrl: '/leads-dashboard',
        },
        { owner: user.id, endpointHash: hash },
      )
      return NextResponse.json(result, { status: result.ok ? 200 : 503 })
    }
    const data = { ...parseSubscription(body), owner: user.id }
    if (device)
      await payload.update({
        collection: 'push-subscriptions',
        id: device.id,
        data,
        overrideAccess: true,
      })
    else await payload.create({ collection: 'push-subscriptions', data, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch {
    // Database errors can contain SQL parameters, including VAPID secrets.
    return NextResponse.json(
      { error: 'Could not update notifications. Reload the app and try again.' },
      { status: 400 },
    )
  }
}
export const GET = handle
export const POST = handle
export const DELETE = handle
