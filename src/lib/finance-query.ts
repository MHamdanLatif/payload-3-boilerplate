import { sql } from '@payloadcms/db-postgres'

// Shared SQL expressions keep detail, reports, filters and exports consistent.
// These CTEs run on the existing database; historical records never go to the browser.
export const financeCTE = sql`
WITH totals AS (
 SELECT d.*, COALESCE(p.title,d.other_property,'Other property') AS project_name,
 COALESCE(fixed_commission,0) AS commission,
 COALESCE((SELECT SUM(amount) FROM finance_receipts r WHERE r.deal_id=d.id AND NOT COALESCE(r.voided,false)),0) AS received
 FROM finance_deals d LEFT JOIN featured_projects p ON p.id=d.project_id
), deals AS (
 SELECT *, CASE WHEN cancelled THEN 0 ELSE GREATEST(commission-received,0) END AS outstanding,
 GREATEST(received-commission,0) AS overpayment,
 CASE WHEN cancelled THEN 'Cancelled' WHEN received >= commission THEN 'Fully Received'
 WHEN received > 0 THEN 'Partially Received' ELSE 'Awaiting Payment' END AS status FROM totals
), schedules AS (
 SELECT id, id AS deal_id, expected_payment_date AS date, commission AS amount, outstanding AS unpaid,
 client_name, project_name, cancelled, commission, received,
 CASE WHEN (expected_payment_date AT TIME ZONE 'Asia/Karachi')::date < (NOW() AT TIME ZONE 'Asia/Karachi')::date THEN 'Overdue'
 WHEN (expected_payment_date AT TIME ZONE 'Asia/Karachi')::date = (NOW() AT TIME ZONE 'Asia/Karachi')::date THEN 'Due'
 ELSE 'Expected' END AS status
 FROM deals WHERE outstanding > 0 AND expected_payment_date IS NOT NULL AND NOT COALESCE(cancelled,false)
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
