import {
  leadReportLabel,
  leadChannelLabel,
  leadFormLabel,
  leadProjectLabel,
} from '@/lib/lead-labels'
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead } from '@/payload-types'
import { LEAD_STATUSES, statusLabel } from '@/lib/lead-status'
import {
  brochureOpenTotals,
  csvCell,
  csvText,
  leadReportWhere,
  pktDateTime,
  reportRange,
} from '@/lib/lead-report'

/**
 * CSV export of the leads pipeline.
 *
 * Mirrors the dashboard's filters exactly (from / to / status / source) so that
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

const STATUSES: readonly string[] = LEAD_STATUSES

/** ms -> "3m 07s", matching how the dashboard renders it. */
const fmtDuration = (ms: number) => {
  if (!ms) return ''
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const sourceOf = leadReportLabel

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const sp = new URL(req.url).searchParams
  // Invalid dates (?from=abc, 2026-02-30) are ignored rather than throwing.
  const range = reportRange(sp.get('from'), sp.get('to'))
  const statusParam = sp.get('status')
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : undefined
  const source = sp.get('source')

  const [leadsRes, totals] = await Promise.all([
    payload.find({
      collection: 'leads',
      where: leadReportWhere(range, status),
      depth: 0,
      limit: 0,
      pagination: false,
      sort: '-createdAt',
    }),
    brochureOpenTotals(payload, range, status),
  ])

  let leads = leadsRes.docs as Lead[]
  // Source is derived rather than stored, so it filters in memory — same as the
  // dashboard does, which keeps the two in step.
  if (source) leads = leads.filter((l) => sourceOf(l) === source)
  const { opens, dwell } = totals

  const header = [
    'Name',
    'Phone',
    'Email',
    'Status',
    'Reason',
    'Acquisition Source',
    'Conversion Surface',
    'First Touch Campaign',
    'First Touch Content',
    'Latest Touch Source',
    'Legacy Source Tag',
    'Project',
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
    csvCell(leadChannelLabel(l)),
    csvCell(leadFormLabel(l)),
    csvCell(l.firstTouchCampaign),
    csvCell(l.firstTouchContent),
    csvCell(l.latestTouchSource),
    csvCell(l.source),
    csvCell(leadProjectLabel(l)),
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
