'use client'

import { useActionState } from 'react'
import { resolveFinanceIssue, reopenFinanceIssue } from '@/app/(crm)/finance/issue-actions'

export function IssueResolution({ fingerprint, reopen = false }: { fingerprint: string; reopen?: boolean }) {
  const [state, action, pending] = useActionState(reopen ? reopenFinanceIssue : resolveFinanceIssue, { error: '' })
  const form = <form action={action}>
    <input type="hidden" name="fingerprint" value={fingerprint} />
    {!reopen && <label>Resolution note<textarea name="note" required maxLength={2000} placeholder="What went wrong, and how was it resolved?" /></label>}
    {state.error && <p role="alert">{state.error}</p>}
    <button className="finance-button secondary" disabled={pending}>{pending ? 'Saving…' : reopen ? 'Reopen issue' : 'Save resolution'}</button>
  </form>
  return reopen ? form : <details><summary>Mark resolved</summary><p>This clears the reminder without changing recorded balances.</p>{form}</details>
}
