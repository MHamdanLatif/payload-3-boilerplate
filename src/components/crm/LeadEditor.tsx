'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { statusOptions } from '@/lib/lead-status'
import type { Lead } from '@/payload-types'
import type { ProjectOption } from './LeadForm'
type Editable = Pick<
  Lead,
  | 'id'
  | 'name'
  | 'phone'
  | 'email'
  | 'status'
  | 'currentInterestedProject'
  | 'closedProject'
  | 'interestedUnitType'
  | 'unqualifiedReason'
>
const relation = (value: Editable['closedProject']) =>
  typeof value === 'object' ? (value?.id ?? '') : (value ?? '')
export function LeadEditor({ lead, projects }: { lead: Editable; projects: ProjectOption[] }) {
  const router = useRouter()
  const [status, setStatus] = useState(lead.status || 'unqualified')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  useEffect(() => {
    setStatus(lead.status || 'unqualified')
  }, [lead.status])
  const save = async (data: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      const result = await fetch('/api/crm/leads/' + lead.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await result.json()
      if (!result.ok) throw Error(body.error || 'Could not save.')
      setSaved('Changes saved.')
      router.refresh()
      return true
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check your connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="crm-status">
        <div className="crm-row">
          <label className="crm-label flex-1">
            Lead status
            <select
              aria-label="Lead status"
              className="crm-field"
              value={status}
              disabled={busy}
              onChange={async (event) => {
                const next = event.target.value as typeof status
                if (await save({ status: next })) setStatus(next)
              }}
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <a
            href="#lead-details"
            className="crm-button secondary mt-5"
            onClick={() => {
              const details = document.getElementById('lead-details')
              if (details instanceof HTMLDetailsElement) details.open = true
            }}
          >
            Edit details
          </a>
        </div>
        {error && (
          <p role="alert" className="crm-error mt-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="crm-success mt-2" aria-live="polite">
            {saved}
          </p>
        )}
      </div>
      <details id="lead-details" className="crm-panel crm-details scroll-mt-44">
        <summary>Contact & project details</summary>
        <form
          className="crm-stack"
          onSubmit={async (event) => {
            event.preventDefault()
            await save(Object.fromEntries(new FormData(event.currentTarget)))
          }}
        >
          <div className="crm-grid">
            <label className="crm-label">
              Name
              <input
                className="crm-field"
                name="name"
                defaultValue={lead.name}
                required
                maxLength={120}
              />
            </label>
            <label className="crm-label">
              Phone
              <input
                className="crm-field"
                name="phone"
                type="tel"
                defaultValue={lead.phone}
                required
              />
            </label>
          </div>
          <label className="crm-label">
            Email (optional)
            <input
              className="crm-field"
              name="email"
              type="email"
              defaultValue={lead.email || ''}
            />
          </label>
          <label className="crm-label">
            Project interested in
            <select
              aria-label="Project interested in"
              className="crm-field"
              name="currentInterestedProject"
              defaultValue={relation(lead.currentInterestedProject)}
            >
              <option value="">Not decided</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-label">
            Closed on project
            <select
              aria-label="Closed on project"
              className="crm-field"
              name="closedProject"
              defaultValue={relation(lead.closedProject)}
            >
              <option value="">Other property / not selected</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-label">
            Interested in unit
            <input
              className="crm-field"
              name="interestedUnitType"
              defaultValue={lead.interestedUnitType || ''}
              placeholder="e.g. 3 Bed Drawing"
            />
          </label>
          <label className="crm-label">
            Reason not proceeding (optional)
            <textarea
              className="crm-field"
              name="unqualifiedReason"
              defaultValue={lead.unqualifiedReason || ''}
              rows={2}
            />
          </label>
          <button className="crm-button" disabled={busy}>
            {busy ? 'Saving...' : 'Save lead details'}
          </button>
        </form>
      </details>
    </>
  )
}
