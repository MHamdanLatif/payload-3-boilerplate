'use client'
import { useActionState } from 'react'
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
}: {
  kind: string
  entryKey: string
  fields: EntryField[]
}) {
  const [state, action, pending] = useActionState(saveFinanceEntry, { error: '' })
  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="entryKey" value={entryKey} />
      <div className="finance-entry">
        {fields.map((f) =>
          f.type === 'hidden' ? (
            <input key={f.name} type="hidden" name={f.name} value={f.value} />
          ) : (
            <label key={f.name}>
              {f.label}
              {f.options ? (
                <select name={f.name} defaultValue={f.value} required={f.required}>
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
                  defaultValue={f.value}
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
