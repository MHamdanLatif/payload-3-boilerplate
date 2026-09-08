/**
 * ntfy owner notifications — free, no Meta setup, plain HTTPS (works fine from
 * Pakistan without a VPN). The owner installs the ntfy app and subscribes to a
 * private topic; we POST to https://ntfy.sh/<topic> (or a self-hosted server).
 *
 * Best-effort: if NTFY_TOPIC is unset or the request fails, we log and move on —
 * a notification never blocks or fails a lead save.
 *
 * Env:
 *   NTFY_TOPIC   — the private topic string (the "channel"). Required to send.
 *   NTFY_SERVER  — base URL, default https://ntfy.sh. Set for a self-hosted instance.
 *   NTFY_TOKEN   — optional bearer token (for auth-protected / self-hosted topics).
 */

type NtfyPriority = 'min' | 'low' | 'default' | 'high' | 'urgent'

/** Total attempts per notification, including the first. */
const NTFY_ATTEMPTS = 3
/** Backoff between attempts, multiplied by the attempt number. */
const NTFY_RETRY_DELAY_MS = 400

export function ntfyConfigured(): boolean {
  return Boolean(process.env.NTFY_TOPIC)
}

/**
 * ntfy passes Title/Tags/Click as HTTP headers, which are latin-1 only — a lead
 * name with non-Latin characters or an emoji would throw. Keep dynamic text
 * (names, projects) in the UTF-8 body; strip headers to a safe ASCII subset.
 */
function headerSafe(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[^\x20-\x7E]/g, '').trim()
}

export async function sendNtfy({
  title,
  message,
  priority,
  tags,
  clickUrl,
  actions,
}: {
  title?: string
  message: string
  priority?: NtfyPriority
  tags?: string
  clickUrl?: string
  /**
   * ntfy "Actions" header — buttons on the notification itself.
   *
   * Format: `<type>, <label>, <param>[, opt=value]`, multiple separated by ";".
   * A comma or semicolon inside a value breaks the parse, so any URL placed here
   * must not contain either un-encoded.
   */
  actions?: string
}): Promise<{ ok: boolean; status: string }> {
  const topic = process.env.NTFY_TOPIC
  if (!topic) return { ok: false, status: 'no-topic' }

  const base = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '')
  const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8' }
  if (title) headers['Title'] = headerSafe(title)
  if (priority) headers['Priority'] = priority
  if (tags) headers['Tags'] = headerSafe(tags)
  if (clickUrl) headers['Click'] = clickUrl
  // Same latin-1 constraint as Title and Tags — this is an HTTP header.
  if (actions) headers['Actions'] = headerSafe(actions)
  if (process.env.NTFY_TOKEN) headers['Authorization'] = `Bearer ${process.env.NTFY_TOKEN}`

  // Retried, because a dropped alert is a missed lead.
  //
  // Three of four alerts were lost in one night to "TypeError", which is what
  // Node throws when the request never reaches the host at all — a DNS blip, a
  // container still coming up after a deploy, a moment of egress trouble. A
  // single attempt turns any of those into a lead the owner never hears about,
  // and the whole point of this is that they hear about it while it is worth
  // calling.
  //
  // Only transport failures are retried. An HTTP response, including 4xx and
  // 5xx, is an answer: retrying a 429 would make rate limiting worse, and
  // retrying a 400 would fail identically three times.
  const url = `${base}/${encodeURIComponent(topic)}`
  let lastError = 'error'

  for (let attempt = 0; attempt < NTFY_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, NTFY_RETRY_DELAY_MS * attempt))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: message,
        signal: controller.signal,
      })
      return { ok: res.ok, status: String(res.status) }
    } catch (e) {
      const err = e as Error
      // The message matters: "TypeError" alone said nothing about WHY, which is
      // why the original failures could not be diagnosed from the lead record.
      lastError = `${err.name}: ${err.message}`.slice(0, 120)
    } finally {
      clearTimeout(timeout)
    }
  }

  return { ok: false, status: lastError }
}
