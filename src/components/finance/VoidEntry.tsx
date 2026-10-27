'use client'
import { useActionState, useRef } from 'react'
import { saveLedgerEntry } from '@/app/(crm)/finance/entry/ledger-actions'

/** Void a posted entry with a written reason. The row stays in the ledger, excluded from totals. */
export function VoidEntry({ collection, id, next }: { collection: string; id: number; next: string }) {
  const [state, action, pending] = useActionState(saveLedgerEntry, { error: '' })
  const reason = useRef<HTMLInputElement>(null)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const answer = window.prompt('Why is this entry being voided? It stays in the ledger but stops counting.')
        if (!answer?.trim()) return e.preventDefault()
        if (reason.current) reason.current.value = answer.trim()
      }}
    >
      <input type="hidden" name="kind" value="void" />
      <input type="hidden" name="entryKey" value="00000000-0000-0000-0000-000000000000" />
      <input type="hidden" name="collection" value={collection} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="voidReason" ref={reason} />
      <button className="finance-button secondary" disabled={pending}>
        {pending ? 'Voiding…' : 'Void'}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
