import Link from 'next/link'
import { displayDate, rupees, param, type FinanceParams } from '@/lib/finance-query'

export function PeriodFilter({ params }: { params: FinanceParams }) {
  return (
    <form className="finance-filters">
      <label>
        Period
        <select name="period" defaultValue={param(params, 'period') || 'current'}>
          <option value="current">Current month</option>
          <option value="previous">Previous month</option>
          <option value="month">Custom month</option>
          <option value="range">Custom date range</option>
          <option value="all">All time</option>
        </select>
      </label>
      <label>
        Month
        <input
          aria-label="Custom month"
          type="month"
          name="month"
          defaultValue={param(params, 'month')}
        />
      </label>
      <label>
        From
        <input type="date" name="from" defaultValue={param(params, 'from')} />
      </label>
      <label>
        To
        <input type="date" name="to" defaultValue={param(params, 'to')} />
      </label>
      <button className="finance-button">Apply period</button>
    </form>
  )
}
export function MoneyCards({ values }: { values: [string, unknown, string?][] }) {
  return (
    <div className="finance-cards">
      {values.map(([label, value, hint]) => (
        <div className="finance-card" key={label}>
          <span>{label}</span>
          <strong>{label === 'Deals closed' ? Number(value || 0) : rupees(value)}</strong>
          {hint && <small>{hint}</small>}
        </div>
      ))}
    </div>
  )
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className={`finance-badge ${children === 'Overdue' ? 'overdue' : ''}`}>{children}</span>
  )
}
export function ScheduleTable({ rows }: { rows: Record<string, any>[] }) {
  return (
    <div className="finance-table">
      <table>
        <thead>
          <tr>
            <th>Expected date</th>
            <th>Client / project</th>
            <th>Remaining commission</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{displayDate(r.date)}</td>
              <td>
                <Link href={`/finance/deals/${r.deal_id}`}>{r.client_name}</Link>
                <small>{r.project_name}</small>
              </td>
              <td>{rupees(r.unpaid)}</td>
              <td>
                <Badge>{r.status}</Badge>
              </td>
              <td>
                <Link href={`/finance/entry/receivables?deal=${r.deal_id}`}>Change date</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>No expected payments found.</p>}
    </div>
  )
}
export function Pager({
  params,
  page,
  total,
}: {
  params: FinanceParams
  page: number
  total: number
}) {
  const url = (n: number) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (typeof v === 'string') query.set(k, v)
    })
    query.set('page', String(n))
    return `?${query}`
  }
  return (
    <div className="finance-actions">
      {page > 1 && <Link href={url(page - 1)}>Previous</Link>}
      <span>
        Page {page} · {total} records
      </span>
      {page * 25 < total && <Link href={url(page + 1)}>Next</Link>}
    </div>
  )
}
