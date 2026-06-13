'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'
import { VALID_LOCATIONS, VALID_PROPERTY_TYPES } from '@/lib/property-search'

const DROPDOWN_LOCATIONS = VALID_LOCATIONS.filter((l) => l !== 'Sukkur')

const groupNumber = new Intl.NumberFormat('en-US')

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
  return grouped === magnitude ? grouped : `${grouped} · ${magnitude}`
}

export function HomeSearch() {
  const router = useRouter()
  const [location, setLocation] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (propertyType) params.set('propertyType', propertyType)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    const qs = params.toString()
    router.push(qs ? `/properties?${qs}` : '/properties')
  }

  return (
    <section className="relative bg-cream py-16 md:py-20">
      <div className="container max-w-5xl">
        <div className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-gold/40 via-transparent to-transparent" />
          <div className="relative rounded-3xl border border-brand-deep/10 bg-white p-6 shadow-luxe md:p-9">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                <Search className="h-4 w-4" />
              </span>
              <span className="eyebrow text-brand-deep/70">Find your property</span>
            </div>
            <h2 className="font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
              Find what fits.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-deep/65 md:text-base">
              Filter by location, type and budget — we'll match you across pre-launch
              developments, ready-to-move units, and off-market inventory.
            </p>

            <form
              onSubmit={onSubmit}
              className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 lg:items-end"
            >
              <Field label="Location" className="lg:col-span-1">
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Any location</option>
                  {DROPDOWN_LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Property Type" className="lg:col-span-1">
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
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

              <Field
                label="Min Budget (PKR)"
                hint={priceHint(minPrice)}
                className="lg:col-span-1"
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="e.g. 10000000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field
                label="Max Budget (PKR)"
                hint={priceHint(maxPrice)}
                className="lg:col-span-1"
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="e.g. 50000000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <button
                type="submit"
                className="group inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-brand-deep px-6 text-sm font-medium uppercase tracking-[0.18em] text-white shadow-luxe-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold hover:text-brand-deep lg:col-span-1"
              >
                Search
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string | null
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
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
