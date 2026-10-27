'use client'
import { useActionState, useState } from 'react'
import { saveLedgerEntry } from '@/app/(crm)/finance/entry/ledger-actions'
import type { Option } from './LedgerForm'

const METHODS = ['Bank transfer', 'Cheque', 'Cash', 'Withdrawal to my account']

/**
 * Commission received from the builder, in one step. If the money has already been
 * withdrawn or paid out, the payouts are recorded at the same time.
 */
export function CommissionForm({
  deal,
  entryKey,
  outstanding,
  today,
  accounts,
  needsSplit,
  hasProjectDefault,
  hasOwner,
  recipients,
}: {
  deal: number
  entryKey: string
  outstanding: number
  today: string
  accounts: Option[]
  needsSplit: boolean
  hasProjectDefault: boolean
  hasOwner: boolean
  recipients: string[]
}) {
  const [state, action, pending] = useActionState(saveLedgerEntry, { error: '' })
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '')
  const [afterwards, setAfterwards] = useState('kept')
  const [split, setSplit] = useState(hasProjectDefault ? 'default' : hasOwner ? 'mine' : 'later')
  const partial = Number(amount) > 0 && Number(amount) < outstanding
  return (
    <form action={action} className="finance-form">
      <input type="hidden" name="kind" value="commission" />
      <input type="hidden" name="entryKey" value={entryKey} />
      <input type="hidden" name="deal" value={deal} />
      <div className="finance-entry">
        <label>
          Amount (PKR)
          <input name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Payment date (PKT)
          <input name="date" type="date" required defaultValue={today} />
        </label>
        {partial && (
          <div>
            <label>
              Next expected payment date
              <input name="nextExpectedDate" type="date" required aria-describedby="remaining-hint" />
            </label>
            <small id="remaining-hint">
              When the remaining {(outstanding - Number(amount)).toLocaleString('en-PK')} is expected.
            </small>
          </div>
        )}
        <label>
          Received into
          <select name="account" defaultValue={accounts.length === 1 ? accounts[0].value : ''}>
            <option value="">{accounts.length ? 'Choose account' : 'No account set up yet'}</option>
            {accounts.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {needsSplit && (
        <fieldset className="finance-split">
          <legend>Who shares this commission?</legend>
          <div className="finance-choice">
            {hasOwner && (
              <label>
                <input type="radio" name="split" value="mine" checked={split === 'mine'} onChange={() => setSplit('mine')} />
                All mine (100%)
              </label>
            )}
            {hasProjectDefault && (
              <label>
                <input type="radio" name="split" value="default" checked={split === 'default'} onChange={() => setSplit('default')} />
                The project&apos;s usual split
              </label>
            )}
            <label>
              <input type="radio" name="split" value="later" checked={split === 'later'} onChange={() => setSplit('later')} />
              Decide later
            </label>
          </div>
        </fieldset>
      )}
      <fieldset className="finance-split">
        <legend>What happened to the money?</legend>
        <div className="finance-choice">
          <label>
            <input type="radio" name="afterwards" value="kept" checked={afterwards === 'kept'} onChange={() => setAfterwards('kept')} />
            It is still in the account
          </label>
          <label>
            <input type="radio" name="afterwards" value="paid" checked={afterwards === 'paid'} onChange={() => setAfterwards('paid')} />
            Already withdrawn / paid out{recipients.length ? ` to ${recipients.join(', ')}` : ''}
          </label>
        </div>
        {afterwards === 'paid' && (
          <div className="finance-entry">
            <label>
              Paid out on (PKT)
              <input name="payoutDate" type="date" defaultValue={today} required />
            </label>
            <label>
              How
              <select name="payoutMethod" defaultValue="Withdrawal to my account">
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>
      <details className="finance-more">
        <summary>More options (reference, notes, proof)</summary>
        <div className="finance-entry">
          <label>
            Paid by (method)
            <select name="paymentMethod" defaultValue="">
              <option value="">Not recorded</option>
              {METHODS.slice(0, 3).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Payment reference (optional)
            <input name="reference" />
          </label>
          <label>
            Notes (optional)
            <textarea name="notes" />
          </label>
          <label>
            Proof (optional, PDF or image)
            <input type="file" name="files" multiple accept="application/pdf,image/*" />
          </label>
        </div>
      </details>
      {state.error && <p role="alert">{state.error}</p>}
      <button className="finance-button" disabled={pending}>
        {pending ? 'Saving…' : 'Save entry'}
      </button>
    </form>
  )
}
