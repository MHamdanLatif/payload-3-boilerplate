import type { UnifiedListing } from '@/lib/property-search'
import { UnifiedListingCard } from './UnifiedListingCard'

export function PropertyResultsGrid({ items }: { items: UnifiedListing[] }) {
  return (
    <section>
      <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
        <p className="text-sm text-brand-deep/70">
          Showing <span className="font-serif text-lg text-brand-deep">{items.length}</span>{' '}
          {items.length === 1 ? 'result' : 'results'}
        </p>
        <p className="hidden text-xs uppercase tracking-[0.25em] text-brand-deep/50 sm:block">
          Sorted by newest
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <UnifiedListingCard key={`${item.kind}:${item.id}`} item={item} />
        ))}
      </div>
    </section>
  )
}
