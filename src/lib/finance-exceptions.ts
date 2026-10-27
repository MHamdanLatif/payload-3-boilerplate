import { sql } from '@payloadcms/db-postgres'
import { allProjectPositions, cashPurpose, dealPosition, type Exec } from './finance-ledger'
import { paisaRupees } from './finance-query'

export type FinanceException = { href: string; title: string; detail: string }

/** Things that need correcting or classifying, for the Finance overview. */
export async function financeExceptions(exec: Exec): Promise<FinanceException[]> {
  const [projects, charges, unsplit, distributed, purpose] = await Promise.all([
    allProjectPositions(exec),
    exec(sql`SELECT id, date, review_flags FROM finance_ad_charges WHERE review_flags IS NOT NULL AND NOT COALESCE(voided,false) ORDER BY date DESC LIMIT 20`),
    exec(sql`SELECT d.id, d.client_name FROM finance_deals d WHERE NOT COALESCE(d.cancelled,false)
      AND NOT EXISTS (SELECT 1 FROM finance_deals_commission_split s WHERE s._parent_id=d.id) ORDER BY d.date_closed DESC LIMIT 20`),
    exec(sql`SELECT DISTINCT deal_id FROM (SELECT deal_id FROM finance_payouts WHERE NOT COALESCE(voided,false)
      UNION SELECT deal_id FROM finance_expenses WHERE pre_distribution AND NOT COALESCE(voided,false)) x WHERE deal_id IS NOT NULL`),
    cashPurpose(exec),
  ])
  const out: FinanceException[] = []
  for (const p of projects) {
    const title = p.rules?.title || `Project #${p.project}`
    if (p.deficitPaisa > 0)
      out.push({ href: `/finance/projects/${p.project}`, title: `${title}: project deficit`, detail: `Spending exceeds this project's funding by ${paisaRupees(p.deficitPaisa)}. It needs funding; other projects' money does not cover it.` })
    for (const x of p.participants.filter((x) => x.shortfall))
      out.push({ href: `/finance/projects/${p.project}`, title: `${title}: ${x.label} owes a top-up`, detail: `Funding shortfall of ${paisaRupees(-x.balancePaisa)}.` })
  }
  for (const c of charges)
    out.push({ href: '/finance/ad-charges?period=all', title: 'Advertising charge needs checking', detail: String(c.review_flags).split('\n')[0] })
  for (const d of distributed) {
    const pos = await dealPosition(exec, Number(d.deal_id))
    if (pos && pos.overpaidPaisa > 0)
      out.push({ href: `/finance/deals/${d.deal_id}`, title: `${pos.deal.client_name}: commission overpaid`, detail: `Payouts exceed entitlements by ${paisaRupees(pos.overpaidPaisa)}.` })
    if (pos && pos.deductionShortfallPaisa > 0)
      out.push({ href: `/finance/deals/${d.deal_id}`, title: `${pos.deal.client_name}: deductions exceed receipts`, detail: `Short by ${paisaRupees(pos.deductionShortfallPaisa)}.` })
  }
  for (const d of unsplit)
    out.push({ href: `/finance/new/deal-split?deal=${d.id}`, title: `${d.client_name}: commission split not set`, detail: 'Choose project default, referral or custom.' })
  if (purpose.unclassifiedOpeningPaisa !== 0)
    out.push({ href: '/finance/accounts', title: 'Opening balance not fully classified', detail: `${paisaRupees(purpose.unclassifiedOpeningPaisa)} is not yet assigned to a purpose.` })
  if (purpose.unassignedReceiptsPaisa || purpose.unassignedExpensesPaisa)
    out.push({ href: '/finance/accounts', title: 'Older entries without an account', detail: `${paisaRupees(purpose.unassignedReceiptsPaisa)} of receipts and ${paisaRupees(purpose.unassignedExpensesPaisa)} of expenses are not in any recorded account balance.` })
  return out
}
