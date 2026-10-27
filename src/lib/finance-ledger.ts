import { sql } from '@payloadcms/db-postgres'
import {
  checkSplit,
  commissionPosition,
  fundingPosition,
  type CheckedSplit,
  type FundingInput,
} from './finance-math'

// Read side of project funding, commission distribution and cash. Every function takes an
// executor so the same queries serve pages (after a finance session check), posting
// hooks (inside the write's transaction) and the database integration test.
export type Exec = (query: ReturnType<typeof sql>) => Promise<Record<string, any>[]>

const P = (v: unknown) => Number(v || 0)
/** Rows dated on or before `asOf` (YYYY-MM-DD, Pakistan time); all rows when empty. */
export const upTo = (column: string, asOf?: string) =>
  asOf
    ? sql`(${sql.raw(column)} AT TIME ZONE 'Asia/Karachi')::date <= ${asOf}::date`
    : sql`true`
export const within = (column: string, from?: string, to?: string) =>
  sql`(${from || ''}='' OR (${sql.raw(column)} AT TIME ZONE 'Asia/Karachi')::date >= ${from || '1900-01-01'}::date) AND (${to || ''}='' OR (${sql.raw(column)} AT TIME ZONE 'Asia/Karachi')::date <= ${to || '9999-12-31'}::date)`

/** Per project and participant: money received, charged, refunded and adjusted. */
export async function fundingRows(exec: Exec, opts: { project?: number; participant?: number; asOf?: string } = {}) {
  const project = opts.project || 0,
    participant = opts.participant || 0
  return exec(sql`WITH f AS (
    SELECT project_id, participant_id,
      SUM(CASE WHEN kind='contribution' THEN ROUND(amount*100)
               WHEN kind='opening' THEN (CASE WHEN direction='decrease' THEN -1 ELSE 1 END)*ROUND(amount*100) ELSE 0 END)::bigint AS received,
      SUM(CASE WHEN kind='refund' THEN ROUND(amount*100) ELSE 0 END)::bigint AS refunds,
      SUM(CASE WHEN kind='adjustment' THEN (CASE WHEN direction='decrease' THEN -1 ELSE 1 END)*ROUND(amount*100) ELSE 0 END)::bigint AS adjustments,
      SUM(CASE WHEN kind='pledge' THEN ROUND(amount*100) ELSE 0 END)::bigint AS pledged,
      SUM(CASE WHEN kind='contribution' AND pledge_id IS NOT NULL THEN ROUND(amount*100) ELSE 0 END)::bigint AS pledge_paid
    FROM finance_funding WHERE NOT COALESCE(voided,false) AND ${upTo('date', opts.asOf)}
      AND (${project}=0 OR project_id=${project}) AND (${participant}=0 OR participant_id=${participant})
    GROUP BY 1,2
  ), c AS (
    SELECT s.project_id, s.participant_id, SUM(ROUND(s.amount*100))::bigint AS costs
    FROM finance_ad_charges_shares s JOIN finance_ad_charges a ON a.id=s._parent_id
    WHERE NOT COALESCE(a.voided,false) AND ${upTo('a.date', opts.asOf)}
      AND (${project}=0 OR s.project_id=${project}) AND (${participant}=0 OR s.participant_id=${participant})
    GROUP BY 1,2
  )
  SELECT COALESCE(f.project_id,c.project_id) AS project_id, COALESCE(f.participant_id,c.participant_id) AS participant_id,
    pr.title AS project_title, pa.name AS participant_name, COALESCE(pa.archived,false) AS archived,
    COALESCE(f.received,0) AS received, COALESCE(c.costs,0) AS costs, COALESCE(f.refunds,0) AS refunds,
    COALESCE(f.adjustments,0) AS adjustments, COALESCE(f.pledged,0) AS pledged, COALESCE(f.pledge_paid,0) AS pledge_paid
  FROM f FULL JOIN c ON c.project_id=f.project_id AND c.participant_id=f.participant_id
  LEFT JOIN featured_projects pr ON pr.id=COALESCE(f.project_id,c.project_id)
  LEFT JOIN finance_participants pa ON pa.id=COALESCE(f.participant_id,c.participant_id)
  ORDER BY pr.title, pa.name`)
}

/** Current funding split and commission defaults of a project, if configured. */
export async function projectRules(exec: Exec, project: number) {
  const [rule] = await exec(
    sql`SELECT r.*, p.title FROM featured_projects p LEFT JOIN finance_project_rules r ON r.project_id=p.id WHERE p.id=${project}`,
  )
  if (!rule) return null
  const id = rule.id || 0
  const [funding, commission, presets, lines] = await Promise.all([
    exec(sql`SELECT f.participant_id, f.percent, p.name FROM finance_project_rules_funding f JOIN finance_participants p ON p.id=f.participant_id WHERE f._parent_id=${id} ORDER BY f._order`),
    exec(sql`SELECT * FROM finance_project_rules_commission WHERE _parent_id=${id} ORDER BY _order`),
    exec(sql`SELECT * FROM finance_project_rules_presets WHERE _parent_id=${id} ORDER BY _order`),
    exec(sql`SELECT l.* FROM finance_project_rules_presets_lines l JOIN finance_project_rules_presets p ON p.id=l._parent_id WHERE p._parent_id=${id} ORDER BY l._order`),
  ])
  return {
    id: rule.id as number | null,
    project,
    title: rule.title as string,
    plannedDailyBudget: rule.planned_daily_budget == null ? null : Number(rule.planned_daily_budget),
    funding,
    commission,
    presets: presets.map((p): Record<string, any> => ({ ...p, lines: lines.filter((l) => l._parent_id === p.id) })),
  }
}

export function fundingSplit(
  rules: Awaited<ReturnType<typeof projectRules>> | undefined,
): CheckedSplit | null {
  if (!rules?.funding.length) return null
  return checkSplit(
    rules.funding.map((f) => ({ key: String(f.participant_id), label: f.name, pct: f.percent })),
    `${rules.title} funding split`,
  )
}

/** Funding position of one project: balances, pooled cash, shortfalls and backing. */
export async function projectPosition(exec: Exec, project: number, asOf?: string) {
  const [rows, rules] = await Promise.all([fundingRows(exec, { project, asOf }), projectRules(exec, project)])
  const keys = new Map<string, FundingInput & { pledged: number; pledgePaid: number; archived: boolean }>()
  for (const f of rules?.funding || [])
    keys.set(String(f.participant_id), {
      key: String(f.participant_id),
      label: f.name,
      receivedPaisa: 0,
      costPaisa: 0,
      refundPaisa: 0,
      adjustmentPaisa: 0,
      pledged: 0,
      pledgePaid: 0,
      archived: false,
    })
  for (const r of rows)
    keys.set(String(r.participant_id), {
      key: String(r.participant_id),
      label: r.participant_name,
      receivedPaisa: P(r.received),
      costPaisa: P(r.costs),
      refundPaisa: P(r.refunds),
      adjustmentPaisa: P(r.adjustments),
      pledged: P(r.pledged),
      pledgePaid: P(r.pledge_paid),
      archived: r.archived,
    })
  const list = [...keys.values()]
  const position = fundingPosition(list)
  const pct = new Map((rules?.funding || []).map((f) => [String(f.participant_id), Number(f.percent)]))
  return {
    rules,
    ...position,
    participants: position.participants.map((p, i) => ({
      ...p,
      fundingPercent: pct.get(p.key) ?? null,
      pledgeOutstandingPaisa: Math.max(list[i].pledged - list[i].pledgePaid, 0),
    })),
  }
}

/** Projects that have any funding activity or rules, with their positions. */
export async function allProjectPositions(exec: Exec, asOf?: string) {
  const ids = await exec(sql`SELECT DISTINCT id FROM (
    SELECT project_id AS id FROM finance_project_rules UNION SELECT project_id FROM finance_funding
    UNION SELECT s.project_id FROM finance_ad_charges_shares s) x WHERE id IS NOT NULL`)
  return Promise.all(ids.map(async (r) => ({ project: Number(r.id), ...(await projectPosition(exec, Number(r.id), asOf)) })))
}

/** Cumulative commission distribution of one deal. Advertising never enters it. */
export async function dealPosition(exec: Exec, deal: number) {
  const [[d], split, payouts] = await Promise.all([
    exec(sql`SELECT d.*, COALESCE(p.title,d.other_property,'Other property') AS project_name,
      COALESCE((SELECT SUM(ROUND(amount*100)) FROM finance_receipts r WHERE r.deal_id=d.id AND NOT COALESCE(r.voided,false)),0)::bigint AS received
      FROM finance_deals d LEFT JOIN featured_projects p ON p.id=d.project_id WHERE d.id=${deal}`),
    exec(sql`SELECT * FROM finance_deals_commission_split WHERE _parent_id=${deal} ORDER BY _order`),
    exec(sql`SELECT recipient_key, SUM(ROUND(amount*100))::bigint AS paid FROM finance_payouts WHERE deal_id=${deal} AND NOT COALESCE(voided,false) GROUP BY 1`),
  ])
  if (!d) return null
  const [unclassified] = await exec(
    sql`SELECT COUNT(*)::int AS n FROM finance_expenses WHERE deal_id=${deal} AND NOT COALESCE(voided,false) AND pre_distribution IS NULL`,
  )
  const [reserve] = await exec(sql`SELECT COALESCE(SUM(ROUND(amount*100)),0)::bigint AS reserved,
    COALESCE(SUM(CASE WHEN payment_status='unpaid' THEN ROUND(amount*100) ELSE 0 END),0)::bigint AS unpaid
    FROM finance_expenses WHERE deal_id=${deal} AND NOT COALESCE(voided,false) AND pre_distribution`)
  let checked: CheckedSplit = [],
    splitError = ''
  try {
    checked = split.length
      ? checkSplit(split.map((s) => ({ key: s.key, label: s.recipient_name, pct: s.percent })), 'Commission split')
      : []
  } catch (error) {
    splitError = error instanceof Error ? error.message : 'Invalid split'
  }
  const position = commissionPosition({
    commissionPaisa: Math.round(Number(d.fixed_commission || 0) * 100),
    receivedPaisa: P(d.received),
    deductionPaisa: P(reserve.reserved),
    split: checked,
    paidPaisa: Object.fromEntries(payouts.map((p) => [p.recipient_key, P(p.paid)])),
  })
  return {
    deal: d,
    split,
    splitError: splitError || (split.length ? '' : 'Commission split not set. Choose how this deal is distributed.'),
    unpaidReservePaisa: P(reserve.unpaid),
    unclassifiedExpenses: Number(unclassified?.n || 0),
    ...position,
  }
}

/**
 * Every recorded cash movement, once, with its account. Card charges post to the card
 * account; settling the card is a transfer, never a second expense.
 */
export const cashMovements = sql`
  SELECT 'opening' AS source, a.id AS source_id, a.id AS account_id, a.opening_date AS date, ROUND(COALESCE(a.opening_balance,0)*100)::bigint AS paisa, 'Opening balance' AS description, NULL::integer AS project_id, NULL::integer AS deal_id FROM finance_accounts a WHERE COALESCE(a.opening_balance,0)<>0
  UNION ALL SELECT 'contribution', f.id, f.account_id, f.date, ROUND(f.amount*100)::bigint, 'Funding contribution · '||pa.name, f.project_id, NULL FROM finance_funding f JOIN finance_participants pa ON pa.id=f.participant_id WHERE f.kind='contribution' AND NOT COALESCE(f.voided,false)
  UNION ALL SELECT 'refund', f.id, f.account_id, f.date, -ROUND(f.amount*100)::bigint, 'Funding refund · '||pa.name, f.project_id, NULL FROM finance_funding f JOIN finance_participants pa ON pa.id=f.participant_id WHERE f.kind='refund' AND NOT COALESCE(f.voided,false)
  UNION ALL SELECT 'ad-charge', c.id, c.account_id, c.date, -ROUND(c.bank_debit*100)::bigint, 'Advertising charge '||COALESCE(c.meta_reference,''), NULL, NULL FROM finance_ad_charges c WHERE NOT COALESCE(c.voided,false)
  UNION ALL SELECT 'commission-receipt', r.id, r.account_id, r.date, ROUND(r.amount*100)::bigint, 'Commission received', NULL, r.deal_id FROM finance_receipts r WHERE r.account_id IS NOT NULL AND NOT COALESCE(r.voided,false)
  UNION ALL SELECT 'expense', e.id, e.account_id, COALESCE(e.paid_date,e.date), -ROUND(e.amount*100)::bigint, e.description, e.project_id, e.deal_id FROM finance_expenses e WHERE e.account_id IS NOT NULL AND COALESCE(e.payment_status,'paid')='paid' AND NOT COALESCE(e.voided,false)
  UNION ALL SELECT 'payout', p.id, p.account_id, p.date, -ROUND(p.amount*100)::bigint, 'Commission payout · '||p.recipient_name, NULL, p.deal_id FROM finance_payouts p WHERE NOT COALESCE(p.voided,false)
  UNION ALL SELECT 'transfer-out', t.id, t.from_account_id, t.date, -ROUND(t.amount*100)::bigint, CASE WHEN t.kind='card-settlement' THEN 'Card settlement' ELSE 'Transfer out' END, NULL, NULL FROM finance_transfers t WHERE NOT COALESCE(t.voided,false)
  UNION ALL SELECT 'transfer-in', t.id, t.to_account_id, t.date, ROUND(t.amount*100)::bigint, CASE WHEN t.kind='card-settlement' THEN 'Card settlement' ELSE 'Transfer in' END, NULL, NULL FROM finance_transfers t WHERE NOT COALESCE(t.voided,false)
`

/** Recorded (not live) account balances as of a date. */
export async function accountBalances(exec: Exec, asOf?: string) {
  return exec(sql`SELECT a.id, a.name, a.kind, a.card_label, a.archived, a.opening_date,
    COALESCE(SUM(m.paisa),0)::bigint AS balance
    FROM finance_accounts a LEFT JOIN (${cashMovements}) m ON m.account_id=a.id AND ${upTo('m.date', asOf)}
    GROUP BY a.id ORDER BY a.archived, a.name`)
}

/**
 * Recorded cash split by what it is for. The parts add up to the recorded balances:
 * project advertising pools + commission retained + general spending + opening amounts.
 */
export async function cashPurpose(exec: Exec, asOf?: string) {
  const [[totals], projects] = await Promise.all([
    exec(sql`SELECT
      (SELECT COALESCE(SUM(paisa),0) FROM (${cashMovements}) m WHERE ${upTo('m.date', asOf)})::bigint AS recorded,
      (SELECT COALESCE(SUM(ROUND(amount*100)),0) FROM finance_receipts WHERE account_id IS NOT NULL AND NOT COALESCE(voided,false) AND ${upTo('date', asOf)})::bigint AS receipts,
      (SELECT COALESCE(SUM(ROUND(amount*100)),0) FROM finance_expenses WHERE account_id IS NOT NULL AND deal_id IS NOT NULL AND COALESCE(payment_status,'paid')='paid' AND NOT COALESCE(voided,false) AND ${upTo('COALESCE(paid_date,date)', asOf)})::bigint AS deal_expenses,
      (SELECT COALESCE(SUM(ROUND(amount*100)),0) FROM finance_payouts WHERE NOT COALESCE(voided,false) AND ${upTo('date', asOf)})::bigint AS payouts,
      (SELECT COALESCE(SUM(ROUND(amount*100)),0) FROM finance_expenses WHERE account_id IS NOT NULL AND deal_id IS NULL AND COALESCE(payment_status,'paid')='paid' AND NOT COALESCE(voided,false) AND ${upTo('COALESCE(paid_date,date)', asOf)})::bigint AS general,
      (SELECT COALESCE(SUM(ROUND(opening_balance*100)),0) FROM finance_accounts WHERE ${upTo('opening_date', asOf)})::bigint AS opening,
      (SELECT COALESCE(SUM(ROUND(c.amount*100)),0) FROM finance_accounts_opening_classification c JOIN finance_accounts a ON a.id=c._parent_id WHERE c.purpose='owner' AND ${upTo('a.opening_date', asOf)})::bigint AS opening_owner,
      (SELECT COALESCE(SUM(ROUND(c.amount*100)),0) FROM finance_accounts_opening_classification c JOIN finance_accounts a ON a.id=c._parent_id WHERE c.purpose='commission' AND ${upTo('a.opening_date', asOf)})::bigint AS opening_commission,
      (SELECT COALESCE(SUM(ROUND(c.amount*100)),0) FROM finance_accounts_opening_classification c JOIN finance_accounts a ON a.id=c._parent_id WHERE c.purpose='other' AND ${upTo('a.opening_date', asOf)})::bigint AS opening_other,
      (SELECT COALESCE(SUM((CASE WHEN direction='decrease' THEN -1 ELSE 1 END)*ROUND(amount*100)),0) FROM finance_funding WHERE kind='opening' AND NOT COALESCE(voided,false) AND ${upTo('date', asOf)})::bigint AS opening_funding,
      (SELECT COALESCE(SUM(ROUND(amount*100)),0) FROM finance_receipts WHERE account_id IS NULL AND NOT COALESCE(voided,false))::bigint AS unassigned_receipts,
      (SELECT COALESCE(SUM(ROUND(amount*100)),0) FROM finance_expenses WHERE account_id IS NULL AND COALESCE(payment_status,'paid')='paid' AND NOT COALESCE(voided,false))::bigint AS unassigned_expenses`),
    allProjectPositions(exec, asOf),
  ])
  const t = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, P(v)]))
  const pools = projects.map((p) => ({
    project: p.project,
    title: p.rules?.title || `Project #${p.project}`,
    poolPaisa: p.poolPaisa,
  }))
  const poolTotal = pools.reduce((a, p) => a + p.poolPaisa, 0)
  const commissionRetained = t.receipts - t.deal_expenses - t.payouts + t.opening_commission
  const unclassifiedOpening =
    t.opening - t.opening_owner - t.opening_commission - t.opening_other - t.opening_funding
  const parts = poolTotal + commissionRetained - t.general + t.opening_owner + t.opening_other + unclassifiedOpening
  return {
    recordedPaisa: t.recorded,
    pools,
    commissionRetainedPaisa: commissionRetained,
    generalSpendingPaisa: -t.general,
    openingOwnerPaisa: t.opening_owner,
    openingOtherPaisa: t.opening_other,
    unclassifiedOpeningPaisa: unclassifiedOpening,
    // Pools count funding received into any account; this is the residue if a funding
    // record has no account (it cannot, for cash kinds) or rows were edited outside the app.
    differencePaisa: t.recorded - parts,
    unassignedReceiptsPaisa: t.unassigned_receipts,
    unassignedExpensesPaisa: t.unassigned_expenses,
  }
}
