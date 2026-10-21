'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DeviceSignOut({ id, name }: { id: number; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <>
      <button
        className="crm-button secondary"
        disabled={busy}
        aria-label={`Sign out ${name}`}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            const res = await fetch('/api/crm/devices', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw Error(data.error || 'Could not sign that device out.')
            if (data.current) window.location.assign('/leads-dashboard/login')
            else router.refresh()
          } catch (e) {
            setError((e as Error).message)
            setBusy(false)
          }
        }}
      >
        {busy ? 'Signing out...' : 'Sign out'}
      </button>
      {error && (
        <p role="alert" className="crm-error">
          {error}
        </p>
      )}
    </>
  )
}
