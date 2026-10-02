import { pageNumber } from '@/lib/finance-query'
import { sql } from '@payloadcms/db-postgres'
import { financeQuery } from '@/lib/finance-server'
import { dateWhere, period, param, rupees, type FinanceParams } from '@/lib/finance-query'
import { Pager, PeriodFilter } from '@/components/finance/FinanceUI'

export default async function Reports({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams,
    range = period(p),
    page = pageNumber(p)
  const projects = await financeQuery(sql`SELECT p.id,p.title,count(*) OVER() AS total_count,
    (SELECT COUNT(*) FROM deals d WHERE d.project_id=p.id AND NOT COALESCE(d.cancelled,false) AND ${dateWhere('d.date_closed', range)}) AS deals,
    (SELECT COALESCE(SUM(d.sale_value),0) FROM deals d WHERE d.project_id=p.id AND NOT COALESCE(d.cancelled,false) AND ${dateWhere('d.date_closed', range)}) AS sales,
    (SELECT COALESCE(SUM(d.commission),0) FROM deals d WHERE d.project_id=p.id AND NOT COALESCE(d.cancelled,false) AND ${dateWhere('d.date_closed', range)}) AS generated,
    (SELECT COALESCE(SUM(r.amount),0) FROM finance_receipts r JOIN deals d ON d.id=r.deal_id WHERE d.project_id=p.id AND NOT COALESCE(r.voided,false) AND ${dateWhere('r.date', range)}) AS received,
    (SELECT COALESCE(SUM(d.outstanding),0) FROM deals d WHERE d.project_id=p.id) AS outstanding,
    (SELECT COALESCE(SUM(e.amount),0) FROM finance_expenses e WHERE e.project_id=p.id AND NOT COALESCE(e.voided,false) AND ${dateWhere('e.date', range)}) AS expenses
    FROM featured_projects p WHERE EXISTS(SELECT 1 FROM deals d WHERE d.project_id=p.id) OR EXISTS(SELECT 1 FROM finance_expenses e WHERE e.project_id=p.id) ORDER BY p.title,p.id LIMIT 25 OFFSET ${(page - 1) * 25}`)
  const monthly = await financeQuery(sql`SELECT to_char(month,'YYYY-MM') AS month,
    (SELECT COUNT(*) FROM deals d WHERE NOT COALESCE(d.cancelled,false) AND date_trunc('month',d.date_closed AT TIME ZONE 'Asia/Karachi')=month) AS deals,
    (SELECT COALESCE(SUM(d.sale_value),0) FROM deals d WHERE NOT COALESCE(d.cancelled,false) AND date_trunc('month',d.date_closed AT TIME ZONE 'Asia/Karachi')=month) AS sales,
    (SELECT COALESCE(SUM(d.commission),0) FROM deals d WHERE NOT COALESCE(d.cancelled,false) AND date_trunc('month',d.date_closed AT TIME ZONE 'Asia/Karachi')=month) AS generated,
    (SELECT COALESCE(SUM(r.amount),0) FROM finance_receipts r WHERE NOT COALESCE(r.voided,false) AND date_trunc('month',r.date AT TIME ZONE 'Asia/Karachi')=month) AS received,
    (SELECT COALESCE(SUM(e.amount),0) FROM finance_expenses e WHERE NOT COALESCE(e.voided,false) AND date_trunc('month',e.date AT TIME ZONE 'Asia/Karachi')=month) AS expenses,
    (SELECT COALESCE(SUM(s.unpaid),0) FROM schedules s WHERE NOT COALESCE(s.cancelled,false) AND date_trunc('month',s.date AT TIME ZONE 'Asia/Karachi')=month+interval '1 month') AS next_month
    FROM generate_series(date_trunc('month',${range.end || new Date().toISOString().slice(0, 10)}::date)-interval '11 months', date_trunc('month',${range.end || new Date().toISOString().slice(0, 10)}::date),interval '1 month') month ORDER BY month DESC`)
  const [context] = await financeQuery(
    sql`SELECT (SELECT COALESCE(SUM(outstanding),0) FROM deals) AS outstanding,(SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE project_id IS NULL AND NOT COALESCE(voided,false) AND ${dateWhere('date', range)}) AS overhead`,
  )
  return (
    <>
      <h2>Project profitability</h2>
      <PeriodFilter params={p} />
      <p>
        {range.label}. Generated commission less project expenses is a contribution figure; actual
        receipts less expenses is cash. Outstanding is the current all-time balance.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {[
                'Project',
                'Deals closed',
                'Sales value',
                'Generated',
                'Received',
                'Outstanding now',
                'Project expenses',
                'Net commission contribution',
                'Net cash received',
              ].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.deals}</td>
                <td>{rupees(r.sales)}</td>
                <td>{rupees(r.generated)}</td>
                <td>{rupees(r.received)}</td>
                <td>{rupees(r.outstanding)}</td>
                <td>{rupees(r.expenses)}</td>
                <td>{rupees(Number(r.generated) - Number(r.expenses))}</td>
                <td>{rupees(Number(r.received) - Number(r.expenses))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!projects.length && <p>No project finance activity yet.</p>}
      </div>
      <Pager params={p} page={page} total={Number(projects[0]?.total_count || 0)} />
      <p>Business overhead excluded from project contribution: {rupees(context.overhead)}.</p>
      <h2>Business monthly report</h2>
      <p>
        Last 12 months ending at the selected period end. Current unpaid eligible commission:{' '}
        {rupees(context.outstanding)}. Historical eligibility snapshots and opening bank balances
        are not recorded, so historical closing balances are not inferred.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {[
                'Month',
                'Deals closed',
                'Sales value',
                'Generated',
                'Cash received',
                'Expenses paid',
                'Net cash flow',
                'Next month scheduled (still unpaid now)',
              ].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthly.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td>{r.deals}</td>
                <td>{rupees(r.sales)}</td>
                <td>{rupees(r.generated)}</td>
                <td>{rupees(r.received)}</td>
                <td>{rupees(r.expenses)}</td>
                <td>{rupees(Number(r.received) - Number(r.expenses))}</td>
                <td>{rupees(r.next_month)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
