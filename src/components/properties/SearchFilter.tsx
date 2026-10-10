'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  VALID_FILTER_STATUSES,
  VALID_UNIT_TYPES,
  type ProjectFilterOptions,
} from '@/lib/property-search'
import { PROJECT_BUDGETS, propertyTypeLabel } from '@/lib/project-budgets'

type FilterState = {
  location: string
  propertyType: string
  status: string
  unitType: string
  layout: string
  budget: string
  minPrice: string
  maxPrice: string
}
const EMPTY: FilterState = {
  location: '',
  propertyType: '',
  status: '',
  unitType: '',
  layout: '',
  budget: '',
  minPrice: '',
  maxPrice: '',
}
export function SearchFilter({
  defaults,
  options,
}: {
  defaults: Partial<FilterState>
  options: ProjectFilterOptions
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState({ ...EMPTY, ...defaults })
  const navigate = (next: FilterState) => {
    setState(next)
    const params = new URLSearchParams()
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }
  const update = (key: keyof FilterState, value: string) =>
    navigate({
      ...state,
      [key]: value,
      ...(key === 'budget' ? { minPrice: '', maxPrice: '' } : {}),
    })
  const controls: {
    key: keyof FilterState
    label: string
    any: string
    options: { value: string; label: string }[]
  }[] = [
    {
      key: 'location',
      label: 'Location',
      any: 'Any location',
      options: options.locations.map((value) => ({ value, label: value })),
    },
    {
      key: 'propertyType',
      label: 'Property Type',
      any: 'Any type',
      options: options.propertyTypes.map((value) => ({ value, label: propertyTypeLabel(value) })),
    },
    {
      key: 'status',
      label: 'Status',
      any: 'Any status',
      options: VALID_FILTER_STATUSES.map((value) => ({
        value,
        label: value === 'Ready' ? 'Ready to Move' : value,
      })),
    },
    {
      key: 'unitType',
      label: 'Unit Type',
      any: 'Any unit',
      options: VALID_UNIT_TYPES.map((value) => ({ value, label: value })),
    },
    {
      key: 'layout',
      label: 'Layout',
      any: 'Any layout',
      options: [{ value: 'duplex', label: 'Duplex' }],
    },
    {
      key: 'budget',
      label: options.budgetLabel,
      any: state.minPrice || state.maxPrice ? 'Custom budget from URL' : 'Any budget',
      options: [...PROJECT_BUDGETS],
    },
  ]
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="rounded-2xl border border-brand-deep/10 bg-white/85 p-5 shadow-luxe-sm md:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="eyebrow text-brand-deep/70">Refine your search</span>
        {Object.values(state).some(Boolean) && (
          <button
            type="button"
            onClick={() => navigate(EMPTY)}
            className="text-sm text-brand-deep underline"
          >
            Reset filters
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {controls.map((control) => (
          <label key={control.key} className="min-w-0 text-sm text-brand-deep">
            {control.label}
            <select
              value={state[control.key]}
              onChange={(e) => update(control.key, e.target.value)}
              className={`${selectCls} mt-2`}
            >
              <option value="">{control.any}</option>
              {state[control.key] &&
                !control.options.some((o) => o.value === state[control.key]) && (
                  <option value={state[control.key]}>{state[control.key]}</option>
                )}
              {control.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="mt-4 text-xs text-brand-deep/65">
        Budget refers to total unit price, not booking or monthly instalments.
        {options.hasStartingPriceFallback &&
          ' Where unit prices are not published, results use the project starting price.'}
      </p>
    </form>
  )
}

const inputCls =
  'h-11 w-full rounded-lg border border-brand-deep/15 bg-ivory px-3 text-sm text-brand-deep placeholder:text-brand-deep/35 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

const selectCls = `${inputCls} appearance-none cursor-pointer pr-10 [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22 fill=%22none%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%232f3558%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/></svg>')] [background-position:right_1rem_center] [background-repeat:no-repeat]`
