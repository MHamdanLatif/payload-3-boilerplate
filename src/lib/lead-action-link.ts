import crypto from 'crypto'

/**
 * Signed one-tap links for push notifications.
 *
 * The action button on an ntfy alert opens a URL, and a push notification
 * carries no session — so the endpoint behind it cannot check who is logged in.
 * Without a signature it would be a URL that changes CRM data and only needs
 * guessing a lead id.
 *
 * So each link carries an HMAC over the lead id and the action name, keyed on
 * PAYLOAD_SECRET. Scoping to the action matters: a link that sends a brochure
 * must not also authorise anything else added later.
 *
 * This is not a session. It authorises exactly one action on exactly one lead,
 * and it is only ever put in a push sent to the owner's own device.
 */

function secret(): string {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is required to sign lead action links')
  return s
}

export function signLeadAction(leadId: string | number, action: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`${action}:${leadId}`)
    .digest('base64url')
    .slice(0, 32)
}

/** Constant-time compare, so the signature cannot be probed a character at a time. */
export function verifyLeadAction(
  leadId: string | number,
  action: string,
  signature: string | null | undefined,
): boolean {
  if (!signature) return false
  try {
    const expected = signLeadAction(leadId, action)
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
