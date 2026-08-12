import Link from 'next/link'
import type { Payload } from 'payload'
import { formatPkr } from '@/lib/featured-projects'
import { findLocationSlugByCanonicalName } from '@/lib/project-mapper'
import {
  VALID_FILTER_STATUSES,
  VALID_LOCATIONS,
  VALID_PROPERTY_TYPES,
  VALID_UNIT_TYPES,
} from '@/lib/property-search'

/**
 * Crawlable category links for /properties.
 *
 * /properties sat at average position 30 — not "outranked" but "not considered
 * relevant", because the page was a filter UI over a JavaScript-driven grid.
 * Nothing in the HTML said "apartments in Gulistan-e-Johar" or "duplex in
 * Scheme 33" lived here, so there was nothing for Google to match a commercial
 * query against.
 *
 * Every category below is derived from live inventory, so the page can never
 * advertise a category with nothing behind it, and the counts and price ranges
 * are real text rather than numbers rendered after hydration.
 *
 * Server component by design — this content only helps if it is in the initial
 * HTML.
 */

type Row = {
  label: string
  href: string
  count: number
  minPrice: number | null
}

type InventoryItem = {
  location?: string | null
  propertyType?: string | null
  unitType?: string | null
  status?: string | null
  price?: number | null
  startingPrice?: number | null
  title?: string | null
}

/**
 * Build one category group.
 *
 * `allowed` is the set of values the /properties filter actually accepts. It
 * matters: PropertyListings carries its own status vocabulary ("Resale",
 * "Urgent Sale", "Ready for Possession") which is NOT the filter vocabulary, so
 * grouping raw field values would emit links like ?status=Urgent%20Sale that
 * silently fail to filter — a set of near-duplicate pages showing unfiltered
 * inventory. Anything outside `allowed` is dropped.
 */
function group(
  items: InventoryItem[],
  key: (i: InventoryItem) => string | null | undefined,
  href: (value: string) => string,
  label: (value: string) => string,
  allowed: readonly string[],
): Row[] {
  const buckets = new Map<string, { count: number; min: number | null }>()
  for (const item of items) {
    const v = key(item)
    if (!v || !allowed.includes(v)) continue
    const price = item.price ?? item.startingPrice ?? null
    const b = buckets.get(v) ?? { count: 0, min: null }
    b.count++
    if (price != null && (b.min == null || price < b.min)) b.min = price
    buckets.set(v, b)
  }
  return [...buckets.entries()]
    .map(([value, b]) => ({
      label: label(value),
      href: href(value),
      count: b.count,
      minPrice: b.min,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function CategoryGrid({ heading, rows }: { heading: string; rows: Row[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-10">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-brand-deep/50">
        {heading}
      </h3>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="group flex items-baseline justify-between gap-3 rounded-lg border border-brand-deep/10 bg-white px-4 py-3 transition-colors hover:border-gold"
            >
              <span className="text-sm text-brand-deep group-hover:text-gold">{r.label}</span>
              <span className="shrink-0 text-[0.7rem] text-brand-deep/45">
                {r.count}
                {r.minPrice != null ? ` · from ${formatPkr(r.minPrice)}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export async function CategoryHub({ payload }: { payload: Payload }) {
  let items: InventoryItem[] = []
  try {
    const [projects, listings] = await Promise.all([
      payload.find({ collection: 'featured-projects', depth: 0, limit: 500, pagination: false }),
      payload.find({ collection: 'property-listings', depth: 0, limit: 500, pagination: false }),
    ])
    items = [
      ...(projects.docs as InventoryItem[]),
      ...(listings.docs as InventoryItem[]),
    ]
  } catch {
    return null
  }
  if (!items.length) return null

  const byLocation = group(
    items,
    (i) => i.location,
    (v) => `/properties?location=${encodeURIComponent(v)}`,
    (v) => `Property for sale in ${v}`,
    VALID_LOCATIONS,
  )
  const byType = group(
    items,
    (i) => i.propertyType,
    (v) => `/properties?propertyType=${encodeURIComponent(v)}`,
    (v) => `${v}s for sale in Karachi`,
    VALID_PROPERTY_TYPES,
  )
  const byUnit = group(
    items,
    (i) => i.unitType,
    (v) => `/properties?unitType=${encodeURIComponent(v)}`,
    (v) => `${v} apartments in Karachi`,
    VALID_UNIT_TYPES,
  )
  const byStatus = group(
    items,
    (i) => i.status,
    (v) => `/properties?status=${encodeURIComponent(v)}`,
    (v) => `${v} property in Karachi`,
    VALID_FILTER_STATUSES,
  )

  // One crawlable sentence stating what this page actually holds. The category
  // links above are navigation; this is the text that can match a query.
  const locationNames = byLocation.slice(0, 6).map((r) => r.label.replace('Property for sale in ', ''))
  const allPrices = items
    .map((i) => i.price ?? i.startingPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0)
  const summary = [
    `${items.length} propert${items.length === 1 ? 'y' : 'ies'} currently listed across Karachi`,
    locationNames.length ? ` — including ${locationNames.join(', ')}` : '',
    allPrices.length ? `. Prices from ${formatPkr(Math.min(...allPrices))}.` : '.',
  ].join('')

  return (
    <section className="mt-16 border-t border-brand-deep/10 pt-14">
      <div className="max-w-3xl">
        <h2 className="font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
          Browse Karachi property by area, type and budget
        </h2>
        <p className="mt-4 text-base leading-relaxed text-brand-deep/70">{summary}</p>
      </div>

      <CategoryGrid heading="By area" rows={byLocation} />
      <CategoryGrid heading="By property type" rows={byType} />
      <CategoryGrid heading="By apartment configuration" rows={byUnit} />
      <CategoryGrid heading="By availability" rows={byStatus} />

      {/* Area pages are richer destinations than a filtered result set, so link
          them explicitly where one exists for the area. */}
      <div className="mt-10">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-brand-deep/50">
          Area guides
        </h3>
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {byLocation
            .map((r) => r.label.replace('Property for sale in ', ''))
            .map((name) => ({ name, slug: findLocationSlugByCanonicalName(name) }))
            .filter((x): x is { name: string; slug: string } => Boolean(x.slug))
            .map((x) => (
              <Link
                key={x.slug}
                href={`/locations/${x.slug}`}
                className="text-gold underline underline-offset-4 hover:text-brand-deep"
              >
                {x.name}
              </Link>
            ))}
          <Link
            href="/locations"
            className="text-brand-deep/60 underline underline-offset-4 hover:text-gold"
          >
            All areas →
          </Link>
        </p>
      </div>
    </section>
  )
}
