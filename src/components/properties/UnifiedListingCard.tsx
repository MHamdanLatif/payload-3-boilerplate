import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, MapPin } from 'lucide-react'
import type { UnifiedListing } from '@/lib/property-search'

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1400&q=80&auto=format&fit=crop'

export function UnifiedListingCard({ item }: { item: UnifiedListing }) {
  const isProject = item.kind === 'project'
  const src = item.image && item.image.startsWith('/') ? item.image : item.image || PLACEHOLDER

  return (
    <Link
      href={item.href}
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-luxe-sm ring-1 ring-border/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-luxe"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={src}
          alt={item.title}
          fill
          sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/80 via-brand-deep/10 to-transparent" />

        <span
          className={
            'absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em]' +
            (isProject
              ? ' bg-gold text-brand-deep shadow-sm'
              : ' border border-gold/60 bg-brand-deep/40 text-gold backdrop-blur-sm')
          }
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          {isProject ? 'Featured Project' : 'Listing'}
        </span>

        <span className="absolute right-5 top-5 rounded-full bg-white/15 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          {item.badge}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h3 className="font-serif text-2xl leading-tight tracking-tight">{item.title}</h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
            <MapPin className="h-3.5 w-3.5" />
            {item.location}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        {item.meta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.meta.map((m) => (
              <span
                key={m}
                className="rounded-full border border-brand-deep/15 bg-brand/[0.04] px-3 py-1 text-[0.7rem] text-brand-deep"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between border-t border-border pt-4">
          <div>
            <p className="eyebrow text-brand/55">Price</p>
            <p className="font-serif text-xl text-brand-deep">{item.priceLabel}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep/70 transition-colors group-hover:text-gold">
            View
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
