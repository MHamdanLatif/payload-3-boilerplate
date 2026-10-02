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
      <PeriodFilter params={params} />
      <p>{range.label}. Cash uses payment dates; sales use closing dates.</p>
      <MoneyCards
        values={[
          ['Deals closed', k.deals],
          ['Sales value', k.sales],
          ['Commission generated', k.generated],
          ['Commission received', k.received, 'Actual cash in the selected period'],
          ['Outstanding commission', k.outstanding, 'Eligible and unpaid · all time, as of now'],
          ['Expected receivables', k.expected, 'Unpaid scheduled amounts · includes conditional'],
          ['Expenses', k.expenses],
          [
            'Net cash flow',
            Number(k.received) - Number(k.expenses),
            'Actual receipts minus expenses',
          ],
          ['Commission eligible', k.eligible, 'All time, as of now'],
          ['Conditional commission', k.conditional, 'Not yet payable · all time, as of now'],
        ]}
      />
      <h2>Upcoming Receivables</h2>
      <p>
        Earliest unpaid payments, including overdue. Conditional payments still depend on the client
        meeting the commission trigger.
      </p>
      <ScheduleTable rows={upcoming} />
      <Link href="/finance/receivables?period=all">View all receivables</Link>
      <h2>Monthly cash flow forecast</h2>
      <p>
        Unpaid schedules, not cash received. Expected expenses and forecast net are unavailable
        until an expense budget is entered; recurring flags alone do not establish a future budget.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Eligible expected commission</th>
              <th>Conditional expected commission</th>
              <th>Expected expenses</th>
              <th>Forecast net</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td>{rupees(r.eligible)}</td>
                <td>{rupees(r.conditional)}</td>
                <td>Not budgeted</td>
                <td>Not available</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Attention required</h2>
      <div className="finance-alerts">
        {attention.map((d) => (
          <article key={d.id}>
            <Link href={`/finance/deals/${d.id}`}>
              {d.client_name} · {d.project_name}
            </Link>
            <p>
              {d.overdue ? 'Overdue commission schedule. ' : ''}
              {Number(d.conditional) > 0
                ? `Client below trigger (${d.booking_percentage}% paid / ${d.required_booking_percentage ?? '—'}% required); ${rupees(d.conditional)} conditional. `
                : ''}
              {Number(d.outstanding) > 0
                ? `${Number(d.received) > 0 ? 'Partial commission outstanding' : 'Eligible but not received'}: ${rupees(d.outstanding)}. `
                : ''}
              {Number(d.overpayment) > 0
                ? `Overpayment: ${rupees(d.overpayment)}. Review receipts. `
                : ''}
              {d.overscheduled
                ? 'Scheduled amounts exceed the commission. Revise the schedule.'
                : ''}
            </p>
          </article>
        ))}
      </div>
      {!attention.length && <p>No items require attention.</p>}
      <p>
        Showing up to 20 items. Use Deals filters for the full list. Cash flow is movement during a
        period, not a bank balance or a spending limit.
      </p>
    </>
  )
}
