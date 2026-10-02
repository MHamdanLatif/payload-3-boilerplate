import { sql } from '@payloadcms/db-postgres'

// Shared SQL expressions keep detail, reports, filters and exports consistent.
// These CTEs run on the existing database; historical records never go to the browser.
export const financeCTE = sql`
WITH totals AS (
 SELECT d.*, p.title AS project_name,
 ROUND(CASE WHEN calculation_type = 'fixed' THEN COALESCE(fixed_commission,0) ELSE sale_value * COALESCE(commission_rate,0) / 100 END,2) AS commission,
 COALESCE((SELECT SUM(amount) FROM finance_receipts r WHERE r.deal_id=d.id AND NOT COALESCE(r.voided,false)),0) AS received,
 (NOT COALESCE(cancelled,false) AND (trigger='booking' OR (trigger='threshold' AND booking_percentage >= required_booking_percentage) OR (trigger IN ('manual','milestone') AND milestone_reached))) AS is_eligible
 FROM finance_deals d LEFT JOIN featured_projects p ON p.id=d.project_id
), eligible AS (
 SELECT *, CASE WHEN is_eligible THEN commission ELSE 0 END AS eligible,
 CASE WHEN NOT is_eligible AND NOT COALESCE(cancelled,false) THEN commission ELSE 0 END AS conditional FROM totals
), deals AS (
 SELECT *, GREATEST(eligible-received,0) AS outstanding,
 GREATEST(received-commission,0) AS overpayment,
 CASE WHEN cancelled THEN 'Cancelled' WHEN received >= commission AND commission > 0 THEN 'Fully Received'
 WHEN received > 0 THEN 'Partially Received' WHEN is_eligible AND claimed THEN 'Claimed / Invoiced'
 WHEN is_eligible THEN 'Commission Eligible' ELSE 'Awaiting Client Payment' END AS status FROM eligible
), schedule_base AS (
 SELECT s.*, d.client_name, d.project_name, d.is_eligible, d.cancelled, d.commission, d.received,
 COALESCE((SELECT SUM(r.amount) FROM finance_receipts r WHERE r.receivable_id=s.id AND NOT COALESCE(r.voided,false)),0) AS matched,
 COALESCE((SELECT SUM(r.amount) FROM finance_receipts r WHERE r.deal_id=s.deal_id AND NOT COALESCE(r.voided,false) AND r.created_at<s.created_at
   AND NOT EXISTS(SELECT 1 FROM finance_receivables target WHERE target.id=r.receivable_id AND NOT COALESCE(target.voided,false))),0) AS prior_unallocated
 FROM finance_receivables s JOIN deals d ON d.id=s.deal_id WHERE NOT COALESCE(s.voided,false)
), schedule_remaining AS (
 SELECT *, GREATEST(amount-matched,0) AS remaining,
 GREATEST(received-SUM(matched) OVER (PARTITION BY deal_id),0) AS unallocated FROM schedule_base
), schedule_allocated AS (
 SELECT *, GREATEST(remaining-GREATEST(unallocated-GREATEST(prior_unallocated,COALESCE(SUM(remaining) OVER (PARTITION BY deal_id ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)),0),0) AS unpaid
 FROM schedule_remaining
), schedules AS (
 SELECT *, CASE WHEN cancelled THEN 'Cancelled' WHEN unpaid=0 THEN 'Received'
 WHEN (date AT TIME ZONE 'Asia/Karachi')::date < (NOW() AT TIME ZONE 'Asia/Karachi')::date THEN 'Overdue'
 WHEN unpaid < amount THEN 'Partially Received'
 WHEN (date AT TIME ZONE 'Asia/Karachi')::date = (NOW() AT TIME ZONE 'Asia/Karachi')::date THEN 'Due' ELSE 'Expected' END AS status
 FROM schedule_allocated
)
`

export type FinanceParams = Record<string, string | string[] | undefined>
export const param = (p: FinanceParams, key: string) =>
  typeof p[key] === 'string' ? (p[key] as string) : ''
export const positiveID = (value: string) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647
    ? Number(value)
    : 0
export const pageNumber = (p: FinanceParams) => Math.min(1000000, positiveID(param(p, 'page')) || 1)
export function period(p: FinanceParams) {
  const now = new Date(Date.now() + 5 * 3600000)
  const mode = param(p, 'period') || 'current'
  let start = '',
    end = ''
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number(s.slice(0, 4)) >= 1900 &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  if (mode === 'all') return { start, end, label: 'All time' }
  if (
    mode === 'range' &&
    valid(param(p, 'from')) &&
    valid(param(p, 'to')) &&
    param(p, 'from') <= param(p, 'to')
  ) {
    start = param(p, 'from')
    end = param(p, 'to')
  } else {
    const custom = param(p, 'month')
    const d =
      mode === 'month' && valid(`${custom}-01`)
        ? new Date(`${custom}-01T00:00:00Z`)
        : new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (mode === 'previous' ? 1 : 0), 1),
          )
    start = d.toISOString().slice(0, 10)
    end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  }
  return { start, end, label: `${start} to ${end} (PKT)` }
}
export function dateWhere(column: string, range: ReturnType<typeof period>) {
  return range.start
    ? sql`(${sql.raw(column)} AT TIME ZONE 'Asia/Karachi')::date BETWEEN ${range.start}::date AND ${range.end}::date`
    : sql`true`
}
export const rupees = (n: unknown) =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
export const displayDate = (d: unknown) =>
  d
    ? new Date(String(d)).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Karachi',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'
export const todayPKT = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10)
