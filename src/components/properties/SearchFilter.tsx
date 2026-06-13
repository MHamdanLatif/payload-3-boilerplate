'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import {
  VALID_LOCATIONS,
  VALID_PROPERTY_TYPES,
  VALID_FILTER_STATUSES,
  VALID_UNIT_TYPES,
} from '@/lib/property-search'

const groupNumber = new Intl.NumberFormat('en-US')

/** "PKR 1 Cr" → "1 Cr"; "PKR 50 Lac" → "50 Lac"; "PKR 50,000" → "50,000". Strips the prefix. */
function humanMagnitude(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(2).replace(/\.?0+$/, '')} Lac`
  return groupNumber.format(n)
}

function priceHint(raw: string): string | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  const grouped = groupNumber.format(n)
  const magnitude = humanMagnitude(n)
  // Avoid duplicating when the number is too small to use Lac/Cr (humanMagnitude already groups).
  return grouped === magnitude ? grouped : `${grouped} · ${magnitude}`
}

// Locations visible in the filter dropdown. Sukkur is intentionally hidden for
// now while the agency is positioning as Karachi-only — `VALID_LOCATIONS` still
// includes it so admin entries and saved URLs remain valid.
const DROPDOWN_LOCATIONS = VALID_LOCATIONS.filter((l) => l !== 'Sukkur')

type FilterState = {
  location: string
  propertyType: string
  status: string
  unitType: string
  minPrice: string
  maxPrice: string
}

const EMPTY: FilterState = {
  location: '',
  propertyType: '',
  status: '',
  unitType: '',
  minPrice: '',
  maxPrice: '',
}

export function SearchFilter({ defaults }: { defaults: Partial<FilterState> }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<FilterState>({ ...EMPTY, ...defaults })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  // Push filters to URL with light debouncing so typing budgets doesn't fire on every keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      ;(Object.keys(state) as (keyof FilterState)[]).forEach((k) => {
        if (state[k]) params.set(k, state[k])
      })
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [state, router, pathname])

  const update = <K extends keyof FilterState>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setState((s) => ({ ...s, [k]: e.target.value }))

  const reset = () => setState(EMPTY)

  const hasFilters = Object.values(state).some(Boolean)

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="rounded-2xl border border-brand-deep/10 bg-white/85 p-5 shadow-luxe-sm backdrop-blur-sm md:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gold" />
          <span className="eyebrow text-brand-deep/70">Refine your search</span>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep/60 transition-colors hover:text-gold"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Field label="Location">
          <select value={state.location} onChange={update('location')} className={selectCls}>
            <option value="">Any location</option>
            {DROPDOWN_LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Property Type">
          <select
            value={state.propertyType}
            onChange={update('propertyType')}
            className={selectCls}
          >
            <option value="">Any type</option>
            {VALID_PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select value={state.status} onChange={update('status')} className={selectCls}>
            <option value="">Any status</option>
            {VALID_FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Unit Type">
          <select value={state.unitType} onChange={update('unitType')} className={selectCls}>
            <option value="">Any unit</option>
            {VALID_UNIT_TYPES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Min Budget (PKR)" hint={priceHint(state.minPrice)}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="e.g. 10000000"
            value={state.minPrice}
            onChange={update('minPrice')}
            className={inputCls}
          />
        </Field>

        <Field label="Max Budget (PKR)" hint={priceHint(state.maxPrice)}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="e.g. 50000000"
            value={state.maxPrice}
            onChange={update('maxPrice')}
            className={inputCls}
          />
        </Field>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string | null
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[0.7rem] uppercase tracking-[0.25em] text-brand-deep/65">{label}</span>
      {children}
      {hint && (
        <span className="font-mono text-[0.7rem] tabular-nums text-brand-deep/65">{hint}</span>
      )}
    </label>
  )
}

const inputCls =
  'h-11 w-full rounded-lg border border-brand-deep/15 bg-ivory px-3 text-sm text-brand-deep placeholder:text-brand-deep/35 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

const selectCls = `${inputCls} appearance-none cursor-pointer pr-10 [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22 fill=%22none%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%232f3558%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/></svg>')] [background-position:right_1rem_center] [background-repeat:no-repeat]`
