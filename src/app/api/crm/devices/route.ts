import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { signOutDevice } from '@/lib/crm-devices'
import { getServerSideURL } from '@/utilities/getURL'

// Signs one of the current user's own phones/tablets out (see Signed-in devices).
export async function DELETE(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin || ![new URL(req.url).origin, new URL(getServerSideURL()).origin].includes(origin))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const body = await req.json()
    if (!Number.isSafeInteger(body?.id)) throw Error()
    const device = await signOutDevice(payload, user.id, body.id)
    if (!device) return NextResponse.json({ error: 'Device not found.' }, { status: 404 })
    return NextResponse.json({
      ok: true,
      current: device.sessionId === (user as { _sid?: string })._sid,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not sign that device out. Try again.' },
      { status: 400 },
    )
  }
}
