'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export type ProjectOption = { id: number; title: string }
export function ManualLeadForm({ projects }: { projects: ProjectOption[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  return (
    <form
      className="crm-panel crm-stack"
      onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        setBusy(true)
        const values = Object.fromEntries(new FormData(event.currentTarget))
        try {
          const result = await fetch('/api/crm/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          })
          const data = await result.json()
          if (!result.ok) throw Error(data.error || 'Could not save lead.')
          router.push('/leads-dashboard/' + data.id)
          router.refresh()
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Check your connection and try again.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="crm-label">
        Name
        <input
          name="name"
          className="crm-field"
          autoComplete="name"
          placeholder="Client name"
          required
          maxLength={120}
        />
      </label>
      <label className="crm-label">
        Phone
        <input
          name="phone"
          type="tel"
          className="crm-field"
          autoComplete="tel"
          placeholder="03XX XXXXXXX"
          required
        />
      </label>
      <label className="crm-label">
        Project interested in
        <select
          aria-label="Project interested in"
          name="project"
          className="crm-field"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Choose a project
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label className="crm-label">
        Source
        <select aria-label="Source" name="source" className="crm-field" defaultValue="whatsapp">
          <option value="whatsapp">WhatsApp</option>
          <option value="call">Call</option>
          <option value="referral">Referral</option>
        </select>
      </label>
      <p className="crm-muted">We will take care of the project details and brochure link.</p>
      {error && (
        <p role="alert" className="crm-error">
          {error}
        </p>
      )}
      <button className="crm-button" disabled={busy || !projects.length}>
        {busy ? 'Adding lead...' : 'Add lead'}
      </button>
    </form>
  )
}
