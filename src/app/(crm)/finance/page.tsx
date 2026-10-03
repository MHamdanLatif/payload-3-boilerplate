import Link from 'next/link'
import { overview } from '@/lib/finance-server'
import { rupees, type FinanceParams } from '@/lib/finance-query'
import { MoneyCards, PeriodFilter, ScheduleTable } from '@/components/finance/FinanceUI'

export default async function FinanceOverview({
  searchParams,
}: {
  searchParams: Promise<FinanceParams>
}) {
  const params = await searchParams
  const { kpis: k, upcoming, attention, forecast, range } = await overview(params)
  return (
    <>
      <p>Record a closed deal, then add commission payments and expenses as they happen.</p>
      <PeriodFilter params={params} />
      <p>{range.label}. Sales use closing dates; payments and expenses use payment dates.</p>
      <MoneyCards
        values={[
          ['Deals closed', k.deals],
          ['Sales value', k.sales],
          ['Commission generated', k.generated],
          ['Commission received', k.received],
          ['Outstanding commission', k.outstanding, 'Total still owed across all dates'],
          ['Expected receivables', k.expected, 'Remaining commission expected in this period'],
          ['Expenses', k.expenses],
          [
            'Net cash flow',
            Number(k.received) - Number(k.expenses),
            'Payments received minus expenses',
          ],
        ]}
      />
      <h2>Upcoming payments</h2>
      <ScheduleTable rows={upcoming} />
      <Link href="/finance/receivables?period=all">View all receivables</Link>
      <h2>Monthly receivables</h2>
      <p>Unpaid commission grouped by its next expected payment date.</p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Expected commission</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td>{rupees(r.expected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {attention.length > 0 && (
        <>
          <h2>Needs attention</h2>
          <div className="finance-alerts">
            {attention.map((d) => (
              <article key={d.id}>
                <Link href={`/finance/deals/${d.id}`}>
                  {d.client_name} · {d.project_name}
                </Link>
                <p>
                  {d.overdue ? `Payment overdue: ${rupees(d.outstanding)}. ` : ''}
                  {!d.expected_payment_date && Number(d.outstanding) > 0
                    ? 'Choose an expected payment date. '
                    : ''}
                  {Number(d.overpayment) > 0
                    ? `Receipts exceed commission by ${rupees(d.overpayment)}.`
                    : ''}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}
