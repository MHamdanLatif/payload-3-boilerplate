'use client'
import { useActionState, useState } from 'react'
import { DealFields, type FinanceProject } from './DealFields'
import { saveFinanceEntry } from '@/app/(crm)/finance/entry/actions'
export type EntryField = {
  name: string
  label: string
  type?: string
  value?: string
  required?: boolean
  min?: number
  max?: number
  step?: string
  options?: { value: string; label: string }[]
}
export function EntryForm({
  kind,
  entryKey,
  fields,
  projects,
  initialProject,
  outstanding,
}: {
  kind: string
  entryKey: string
  fields: EntryField[]
  projects?: FinanceProject[]
  initialProject?: string
  outstanding?: number
}) {
  const [state, action, pending] = useActionState(saveFinanceEntry, { error: '' })
  const [amount, setAmount] = useState(String(outstanding ?? ''))
  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="entryKey" value={entryKey} />
      <div className="finance-entry">
        {projects && <DealFields projects={projects} initialProject={initialProject} />}
        {fields.map((f) =>
          f.name === 'nextExpectedDate' && Number(amount) >= Number(outstanding) ? null : f.type ===
            'hidden' ? (
            <input key={f.name} type="hidden" name={f.name} value={f.value} />
          ) : (
            <label key={f.name}>
              {f.label}
              {f.options ? (
                <select
                  aria-label={f.label}
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea name={f.name} defaultValue={f.value} />
              ) : (
                <input
                  name={f.name}
                  type={f.type || 'text'}
                  defaultValue={
                    f.name === 'amount' && outstanding !== undefined ? undefined : f.value
                  }
                  value={f.name === 'amount' && outstanding !== undefined ? amount : undefined}
                  onChange={
                    f.name === 'amount' && outstanding !== undefined
                      ? (e) => setAmount(e.target.value)
                      : undefined
                  }
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                />
              )}
            </label>
          ),
        )}
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      <button className="finance-button" disabled={pending}>
        {pending ? 'Saving…' : 'Save entry'}
      </button>
    </form>
  )
}
