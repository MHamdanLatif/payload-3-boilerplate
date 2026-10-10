'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'
import type { ProjectFilterOptions } from '@/lib/property-search'
import { PROJECT_BUDGETS, propertyTypeLabel } from '@/lib/project-budgets'

export function HomeSearch({ options }: { options: ProjectFilterOptions }) {
  const router = useRouter()
  const [location, setLocation] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [budget, setBudget] = useState('')
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (propertyType) params.set('propertyType', propertyType)
    if (budget) params.set('budget', budget)
    router.push(`/properties${params.size ? `?${params}` : ''}`)
  }
  return (
    <section className="relative bg-cream py-16 md:py-20">
      <div className="container max-w-5xl">
        <div className="rounded-3xl border border-brand-deep/10 bg-white p-6 shadow-luxe md:p-9">
          <Search className="mb-3 h-5 w-5 text-gold" />
          <h2 className="font-serif text-3xl text-brand-deep md:text-4xl">Find what fits.</h2>
          <p className="mt-2 text-brand-deep/65">
            Explore projects by location, property type and budget.
          </p>
          <form
            onSubmit={onSubmit}
            className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
            <label className="min-w-0 text-sm text-brand-deep">
              Location
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`${selectCls} mt-2`}
              >
                <option value="">Any location</option>
                {options.locations.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm text-brand-deep">
              Property Type
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className={`${selectCls} mt-2`}
              >
                <option value="">Any type</option>
                {options.propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {propertyTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm text-brand-deep">
              {options.budgetLabel}
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className={`${selectCls} mt-2`}
              >
                <option value="">Any budget</option>
                {PROJECT_BUDGETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-deep px-4 text-sm font-medium text-white transition-colors hover:bg-gold hover:text-brand-deep"
            >
              Find Projects <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-4 text-xs text-brand-deep/65">
            Budget refers to total unit price, not booking or monthly instalments.
            {options.hasStartingPriceFallback &&
              ' Where unit prices are not published, results use the project starting price.'}
          </p>
        </div>
      </div>
    </section>
  )
}

const inputCls =
  'h-11 w-full rounded-lg border border-brand-deep/15 bg-ivory px-3 text-sm text-brand-deep placeholder:text-brand-deep/35 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

const selectCls = `${inputCls} appearance-none cursor-pointer pr-10 [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22 fill=%22none%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%232f3558%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/></svg>')] [background-position:right_1rem_center] [background-repeat:no-repeat]`
