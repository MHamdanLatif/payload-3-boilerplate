import { RemoveEntry } from '@/components/finance/RemoveEntry'
import { pageNumber } from '@/lib/finance-query'
import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeQuery } from '@/lib/finance-server'
import {
  dateWhere,
  period,
  param,
  rupees,
  displayDate,
  type FinanceParams,
} from '@/lib/finance-query'
import { Pager, PeriodFilter } from '@/components/finance/FinanceUI'
export default async function Receipts({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams,
    page = pageNumber(p)
  const rows = await financeQuery(
    sql`SELECT r.*,d.client_name,d.project_name,count(*) OVER() AS total_count FROM finance_receipts r JOIN deals d ON d.id=r.deal_id WHERE ${dateWhere('r.date', period(p))} ORDER BY r.date DESC,r.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`,
  )
  return (
    <>
      <h2>Commission payments</h2>
      <PeriodFilter params={p} />
      <p>
        Actual transactions by receipt date. Voided payments are retained here and excluded from
        cash totals.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              <th>Date received</th>
              <th>Client / project</th>
              <th>Amount</th>
              <th>Payment method</th>
              <th>Reference / builder</th>
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
                <td>{rupees(r.amount)}</td>
                <td>{r.payment_method}</td>
                <td>
                  {r.reference} {r.received_from}
                </td>
                <td>{r.voided ? 'Voided' : 'Posted'}</td>
                <td>
                  <Link href={`/admin/collections/finance-receipts/${r.id}`}>Notes / void</Link>
                  <RemoveEntry kind="receipts" id={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No payments recorded for this period.</p>}
      </div>
      <Pager params={p} page={page} total={Number(rows[0]?.total_count || 0)} />
      <a download href="/finance/export?kind=receipts">
        Export all commission receipts (CSV)
      </a>
    </>
  )
}
