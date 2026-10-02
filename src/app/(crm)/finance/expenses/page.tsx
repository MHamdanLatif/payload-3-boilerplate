import { positiveID } from '@/lib/finance-query'
import { pageNumber } from '@/lib/finance-query'
import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeQuery, financeSession } from '@/lib/finance-server'
import {
  dateWhere,
  period,
  param,
  rupees,
  displayDate,
  type FinanceParams,
} from '@/lib/finance-query'
import { Pager, PeriodFilter, MoneyCards } from '@/components/finance/FinanceUI'
export default async function Expenses({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams,
    page = pageNumber(p),
    project = positiveID(param(p, 'project'))
  const where = sql`${dateWhere('e.date', period(p))} AND (${param(p, 'category')}='' OR e.category=${param(p, 'category')}) AND (${project}=0 OR e.project_id=${project})`
  const rows = await financeQuery(
    sql`SELECT e.*,p.title AS project_name,count(*) OVER() AS total_count FROM finance_expenses e LEFT JOIN featured_projects p ON p.id=e.project_id WHERE ${where} ORDER BY e.date DESC,e.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`,
  )
  const breakdown = await financeQuery(
    sql`SELECT e.category,COALESCE(p.title,'Business overhead') AS project_name,to_char(e.date AT TIME ZONE 'Asia/Karachi','YYYY-MM') AS month,SUM(e.amount) AS total FROM finance_expenses e LEFT JOIN featured_projects p ON p.id=e.project_id WHERE ${where} AND NOT COALESCE(e.voided,false) GROUP BY e.category,p.title,month ORDER BY month DESC,total DESC LIMIT 100`,
  )
  const [totals] = await financeQuery(
    sql`SELECT SUM(e.amount) AS selected, (SELECT SUM(amount) FROM finance_expenses WHERE NOT COALESCE(voided,false) AND ${dateWhere('date', period({}))}) AS current FROM finance_expenses e WHERE ${where} AND NOT COALESCE(e.voided,false)`,
  )
  const { payload, user } = await financeSession(),
    projects = await payload.find({
      collection: 'featured-projects',
      depth: 0,
      limit: 1000,
      select: { title: true },
      overrideAccess: false,
      user,
    })
  return (
    <>
      <h2>Expenses</h2>
      <PeriodFilter params={p} />
      <form className="finance-filters">
        {['period', 'month', 'from', 'to'].map((k) => (
          <input key={k} type="hidden" name={k} value={param(p, k)} />
        ))}
        <label>
          Category
          <input name="category" defaultValue={param(p, 'category')} placeholder="e.g. Meta Ads" />
        </label>
        <label>
          Project
          <select name="project" defaultValue={param(p, 'project')}>
            <option value="">All projects and overhead</option>
            {projects.docs.map((d) => (
              <option value={d.id} key={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <button className="finance-button">Filter expenses</button>
      </form>
      <MoneyCards
        values={[
          ['Expenses this month', totals.current],
          ['Selected expenses', totals.selected],
        ]}
      />
      <h2>Breakdown by category, project and month</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Category</th>
              <th>Project</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r, i) => (
              <tr key={i}>
                <td>{r.month}</td>
                <td>{r.category}</td>
                <td>{r.project_name}</td>
                <td>{rupees(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Up to 100 breakdown groups. Narrow the period for detailed reporting.</p>
      <h2>Expense ledger</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Project</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Recurring</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{displayDate(r.date)}</td>
                <td>{r.category}</td>
                <td>{r.project_name || 'Business overhead'}</td>
                <td>{r.description}</td>
                <td>{rupees(r.amount)}</td>
                <td>{r.recurring ? 'Yes' : 'No'}</td>
                <td>{r.voided ? 'Voided' : 'Posted'}</td>
                <td>
                  <Link href={`/admin/collections/finance-expenses/${r.id}`}>Notes / void</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No expenses in this period.</p>}
      </div>
      <Pager params={p} page={page} total={Number(rows[0]?.total_count || 0)} />
      <a download href="/finance/export?kind=expenses">
        Export all expenses (CSV)
      </a>
    </>
  )
}
