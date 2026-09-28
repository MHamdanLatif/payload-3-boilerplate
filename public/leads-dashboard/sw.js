// Network-only: never store client records, authenticated HTML, or API responses.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.mode !== 'navigate' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith('/leads-dashboard')
  )
    return
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lateef CRM - Offline</title><body style="background:hsl(36 33% 97%);color:hsl(231 30% 27%);font-family:system-ui;padding:48px 24px"><h1>You are offline</h1><p>Reconnect to view your leads and save changes.</p><a href="/leads-dashboard" style="display:inline-block;padding:14px 24px;background:hsl(231 30% 27%);color:white;border-radius:12px">Try again</a></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          },
        ),
    ),
  )
})

function safeNotificationURL(value) {
  try {
    const url = new URL(value || '/leads-dashboard', self.location.origin)
    if (
      url.origin === self.location.origin &&
      (/^\/leads-dashboard(?:\/|$)/.test(url.pathname) ||
        /^\/api\/leads\/\d+\/(?:send-brochure|whatsapp)$/.test(url.pathname))
    )
      return url.href
  } catch {}
  return self.location.origin + '/leads-dashboard'
}
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() || {}
  } catch {}
  const actions = Array.isArray(data.actions) ? data.actions.slice(0, 2) : []
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'Lateef CRM', {
        ...(data.tag ? { tag: data.tag, renotify: false } : {}),
        body: data.body || 'Open the CRM to see your updates.',
        icon: '/leads-dashboard/icon-192.png?v=2',
        badge: '/leads-dashboard/badge.png',
        actions: actions.map(({ action, title }) => ({ action, title })),
        data: { url: safeNotificationURL(data.url), actions },
      })
      // Receipt confirms showNotification succeeded, not that a person read the alert.
      if (typeof data.receipt === 'string' && data.receipt.startsWith('/api/crm/push/receipt?')) {
        await fetch(data.receipt, { method: 'POST' }).catch(() => {})
      }
    })(),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const action = (data.actions || []).find((item) => item.action === event.action)
  const url = safeNotificationURL(action?.url || data.url)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((client) => client.url === url)
      if (existing) return existing.focus()
      // Opening the signed action URL preserves the original WhatsApp handoff.
      return self.clients.openWindow(url)
    })(),
  )
})
