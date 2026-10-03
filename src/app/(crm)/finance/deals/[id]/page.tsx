import { RemoveEntry } from '@/components/finance/RemoveEntry'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { financeQuery } from '@/lib/finance-server'
import { displayDate, rupees } from '@/lib/finance-query'
import { MoneyCards, Badge, ScheduleTable } from '@/components/finance/FinanceUI'

export default async function Deal({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id < 1) notFound()
  const [d] = await financeQuery(sql`SELECT * FROM deals WHERE id=${id}`)
  if (!d) notFound()
  const receipts = await financeQuery(
    sql`SELECT * FROM finance_receipts WHERE deal_id=${id} ORDER BY date DESC,id DESC LIMIT 100`,
  )
  const schedules = await financeQuery(
    sql`SELECT * FROM schedules WHERE deal_id=${id} ORDER BY date,id LIMIT 100`,
  )
  const expenses = await financeQuery(
    sql`SELECT * FROM finance_expenses WHERE deal_id=${id} ORDER BY date DESC,id DESC LIMIT 100`,
  )
  return (
    <>
      <div className="finance-heading">
        <h2>
          {d.client_name} · {d.unit_number}
        </h2>
        <Link href={`/admin/collections/finance-deals/${id}`}>Edit deal</Link>
      </div>
      <Badge>{d.status}</Badge>
      <div className="finance-actions">
        <RemoveEntry kind="deals" id={id} />
        {!d.cancelled && <RemoveEntry kind="deals" id={id} cancel />}
      </div>
      <h2>Sale details</h2>
      <dl>
        {[
          ['Client', d.client_name],
          ['Contact', d.contact],
          ['Project', d.project_name],
          ['Unit', `${d.unit_number} · ${d.unit_type || ''}`],
          ['Sale value', rupees(d.sale_value)],
          ['Date closed', displayDate(d.date_closed)],
          ['Booking amount', rupees(d.booking_amount)],
          ['Expected commission', displayDate(d.expected_payment_date)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {d.lead_id && (
        <p>
          <Link href={`/leads-dashboard/${d.lead_id}`}>Open CRM lead</Link>
        </p>
      )}
      <h2>Commission</h2>
      <MoneyCards
        values={[
          ['Commission generated', d.commission],
          ['Commission received', d.received],
          ['Outstanding commission', d.outstanding],
        ]}
      />
      {Number(d.overpayment) > 0 && (
        <p role="alert">
          Receipts exceed commission by {rupees(d.overpayment)}. Review the ledger.
        </p>
      )}
      <div className="finance-heading">
        <h2>Commission receipts</h2>
        <Link className="finance-button" href={`/finance/entry/receipts?deal=${id}`}>
          + Record Payment
        </Link>
      </div>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              <th>Date received</th>
              <th>Amount</th>
              <th>Method / reference</th>
              <th>Received from</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td>{displayDate(r.date)}</td>
                <td>{rupees(r.amount)}</td>
                <td>
                  {r.payment_method} {r.reference}
                </td>
                <td>{r.received_from}</td>
                <td>{r.voided ? 'Voided' : 'Posted'}</td>
                <td>
                  <Link href={`/admin/collections/finance-receipts/${r.id}`}>Notes / void</Link>
                  <RemoveEntry kind="receipts" id={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!receipts.length && <p>No payments recorded.</p>}
      </div>
      <Link href={`/admin/collections/finance-receipts?where[deal][equals]=${id}`}>
        Full payment history and audit fields
      </Link>
      <div className="finance-heading">
        <h2>Remaining commission</h2>
        <Link className="finance-button" href={`/finance/entry/receivables?deal=${id}`}>
          Change expected date
        </Link>
      </div>
      <ScheduleTable rows={schedules} />
      <p>The unpaid balance moves to the next expected date when you record a partial payment.</p>
      <h2>Deal expenses</h2>
      <Link className="finance-button" href={`/finance/entry/expenses?deal=${id}`}>
        Add deal expense
      </Link>
      {expenses.map((e) => (
        <p key={e.id}>
          {displayDate(e.date)} · {e.description} · {rupees(e.amount)} {e.voided ? '(Voided)' : ''}
        </p>
      ))}
      {!expenses.length && <p>No expenses recorded for this deal.</p>}
      <h2>Notes</h2>
      <pre>{d.notes || 'No notes yet.'}</pre>
      <p>
        Created {displayDate(d.created_at)} by user #{d.created_by_id || '—'} · Updated{' '}
        {displayDate(d.updated_at)} by user #{d.updated_by_id || '—'}
      </p>
    </>
  )
}
