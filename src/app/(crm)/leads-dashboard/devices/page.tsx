import type { Metadata } from 'next'
import { crmSession } from '@/lib/crm-server'
import { liveMobileDevices, MOBILE_DEVICE_LIMIT } from '@/lib/crm-devices'
import { DeviceSignOut } from '@/components/crm/DeviceSignOut'

export const metadata: Metadata = {
  title: 'Signed-in devices',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function DevicesPage() {
  const { payload, user } = await crmSession('/leads-dashboard/devices')
  // Users only ever see and manage their own sessions.
  const devices = await liveMobileDevices(payload, user.id, user.sessions)
  const current = (user as { _sid?: string })._sid
  return (
    <main className="crm-wrap">
      <p className="crm-eyebrow">Your account</p>
      <h1 className="crm-title">Signed-in devices</h1>
      <p className="crm-muted mt-2">
        Your account can be signed in on up to {MOBILE_DEVICE_LIMIT} phones/tablets at a time.
        Laptops and computers do not count. Signing a device out also stops its notifications.
      </p>
      <div className="crm-leads mt-4">
        {devices.map((device) => (
          <article key={device.id} className="crm-card">
            <div className="crm-row">
              <h2>{device.description || 'Phone/tablet'}</h2>
              {device.sessionId === current && <span className="crm-badge">This device</span>}
            </div>
            <p className="crm-muted mt-1">
              Signed in{' '}
              {new Date(device.createdAt).toLocaleString('en-GB', {
                timeZone: 'Asia/Karachi',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              PKT
            </p>
            <div className="mt-3">
              <DeviceSignOut id={device.id} name={device.description || 'Phone/tablet'} />
            </div>
          </article>
        ))}
      </div>
      {!devices.length && (
        <div className="crm-panel crm-empty">
          <h2 className="text-xl font-semibold">No phones or tablets signed in</h2>
          <p className="crm-muted mt-2">Phones and tablets you sign in on will appear here.</p>
        </div>
      )}
    </main>
  )
}
