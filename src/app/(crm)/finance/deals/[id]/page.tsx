import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { RemoveEntry } from '@/components/finance/RemoveEntry'
import { financeExec, financeQuery } from '@/lib/finance-server'
import { dealPosition } from '@/lib/finance-ledger'
import { displayDate, paisaRupees, rupees } from '@/lib/finance-query'
import { Badge, MoneyCards } from '@/components/finance/FinanceUI'
import { LedgerForm } from '@/components/finance/LedgerForm'
import { VoidEntry } from '@/components/finance/VoidEntry'

const MODE: Record<string, string> = { 'project-default': 'Project default', referral: 'Referral', custom: 'Custom' }

export default async function Deal({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id < 1) notFound()
  const [d] = await financeQuery(sql`SELECT * FROM deals WHERE id=${id}`)
  if (!d) notFound()
  const exec = await financeExec()
  const [receipts, schedules, expenses, payouts, accounts, dist, owner] = await Promise.all([
    exec(sql`SELECT r.*, a.name AS account_name FROM finance_receipts r LEFT JOIN finance_accounts a ON a.id=r.account_id WHERE r.deal_id=${id} ORDER BY r.date DESC, r.id DESC LIMIT 100`),
    financeQuery(sql`SELECT * FROM schedules WHERE deal_id=${id} ORDER BY date,id LIMIT 100`),
    exec(sql`SELECT e.*, a.name AS account_name FROM finance_expenses e LEFT JOIN finance_accounts a ON a.id=e.account_id WHERE e.deal_id=${id} ORDER BY e.date DESC, e.id DESC LIMIT 100`),
    exec(sql`SELECT p.*, a.name AS account_name FROM finance_payouts p JOIN finance_accounts a ON a.id=p.account_id WHERE p.deal_id=${id} ORDER BY p.date DESC, p.id DESC`),
    exec(sql`SELECT id, name FROM finance_accounts WHERE NOT archived ORDER BY name`),
    dealPosition(exec, id),
    exec(sql`SELECT id FROM finance_participants WHERE is_owner LIMIT 1`),
  ])
  const [campaign] = d.campaign_id ? await exec(sql`SELECT name FROM finance_campaigns WHERE id=${d.campaign_id}`) : []
  const pct = Number(d.commission) > 0 ? Math.min(100, (Number(d.received) / Number(d.commission)) * 100) : 0
  const next = schedules[0]
  // One time-ordered history instead of three separate ledgers.
  const history = [
    ...receipts.map((r) => ({ kind: 'receipt' as const, date: r.date, row: r })),
    ...payouts.map((r) => ({ kind: 'payout' as const, date: r.date, row: r })),
    ...expenses.map((r) => ({ kind: 'expense' as const, date: r.date, row: r })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.row.id - a.row.id)
  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: a.name }))
  return (
    <>
      <p>
        <Link href="/finance/deals">← Deals</Link>
      </p>
      <div className="finance-heading">
        <h1>{d.client_name}</h1>
        <Badge>{d.status}</Badge>
      </div>
      <p>
        {d.project_name}
        {d.unit_type ? ` · ${d.unit_type}` : ''}
        {d.unit_number ? ` · ${d.unit_number}` : ''} · closed {displayDate(d.date_closed)}
      </p>

      <MoneyCards
        values={[
          ['Commission generated', d.commission],
          ['Commission received', d.received],
          ['Outstanding commission', d.outstanding],
        ]}
      />
      <div className="finance-progress" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      {next && (
        <p>
          Next expected: {rupees(next.unpaid)} on {displayDate(next.date)} <Badge>{next.status}</Badge>{' '}
          <Link href={`/finance/entry/receivables?deal=${id}`}>Change expected date</Link>
        </p>
      )}
      {Number(d.overpayment) > 0 && (
        <p role="alert">Receipts exceed commission by {rupees(d.overpayment)}. Review the history below.</p>
      )}
      <div className="finance-actions">
        {!d.cancelled && Number(d.outstanding) > 0 && (
          <Link className="finance-button gold" href={`/finance/new/commission?deal=${id}`}>
            Commission received
          </Link>
        )}
        {dist && dist.unpaidPaisa > 0 && (
          <Link className="finance-button" href={`/finance/new/payout?deal=${id}`}>
            Pay out / withdraw
          </Link>
        )}
        <Link className="finance-button secondary" href={`/finance/new/deal-expense?deal=${id}`}>
          Add deal expense
        </Link>
      </div>

      <div className="finance-heading">
        <h2>Who gets the commission</h2>
        {dist?.split.length ? (
          <Link href={`/finance/new/deal-split?deal=${id}`}>Change split</Link>
        ) : null}
      </div>
      {dist && !dist.split.length ? (
        <div className="finance-panel">
          <p>Commission split not set. Who shares this deal&apos;s commission?</p>
          <div className="finance-actions">
            {owner.length > 0 && (
              <LedgerForm kind="split-mine" entryKey={crypto.randomUUID()} hidden={{ deal: String(id) }} fields={[]} submit="All mine (100%)" />
            )}
            <Link className="finance-button secondary" href={`/finance/new/deal-split?deal=${id}`}>
              Share it with others
            </Link>
          </div>
          {!owner.length && (
            <p className="finance-warning">
              Add yourself first: <Link href="/finance/new/participant">Add person</Link> and tick &quot;This is me&quot;.
            </p>
          )}
        </div>
      ) : (
        dist && (
          <>
            <p>
              {MODE[d.commission_mode] || 'Custom'}
              {d.referrer_name ? ` · referred by ${d.referrer_name}` : ''}
              {campaign ? ` · from campaign ${campaign.name}` : ''}. Shares are of commission received
              {dist.deductionPaisa > 0 ? ` after ${paisaRupees(dist.deductionPaisa)} of deal deductions` : ''}: {paisaRupees(dist.distributablePaisa)} so far.
            </p>
            {dist.splitError && <p role="alert">{dist.splitError}</p>}
            {dist.deductionShortfallPaisa > 0 && (
              <p role="alert">Deductions exceed commission received by {paisaRupees(dist.deductionShortfallPaisa)}.</p>
            )}
            {dist.overpaidPaisa > 0 && (
              <p role="alert">
                Paid out {paisaRupees(dist.overpaidPaisa)} more than currently owed (for example, a deduction was added after paying).
                Past payouts are not changed.
              </p>
            )}
            <div className="finance-list">
              {dist.recipients.map((r) => (
                <div key={r.key} className="finance-item">
                  <div className="finance-row">
                    <h3>
                      {r.label} <small>{r.units / 10000}%</small>
                    </h3>
                    {r.unpaidPaisa > 0 ? (
                      <Link className="finance-button small" href={`/finance/new/payout?deal=${id}&recipient=${r.key}`}>
                        Record payout
                      </Link>
                    ) : r.entitlementPaisa > 0 ? (
                      <span className="finance-badge good">Paid up</span>
                    ) : null}
                  </div>
                  <div className="finance-row">
                    <span>Share so far {paisaRupees(r.entitlementPaisa)}</span>
                    <span>Paid {paisaRupees(r.paidPaisa)}</span>
                    <span className="finance-amount">Owed {paisaRupees(r.unpaidPaisa)}</span>
                  </div>
                  {r.overpaidPaisa > 0 && <Badge tone="alert">Overpaid {paisaRupees(r.overpaidPaisa)}</Badge>}
                </div>
              ))}
            </div>
            {dist.unclassifiedExpenses > 0 && (
              <p className="finance-warning">
                {dist.unclassifiedExpenses} older deal expense(s) are not marked as deducted or not, so they are not deducted.
              </p>
            )}
          </>
        )
      )}

      <h2>History</h2>
      <div className="finance-list">
        {history.map(({ kind, row: r }) => (
          <div key={`${kind}-${r.id}`} className="finance-item">
            <div className="finance-row">
              <h3>
                {kind === 'receipt'
                  ? 'Commission received'
                  : kind === 'payout'
                    ? `Paid out to ${r.recipient_name}`
                    : `Expense: ${r.description}`}
              </h3>
              <span className="finance-amount">{rupees(r.amount)}</span>
            </div>
            <div className="finance-row">
              <span>
                {displayDate(kind === 'expense' ? r.paid_date || r.date : r.date)}
                {r.account_name ? ` · ${r.account_name}` : ''}
                {r.payment_method ? ` · ${r.payment_method}` : ''}
                {r.reference ? ` · ${r.reference}` : ''}
                {kind === 'expense' && r.vendor ? ` · ${r.vendor}` : ''}
              </span>
              <span>
                {r.voided ? (
                  <Badge>Voided{r.void_reason ? `: ${r.void_reason}` : ''}</Badge>
                ) : kind === 'expense' ? (
                  <>
                    {r.pre_distribution == null ? (
                      <Badge tone="alert">Needs classification</Badge>
                    ) : (
                      <Badge>{r.pre_distribution ? 'Deducted before sharing' : 'Not deducted'}</Badge>
                    )}{' '}
                    {r.payment_status === 'unpaid' && <Badge tone="alert">Unpaid (reserved)</Badge>}
                  </>
                ) : null}
              </span>
            </div>
            {!r.voided && (
              <div className="finance-actions">
                {kind === 'receipt' && !r.account_id && accounts.length > 0 && (
                  <LedgerForm
                    kind="receipt-account"
                    entryKey={crypto.randomUUID()}
                    hidden={{ id: String(r.id) }}
                    fields={[{ name: 'account', label: 'Which account did it go into?', options: accountOptions, value: accountOptions.length === 1 ? accountOptions[0].value : undefined, required: true }]}
                    submit="Save account"
                  />
                )}
                {kind === 'receipt' && (r.account_id ? <VoidEntry collection="receipts" id={r.id} next={`/finance/deals/${id}`} /> : <RemoveEntry kind="receipts" id={r.id} />)}
                {kind === 'payout' && <VoidEntry collection="payouts" id={r.id} next={`/finance/deals/${id}`} />}
                {kind === 'expense' && r.payment_status === 'unpaid' && (
                  <Link className="finance-button small secondary" href={`/finance/new/expense-paid?id=${r.id}`}>
                    Mark paid
                  </Link>
                )}
                {kind === 'expense' && <VoidEntry collection="expenses" id={r.id} next={`/finance/deals/${id}`} />}
              </div>
            )}
          </div>
        ))}
        {!history.length && <p>No payments recorded yet.</p>}
      </div>

      <details className="finance-more">
        <summary>Sale details, notes and change history</summary>
        <dl>
          {[
            ['Client', d.client_name],
            ['Contact', d.contact],
            ['Project', d.project_name],
            ['Unit', `${d.unit_number || ''} · ${d.unit_type || ''}`],
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
        <p>
          {d.lead_id && (
            <>
              <Link href={`/leads-dashboard/${d.lead_id}`}>Open CRM lead</Link> ·{' '}
            </>
          )}
          <Link href={`/admin/collections/finance-deals/${id}`}>Edit deal</Link> ·{' '}
          <a download href={`/finance/export?kind=deal-report&deal=${id}`}>
            Deal report (CSV)
          </a>
        </p>
        <pre>{d.notes || 'No notes yet.'}</pre>
        <p>
          Created {displayDate(d.created_at)} · updated {displayDate(d.updated_at)}
        </p>
      </details>
      <div className="finance-actions">
        {!d.cancelled && <RemoveEntry kind="deals" id={id} cancel />}
        <RemoveEntry kind="deals" id={id} />
      </div>
    </>
  )
}
