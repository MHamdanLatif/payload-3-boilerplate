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
