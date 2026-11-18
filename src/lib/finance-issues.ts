import { createHash } from 'node:crypto'
import { financeExceptions, type FinanceException } from './finance-exceptions'
import { financeExec, overview } from './finance-server'
import { rupees } from './finance-query'

export function issueFingerprint(issue: FinanceException) {
  return createHash('sha256').update(JSON.stringify([issue.key, issue.detail])).digest('hex')
}

export async function currentFinanceIssues() {
  const exec = await financeExec()
  const [exceptions, { attention }] = await Promise.all([financeExceptions(exec), overview({})])
  return [
    ...attention.map((d): FinanceException => ({
      key: `deal-attention:${d.id}`,
      href: `/finance/deals/${d.id}`,
      title: `${d.client_name} · ${d.project_name}`,
      detail: [
        d.overdue ? `Payment overdue: ${rupees(d.outstanding)}.` : '',
        !d.expected_payment_date && Number(d.outstanding) > 0 ? 'Choose an expected payment date.' : '',
        Number(d.overpayment) > 0 ? `Receipts exceed commission by ${rupees(d.overpayment)}.` : '',
      ].filter(Boolean).join(' '),
    })),
    ...exceptions,
  ].map((issue) => ({ ...issue, fingerprint: issueFingerprint(issue) }))
}
