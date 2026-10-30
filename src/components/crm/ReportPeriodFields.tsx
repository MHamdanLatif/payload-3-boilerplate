'use client'

import { useState } from 'react'
import { PERIODS } from '@/lib/lead-report-groups'

const field = 'rounded-md border border-brand-deep/15 px-2 py-1.5 text-sm'
const label = 'flex flex-col gap-1 text-xs text-brand-deep/60'

/**
 * Period preset, plus date-and-time inputs that only appear for Custom. The
 * inputs are left out of the form entirely otherwise, so a stale custom range
 * can't ride along with a preset.
 */
export function ReportPeriodFields({
  period,
  from,
  to,
}: {
  period: string
  from?: string
  to?: string
}) {
  const [value, setValue] = useState(period)
  return (
    <>
      <label className={label}>
        Period
        <select
          name="period"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={field}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {value === 'custom' && (
        <>
          <label className={label}>
            From
            <input type="datetime-local" name="from" defaultValue={from} className={field} />
          </label>
          <label className={label}>
            To
            <input type="datetime-local" name="to" defaultValue={to} className={field} />
          </label>
        </>
      )}
    </>
  )
}
