import { pageNumber } from '@/lib/finance-query'
import { sql } from '@payloadcms/db-postgres'
import { financeQuery } from '@/lib/finance-server'
import { dateWhere, period, param, type FinanceParams } from '@/lib/finance-query'
import { Pager, PeriodFilter, ScheduleTable } from '@/components/finance/FinanceUI'

export default async function Receivables({
  searchParams,
}: {
  searchParams: Promise<FinanceParams>
}) {
  const p = await searchParams,
    page = pageNumber(p)
  const rows = await financeQuery(
    sql`SELECT *,count(*) OVER() AS total_count FROM schedules WHERE ${dateWhere('date', period(p))} AND (${param(p, 'status')}='' OR status=${param(p, 'status')}) ORDER BY date,id LIMIT 25 OFFSET ${(page - 1) * 25}`,
  )
  return (
    <>
      <h2>Expected commission</h2>
      <PeriodFilter params={p} />
      <form className="finance-filters">
        <input type="hidden" name="period" value="all" />
        <label>
          Status
          <select name="status" defaultValue={param(p, 'status')}>
            <option value="">All</option>
            {['Expected', 'Due', 'Overdue'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="finance-button">Filter all dates</button>
      </form>
      <ScheduleTable rows={rows} />
      <Pager params={p} page={page} total={Number(rows[0]?.total_count || 0)} />
      <p>
        Remaining commission appears automatically here. Record a payment or change the expected
        date from the deal.
      </p>
      <a download href="/finance/export?kind=receivables">
        Export all receivables (CSV)
      </a>
    </>
  )
}
