'use client'
import { useActionState } from 'react'
import { removeFinanceEntry } from '@/app/(crm)/finance/entry/actions'

export function RemoveEntry({
  kind,
  id,
  cancel = false,
}: {
  kind: 'deals' | 'receipts' | 'expenses'
  id: number
  cancel?: boolean
}) {
  const [state, action, pending] = useActionState(removeFinanceEntry, { error: '' })
  const label = cancel
    ? 'Cancel deal'
    : kind === 'deals'
      ? 'Delete deal'
      : kind === 'receipts'
        ? 'Delete payment'
        : 'Delete expense'
  const message = cancel
    ? 'Cancel this deal? Future receivables will stop. Existing payments and expenses will stay in your reports.'
    : kind === 'deals'
      ? 'Delete this deal and ALL its recorded payments and deal expenses? Their amounts will be removed from reports. This cannot be undone. To keep payment history, choose Cancel deal instead.'
      : `Delete this ${kind === 'receipts' ? 'payment' : 'expense'}? Totals will be recalculated. This cannot be undone.`
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cancel" value={String(cancel)} />
      <button className="finance-button secondary" disabled={pending}>
        {pending ? 'Saving…' : label}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
