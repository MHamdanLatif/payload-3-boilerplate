'use client'
import { useEffect, useState } from 'react'

async function request(method: string, body: unknown) {
  const res = await fetch('/api/crm/push', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw Error(data.error || data.status || 'Could not update notifications.')
  return data
}
async function registration() {
  // getRegistration does not hang when a worker has not activated yet.
  const worker = await navigator.serviceWorker.getRegistration('/leads-dashboard')
  if (!worker?.active) throw Error('App is updating. Wait a moment and try again.')
  return worker
}
export async function disableCrmNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const worker = await navigator.serviceWorker.getRegistration('/leads-dashboard')
  const subscription = await worker?.pushManager.getSubscription()
  if (!subscription) return
  await request('DELETE', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

export function CrmNotifications() {
  const [supported, setSupported] = useState(false)
  const [key, setKey] = useState('')
  const [automaticReminders, setAutomaticReminders] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setMessage('Open the CRM in Chrome to enable phone notifications.')
      return
    }
    setSupported(true)
    void (async () => {
      try {
        const res = await fetch('/api/crm/push', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw Error(data.error || 'Could not load notification settings.')
        if (!active) return
        setAutomaticReminders(data.automaticReminders !== false)
        if (data.disabled) {
          setMessage('Notifications are disabled on the server.')
          return
        }
        if (typeof data.publicKey !== 'string')
          throw Error('Could not load notification settings. Reload the app to try again.')
        setKey(data.publicKey)
        const worker = await navigator.serviceWorker.getRegistration('/leads-dashboard')
        const subscription = await worker?.pushManager.getSubscription()
        if (subscription && Notification.permission === 'granted') {
          const expected = Uint8Array.from(
            atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0),
          )
          const stored = subscription.options.applicationServerKey
          if (
            stored &&
            (stored.byteLength !== expected.length ||
              !new Uint8Array(stored).every((byte, i) => byte === expected[i]))
          ) {
            await subscription.unsubscribe()
            if (active) setMessage('Notification settings changed. Enable notifications again.')
            return
          }
          // Renew the server record after an expired subscription was removed, or a database restore.
          await request('POST', subscription.toJSON())
          if (active) setEnabled(true)
        }
      } catch (error) {
        if (active) setMessage((error as Error).message)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted')
        throw Error(
          'Allow notifications in Chrome site settings and Android notification settings, then try again.',
        )
      const worker = await registration()
      const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0),
      )
      let subscription = await worker.pushManager.getSubscription()
      const oldKey = subscription?.options.applicationServerKey
      if (subscription && oldKey && !new Uint8Array(oldKey).every((byte, i) => byte === bytes[i])) {
        await subscription.unsubscribe()
        subscription = null
      }
      subscription ||= await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      })
      await request('POST', subscription.toJSON())
      setEnabled(true)
      setMessage('Notifications enabled on this device.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="crm-notice crm-notifications">
      <summary>Notifications {enabled ? 'on' : 'off'}</summary>
      <p className="mt-2 text-sm">
        New leads, brochure opens and follow-up reminders on this device.
      </p>
      {automaticReminders !== null && (
        <label className="flex items-start gap-2 mt-3 text-sm">
          <input
            type="checkbox"
            checked={automaticReminders}
            disabled={busy}
            onChange={async (event) => {
              const checked = event.target.checked
              setBusy(true)
              try {
                await request('PATCH', { automaticReminders: checked })
                setAutomaticReminders(checked)
                setMessage(
                  checked
                    ? 'Automatic reminders enabled for new leads.'
                    : 'Automatic reminders disabled. Your manual reminders are unchanged.',
                )
              } catch (error) {
                setMessage((error as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          />
          Automatic reminders at 30 minutes and 2 hours while a new lead is Uncontacted.
        </label>
      )}
      <div className="flex flex-wrap gap-3 mt-3">
        {supported && !enabled && (
          <button className="crm-button" disabled={busy || !key} onClick={enable}>
            Enable notifications
          </button>
        )}
        {enabled && (
          <>
            <button
              className="crm-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const subscription = await (await registration()).pushManager.getSubscription()
                  if (!subscription) throw Error('Enable notifications again.')
                  await request('POST', { endpoint: subscription.endpoint, test: true })
                  setMessage('Test sent. Check your phone notifications.')
                } catch (error) {
                  setMessage((error as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Send test
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await disableCrmNotifications()
                  setEnabled(false)
                  setMessage('Notifications disabled on this device.')
                } catch (error) {
                  setMessage((error as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Disable
            </button>
          </>
        )}
      </div>
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </details>
  )
}
