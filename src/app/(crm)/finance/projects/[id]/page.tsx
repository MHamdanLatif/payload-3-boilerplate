import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { projectPosition } from '@/lib/finance-ledger'
import { displayDate, displayDateTime, paisaRupees, rupees } from '@/lib/finance-query'
import { Badge, MoneyCards } from '@/components/finance/FinanceUI'
import { LedgerForm } from '@/components/finance/LedgerForm'
import { VoidEntry } from '@/components/finance/VoidEntry'

const KIND: Record<string, string> = {
  contribution: 'Contribution received',
  pledge: 'Promised (no cash)',
  refund: 'Refund',
  adjustment: 'Adjustment (no cash)',
  opening: 'Opening balance',
}

export default async function FinanceProject({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id < 1) notFound()
  const exec = await financeExec()
  const pos = await projectPosition(exec, id)
  if (!pos.rules) notFound()
  const rules = pos.rules
  const [campaigns, funding, charges, deals] = await Promise.all([
    exec(sql`SELECT c.*,
      COALESCE((SELECT SUM(l.meta_amount) FROM finance_ad_charges_lines l JOIN finance_ad_charges a ON a.id=l._parent_id WHERE l.campaign_id=c.id AND NOT COALESCE(a.voided,false)),0) AS meta,
      COALESCE((SELECT SUM(l.total_cost) FROM finance_ad_charges_lines l JOIN finance_ad_charges a ON a.id=l._parent_id WHERE l.campaign_id=c.id AND NOT COALESCE(a.voided,false)),0) AS cost,
      COALESCE((SELECT SUM(f.amount) FROM finance_funding f WHERE f.campaign_id=c.id AND f.kind='contribution' AND NOT COALESCE(f.voided,false)),0) AS funded
      FROM finance_campaigns c WHERE c.project_id=${id} ORDER BY c.start_at DESC`),
    exec(sql`SELECT f.*, pa.name AS participant_name, a.name AS account_name, c.name AS campaign_name
      FROM finance_funding f JOIN finance_participants pa ON pa.id=f.participant_id LEFT JOIN finance_accounts a ON a.id=f.account_id LEFT JOIN finance_campaigns c ON c.id=f.campaign_id
      WHERE f.project_id=${id} ORDER BY f.date DESC, f.id DESC LIMIT 200`),
    exec(sql`SELECT a.id, a.date, a.meta_reference, a.voided, a.review_flags, c.name AS campaign_name, l.meta_amount, l.additional_charges, l.total_cost
      FROM finance_ad_charges_lines l JOIN finance_ad_charges a ON a.id=l._parent_id LEFT JOIN finance_campaigns c ON c.id=l.campaign_id
      WHERE l.project_id=${id} ORDER BY a.date DESC, a.id DESC LIMIT 200`),
    exec(sql`SELECT d.id, d.client_name, d.unit_number, d.fixed_commission, d.cancelled, c.name AS campaign_name,
      (SELECT COUNT(*) FROM finance_deals_commission_split s WHERE s._parent_id=d.id) AS split_lines
      FROM finance_deals d LEFT JOIN finance_campaigns c ON c.id=d.campaign_id WHERE d.project_id=${id} ORDER BY d.date_closed DESC LIMIT 100`),
  ])
  const pct = (r: Record<string, any>) => `${Number(r.percent)}%`
  return (
    <>
      <div className="finance-heading">
        <h1>{rules.title}</h1>
        <a download href={`/finance/export?kind=project-report&project=${id}`}>
          Download project report (CSV)
        </a>
      </div>
      <MoneyCards
        values={[
          ['Advertising cash remaining', pos.poolPaisa / 100, 'This project\'s own funding less its costs and refunds'],
          ['Positive participant balances', pos.positivePaisa / 100, 'Unspent funding entitlements'],
          ['Backed by project cash', pos.backedPaisa / 100, 'Part of those balances the project can actually pay'],
          ['Participant shortfalls', pos.shortfallPaisa / 100, 'Top-ups owed to this project'],
        ]}
      />
      <div className="finance-actions">
        <Link className="finance-button" href="/finance/new/ad-charge">
          Record ad spend
        </Link>
      </div>
      <p>
        <Link href="/finance/projects">← Projects</Link>
      </p>
      {pos.deficitPaisa > 0 && (
        <p role="alert">
          Project deficit of {paisaRupees(pos.deficitPaisa)}: spending exceeded this project&apos;s funding. It is not covered by other
          projects&apos; money. Record top-ups to clear it.
        </p>
      )}
      {pos.unbackedPaisa > 0 && (
        <p className="finance-warning">
          {paisaRupees(pos.unbackedPaisa)} of positive balances is not backed by cash until participants with shortfalls top up.
        </p>
      )}
      {pos.adjustmentPaisa !== 0 && (
        <p className="finance-warning">Adjustments total {paisaRupees(pos.adjustmentPaisa)} rather than zero; check each is documented.</p>
      )}

      <div className="finance-heading">
        <h2>Participant funding balances</h2>
        <Link className="finance-button" href={`/finance/new/funding?project=${id}`}>
          + Record funding
        </Link>
      </div>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Participant', 'Funding %', 'Received', 'Allocated costs', 'Refunds', 'Adjustments', 'Balance', 'Backed by cash', 'Promised, not received'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pos.participants.map((x) => (
              <tr key={x.key}>
                <td>
                  <Link href={`/finance/participants/${x.key}`}>{x.label}</Link>
                </td>
                <td>{x.fundingPercent == null ? 'Not in split' : `${x.fundingPercent}%`}</td>
                <td>{paisaRupees(x.receivedPaisa)}</td>
                <td>{paisaRupees(x.costPaisa)}</td>
                <td>{paisaRupees(x.refundPaisa)}</td>
                <td>{paisaRupees(x.adjustmentPaisa)}</td>
                <td>
                  {paisaRupees(x.balancePaisa)} {x.shortfall && <Badge tone="alert">Shortfall: top-up owed</Badge>}
                </td>
                <td>{paisaRupees(x.backedPaisa)}</td>
                <td>{paisaRupees(x.pledgeOutstandingPaisa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pos.participants.length && <p>No funding recorded yet.</p>}
      </div>
      <p>
        Someone whose costs exceed their contributions keeps being charged their agreed share; their balance goes negative and
        is cleared by their next top-up. Nobody else is charged extra, and commission splits are not affected.
      </p>

      <div className="finance-heading">
        <h2>Rules</h2>
        <div className="finance-actions">
          <Link className="finance-button secondary" href={`/finance/new/rules?project=${id}`}>
            Edit funding / commission rules
          </Link>
          <Link className="finance-button secondary" href={`/finance/new/preset?project=${id}`}>
            + Commission preset
          </Link>
        </div>
      </div>
      <dl>
        <div>
          <dt>Planned daily budget (whole project)</dt>
          <dd>{rupees(rules.plannedDailyBudget ?? 5000)} · 30 days = {rupees((rules.plannedDailyBudget ?? 5000) * 30)} before bank charges/taxes</dd>
        </div>
        <div>
          <dt>Funding split</dt>
          <dd>{rules.funding.length ? rules.funding.map((f) => `${f.name} ${pct(f)}`).join(' · ') : 'Not set: required before recording advertising charges'}</dd>
        </div>
        <div>
          <dt>Default commission split</dt>
          <dd>{rules.commission.length ? rules.commission.map((c) => `${c.recipient_name} ${pct(c)}`).join(' · ') : 'Not set'}</dd>
        </div>
      </dl>
      {rules.presets.map((preset) => (
        <div className="finance-actions" key={preset.id}>
          <span>
            Preset <strong>{preset.name}</strong> ({preset.kind}): {preset.lines.map((l: Record<string, any>) => `${l.recipient_name}${l.role ? ' (' + l.role + ')' : ''} ${pct(l)}`).join(' · ')}
          </span>
          <LedgerForm
            kind="preset-remove"
            entryKey={crypto.randomUUID()}
            hidden={{ project: String(id), presetId: String(preset.id), changeReason: `Removed preset ${preset.name}` }}
            fields={[]}
            submit="Remove preset"
            confirm={`Remove the preset "${preset.name}"? Deals that already used it keep their own split.`}
          />
        </div>
      ))}
      <p>Changing rules never recalculates posted charges or saved deal splits; history is in the audit log.</p>

      <div className="finance-heading">
        <h2>Campaigns</h2>
        <Link className="finance-button" href={`/finance/new/campaign?project=${id}`}>
          + Add campaign
        </Link>
      </div>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Campaign', 'Meta ID', 'Start (PKT)', 'End', 'Planned daily', 'Funding target', 'Funded', 'Meta amounts', 'Total cost', 'Status', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.meta_campaign_id || '—'}</td>
                <td>{displayDateTime(c.start_at)}</td>
                <td>{c.end_at ? displayDateTime(c.end_at) : '—'}</td>
                <td>{rupees(c.daily_budget)}</td>
                <td>{c.funding_target ? rupees(c.funding_target) : '—'}</td>
                <td>{rupees(c.funded)}</td>
                <td>{rupees(c.meta)}</td>
                <td>{rupees(c.cost)}</td>
                <td>
                  <Badge>{c.status === 'completed' ? 'Completed' : 'Active'}</Badge>
                </td>
                <td>
                  <Link href={`/finance/new/campaign?id=${c.id}`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!campaigns.length && <p>No campaigns yet.</p>}
      </div>

      <details className="finance-more">
        <summary>History: funding entries, ad costs and deals</summary>
      <h2>Funding ledger</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Date', 'Participant', 'Type', 'Campaign', 'Amount', 'Account', 'Method / reference', 'Status', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funding.map((f) => (
              <tr key={f.id}>
                <td>{displayDate(f.date)}</td>
                <td>{f.participant_name}</td>
                <td>
                  {KIND[f.kind]}
                  {['adjustment', 'opening'].includes(f.kind) && f.direction === 'decrease' ? ' (decrease)' : ''}
                </td>
                <td>{f.campaign_name || '—'}</td>
                <td>{rupees(f.amount)}</td>
                <td>{f.account_name || '—'}</td>
                <td>
                  {f.payment_method} {f.reference}
                </td>
                <td>{f.voided ? `Voided: ${f.void_reason}` : 'Posted'}</td>
                <td>{!f.voided && <VoidEntry collection="funding" id={f.id} next={`/finance/projects/${id}`} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!funding.length && <p>No funding entries.</p>}
      </div>

      <h2>Advertising costs allocated to this project</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Date', 'Campaign', 'Meta amount', 'Additional bank charges/taxes', 'Total cost', 'Reference', 'Status'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {charges.map((c, i) => (
              <tr key={`${c.id}-${i}`}>
                <td>{displayDateTime(c.date)}</td>
                <td>{c.campaign_name}</td>
                <td>{rupees(c.meta_amount)}</td>
                <td>{rupees(c.additional_charges)}</td>
                <td>{rupees(c.total_cost)}</td>
                <td>{c.meta_reference || '—'}</td>
                <td>{c.voided ? 'Voided' : c.review_flags ? <Badge tone="alert">Check</Badge> : 'Posted'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!charges.length && <p>No advertising charges yet.</p>}
      </div>

      <h2>Deals in this project</h2>
      <p>Advertising spend is never deducted from these deals&apos; commission.</p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Client', 'Unit', 'Commission', 'Originating campaign', 'Split'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/finance/deals/${d.id}`}>{d.client_name}</Link> {d.cancelled && <Badge>Cancelled</Badge>}
                </td>
                <td>{d.unit_number || '—'}</td>
                <td>{rupees(d.fixed_commission)}</td>
                <td>{d.campaign_name || 'Unknown'}</td>
                <td>{Number(d.split_lines) ? 'Set' : <Badge tone="alert">Not set</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!deals.length && <p>No deals yet.</p>}
      </div>
      </details>
    </>
  )
}
