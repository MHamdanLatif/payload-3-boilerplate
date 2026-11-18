import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { overview, financeExec } from '@/lib/finance-server'
import { cashPurpose, dealPosition } from '@/lib/finance-ledger'
import { currentFinanceIssues } from '@/lib/finance-issues'
import { financeSession } from '@/lib/finance-server'
import { IssueResolution } from '@/components/finance/IssueResolution'
import { displayDate, paisaRupees, param, rupees, type FinanceParams } from '@/lib/finance-query'
import { MoneyCards, PeriodFilter } from '@/components/finance/FinanceUI'

export default async function FinanceHome({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const params = await searchParams
  const exec = await financeExec()
  const { payload, user } = await financeSession()
  const resolutions = await payload.find({ collection: 'finance-issue-resolutions', pagination: false, sort: '-createdAt', overrideAccess: false, user })
  const resolved = new Set(resolutions.docs.filter((r) => !r.reopenedAt).map((r) => r.fingerprint))
  const [{ kpis: k, upcoming, range }, exceptions, purpose, splitDeals] = await Promise.all([
    overview(params),
    currentFinanceIssues(),
    cashPurpose(exec),
    exec(sql`SELECT DISTINCT _parent_id AS id FROM finance_deals_commission_split`),
  ])
  const positions = await Promise.all(splitDeals.map((d) => dealPosition(exec, Number(d.id))))
  const owedToPeople = positions.reduce((a, p) => a + (p?.unpaidPaisa || 0), 0)
  const todo = exceptions.filter((x) => !resolved.has(x.fingerprint))
  return (
    <>
      <h1>Finance</h1>
      <div className="finance-cards">
        <div className="finance-card">
          <span>Cash in your accounts</span>
          <strong>{paisaRupees(purpose.recordedPaisa)}</strong>
          <small>As recorded here</small>
        </div>
        <div className="finance-card">
          <span>Outstanding commission</span>
          <strong>{rupees(k.outstanding)}</strong>
          <small>Still to come from builders</small>
        </div>
        <div className="finance-card">
          <span>Owed to people</span>
          <strong>{paisaRupees(owedToPeople)}</strong>
          <small>Commission shares not paid out yet</small>
        </div>
      </div>
      <div className="finance-actions">
        <Link className="finance-button gold" href="/finance/record?for=commission">
          Commission received
        </Link>
        <Link className="finance-button" href="/finance/record?for=payout">
          Pay out / withdraw
        </Link>
        <Link className="finance-button secondary" href="/finance/entry/deals">
          + Add Deal
        </Link>
        <Link className="finance-button secondary" href="/finance/record">
          More…
        </Link>
      </div>

      <h2>To do {todo.length > 0 && <span className="finance-badge overdue">{todo.length}</span>}</h2>
      {todo.length ? (
        <div className="finance-alerts">
          {todo.map((x) => (
            <article key={x.fingerprint}>
              <Link href={x.href}>{x.title}</Link>
              <p>{x.detail}</p>
              <IssueResolution fingerprint={x.fingerprint} />
            </article>
          ))}
        </div>
      ) : (
        <p>Nothing needs attention.</p>
      )}

      {resolutions.docs.length > 0 && <details className="finance-more">
        <summary>Resolution history ({resolutions.docs.length})</summary>
        <div className="finance-alerts">
          {resolutions.docs.map((r) => <article key={r.id}>
            <Link href={r.href}>{r.title}</Link>
            <p>{r.detail}</p>
            <p><strong>Resolution:</strong> {r.note}</p>
            <p>Resolved {displayDate(r.createdAt)} by {r.resolvedBy}</p>
            {r.reopenedAt ? <p>Reopened {displayDate(r.reopenedAt)}</p> : <IssueResolution fingerprint={r.fingerprint} reopen />}
          </article>)}
        </div>
      </details>}

      <h2>Coming in</h2>
      <div className="finance-list">
        {upcoming.map((r) => (
          <Link key={r.id} className="finance-item" href={`/finance/deals/${r.deal_id}`}>
            <div className="finance-row">
              <h3>{r.client_name}</h3>
              <span className="finance-amount">{rupees(r.unpaid)}</span>
            </div>
            <div className="finance-row">
              <span>{r.project_name}</span>
              <span className={`finance-badge ${r.status === 'Overdue' ? 'overdue' : ''}`}>
                {r.status} · {displayDate(r.date)}
              </span>
            </div>
          </Link>
        ))}
        {!upcoming.length && <p>No expected payments found.</p>}
      </div>
      <p>
        <Link href="/finance/receivables?period=all">All expected payments</Link>
      </p>

      <details className="finance-more" open={Boolean(param(params, 'period'))}>
        <summary>Summary for a period ({range.label})</summary>
        <PeriodFilter params={params} />
        <p>Sales use closing dates; payments and expenses use payment dates.</p>
        <MoneyCards
          values={[
            ['Deals closed', k.deals],
            ['Sales value', k.sales],
            ['Commission generated', k.generated],
            ['Commission received', k.received],
            ['Expected receivables', k.expected, 'Remaining commission expected in this period'],
            ['Expenses', k.expenses],
            [
              'Net cash flow',
              Number(k.received) - Number(k.expenses),
              'Commission receipts minus expenses. Not money available to you: see Money for cash by purpose.',
            ],
          ]}
        />
      </details>
    </>
  )
}
