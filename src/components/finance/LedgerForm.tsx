'use client'
import { useActionState, useMemo, useState } from 'react'
import { saveLedgerEntry } from '@/app/(crm)/finance/entry/ledger-actions'
import { allocateCharge, FULL_SPLIT, PCT_SCALE, toPaisa, toPctUnits } from '@/lib/finance-math'
import type { EntryField } from './EntryForm'

export type Option = { value: string; label: string }

/** Generic posting form for the funding/distribution ledger. Children add custom inputs. */
export function LedgerForm({
  kind,
  entryKey,
  fields,
  hidden = {},
  files = false,
  submit = 'Save entry',
  confirm,
  children,
}: {
  kind: string
  entryKey: string
  fields: EntryField[]
  hidden?: Record<string, string>
  files?: boolean
  submit?: string
  confirm?: string
  children?: React.ReactNode
}) {
  const [state, action, pending] = useActionState(saveLedgerEntry, { error: '' })
  const renderField = (f: EntryField) =>
    f.type === 'checkbox' ? (
      <label key={f.name} className="finance-check">
        <input type="checkbox" name={f.name} value="true" defaultChecked={f.value === 'true'} />
        {f.label}
      </label>
    ) : (
      <label key={f.name}>
        {f.label}
        {f.options ? (
          <select aria-label={f.label} name={f.name} defaultValue={f.value} required={f.required}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : f.type === 'textarea' ? (
          <textarea name={f.name} defaultValue={f.value} required={f.required} />
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
        {f.hint && <small>{f.hint}</small>}
      </label>
    )
  return (
    <form
      className={fields.length ? 'finance-form' : undefined}
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="entryKey" value={entryKey} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="finance-entry">{fields.filter((f) => !f.advanced).map(renderField)}</div>
      {children}
      {(files || fields.some((f) => f.advanced)) && (
        <details className="finance-more">
          <summary>More options{files ? ' (reference, notes, proof)' : ''}</summary>
          <div className="finance-entry">
            {fields.filter((f) => f.advanced).map(renderField)}
            {files && (
              <label>
                Proof attachments (optional, PDF or image, up to 10 MB each)
                <input type="file" name="files" multiple accept="application/pdf,image/*" />
              </label>
            )}
          </div>
        </details>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      <button className="finance-button" disabled={pending}>
        {pending ? 'Saving…' : submit}
      </button>
    </form>
  )
}

export type SplitRow = { key?: string; participant?: string; recipientName?: string; percent: string; role?: string }

/** Percentage table with a live total. Serialised as JSON into one hidden input. */
export function SplitEditor({
  name,
  label,
  participants,
  initial,
  allowOutside = true,
  showRole = true,
}: {
  name: string
  label: string
  participants: Option[]
  initial: SplitRow[]
  allowOutside?: boolean
  showRole?: boolean
}) {
  const [rows, setRows] = useState<SplitRow[]>(initial.length ? initial : [{ percent: '' }])
  const set = (i: number, patch: Partial<SplitRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  let total = 0,
    valid = true
  for (const r of rows)
    try {
      total += toPctUnits(r.percent)
    } catch {
      valid = false
    }
  const ok = valid && total === FULL_SPLIT
  return (
    <fieldset className="finance-split">
      <legend>{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div className="finance-split-row" key={i}>
          <select
            aria-label="Person"
            value={row.participant || (row.recipientName !== undefined ? 'outside' : '')}
            onChange={(e) =>
              set(i, {
                participant: e.target.value === 'outside' ? '' : e.target.value,
                recipientName: e.target.value === 'outside' ? row.recipientName || '' : undefined,
              })
            }
          >
            <option value="">Choose person</option>
            {participants.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            {allowOutside && <option value="outside">Someone outside the register…</option>}
          </select>
          {allowOutside && !row.participant && row.recipientName !== undefined && (
            <input
              aria-label="Name"
              placeholder="Name"
              value={row.recipientName || ''}
              onChange={(e) => set(i, { recipientName: e.target.value })}
            />
          )}
          <input
            aria-label="Percent"
            type="number"
            min="0"
            max="100"
            step="0.0001"
            placeholder="%"
            value={row.percent}
            onChange={(e) => set(i, { percent: e.target.value })}
          />
          {showRole && (
            <input
              aria-label="Role"
              placeholder="Role (e.g. Referrer)"
              value={row.role || ''}
              onChange={(e) => set(i, { role: e.target.value })}
            />
          )}
          <button
            type="button"
            className="finance-button secondary"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            disabled={rows.length === 1}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="finance-button secondary" onClick={() => setRows((r) => [...r, { percent: '' }])}>
        + Add person
      </button>
      <p role="status" className={ok ? '' : 'finance-warning'}>
        Total {valid ? total / PCT_SCALE : '—'}% {ok ? '✓' : '(must be exactly 100%)'}
      </p>
    </fieldset>
  )
}

type ChargeRow = { campaign: string; metaAmount: string; metaReceipt: string }
/** Advertising charge lines with the proportional allocation previewed as you type. */
export function ChargeLines({ campaigns }: { campaigns: Option[] }) {
  const [debit, setDebit] = useState('')
  const [rows, setRows] = useState<ChargeRow[]>([{ campaign: '', metaAmount: '', metaReceipt: '' }])
  const set = (i: number, patch: Partial<ChargeRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const preview = useMemo(() => {
    try {
      return allocateCharge(
        toPaisa(debit),
        rows.map((r, i) => ({ key: String(i), metaPaisa: toPaisa(r.metaAmount) })),
      )
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Check the amounts.' }
    }
  }, [debit, rows])
  const pkr = (p: number) => `Rs. ${(p / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
  return (
    <fieldset className="finance-split">
      <legend>Bank debit and Meta amounts</legend>
      <label>
        Actual bank debit (PKR)
        <input
          name="bankDebit"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={debit}
          onChange={(e) => setDebit(e.target.value)}
        />
      </label>
      <input type="hidden" name="lines" value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div className="finance-split-row" key={i}>
          <select aria-label="Campaign" required value={row.campaign} onChange={(e) => set(i, { campaign: e.target.value })}>
            <option value="">Choose campaign</option>
            {campaigns.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Meta amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="Meta amount (PKR)"
            required
            value={row.metaAmount}
            onChange={(e) => set(i, { metaAmount: e.target.value })}
          />
          <input
            aria-label="Meta receipt"
            placeholder="Meta receipt (optional)"
            value={row.metaReceipt}
            onChange={(e) => set(i, { metaReceipt: e.target.value })}
          />
          <button
            type="button"
            className="finance-button secondary"
            disabled={rows.length === 1}
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="finance-button secondary"
        onClick={() => setRows((r) => [...r, { campaign: '', metaAmount: '', metaReceipt: '' }])}
      >
        + Add campaign line
      </button>
      {'error' in preview ? (
        <p className="finance-warning">{debit ? preview.error : 'Enter the bank debit to preview the allocation.'}</p>
      ) : (
        <div className="finance-table">
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Meta amount</th>
                <th>Additional bank charges/taxes</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((l, i) => (
                <tr key={l.key}>
                  <td>{campaigns.find((c) => c.value === rows[i].campaign)?.label || `Line ${i + 1}`}</td>
                  <td>{pkr(l.metaPaisa)}</td>
                  <td>{pkr(l.additionalPaisa)}</td>
                  <td>{pkr(l.totalPaisa)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td>{pkr(preview.metaPaisa)}</td>
                <td>{pkr(preview.additionalPaisa)}</td>
                <td>{pkr(preview.debitPaisa)}</td>
              </tr>
            </tbody>
          </table>
          {preview.flags.map((f) => (
            <p key={f} className="finance-warning">
              {f}
            </p>
          ))}
        </div>
      )}
    </fieldset>
  )
}
