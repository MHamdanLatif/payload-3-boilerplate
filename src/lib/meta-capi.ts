import crypto from 'crypto'

/**
 * Meta Conversions API (server-side events).
 *
 * Env:
 *   META_CAPI_ACCESS_TOKEN     — CAPI access token (system user)
 *   META_PIXEL_ID              — pixel / dataset id (defaults to the public pixel)
 *   META_GRAPH_VERSION         — Graph version (default 'v21.0')
 *   META_CAPI_TEST_EVENT_CODE  — optional, to see events in Test Events
 *
 * User identifiers (phone/email) are SHA-256 hashed as Meta requires. `event_id`
 * is passed through so a server event dedupes against the browser Pixel event.
 * Best-effort: never throws, returns a status string for logging on the lead.
 */
const VERSION = process.env.META_GRAPH_VERSION || 'v21.0'
const PIXEL_ID =
  process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '1007386375371716'
const TIMEOUT_MS = 6000

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex')
const normEmail = (e: string) => e.trim().toLowerCase()
// Meta wants phone as digits with country code, no '+', spaces or leading zeros.
const normPhone = (p: string) => p.replace(/[^\d]/g, '').replace(/^0+/, '')

export function capiConfigured(): boolean {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN && PIXEL_ID)
}

export async function sendCapiEvent(opts: {
  eventName: string
  eventId?: string | null
  email?: string | null
  phone?: string | null
  fbc?: string | null
  fbp?: string | null
  fbclid?: string | null
  clientIp?: string | null
  userAgent?: string | null
  eventSourceUrl?: string | null
  customData?: Record<string, unknown>
}): Promise<{ ok: boolean; status: string }> {
  if (!capiConfigured()) return { ok: false, status: 'not-configured' }
  const token = process.env.META_CAPI_ACCESS_TOKEN as string

  const user_data: Record<string, unknown> = {}
  if (opts.email) user_data.em = [sha256(normEmail(opts.email))]
  if (opts.phone) user_data.ph = [sha256(normPhone(opts.phone))]
  // Prefer a stored _fbc; otherwise synthesise it from the click id.
  let fbc = opts.fbc || undefined
  if (!fbc && opts.fbclid) fbc = `fb.1.${Date.now()}.${opts.fbclid}`
  if (fbc) user_data.fbc = fbc
  if (opts.fbp) user_data.fbp = opts.fbp
  if (opts.clientIp) user_data.client_ip_address = opts.clientIp
  if (opts.userAgent) user_data.client_user_agent = opts.userAgent

  const event: Record<string, unknown> = {
    event_name: opts.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data,
  }
  if (opts.eventId) event.event_id = opts.eventId
  if (opts.eventSourceUrl) event.event_source_url = opts.eventSourceUrl
  if (opts.customData) event.custom_data = opts.customData

  const payload: Record<string, unknown> = { data: [event] }
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://graph.facebook.com/${VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    )
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
      events_received?: number
    }
    if (!res.ok) {
      const m = json?.error?.message || `${res.status} ${res.statusText}`
      console.warn('[capi] event failed:', m)
      return { ok: false, status: `error: ${String(m).slice(0, 180)}` }
    }
    return { ok: true, status: `sent (received ${json?.events_received ?? '?'})` }
  } catch (e) {
    const s = (e as Error).name === 'AbortError' ? 'timeout' : `error: ${(e as Error).message}`
    console.warn('[capi] event error:', s)
    return { ok: false, status: s }
  } finally {
    clearTimeout(timer)
  }
}
