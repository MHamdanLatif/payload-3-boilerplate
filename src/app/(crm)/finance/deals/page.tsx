import { FinanceTabs } from '@/components/finance/FinanceNav'
import { DEAL_TABS } from '@/lib/finance-nav'
import Link from 'next/link'
import { dealRows, financeSession } from '@/lib/finance-server'
import { displayDate, rupees, param, type FinanceParams } from '@/lib/finance-query'
import { Badge, Pager, PeriodFilter } from '@/components/finance/FinanceUI'

export default async function Deals({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams
  const { rows, page, total } = await dealRows(p)
  const { payload, user } = await financeSession()
  const [projects, users] = await Promise.all([
    payload.find({
      collection: 'featured-projects',
      depth: 0,
      limit: 1000,
      select: { title: true },
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'users',
      depth: 0,
      limit: 1000,
      select: { name: true },
      overrideAccess: false,
      user,
    }),
  ])
  return (
    <>
      <div className="finance-heading">
        <h1>Deals</h1>
        <Link className="finance-button" href="/finance/entry/deals">
          + Add Deal
        </Link>
      </div>
      <FinanceTabs tabs={DEAL_TABS} />
      <details className="finance-more" open={Boolean(param(p, 'q') || param(p, 'project') || param(p, 'status') || param(p, 'period'))}>
        <summary>Search and filter</summary>
        <PeriodFilter params={p} fallback="all" />
      <form className="finance-filters">
        {['period', 'month', 'from', 'to'].map((k) => (
          <input key={k} type="hidden" name={k} value={param(p, k)} />
        ))}
        <label>
          Search client, phone or unit
          <input name="q" defaultValue={param(p, 'q')} />
        </label>
        <label>
          Project
          <select name="project" defaultValue={param(p, 'project')}>
            <option value="">All properties</option>
            <option value="other">Other properties / brokerage</option>
            {projects.docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={param(p, 'status')}>
            <option value="">All statuses</option>
            {['Awaiting Payment', 'Partially Received', 'Fully Received', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Salesperson
          <select name="salesperson" defaultValue={param(p, 'salesperson')}>
            <option value="">Everyone</option>
            {users.docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expected receipt month
          <input type="month" name="expectedMonth" defaultValue={param(p, 'expectedMonth')} />
        </label>
        <label>
          Balance
          <select name="balance" defaultValue={param(p, 'balance')}>
            <option value="">All</option>
            <option value="paid">Fully paid</option>
            <option value="outstanding">Outstanding</option>
          </select>
        </label>
        <label>
          Overdue
          <select name="overdue" defaultValue={param(p, 'overdue')}>
            <option value="">All</option>
            <option value="yes">Overdue only</option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={param(p, 'sort')}>
            <option value="date">Date closed</option>
            <option value="sale">Sale value</option>
            <option value="commission">Commission</option>
            <option value="outstanding">Outstanding</option>
            <option value="expected">Expected receipt date</option>
          </select>
        </label>
        <button className="finance-button">Filter deals</button>
      </form>
      </details>
      <div className="finance-list">
        {rows.map((d) => {
          const pct = Number(d.commission) > 0 ? Math.min(100, (Number(d.received) / Number(d.commission)) * 100) : 0
          return (
            <Link key={d.id} className="finance-item" href={`/finance/deals/${d.id}`}>
              <div className="finance-row">
                <h3>{d.client_name}</h3>
                <Badge>{d.status}</Badge>
              </div>
              <p>
                {d.project_name}
                {d.unit_type ? ` · ${d.unit_type}` : ''}
                {d.unit_number ? ` · ${d.unit_number}` : ''} · closed {displayDate(d.date_closed)}
              </p>
              <div className="finance-progress" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="finance-row">
                <span>
                  {rupees(d.received)} of {rupees(d.commission)} received
                </span>
                {Number(d.outstanding) > 0 && (
                  <span className="finance-amount">
                    {rupees(d.outstanding)} to come{d.next_payment ? ` · ${displayDate(d.next_payment)}` : ''}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
      {!rows.length && <p>No deals match these filters.</p>}
      <Pager params={p} page={page} total={total} />
      <a download href="/finance/export?kind=deals">
        Export all deals (CSV)
      </a>
    </>
  )
}
