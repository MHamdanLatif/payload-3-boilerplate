import {
  APIError,
  type CollectionAfterLogoutHook,
  type CollectionBeforeLoginHook,
  type Payload,
  type PayloadRequest,
} from 'payload'

// Each account may be signed in on at most this many phones/tablets at once.
// Laptops and desktops (including /admin) never count and are never blocked.
export const MOBILE_DEVICE_LIMIT = 2
export const DEVICE_LIMIT_MESSAGE =
  'This account is already signed in on 2 phones/tablets. Sign out on one of them first (or remove one under Signed-in devices from a computer).'
// iPadOS Safari reports a Mac user agent; the CRM login form sends
// navigator.maxTouchPoints so a touch "Mac" is counted as an iPad.
export const TOUCH_POINTS_HEADER = 'x-crm-touch-points'

export function classifyDevice(
  userAgent: string | null | undefined,
  touchPoints?: string | null,
): { mobile: boolean; description: string } {
  const ua = userAgent || ''
  const browser = /Edg(A|iOS)?\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /CriOS|Chrome\//.test(ua)
        ? 'Chrome'
        : /FxiOS|Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser'
  const device = /iPhone|iPod/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && Number(touchPoints) > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? 'Android phone'
          : 'Android tablet'
        : /Mobi|Tablet|Kindle|Silk|BlackBerry|IEMobile|Opera Mini/i.test(ua)
          ? 'Phone/tablet'
          : null
  return device
    ? { mobile: true, description: `${device} · ${browser}` }
    : { mobile: false, description: `Computer · ${browser}` }
}

type Session = { id: string; expiresAt: string | Date }
export const liveSessionIds = (sessions: unknown) =>
  (Array.isArray(sessions) ? (sessions as Session[]) : [])
    .filter((session) => new Date(session.expiresAt).getTime() > Date.now())
    .map((session) => session.id)

/** End the phone/tablet records and push subscriptions of these sessions. */
export async function forgetSessions(payload: Payload, sessionIds: string[], req?: PayloadRequest) {
  if (!sessionIds.length) return
  const where = { sessionId: { in: sessionIds } }
  await payload.delete({ collection: 'crm-devices', where, overrideAccess: true, req })
  await payload.delete({ collection: 'push-subscriptions', where, overrideAccess: true, req })
}

/** Phones/tablets whose session still exists. Logged-out or expired ones free their slot. */
export async function liveMobileDevices(
  payload: Payload,
  userId: number,
  sessions: unknown,
  req?: PayloadRequest,
) {
  const live = liveSessionIds(sessions)
  const devices = await payload.find({
    collection: 'crm-devices',
    where: { owner: { equals: userId } },
    pagination: false,
    depth: 0,
    sort: 'createdAt',
    overrideAccess: true,
    req,
  })
  await forgetSessions(
    payload,
    devices.docs.filter((device) => !live.includes(device.sessionId)).map((d) => d.sessionId),
    req,
  )
  return devices.docs.filter((device) => live.includes(device.sessionId))
}

// Runs inside Payload's login transaction, after the new session was appended
// to user.sessions. Throwing here revokes that session. The login has already
// written the user row in this transaction, so concurrent logins for the same
// account wait on that row lock and see each other's device rows.
export const limitMobileSessions: CollectionBeforeLoginHook = async ({ req, user }) => {
  const sessions = (user.sessions || []) as Session[]
  const sessionId = sessions.at(-1)?.id
  if (!sessionId) return user
  const device = classifyDevice(req.headers.get('user-agent'), req.headers.get(TOUCH_POINTS_HEADER))
  const others = (await liveMobileDevices(req.payload, user.id, sessions, req)).filter(
    (row) => row.sessionId !== sessionId,
  )
  if (!device.mobile) return user
  if (others.length >= MOBILE_DEVICE_LIMIT) throw new APIError(DEVICE_LIMIT_MESSAGE, 403)
  await req.payload.create({
    collection: 'crm-devices',
    data: { sessionId, owner: user.id, description: device.description },
    overrideAccess: true,
    req,
  })
  return user
}

// Runs before Payload removes the session, so its device and alerts go with it
// even when the browser could not unsubscribe.
export const forgetLoggedOutSession: CollectionAfterLogoutHook = async ({ req }) => {
  const sessionId = (req.user as { _sid?: string } | null)?._sid
  if (sessionId) await forgetSessions(req.payload, [sessionId], req)
}

/** Sign one of the user's own phones/tablets out: end its session and its alerts. */
export async function signOutDevice(payload: Payload, userId: number, deviceId: number) {
  const found = await payload.find({
    collection: 'crm-devices',
    where: { and: [{ id: { equals: deviceId } }, { owner: { equals: userId } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const device = found.docs[0]
  if (!device) return null
  // Same session removal as Payload's own logout operation.
  const doc = await payload.db.findOne<{ id: number; sessions?: Session[]; updatedAt?: unknown }>({
    collection: 'users',
    where: { id: { equals: userId } },
  })
  if (doc?.sessions?.some((session) => session.id === device.sessionId)) {
    doc.sessions = doc.sessions.filter((session) => session.id !== device.sessionId)
    doc.updatedAt = null
    await payload.db.updateOne({ id: userId, collection: 'users', data: doc, returning: false })
  }
  await forgetSessions(payload, [device.sessionId])
  return device
}
