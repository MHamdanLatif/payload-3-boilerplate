'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function pakistanInput(value?: string | null) {
  return value
    ? new Date(new Date(value).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16)
    : ''
}

export function LeadFollowUp({
  id,
  notes,
  reminder,
  sentAt,
  status,
  configured,
}: {
  id: number
  notes?: string | null
  reminder?: string | null
  sentAt?: string | null
  status?: string | null
  configured: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState(notes || '')
  const [enabled, setEnabled] = useState(Boolean(reminder))
  const [date, setDate] = useState(pakistanInput(reminder))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const field = 'mt-1 w-full rounded-md border border-brand-deep/20 bg-white px-3 py-2 text-sm'

  return (
    <section className="mt-8 rounded-xl border border-brand-deep/10 bg-white p-5 text-brand-deep">
      <h2 className="font-serif text-xl">Client notes & follow-up</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setMessage('')
          const changed =
            enabled !== Boolean(reminder) || (enabled && date !== pakistanInput(reminder))
          const next = enabled && date ? new Date(`${date}:00+05:00`) : null
          if (
            enabled &&
            (!next || !Number.isFinite(next.getTime()) || (changed && next.getTime() <= Date.now()))
          ) {
            setMessage('Choose a future date and time for the reminder.')
            return
          }
          setBusy(true)
          try {
            const response = await fetch(`/api/leads/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationNotes: text,
                ...(changed ? { followUpAt: next?.toISOString() ?? null } : {}),
              }),
            })
            if (!response.ok) {
              const body = await response.json().catch(() => null)
              throw new Error(
                body?.errors?.[0]?.data?.errors?.[0]?.message ||
                  'Could not save. Please try again.',
              )
            }
            setMessage('Saved.')
            router.refresh()
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save. Please try again.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-sm">
          Conversation notes
          <textarea
            className={field}
            rows={6}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add dated pointers: what you discussed, client preferences, and next steps."
          />
        </label>
        <label className="block text-sm">
          Follow-up reminder
          <select
            className={field}
            value={enabled ? 'scheduled' : 'none'}
            disabled={busy}
            onChange={(e) => {
              setEnabled(e.target.value === 'scheduled')
              setMessage('')
            }}
          >
            <option value="none">No reminder</option>
            <option value="scheduled">Set a reminder</option>
          </select>
        </label>
        {enabled && (
          <label className="block text-sm">
            Reminder date and time (PKT, UTC+5)
            <input
              type="datetime-local"
              required
              className={field}
              value={date}
              disabled={busy}
              onChange={(e) => {
                setDate(e.target.value)
                setMessage('')
              }}
            />
          </label>
        )}
        <p className="text-xs text-brand-deep/60">
          Save to apply changes. Reminders arrive through ntfy and open this client record.
        </p>
        {!configured && (
          <p className="text-sm text-amber-800">
            ntfy is not configured. Reminders can be saved, but notifications will only send after
            NTFY_TOPIC is configured on the server.
          </p>
        )}
        {reminder && <p className="text-sm">Delivery: {sentAt ? 'Sent' : status || 'Pending'}</p>}
        <button
          disabled={busy}
          className="rounded-full bg-brand-deep px-5 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save notes & reminder'}
        </button>
        <p role="status" className="text-sm" aria-live="polite">
          {message}
        </p>
      </form>
    </section>
  )
}
