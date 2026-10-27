import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { within } from '@/lib/finance-ledger'
import { displayDateTime, param, period, rupees, type FinanceParams } from '@/lib/finance-query'
import { Badge, PeriodFilter } from '@/components/finance/FinanceUI'
import { VoidEntry } from '@/components/finance/VoidEntry'

export default async function AdCharges({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams
  const range = period(p)
  const exec = await financeExec()
  const charges = await exec(sql`SELECT a.*, ac.name AS account_name, ac.kind AS account_kind FROM finance_ad_charges a
    JOIN finance_accounts ac ON ac.id=a.account_id WHERE ${within('a.date', range.start, range.end)}
    ORDER BY a.date DESC, a.id DESC LIMIT 200`)
  const ids = charges.map((c) => Number(c.id))
  const [lines, shares] = ids.length
    ? await Promise.all([
        exec(sql`SELECT l.*, c.name AS campaign_name, pr.title AS project_title FROM finance_ad_charges_lines l
          LEFT JOIN finance_campaigns c ON c.id=l.campaign_id LEFT JOIN featured_projects pr ON pr.id=l.project_id
          WHERE l._parent_id = ANY(${`{${ids.join(',')}}`}::int[]) ORDER BY l._order`),
        exec(sql`SELECT s.*, pa.name AS participant_name FROM finance_ad_charges_shares s JOIN finance_participants pa ON pa.id=s.participant_id
          WHERE s._parent_id = ANY(${`{${ids.join(',')}}`}::int[]) ORDER BY s._order`),
      ])
    : [[], []]
  return (
    <>
      <div className="finance-heading">
        <h2>Advertising charges</h2>
        <Link className="finance-button" href="/finance/new/ad-charge">
          + Record charge
        </Link>
      </div>
      <PeriodFilter params={p} />
      <p>
        {range.label}. One bank debit reduces cash once. Campaign and participant amounts are breakdowns of that debit and always add
        back to it exactly. Correct a mistake by voiding the charge and recording it again.
      </p>
      {charges.map((c) => (
        <article key={c.id} className="finance-panel">
          <div className="finance-heading">
            <strong>
              {displayDateTime(c.date)} · {c.account_name}
              {c.card_label ? ` · ${c.card_label}` : ''} · bank debit {rupees(c.bank_debit)}
            </strong>
            {c.voided ? <Badge>Voided: {c.void_reason}</Badge> : <VoidEntry collection="ad-charges" id={c.id} next={`/finance/ad-charges?${new URLSearchParams(p as Record<string, string>)}`} />}
          </div>
          <p>
            Meta {rupees(c.meta_total)} + additional bank charges/taxes {rupees(c.additional_total)}
            {c.meta_reference ? ` · Ref ${c.meta_reference}` : ''}
            {c.account_kind === 'card' ? ' · on a card: settle it with a card-settlement transfer, not a second expense' : ''}
          </p>
          {c.charge_breakdown && <p>Breakdown: {c.charge_breakdown}</p>}
          {c.review_flags &&
            String(c.review_flags)
              .split('\n')
              .map((f: string) => (
                <p key={f} className="finance-warning">
                  {f}
                </p>
              ))}
          <div className="finance-table">
            <table>
              <thead>
                <tr>
                  {['Project · campaign', 'Meta amount', 'Additional', 'Total cost', 'Participant shares'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines
                  .filter((l) => l._parent_id === c.id)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/finance/projects/${l.project_id}`}>{l.project_title}</Link> · {l.campaign_name}
                        {l.meta_receipt ? <small> Receipt {l.meta_receipt}</small> : null}
                      </td>
                      <td>{rupees(l.meta_amount)}</td>
                      <td>{rupees(l.additional_charges)}</td>
                      <td>{rupees(l.total_cost)}</td>
                      <td>
                        {shares
                          .filter((s) => s._parent_id === c.id && Number(s.line) === Number(l._order) - 1)
                          .map((s) => `${s.participant_name} ${Number(s.percent)}% ${rupees(s.amount)}`)
                          .join(' · ')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
      {!charges.length && <p>No advertising charges in this period.</p>}
      <a download href="/finance/export?kind=ad-charges">
        Export all charge lines (CSV)
      </a>
      <p>{param(p, 'period') ? '' : 'Showing the current month by default.'}</p>
    </>
  )
}
