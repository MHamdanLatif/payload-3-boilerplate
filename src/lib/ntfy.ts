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
}: {
  title?: string
  message: string
  priority?: NtfyPriority
  tags?: string
  clickUrl?: string
}): Promise<{ ok: boolean; status: string }> {
  const topic = process.env.NTFY_TOPIC
  if (!topic) return { ok: false, status: 'no-topic' }

  const base = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '')
  const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8' }
  if (title) headers['Title'] = headerSafe(title)
  if (priority) headers['Priority'] = priority
  if (tags) headers['Tags'] = headerSafe(tags)
  if (clickUrl) headers['Click'] = clickUrl
  if (process.env.NTFY_TOKEN) headers['Authorization'] = `Bearer ${process.env.NTFY_TOKEN}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body: message,
      signal: controller.signal,
    })
    return { ok: res.ok, status: String(res.status) }
  } catch (e) {
    return { ok: false, status: (e as Error).name || 'error' }
  } finally {
    clearTimeout(timeout)
  }
}
