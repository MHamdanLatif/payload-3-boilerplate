import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderToBuffer } from '@react-pdf/renderer'
import { fmtDuration } from '@/lib/engagement'
import { statusLabel } from '@/lib/lead-status'
import {
  channelLabel,
  countLeads,
  projectKeyLabel,
  sourceRows,
  sourceSummary,
} from '@/lib/lead-report-groups'
import {
  brochureStats,
  leadNotes,
  loadLeadReport,
  periodText,
  projectRows,
  readReportParams,
} from '@/lib/lead-report-data'
import { pktDateTime } from '@/lib/lead-report'
import { LeadReportDocument } from '@/components/crm/LeadReportPDF'

export const dynamic = 'force-dynamic'

/**
 * The Reports page as a PDF: same filters, the summary tables, then the leads
 * they count. Signed-in CRM users only, like the page itself.
 */
export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const report = await loadLeadReport(payload, readReportParams(new URL(req.url).searchParams))
  const { opened, avgDwell } = brochureStats(report)
  const filters = [
    report.status && `Status: ${statusLabel(report.status)}`,
    report.channel && `Source: ${channelLabel(report.channel)}`,
  ].filter((f): f is string => Boolean(f))

  // Read from disk rather than fetched over HTTP, so the PDF never depends on
  // the server reaching its own public URL.
  const logo = await readFile(path.join(process.cwd(), 'public/brand/lateef-logo.png')).catch(
    () => null,
  )

  try {
    const buffer = await renderToBuffer(
      LeadReportDocument({
        logo,
        projectLabel: report.projectLabel,
        period: periodText(report),
        filters,
        generatedAt: pktDateTime(new Date()),
        totals: countLeads(report.leads),
        openedBrochure: opened,
        avgTimeOnPage: avgDwell ? fmtDuration(avgDwell) : '',
        byProject: report.project ? null : projectRows(report),
        bySource: sourceRows(report.leads),
        leads: report.leads.map((l) => ({
          name: l.name,
          phone: l.phone,
          created: pktDateTime(l.createdAt),
          project: projectKeyLabel(report.projectKeyOf.get(l.id) ?? 'general', report.projects),
          source: sourceSummary(l),
          status: statusLabel(l.status),
          notes: leadNotes(l),
        })),
      }),
    )
    const stamp = pktDateTime(new Date()).slice(0, 10)
    const slug = report.projectLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lateef-lead-report-${slug}-${stamp}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.error('[reports/pdf] render failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'PDF could not be rendered. Please try again.' }, { status: 500 })
  }
}
