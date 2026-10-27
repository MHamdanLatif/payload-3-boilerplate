import { RemoveEntry } from '@/components/finance/RemoveEntry'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { financeExec, financeQuery } from '@/lib/finance-server'
import { dealPosition } from '@/lib/finance-ledger'
import { displayDate, paisaRupees, rupees } from '@/lib/finance-query'
import { VoidEntry } from '@/components/finance/VoidEntry'
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
    sql`SELECT e.*, a.name AS account_name FROM finance_expenses e LEFT JOIN finance_accounts a ON a.id=e.account_id WHERE e.deal_id=${id} ORDER BY e.date DESC,e.id DESC LIMIT 100`,
  )
  const exec = await financeExec()
  const dist = await dealPosition(exec, id)
  const payouts = await exec(
    sql`SELECT p.*, a.name AS account_name FROM finance_payouts p JOIN finance_accounts a ON a.id=p.account_id WHERE p.deal_id=${id} ORDER BY p.date DESC, p.id DESC`,
  )
  const [campaign] = d.campaign_id
    ? await exec(sql`SELECT name FROM finance_campaigns WHERE id=${d.campaign_id}`)
    : []
  const MODE: Record<string, string> = { 'project-default': 'Project default', referral: 'Referral', custom: 'Custom' }
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
        <h2>Commission distribution</h2>
        <div className="finance-actions">
          <Link className="finance-button secondary" href={`/finance/new/deal-split?deal=${id}`}>
            {dist?.split.length ? 'Change split' : 'Set split'}
          </Link>
          <a download href={`/finance/export?kind=deal-report&deal=${id}`}>
            Deal report (CSV)
          </a>
        </div>
      </div>
      <p>
        {MODE[d.commission_mode] || 'Not chosen'}
        {d.referrer_name ? ` · referred by ${d.referrer_name}` : ''} · Originating campaign: {campaign?.name || 'unknown'}
      </p>
      {dist?.splitError && <p role="alert">{dist.splitError}</p>}
      {dist && (
        <>
          <MoneyCards
            values={[
              ['Direct deal deductions', dist.deductionPaisa / 100, 'Pre-distribution expenses of this deal only, paid or reserved'],
              ['Distributable to date', dist.distributablePaisa / 100, 'Received less deductions, never below zero'],
              ['Paid out', dist.paidPaisa / 100],
              ['Unpaid entitlements', dist.unpaidPaisa / 100, 'Owed to recipients; not cash until paid'],
            ]}
          />
          <p>Advertising spend is never deducted from commission.</p>
          {dist.deductionShortfallPaisa > 0 && (
            <p role="alert">
              Deductions exceed commission received by {paisaRupees(dist.deductionShortfallPaisa)}. Nothing is distributable yet.
            </p>
          )}
          {dist.overpaidPaisa > 0 && (
            <p role="alert">
              Payouts exceed current entitlements by {paisaRupees(dist.overpaidPaisa)}, for example because a deduction was added after
              paying out. Completed payouts are not changed; recover or offset it manually and note why.
            </p>
          )}
          {dist.unclassifiedExpenses > 0 && (
            <p className="finance-warning">
              {dist.unclassifiedExpenses} older expense(s) on this deal are not marked as deducted or not, so they are not deducted.
              Void and re-enter any that should be deducted before distribution.
            </p>
          )}
          <div className="finance-table">
            <table>
              <thead>
                <tr>
                  {['Recipient', 'Share', 'Entitlement to date', 'Paid', 'Unpaid', ''].map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dist.recipients.map((r) => {
                  const line = dist.split.find((x) => x.key === r.key)
                  return (
                    <tr key={r.key}>
                      <td>
                        {line?.participant_id ? (
                          <Link href={`/finance/participants/${line.participant_id}`}>{r.label}</Link>
                        ) : (
                          r.label
                        )}
                        {line?.role ? <small> {line.role}</small> : null}
                      </td>
                      <td>{r.units / 10000}%</td>
                      <td>{paisaRupees(r.entitlementPaisa)}</td>
                      <td>{paisaRupees(r.paidPaisa)}</td>
                      <td>
                        {paisaRupees(r.unpaidPaisa)}{' '}
                        {r.overpaidPaisa > 0 && <Badge tone="alert">Overpaid {paisaRupees(r.overpaidPaisa)}</Badge>}
                      </td>
                      <td>
                        {r.unpaidPaisa > 0 && (
                          <Link href={`/finance/new/payout?deal=${id}&recipient=${r.key}`}>Record payout</Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <h2>Payouts</h2>
          <div className="finance-table">
            <table>
              <thead>
                <tr>
                  {['Date', 'Recipient', 'Amount', 'Account', 'Method / reference', 'Status', ''].map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{displayDate(p.date)}</td>
                    <td>{p.recipient_name}</td>
                    <td>{rupees(p.amount)}</td>
                    <td>{p.account_name}</td>
                    <td>
                      {p.payment_method} {p.reference}
                    </td>
                    <td>{p.voided ? `Voided: ${p.void_reason}` : 'Paid'}</td>
                    <td>{!p.voided && <VoidEntry collection="payouts" id={p.id} next={`/finance/deals/${id}`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!payouts.length && <p>No payouts recorded. An entitlement is not a payout until it is recorded here.</p>}
          </div>
        </>
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
      <div className="finance-heading">
        <h2>Deal expenses</h2>
        <Link className="finance-button" href={`/finance/new/deal-expense?deal=${id}`}>
          Add deal expense
        </Link>
      </div>
      <p>
        Only expenses of this specific deal, such as an external broker fee, can reduce its distributable commission, and only when
        marked as a pre-distribution deduction.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Date', 'Payee', 'Description', 'Amount', 'Deducted before distribution', 'Status', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{displayDate(e.date)}</td>
                <td>{e.vendor || '—'}</td>
                <td>{e.description}</td>
                <td>{rupees(e.amount)}</td>
                <td>
                  {e.pre_distribution == null ? (
                    <Badge tone="alert">Needs classification</Badge>
                  ) : e.pre_distribution ? (
                    'Yes'
                  ) : (
                    'No'
                  )}
                </td>
                <td>
                  {e.voided
                    ? 'Voided'
                    : e.payment_status === 'unpaid'
                      ? 'Unpaid (reserved)'
                      : `Paid${e.account_name ? ' · ' + e.account_name : ''}`}
                </td>
                <td className="finance-actions">
                  {!e.voided && e.payment_status === 'unpaid' && (
                    <Link href={`/finance/new/expense-paid?id=${e.id}`}>Mark paid</Link>
                  )}
                  {!e.voided && <VoidEntry collection="expenses" id={e.id} next={`/finance/deals/${id}`} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!expenses.length && <p>No expenses recorded for this deal.</p>}
      </div>
      <h2>Notes</h2>
      <pre>{d.notes || 'No notes yet.'}</pre>
      <p>
        Created {displayDate(d.created_at)} by user #{d.created_by_id || '—'} · Updated{' '}
        {displayDate(d.updated_at)} by user #{d.updated_by_id || '—'}
      </p>
    </>
  )
}
