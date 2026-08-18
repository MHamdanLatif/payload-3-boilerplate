import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Lead, LinkOpen } from '@/payload-types'

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
 */

const STATUSES = ['unqualified', 'contacted', 'qualified', 'site-visit', 'closed-won', 'junk']

/** RFC 4180: wrap in quotes, double any internal quote. Guards commas, newlines and quotes in notes. */
function csvCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : ''

/** ms -> "3m 07s", matching how the dashboard renders it. */
const fmtDuration = (ms: number) => {
  if (!ms) return ''
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const sourceOf = (l: Lead) => l.metaAdName || l.source || l.sourceKind || 'unknown'

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const sp = new URL(req.url).searchParams
  const from = sp.get('from')
  const to = sp.get('to')
  const status = sp.get('status')
  const source = sp.get('source')

  const and: Where[] = []
  if (from) and.push({ createdAt: { greater_than_equal: new Date(from).toISOString() } })
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    and.push({ createdAt: { less_than_equal: end.toISOString() } })
  }
  if (status && STATUSES.includes(status)) and.push({ status: { equals: status } })

  const [leadsRes, opensRes] = await Promise.all([
    payload.find({
      collection: 'leads',
      where: and.length ? { and } : {},
      depth: 0,
      limit: 5000,
      pagination: false,
      sort: '-createdAt',
    }),
    payload.find({
      collection: 'link-opens',
      where: { asset: { equals: 'page' } },
      depth: 0,
      limit: 5000,
      pagination: false,
    }),
  ])

  let leads = leadsRes.docs as Lead[]
  // Source is derived rather than stored, so it filters in memory — same as the
  // dashboard does, which keeps the two in step.
  if (source) leads = leads.filter((l) => sourceOf(l) === source)

  const opens = new Map<string, number>()
  const dwell = new Map<string, number>()
  for (const o of opensRes.docs as LinkOpen[]) {
    if (!o.brochureId) continue
    opens.set(o.brochureId, (opens.get(o.brochureId) ?? 0) + 1)
    if (o.dwellMs) dwell.set(o.brochureId, (dwell.get(o.brochureId) ?? 0) + o.dwellMs)
  }

  const header = [
    'Name', 'Phone', 'Email', 'Status', 'Source', 'Project',
    'Property Type', 'Budget', 'Created', 'Brochure Sent',
    'Brochure Opened', 'Opens', 'Time on Page', 'Notes',
  ]

  const rows = leads.map((l) => [
    l.name, l.phone, l.email, l.status, sourceOf(l), l.sourceName,
    l.propertyType, l.budget, fmtDateTime(l.createdAt), fmtDateTime(l.brochureSentAt),
    fmtDateTime(l.brochureOpenedAt),
    l.brochureId ? (opens.get(l.brochureId) ?? 0) : 0,
    fmtDuration(l.brochureId ? (dwell.get(l.brochureId) ?? 0) : 0),
    l.notes,
  ])

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')

  // Leading BOM: without it Excel reads the file as the local codepage and
  // mangles non-ASCII names.
  const body = `﻿${csv}`
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lateef-leads-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
