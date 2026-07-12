import type { CollectionAfterChangeHook } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * IndexNow — instantly notify Bing (and Yandex, Seznam, etc.) when a URL is
 * added or updated, instead of waiting for the next crawl.
 *
 * Setup: the ownership key is served as a static file at
 *   https://lateefproperties.com/<KEY>.txt   (public/<KEY>.txt)
 * and echoed in every submission's `keyLocation`, which is how the API verifies
 * we own the host.
 *
 * Verify in Bing Webmaster Tools → IndexNow after the first submissions land.
 */
const INDEXNOW_KEY = 'e44f2c876cec4f27acd27b959eeacf6e'
const ENDPOINT = 'https://api.indexnow.org/IndexNow'
const TIMEOUT_MS = 3000

/**
 * Submit one or more URLs (absolute, or root-relative like `/blog/x`) to
 * IndexNow. Never throws and never blocks a save for long — it's bounded by a
 * short timeout. No-ops outside production or on localhost, where the key file
 * isn't publicly reachable and the API would reject the host.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return

  const base = getServerSideURL().replace(/\/$/, '')
  let host: string
  try {
    host = new URL(base).host
  } catch {
    return
  }

  // IndexNow only accepts publicly reachable hosts.
  if (
    process.env.NODE_ENV !== 'production' ||
    host.includes('localhost') ||
    host.startsWith('127.')
  ) {
    return
  }

  // Normalise to absolute URLs on our own host; drop anything off-host.
  const urlList = Array.from(
    new Set(
      urls
        .map((u) => (/^https?:\/\//.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`))
        .filter((u) => {
          try {
            return new URL(u).host === host
          } catch {
            return false
          }
        }),
    ),
  )
  if (!urlList.length) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: controller.signal,
    })
    // 200 = accepted, 202 = accepted pending key validation. Anything else is
    // worth a log line (e.g. 403 = key not found, 422 = URLs don't match host).
    if (res.status !== 200 && res.status !== 202) {
      console.warn(`[indexnow] submit returned ${res.status} ${res.statusText}`)
    }
  } catch (e) {
    console.warn('[indexnow] submit failed:', (e as Error).message)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build a Payload `afterChange` hook that pings IndexNow with the URL derived
 * from the saved doc. `pathFor` returns the site path (e.g. `/blog/<slug>`) or
 * null to skip (e.g. an unpublished draft). Errors are swallowed so a failed
 * ping can never break a CMS save.
 */
export function indexNowAfterChange(
  pathFor: (doc: Record<string, unknown>) => string | null,
): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    try {
      const path = pathFor(doc as Record<string, unknown>)
      if (path) await submitToIndexNow([path])
    } catch (e) {
      req?.payload?.logger?.warn?.(`[indexnow] hook error: ${(e as Error).message}`)
    }
    return doc
  }
}
