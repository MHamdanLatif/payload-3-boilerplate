import { Check } from 'lucide-react'
import { SectionRule } from '@/components/landing/SectionRule'

export type AmenityRow = { name: string }

type Props = {
  amenities: AmenityRow[] | null | undefined
  sectionNumber?: string
  heading?: string
  subheading?: string
}

export function AmenitiesSection({
  amenities,
  sectionNumber = '02 / AMENITIES',
  heading = "What's included",
  subheading,
}: Props) {
  const list = amenities ?? []
  if (!list.length) return null

  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="container">
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              {sectionNumber}
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl">
            {heading}
          </h2>
          <SectionRule className="mt-6" />
          {subheading && (
            <p className="mt-5 text-base leading-relaxed text-brand-deep/70 md:text-lg">
              {subheading}
            </p>
          )}
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a, i) => (
            <li
              key={`${a.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-brand-deep/10 bg-white px-5 py-4 shadow-luxe-sm"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="text-sm text-brand-deep">{a.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
