'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export type ProjectOption = { id: number; title: string }
type Duplicate = { id: number; name: string; project: string | null; createdAt: string }
export function ManualLeadForm({ projects }: { projects: ProjectOption[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const router = useRouter()
  return (
    <form
      className="crm-panel crm-stack"
      onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        setBusy(true)
        const values = Object.fromEntries(new FormData(event.currentTarget))
        const confirmDuplicate = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'confirm'
        try {
          const result = await fetch('/api/crm/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, confirmDuplicate }),
          })
          const data = await result.json()
          if (result.status === 409 && data.duplicates) {
            setDuplicates(data.duplicates)
            return
          }
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
      {duplicates.length > 0 && (
        <div role="alert" className="crm-panel">
          <p>
            <strong>This number already has {duplicates.length === 1 ? 'an enquiry' : `${duplicates.length} enquiries`}.</strong>{' '}
            Matched by phone number only. Open the existing record, or add this as a new enquiry (for example, for another project).
          </p>
          <ul className="mt-2">
            {duplicates.map((d) => (
              <li key={d.id}>
                <a className="underline" href={'/leads-dashboard/' + d.id} target="_blank" rel="noopener noreferrer">
                  {d.name}
                </a>{' '}
                · {d.project || 'No project'} · {new Date(d.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' })}
              </li>
            ))}
          </ul>
          <button className="crm-button secondary mt-3" name="duplicate" value="confirm" disabled={busy}>
            Add as a new enquiry anyway
          </button>
        </div>
      )}
      <button className="crm-button" disabled={busy || !projects.length}>
        {busy ? 'Adding lead...' : 'Add lead'}
      </button>
    </form>
  )
}
