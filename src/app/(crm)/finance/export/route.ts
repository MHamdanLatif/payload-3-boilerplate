import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasFinanceAccess } from '@/access/finance'
import { sql } from '@payloadcms/db-postgres'
import { exportValue, financeCTE, positiveID } from '@/lib/finance-query'
import { accountReport, dealReport, participantReport, projectReport, reportPeriod, type Report } from '@/lib/finance-reports'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'
const queries = {
  deals: sql`SELECT id,client_name,contact,project_name,unit_number,unit_type,date_closed,sale_value,booking_amount,expected_payment_date,commission,received,outstanding,status,notes,created_at,updated_at,created_by_id,updated_by_id FROM deals`,
  receipts: sql`SELECT r.*,d.client_name,d.project_name FROM finance_receipts r JOIN deals d ON d.id=r.deal_id`,
  receivables: sql`SELECT id,deal_id,client_name,project_name,date,unpaid,status FROM schedules`,
  expenses: sql`SELECT e.*,COALESCE(d.project_name,p.title) AS project_name FROM finance_expenses e LEFT JOIN deals d ON d.id=e.deal_id LEFT JOIN featured_projects p ON p.id=e.project_id`,
  funding: sql`SELECT f.*,pa.name AS participant_name,pr.title AS project_title FROM finance_funding f JOIN finance_participants pa ON pa.id=f.participant_id JOIN featured_projects pr ON pr.id=f.project_id`,
  'ad-charges': sql`SELECT l._parent_id*1000+l._order AS id,a.id AS charge_id,a.date,a.account_id,a.bank_debit,a.meta_reference,a.voided,a.review_flags,pr.title AS project_title,c.name AS campaign_name,l.meta_receipt,l.meta_amount,l.additional_charges,l.total_cost FROM finance_ad_charges_lines l JOIN finance_ad_charges a ON a.id=l._parent_id LEFT JOIN featured_projects pr ON pr.id=l.project_id LEFT JOIN finance_campaigns c ON c.id=l.campaign_id`,
  payouts: sql`SELECT p.*,d.client_name FROM finance_payouts p JOIN finance_deals d ON d.id=p.deal_id`,
  transfers: sql`SELECT * FROM finance_transfers`,
  audit: sql`SELECT id,target_collection,target_id,operation,changes::text AS changes,reason,user_id,created_at FROM finance_audit_log`,
}
const reports = {
  'project-report': true,
  'participant-report': true,
  'deal-report': true,
  'account-report': true,
} as const
/** Sections as stacked CSV blocks: a title row, a header row, the data, then a blank line. */
function reportCSV(report: Report) {
  const lines: string[] = []
  for (const section of report.sections) {
    lines.push(cell(section.title))
    const columns = [...new Set(section.rows.flatMap((r) => Object.keys(r)))]
    if (!columns.length) lines.push(cell('No records'))
    else {
      lines.push(columns.map((c) => cell(c)).join(','))
      for (const row of section.rows) lines.push(columns.map((c) => cell(row[c], c)).join(','))
    }
    lines.push('')
  }
  return '\uFEFF' + lines.join('\r\n')
}
// Dates and timestamps are written in Pakistan time (see exportValue), not UTC.
const cell = (value: unknown, column = '') => {
  let s = String(exportValue(column, value) ?? '')
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
  if (Object.hasOwn(reports, kind)) {
    const params = request.nextUrl.searchParams
    const { from, to } = reportPeriod(params)
    const exec = async (query: ReturnType<typeof sql>) =>
      (await payload.db.drizzle.execute(query)).rows as Record<string, any>[]
    const report =
      kind === 'project-report'
        ? await projectReport(exec, positiveID(params.get('project') || ''), from, to)
        : kind === 'participant-report'
          ? await participantReport(exec, positiveID(params.get('participant') || ''), from, to)
          : kind === 'deal-report'
            ? await dealReport(exec, positiveID(params.get('deal') || ''), getServerSideURL())
            : await accountReport(exec, from, to)
    if (!report) return Response.json({ error: 'Not found' }, { status: 404, headers: noStore })
    return new Response(reportCSV(report), {
      headers: {
        ...noStore,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${report.filename}"`,
      },
    })
  }
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
        // UTF-8 BOM so Excel reads Urdu names correctly instead of using the local codepage.
        controller.enqueue(encoder.encode('﻿'))
        while (true) {
          const result = await payload.db.drizzle.execute(
            sql`${financeCTE} SELECT * FROM (${query}) exported WHERE id>${last} ORDER BY id LIMIT 500`,
          )
          const rows = result.rows as Record<string, unknown>[]
          if (!rows.length) break
          if (!columns.length) {
            columns = Object.keys(rows[0])
            controller.enqueue(encoder.encode(columns.map((c) => cell(c)).join(',') + '\r\n'))
          }
          for (const row of rows)
            controller.enqueue(encoder.encode(columns.map((c) => cell(row[c], c)).join(',') + '\r\n'))
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
