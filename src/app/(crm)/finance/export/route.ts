import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasFinanceAccess } from '@/access/finance'
import { sql } from '@payloadcms/db-postgres'
import { financeCTE } from '@/lib/finance-query'

export const dynamic = 'force-dynamic'
const queries = {
  deals: sql`SELECT id,client_name,contact,project_name,unit_number,unit_type,date_closed,sale_value,booking_amount,expected_payment_date,commission,received,outstanding,status,notes,created_at,updated_at,created_by_id,updated_by_id FROM deals`,
  receipts: sql`SELECT r.*,d.client_name,d.project_name FROM finance_receipts r JOIN deals d ON d.id=r.deal_id`,
  receivables: sql`SELECT id,deal_id,client_name,project_name,date,unpaid,status FROM schedules`,
  expenses: sql`SELECT e.*,COALESCE(d.project_name,p.title) AS project_name FROM finance_expenses e LEFT JOIN deals d ON d.id=e.deal_id LEFT JOIN featured_projects p ON p.id=e.project_id`,
}
const cell = (value: unknown) => {
  let s = value instanceof Date ? value.toISOString() : String(value ?? '')
  if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`
  return `"${s.replaceAll('"', '""')}"`
}
export async function GET(request: NextRequest) {
  const payload = await getPayload({ config }),
    { user } = await payload.auth({ headers: await headers() })
  const noStore = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!hasFinanceAccess(user))
    return Response.json(
      { error: 'Finance authorization required' },
      { status: user ? 403 : 401, headers: noStore },
    )
  const kind = request.nextUrl.searchParams.get('kind') || ''
  if (!Object.hasOwn(queries, kind))
    return Response.json({ error: 'Invalid export kind' }, { status: 400, headers: noStore })
  const query = queries[kind as keyof typeof queries]
  // Stream bounded database batches; do not hold the entire ledger in memory.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let last = 0,
        columns: string[] = []
      try {
        while (true) {
          const result = await payload.db.drizzle.execute(
            sql`${financeCTE} SELECT * FROM (${query}) exported WHERE id>${last} ORDER BY id LIMIT 500`,
          )
          const rows = result.rows as Record<string, unknown>[]
          if (!rows.length) break
          if (!columns.length) {
            columns = Object.keys(rows[0])
            controller.enqueue(encoder.encode(columns.map(cell).join(',') + '\r\n'))
          }
          for (const row of rows)
            controller.enqueue(encoder.encode(columns.map((c) => cell(row[c])).join(',') + '\r\n'))
          last = Number(rows[rows.length - 1].id)
        }
        if (!columns.length) controller.enqueue(encoder.encode('No records\r\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
  return new Response(stream, {
    headers: {
      ...noStore,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finance-${kind}.csv"`,
    },
  })
}
