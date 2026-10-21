import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'

/**
 * Shared pieces of the CRM leads report page and its CSV export, so the two
 * always filter, count and format the same way.
 */

/** A real calendar date in YYYY-MM-DD form, or undefined (so `?from=abc` or 2026-02-30 is ignored). */
export function reportDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : undefined
}

/** PKT day bounds for the from/to filters as UTC ISO strings. Invalid dates fall back to no bound. */
export function reportRange(from: unknown, to: unknown) {
  const f = reportDate(from)
  const t = reportDate(to)
  return {
    from: f,
    to: t,
    start: f ? new Date(`${f}T00:00:00+05:00`).toISOString() : undefined,
    end: t ? new Date(`${t}T23:59:59.999+05:00`).toISOString() : undefined,
  }
}
export type ReportRange = ReturnType<typeof reportRange>

export function leadReportWhere(range: ReportRange, status: string | undefined): Where {
  const and: Where[] = []
  if (range.start) and.push({ createdAt: { greater_than_equal: range.start } })
  if (range.end) and.push({ createdAt: { less_than_equal: range.end } })
  if (status) and.push({ status: { equals: status } })
  return and.length ? { and } : {}
}

/**
 * Brochure page opens and summed dwell per brochureId, counted in Postgres for
 * just the leads in range — no row cap, so older opens can't drop off.
 */
export async function brochureOpenTotals(
  payload: Payload,
  range: ReportRange,
  status: string | undefined,
) {
  const start = range.start ?? null
  const end = range.end ?? null
  const result = await payload.db.drizzle.execute(sql`
    SELECT o.brochure_id, COUNT(*) AS opens, COALESCE(SUM(o.dwell_ms), 0) AS dwell
    FROM link_opens o
    WHERE o.asset = 'page' AND o.brochure_id IN (
      SELECT l.brochure_id FROM leads l
      WHERE l.brochure_id IS NOT NULL
        AND (${start}::timestamptz IS NULL OR l.created_at >= ${start}::timestamptz)
        AND (${end}::timestamptz IS NULL OR l.created_at <= ${end}::timestamptz)
        AND (${status ?? ''} = '' OR l.status::text = ${status ?? ''})
    )
    GROUP BY o.brochure_id`)
  const opens = new Map<string, number>()
  const dwell = new Map<string, number>()
  for (const row of result.rows as { brochure_id: string; opens: unknown; dwell: unknown }[]) {
    opens.set(row.brochure_id, Number(row.opens))
    if (Number(row.dwell)) dwell.set(row.brochure_id, Number(row.dwell))
  }
  return { opens, dwell }
}

/** Pakistan has no daylight saving, so a fixed +05:00 shift is exact. Empty for missing/invalid input. */
export function pktDateTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * RFC 4180 cell, guarded against spreadsheet formula injection: a cell that
 * starts with = + - @ tab or CR is prefixed with ' so Excel/Sheets show it as text.
 */
export function csvCell(value: unknown): string {
  if (value == null) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Always-text cell for values like phone numbers: the ' prefix stops Excel
 * reading +923001234567 as a formula/number (dropping the + or a leading 0).
 */
export function csvText(value: unknown): string {
  if (value == null || value === '') return ''
  const s = String(value)
  return csvCell(s.startsWith("'") ? s : `'${s}`)
}
