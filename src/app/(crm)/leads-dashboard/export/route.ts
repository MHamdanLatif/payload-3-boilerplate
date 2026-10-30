import { leadFormLabel } from '@/lib/lead-labels'
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { statusLabel } from '@/lib/lead-status'
import { csvCell, csvText, pktDateTime } from '@/lib/lead-report'
import { loadLeadReport, readReportParams } from '@/lib/lead-report-data'
import {
  channelLabel,
  channelOf,
  metaPath,
  projectKeyLabel,
  sourceSummary,
} from '@/lib/lead-report-groups'

/**
 * CSV export of the leads pipeline.
 *
 * Mirrors the dashboard's filters exactly (period / dates / project / status /
 * source), loaded through the same function, so that
 * whatever is on screen is what downloads — "the twelve qualified leads from
 * August" rather than a dump you then have to clean up in Excel.
 *
 * Auth-gated the same way as the dashboard itself: this file contains names,
 * phone numbers and IP addresses, so it must never be reachable anonymously.
 *
 * Deliberately narrow columns. The leads table has 39 of them, most being Meta
 * attribution plumbing (fbc, fbp, fbclid, client_ip, capi_*) that is noise in a
 * spreadsheet. What is here is what someone actually works a pipeline from.
 *
 * Dates and times are Pakistan time as "YYYY-MM-DD HH:mm", which Excel sorts
 * and parses reliably. Every lead in range is exported (no row cap).
 */

/** ms -> "3m 07s", matching how the dashboard renders it. */
const fmtDuration = (ms: number) => {
  if (!ms) return ''
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const report = await loadLeadReport(payload, readReportParams(new URL(req.url).searchParams))
  const { leads, opens, dwell } = report

  const header = [
    'Name',
    'Phone',
    'Email',
    'Status',
    'Reason',
    'Project',
    'Source',
    'Source Detail',
    'Meta Campaign',
    'Meta Ad Set',
    'Meta Ad',
    'Conversion Surface',
    'Latest Touch Source',
    'Legacy Source Tag',
    'Interested Unit',
    'Property Type',
    'Budget',
    'Created (PKT)',
    'Brochure Sent (PKT)',
    'Brochure Opened (PKT)',
    'Opens',
    'Time on Page',
    'Notes',
  ]

  const rows = leads.map((l) => [
    csvCell(l.name),
    csvText(l.phone),
    csvCell(l.email),
    csvCell(statusLabel(l.status)),
    csvCell(l.unqualifiedReason),
    csvCell(projectKeyLabel(report.projectKeyOf.get(l.id) ?? 'general', report.projects)),
    csvCell(channelLabel(channelOf(l))),
    csvCell(sourceSummary(l)),
    ...(channelOf(l) === 'meta'
      ? Object.values(metaPath(l)).map(csvCell)
      : [csvCell(''), csvCell(''), csvCell('')]),
    csvCell(leadFormLabel(l)),
    csvCell(l.latestTouchSource),
    csvCell(l.source),
    csvCell(l.interestedUnitType),
    csvCell(l.propertyType),
    csvCell(l.budget),
    csvCell(pktDateTime(l.createdAt)),
    csvCell(pktDateTime(l.brochureSentAt)),
    csvCell(pktDateTime(l.brochureOpenedAt)),
    csvCell(l.brochureId ? (opens.get(l.brochureId) ?? 0) : 0),
    csvCell(fmtDuration(l.brochureId ? (dwell.get(l.brochureId) ?? 0) : 0)),
    csvCell(l.notes),
  ])

  const csv = [header.map(csvCell), ...rows].map((r) => r.join(',')).join('\r\n')

  // Leading BOM: without it Excel reads the file as the local codepage and
  // mangles non-ASCII (e.g. Urdu) names.
  const body = `﻿${csv}`
  const stamp = pktDateTime(new Date()).slice(0, 10)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lateef-leads-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
