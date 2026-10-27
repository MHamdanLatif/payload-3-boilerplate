import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { participantSummary } from '@/lib/finance-participant'
import { displayDate, paisaRupees, rupees } from '@/lib/finance-query'
import { Badge, MoneyCards } from '@/components/finance/FinanceUI'

export default async function Participant({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id < 1) notFound()
  const exec = await financeExec()
  const s = await participantSummary(exec, id)
  if (!s) notFound()
  const payouts = await exec(sql`SELECT p.*, d.client_name, a.name AS account_name FROM finance_payouts p
    JOIN finance_deals d ON d.id=p.deal_id LEFT JOIN finance_accounts a ON a.id=p.account_id
    WHERE p.participant_id=${id} ORDER BY p.date DESC LIMIT 200`)
  const sum = (rows: { [k: string]: any }[], k: string) => rows.reduce((a, r) => a + Number(r[k] || 0), 0)
  return (
    <>
      <div className="finance-heading">
        <h2>
          {s.person.name} {s.person.is_owner && <Badge>Me</Badge>} {s.person.archived && <Badge>Archived</Badge>}
        </h2>
        <a download href={`/finance/export?kind=participant-report&participant=${id}`}>
          Download participant report (CSV)
        </a>
      </div>
      {s.person.phone && <p>{s.person.phone}</p>}
      <p>Funding balances and commission are separate. A funding shortfall is never offset against commission.</p>
      <h2>Project funding</h2>
      <MoneyCards
        values={[
          ['Contributions received', sum(s.funding, 'receivedPaisa') / 100],
          ['Allocated funding expenses', sum(s.funding, 'costPaisa') / 100],
          ['Funding refunds', sum(s.funding, 'refundPaisa') / 100],
        ]}
      />
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Project', 'Funding %', 'Received', 'Allocated costs', 'Refunds', 'Adjustments', 'Balance', 'Backed by project cash'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.funding.map((f) => (
              <tr key={f.project}>
                <td>
                  <Link href={`/finance/projects/${f.project}`}>{f.title}</Link>
                </td>
                <td>{f.fundingPercent == null ? '—' : `${f.fundingPercent}%`}</td>
                <td>{paisaRupees(f.receivedPaisa)}</td>
                <td>{paisaRupees(f.costPaisa)}</td>
                <td>{paisaRupees(f.refundPaisa)}</td>
                <td>{paisaRupees(f.adjustmentPaisa)}</td>
                <td>
                  {paisaRupees(f.balancePaisa)} {f.shortfall && <Badge tone="alert">Shortfall</Badge>}
                </td>
                <td>{paisaRupees(f.backedPaisa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!s.funding.length && <p>No project funding.</p>}
      </div>
      <h2>Commission</h2>
      <MoneyCards
        values={[
          ['Commission earned from receipts', sum(s.commission, 'entitlementPaisa') / 100, 'Entitlement on commission received so far'],
          ['Commission paid', sum(s.commission, 'paidPaisa') / 100],
          ['Commission unpaid', sum(s.commission, 'unpaidPaisa') / 100, 'Owed, not yet paid out'],
        ]}
      />
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Deal', 'Project', 'Entitlement', 'Paid', 'Unpaid', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.commission.map((c) => (
              <tr key={c.deal}>
                <td>
                  <Link href={`/finance/deals/${c.deal}`}>{c.client}</Link> {c.cancelled && <Badge>Cancelled</Badge>}
                </td>
                <td>{c.project}</td>
                <td>{paisaRupees(c.entitlementPaisa)}</td>
                <td>{paisaRupees(c.paidPaisa)}</td>
                <td>{paisaRupees(c.unpaidPaisa)}</td>
                <td>
                  {c.overpaidPaisa > 0 && <Badge tone="alert">Overpaid {paisaRupees(c.overpaidPaisa)}</Badge>}
                  {c.unpaidPaisa > 0 && c.recipientKeys.length === 1 && (
                    <Link href={`/finance/new/payout?deal=${c.deal}&recipient=${c.recipientKeys[0]}`}>Record payout</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!s.commission.length && <p>Not a commission recipient on any deal.</p>}
      </div>
      <h2>Payouts</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Date', 'Deal', 'Amount', 'Account', 'Method / reference', 'Status'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td>{displayDate(p.date)}</td>
                <td>{p.client_name}</td>
                <td>{rupees(p.amount)}</td>
                <td>{p.account_name}</td>
                <td>
                  {p.payment_method} {p.reference}
                </td>
                <td>{p.voided ? 'Voided' : 'Paid'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payouts.length && <p>No payouts.</p>}
      </div>
    </>
  )
}
