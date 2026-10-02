import { positiveID } from '@/lib/finance-query'
import { pageNumber } from '@/lib/finance-query'
import 'server-only'
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasFinanceAccess } from '@/access/finance'
import { sql } from '@payloadcms/db-postgres'
import { financeCTE, dateWhere, period, param, type FinanceParams } from './finance-query'

export async function financeSession() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Ffinance')
  if (!hasFinanceAccess(user)) notFound()
  return { payload, user }
}
export async function financeQuery(query: ReturnType<typeof sql>) {
  // Raw report queries are privileged; every call authenticates before touching data.
  const { payload } = await financeSession()
  const result = await payload.db.drizzle.execute(sql`${financeCTE} ${query}`)
  return result.rows as Record<string, any>[]
}
export function dealWhere(p: FinanceParams) {
  const search = param(p, 'q').slice(0, 100)
  const project = positiveID(param(p, 'project'))
  const salesperson = positiveID(param(p, 'salesperson'))
  const status = param(p, 'status')
  const month = param(p, 'expectedMonth')
  return sql`${dateWhere('d.date_closed', period(p))}
    AND (${search}='' OR d.client_name ILIKE ${`%${search}%`} OR d.contact ILIKE ${`%${search}%`} OR d.unit_number ILIKE ${`%${search}%`})
    AND (${project}=0 OR d.project_id=${project}) AND (${salesperson}=0 OR d.salesperson_id=${salesperson})
    AND (${status}='' OR d.status=${status})
    AND (${param(p, 'balance')} != 'outstanding' OR d.outstanding > 0)
    AND (${param(p, 'balance')} != 'paid' OR d.status='Fully Received')
    AND (${param(p, 'overdue')} != 'yes' OR EXISTS (SELECT 1 FROM schedules s WHERE s.deal_id=d.id AND s.status='Overdue' AND NOT s.cancelled))
    AND (${month}='' OR EXISTS (SELECT 1 FROM schedules s WHERE s.deal_id=d.id AND to_char(s.date AT TIME ZONE 'Asia/Karachi','YYYY-MM')=${month} AND s.unpaid>0 AND NOT s.cancelled))`
}
export async function dealRows(p: FinanceParams) {
  const columns = {
    date: 'd.date_closed DESC',
    sale: 'd.sale_value DESC',
    commission: 'd.commission DESC',
    outstanding: 'd.outstanding DESC',
    expected: 'next_payment ASC NULLS LAST',
  }
  const sort = columns[param(p, 'sort')] || columns.date
  const page = pageNumber(p)
  const rows =
    await financeQuery(sql`SELECT d.*, (SELECT MIN(date) FROM schedules s WHERE s.deal_id=d.id AND s.unpaid>0 AND NOT s.cancelled) AS next_payment,
    count(*) OVER() AS total_count FROM deals d WHERE ${dealWhere(p)} ORDER BY ${sql.raw(sort)}, d.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`)
  return { rows, page, total: Number(rows[0]?.total_count || 0) }
}
export async function overview(p: FinanceParams) {
  const range = period(p)
  const [kpis] = await financeQuery(sql`SELECT
    (SELECT COUNT(*) FROM deals WHERE NOT COALESCE(cancelled,false) AND ${dateWhere('date_closed', range)}) AS deals,
    (SELECT COALESCE(SUM(sale_value),0) FROM deals WHERE NOT COALESCE(cancelled,false) AND ${dateWhere('date_closed', range)}) AS sales,
    (SELECT COALESCE(SUM(commission),0) FROM deals WHERE NOT COALESCE(cancelled,false) AND ${dateWhere('date_closed', range)}) AS generated,
    (SELECT COALESCE(SUM(amount),0) FROM finance_receipts WHERE NOT COALESCE(voided,false) AND ${dateWhere('date', range)}) AS received,
    (SELECT COALESCE(SUM(outstanding),0) FROM deals) AS outstanding,
    (SELECT COALESCE(SUM(conditional),0) FROM deals) AS conditional,
    (SELECT COALESCE(SUM(eligible),0) FROM deals) AS eligible,
    (SELECT COALESCE(SUM(unpaid),0) FROM schedules WHERE NOT COALESCE(cancelled,false) AND ${dateWhere('date', range)}) AS expected,
    (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE NOT COALESCE(voided,false) AND ${dateWhere('date', range)}) AS expenses`)
  const upcoming = await financeQuery(
    sql`SELECT * FROM schedules WHERE unpaid>0 AND NOT COALESCE(cancelled,false) ORDER BY date,id LIMIT 12`,
  )
  const attention = await financeQuery(sql`SELECT d.*,
    EXISTS(SELECT 1 FROM schedules s WHERE s.deal_id=d.id AND s.status='Overdue') AS overdue,
    (SELECT COALESCE(SUM(amount),0) FROM schedules s WHERE s.deal_id=d.id)>d.commission AS overscheduled
    FROM deals d WHERE NOT COALESCE(d.cancelled,false) AND (d.conditional>0 OR d.outstanding>0 OR d.overpayment>0 OR EXISTS(SELECT 1 FROM schedules s WHERE s.deal_id=d.id AND s.status='Overdue') OR (SELECT COALESCE(SUM(amount),0) FROM schedules s WHERE s.deal_id=d.id)>d.commission)
    ORDER BY overdue DESC, d.outstanding DESC, d.id DESC LIMIT 20`)
  const forecast = await financeQuery(sql`SELECT to_char(month_start,'Mon YYYY') AS month,
    COALESCE(SUM(s.unpaid) FILTER(WHERE s.is_eligible),0) AS eligible,
    COALESCE(SUM(s.unpaid) FILTER(WHERE NOT s.is_eligible),0) AS conditional
    FROM generate_series(date_trunc('month',NOW() AT TIME ZONE 'Asia/Karachi'), date_trunc('month',NOW() AT TIME ZONE 'Asia/Karachi')+interval '5 months',interval '1 month') AS months(month_start)
    LEFT JOIN schedules s ON date_trunc('month',s.date AT TIME ZONE 'Asia/Karachi')=month_start AND NOT COALESCE(s.cancelled,false)
    GROUP BY month_start ORDER BY month_start`)
  return { kpis, upcoming, attention, forecast, range }
}
