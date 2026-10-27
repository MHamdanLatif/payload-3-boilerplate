import { sql } from '@payloadcms/db-postgres'
import {
  accountBalances,
  cashMovements,
  cashPurpose,
  dealPosition,
  projectPosition,
  projectRules,
  within,
  type Exec,
} from './finance-ledger'
import { participantSummary } from './finance-participant'

// Multi-section CSV reports. Each report distinguishes activity inside the selected period
// from balances as of the period's end date.

export type Section = { title: string; rows: Record<string, unknown>[] }
export type Report = { filename: string; sections: Section[] }
const pkr = (paisa: number) => (paisa / 100).toFixed(2)
const iso = /^\d{4}-\d{2}-\d{2}$/
const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

export function reportPeriod(params: URLSearchParams) {
  const from = iso.test(params.get('from') || '') ? params.get('from')! : ''
  const today = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10)
  const to = iso.test(params.get('to') || '') ? params.get('to')! : today
  return { from, to: from && from > to ? from : to }
}
const periodRow = (from: string, to: string) => ({
  period_from: from || 'beginning',
  period_to: to,
  note: 'Activity sections cover the period; balance sections are as of period_to (Pakistan time).',
})

export async function projectReport(exec: Exec, project: number, from: string, to: string): Promise<Report | null> {
  const rules = await projectRules(exec, project)
  if (!rules) return null
  const [campaigns, contributions, daily, costs, position, deals] = await Promise.all([
    exec(sql`SELECT id, name, meta_campaign_id, start_at, end_at, daily_budget, funding_target, status FROM finance_campaigns WHERE project_id=${project} ORDER BY start_at`),
    exec(sql`SELECT f.date, pa.name AS participant, f.kind, f.direction, c.name AS campaign, f.amount, a.name AS account, f.payment_method, f.reference, f.voided, f.void_reason
      FROM finance_funding f JOIN finance_participants pa ON pa.id=f.participant_id LEFT JOIN finance_campaigns c ON c.id=f.campaign_id LEFT JOIN finance_accounts a ON a.id=f.account_id
      WHERE f.project_id=${project} AND ${within('f.date', from, to)} ORDER BY f.date, f.id`),
    exec(sql`SELECT to_char(a.date AT TIME ZONE 'Asia/Karachi','YYYY-MM-DD') AS day, c.name AS campaign,
      SUM(l.meta_amount) AS meta_amount, SUM(l.additional_charges) AS additional_bank_charges_taxes, SUM(l.total_cost) AS total_advertising_cost
      FROM finance_ad_charges_lines l JOIN finance_ad_charges a ON a.id=l._parent_id LEFT JOIN finance_campaigns c ON c.id=l.campaign_id
      WHERE l.project_id=${project} AND NOT COALESCE(a.voided,false) AND ${within('a.date', from, to)} GROUP BY 1,2 ORDER BY 1,2`),
    exec(sql`SELECT pa.name AS participant, SUM(s.amount) AS allocated_cost FROM finance_ad_charges_shares s JOIN finance_ad_charges a ON a.id=s._parent_id
      JOIN finance_participants pa ON pa.id=s.participant_id WHERE s.project_id=${project} AND NOT COALESCE(a.voided,false) AND ${within('a.date', from, to)}
      GROUP BY pa.name ORDER BY pa.name`),
    projectPosition(exec, project, to),
    exec(sql`SELECT id FROM finance_deals WHERE project_id=${project} ORDER BY date_closed`),
  ])
  const dealRows: Record<string, unknown>[] = []
  for (const d of deals) {
    const pos = await dealPosition(exec, Number(d.id))
    if (!pos) continue
    for (const r of pos.recipients.length ? pos.recipients : [null])
      dealRows.push({
        deal_id: d.id,
        client: pos.deal.client_name,
        commission_agreed: pkr(pos.commissionPaisa),
        commission_received: pkr(pos.receivedPaisa),
        direct_deductions: pkr(pos.deductionPaisa),
        distributable: pkr(pos.distributablePaisa),
        recipient: r?.label ?? '(split not set)',
        entitlement: r ? pkr(r.entitlementPaisa) : '',
        paid: r ? pkr(r.paidPaisa) : '',
        unpaid: r ? pkr(r.unpaidPaisa) : '',
      })
  }
  return {
    filename: `project-${project}-report.csv`,
    sections: [
      { title: 'Report', rows: [{ project: rules.title, ...periodRow(from, to) }] },
      {
        title: 'Rules (current)',
        rows: [
          { rule: 'Planned daily budget (whole project)', value: rules.plannedDailyBudget ?? 5000 },
          ...rules.funding.map((f) => ({ rule: 'Funding split', value: `${f.name} ${Number(f.percent)}%` })),
          ...rules.commission.map((c) => ({ rule: 'Default commission split', value: `${c.recipient_name} ${Number(c.percent)}%` })),
          ...rules.presets.flatMap((p) =>
            p.lines.map((l: Record<string, any>) => ({ rule: `Preset: ${p.name}`, value: `${l.recipient_name}${l.role ? ` (${l.role})` : ''} ${Number(l.percent)}%` })),
          ),
        ],
      },
      { title: 'Campaigns (planned budgets, not spending)', rows: campaigns },
      { title: 'Funding entries in period', rows: contributions },
      { title: 'Daily Meta amounts and allocated additional charges', rows: daily },
      { title: 'Advertising cost allocated to participants in period', rows: costs },
      {
        title: `Funding balances as of ${to}`,
        rows: [
          ...position.participants.map((x) => ({
            participant: x.label,
            funding_percent: x.fundingPercent ?? '',
            received: pkr(x.receivedPaisa),
            allocated_costs: pkr(x.costPaisa),
            refunds: pkr(x.refundPaisa),
            adjustments: pkr(x.adjustmentPaisa),
            balance: pkr(x.balancePaisa),
            shortfall: x.shortfall ? 'YES' : '',
            backed_by_project_cash: pkr(x.backedPaisa),
          })),
          { participant: 'PROJECT ADVERTISING CASH REMAINING', balance: pkr(position.poolPaisa), shortfall: position.deficitPaisa ? `DEFICIT ${pkr(position.deficitPaisa)}` : '' },
        ],
      },
      { title: 'Linked deal commissions (advertising is never deducted)', rows: dealRows },
    ],
  }
}

export async function participantReport(exec: Exec, participant: number, from: string, to: string): Promise<Report | null> {
  const s = await participantSummary(exec, participant, to)
  if (!s) return null
  const [entries, costs, payouts] = await Promise.all([
    exec(sql`SELECT f.date, pr.title AS project, f.kind, f.direction, f.amount, a.name AS account, f.reference, f.voided
      FROM finance_funding f JOIN featured_projects pr ON pr.id=f.project_id LEFT JOIN finance_accounts a ON a.id=f.account_id
      WHERE f.participant_id=${participant} AND ${within('f.date', from, to)} ORDER BY f.date, f.id`),
    exec(sql`SELECT pr.title AS project, SUM(s.amount) AS allocated_cost FROM finance_ad_charges_shares s JOIN finance_ad_charges a ON a.id=s._parent_id
      JOIN featured_projects pr ON pr.id=s.project_id WHERE s.participant_id=${participant} AND NOT COALESCE(a.voided,false) AND ${within('a.date', from, to)} GROUP BY pr.title`),
    exec(sql`SELECT p.date, d.client_name AS deal, p.amount, a.name AS account, p.payment_method, p.reference, p.voided
      FROM finance_payouts p JOIN finance_deals d ON d.id=p.deal_id JOIN finance_accounts a ON a.id=p.account_id
      WHERE p.participant_id=${participant} AND ${within('p.date', from, to)} ORDER BY p.date`),
  ])
  return {
    filename: `participant-${participant}-report.csv`,
    sections: [
      { title: 'Report', rows: [{ participant: s.person.name, ...periodRow(from, to) }] },
      { title: 'Funding entries in period (contributions, refunds, adjustments)', rows: entries },
      { title: 'Allocated funding expenses in period', rows: costs },
      {
        title: `Funding balances as of ${to} (kept separate from commission)`,
        rows: s.funding.map((f) => ({
          project: f.title,
          received: pkr(f.receivedPaisa),
          allocated_costs: pkr(f.costPaisa),
          refunds: pkr(f.refundPaisa),
          balance: pkr(f.balancePaisa),
          shortfall: f.shortfall ? 'YES' : '',
          backed_by_project_cash: pkr(f.backedPaisa),
        })),
      },
      {
        title: 'Commission by deal (current)',
        rows: s.commission.map((c) => ({
          deal: c.client,
          project: c.project,
          earned_from_receipts: pkr(c.entitlementPaisa),
          paid: pkr(c.paidPaisa),
          outstanding: pkr(c.unpaidPaisa),
          overpaid: c.overpaidPaisa ? pkr(c.overpaidPaisa) : '',
        })),
      },
      { title: 'Payouts in period', rows: payouts },
    ],
  }
}

export async function dealReport(exec: Exec, deal: number, serverURL: string): Promise<Report | null> {
  const pos = await dealPosition(exec, deal)
  if (!pos) return null
  const d = pos.deal
  const [receipts, expenses, payouts, [campaign]] = await Promise.all([
    exec(sql`SELECT r.date, r.amount, r.payment_method, r.reference, a.name AS account, r.voided FROM finance_receipts r LEFT JOIN finance_accounts a ON a.id=r.account_id WHERE r.deal_id=${deal} ORDER BY r.date`),
    exec(sql`SELECT e.date, e.vendor AS payee, e.description, e.amount, e.pre_distribution, e.payment_status, a.name AS account, e.reference, e.voided FROM finance_expenses e LEFT JOIN finance_accounts a ON a.id=e.account_id WHERE e.deal_id=${deal} ORDER BY e.date`),
    exec(sql`SELECT p.date, p.recipient_name, p.amount, a.name AS account, p.payment_method, p.reference, p.voided FROM finance_payouts p JOIN finance_accounts a ON a.id=p.account_id WHERE p.deal_id=${deal} ORDER BY p.date`),
    d.campaign_id ? exec(sql`SELECT name FROM finance_campaigns WHERE id=${d.campaign_id}`) : Promise.resolve([]),
  ])
  return {
    filename: `deal-${deal}-report.csv`,
    sections: [
      {
        title: 'Deal',
        rows: [
          {
            client: d.client_name,
            crm_lead: d.lead_id ? `${serverURL}/leads-dashboard/${d.lead_id}` : '',
            project: d.project_name,
            unit: d.unit_number,
            originating_campaign: campaign?.name || 'unknown',
            commission_arrangement: d.commission_mode || 'not set',
            referrer: d.referrer_name || '',
            builder_commission: pkr(pos.commissionPaisa),
            received: pkr(pos.receivedPaisa),
            remaining: pkr(pos.outstandingPaisa),
            next_expected_date: d.expected_payment_date,
            direct_deductions: pkr(pos.deductionPaisa),
            distributable_to_date: pkr(pos.distributablePaisa),
            cancelled: d.cancelled ? 'YES' : '',
          },
        ],
      },
      { title: 'Commission receipts', rows: receipts },
      { title: 'Deal expenses (pre_distribution = deducted before distribution)', rows: expenses },
      {
        title: 'Recipient allocations',
        rows: pos.recipients.map((r) => ({
          recipient: r.label,
          percent: r.units / 10000,
          entitlement: pkr(r.entitlementPaisa),
          paid: pkr(r.paidPaisa),
          unpaid: pkr(r.unpaidPaisa),
          overpaid: r.overpaidPaisa ? pkr(r.overpaidPaisa) : '',
        })),
      },
      { title: 'Payouts', rows: payouts },
    ],
  }
}

export async function accountReport(exec: Exec, from: string, to: string): Promise<Report> {
  const openingAsOf = from ? dayBefore(from) : ''
  const [opening, closing, movements, statements, purpose] = await Promise.all([
    openingAsOf ? accountBalances(exec, openingAsOf) : Promise.resolve([]),
    accountBalances(exec, to),
    exec(sql`SELECT m.date, a.name AS account, m.source, m.description, m.paisa FROM (${cashMovements}) m JOIN finance_accounts a ON a.id=m.account_id
      WHERE ${within('m.date', from, to)} ORDER BY m.date, a.name`),
    exec(sql`SELECT DISTINCT ON (s.account_id) s.account_id, s.date, s.statement_balance FROM finance_statements s
      WHERE (s.date AT TIME ZONE 'Asia/Karachi')::date <= ${to}::date ORDER BY s.account_id, s.date DESC`),
    cashPurpose(exec, to),
  ])
  const statementDiffs: Record<string, unknown>[] = []
  for (const s of statements) {
    const day = new Date(new Date(s.date).getTime() + 5 * 3600000).toISOString().slice(0, 10)
    const at = await accountBalances(exec, day)
    const recorded = Number(at.find((a) => a.id === s.account_id)?.balance || 0)
    statementDiffs.push({
      account: at.find((a) => a.id === s.account_id)?.name,
      statement_date: day,
      statement_balance: Number(s.statement_balance).toFixed(2),
      recorded_balance: pkr(recorded),
      difference: pkr(Math.round(Number(s.statement_balance) * 100) - recorded),
    })
  }
  return {
    filename: `accounts-${from || 'start'}-to-${to}.csv`,
    sections: [
      { title: 'Report', rows: [{ ...periodRow(from, to), basis: 'Recorded balances entered in this app, not live bank balances.' }] },
      {
        title: 'Balances',
        rows: closing.map((a) => {
          const open = Number(opening.find((o) => o.id === a.id)?.balance || 0)
          const moved = movements.filter((m) => m.account === a.name)
          return {
            account: a.name,
            type: a.kind,
            opening_balance: from ? pkr(open) : '0.00',
            incoming: pkr(moved.filter((m) => Number(m.paisa) > 0).reduce((t, m) => t + Number(m.paisa), 0)),
            outgoing: pkr(-moved.filter((m) => Number(m.paisa) < 0).reduce((t, m) => t + Number(m.paisa), 0)),
            closing_recorded_balance: pkr(Number(a.balance)),
          }
        }),
      },
      { title: 'Transactions in period', rows: movements.map((m) => ({ date: m.date, account: m.account, type: m.source, description: m.description, amount: pkr(Number(m.paisa)) })) },
      { title: 'Latest statement check', rows: statementDiffs },
      {
        title: `Recorded cash by purpose as of ${to}`,
        rows: [
          ...purpose.pools.map((p) => ({ purpose: `Advertising funding: ${p.title}`, amount: pkr(p.poolPaisa) })),
          { purpose: 'Commission retained pending distribution', amount: pkr(purpose.commissionRetainedPaisa) },
          { purpose: 'General business spending', amount: pkr(purpose.generalSpendingPaisa) },
          { purpose: 'Opening: mine', amount: pkr(purpose.openingOwnerPaisa) },
          { purpose: 'Opening: other', amount: pkr(purpose.openingOtherPaisa) },
          { purpose: 'Opening: unclassified', amount: pkr(purpose.unclassifiedOpeningPaisa) },
          { purpose: 'TOTAL RECORDED CASH', amount: pkr(purpose.recordedPaisa) },
        ],
      },
    ],
  }
}
