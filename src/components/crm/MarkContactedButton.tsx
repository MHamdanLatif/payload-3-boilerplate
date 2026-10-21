'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Handles a follow-up: clears its reminder and moves an early-stage lead to Contacted.
export function MarkContactedButton({
  id,
  className,
  onDone,
}: {
  id: number
  className?: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            const res = await fetch(`/api/leads/${id}/mark-contacted`, { method: 'POST' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw Error(data.error || 'Could not update the lead. Try again.')
            onDone?.()
            router.refresh()
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Saving…' : 'Mark contacted'}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </>
  )
}
