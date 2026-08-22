import type { FeaturedProject } from '@/payload-types'
import {
  areaRangeLabel,
  formatPkr,
  sortedUnits,
  unitKey,
  unitSummary,
} from '@/lib/featured-projects'
import { SectionRule } from '@/components/landing/SectionRule'
import type { Media } from '@/payload-types'

/** Small counts read better spelled out in prose. Falls back to digits. */
const COUNT_WORDS = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n)

/** Uploaded flat-layout image for a unit, or null. Depth 1 populates the relation. */
const layoutUrl = (u: { flatLayout?: number | Media | null }): string | null => {
  const m = u.flatLayout
  return m && typeof m === 'object' && m.url ? m.url : null
}

/**
 * Server-rendered table of a project's available units.
 *
 * This data (`unitTypes`) has always existed in the CMS but was never rendered
 * as text — it only fed the /properties filter and the client-side payment
 * calculator. That left the project pages, which earn ~74% of the site's
 * organic clicks, with a single "starting from" price as their only crawlable
 * commercial content, while the queries reaching them ask for prices, sizes and
 * availability.
 *
 * Deliberately a server component with no client JS: the whole point is that
 * this text exists in the initial HTML for both crawlers and slow connections.
 *
 * Mobile (81% of our traffic) uses the same single table rather than a
 * duplicate card stack — each cell carries a `data-label` and the row collapses
 * to a block below `md`, so every string appears exactly once in the document.
 */
export function UnitTypesTable({
  project,
  sectionNumber = '02 / AVAILABLE UNITS',
}: {
  project: FeaturedProject
  sectionNumber?: string
}) {
  const units = sortedUnits(project)
  const summary = unitSummary(project)
  if (!units.length || !summary) return null

  const area = areaRangeLabel(summary)
  const priceRange =
    summary.minPrice === summary.maxPrice
      ? formatPkr(summary.minPrice)
      : `${formatPkr(summary.minPrice)} – ${formatPkr(summary.maxPrice)}`

  // The prose line, not the table, is what matches long-tail queries such as
  // "3 bed flat for sale in Scheme 33" — a table alone is weak text.
  const prose = [
    `${project.title} offers ${summary.count} unit ${summary.count === 1 ? 'configuration' : 'configurations'}`,
    summary.types.length ? ` — ${summary.types.join(', ')}` : '',
    area ? `, ${area}` : '',
    `, priced ${priceRange}`,
    project.location ? ` in ${project.location}, Karachi.` : '.',
  ].join('')

  // Duplex gets its own sentence rather than being buried in the list above.
  // "duplex" is the single highest-volume query cluster reaching this site
  // (~753 impressions/quarter) and it currently lands on blog posts, because no
  // commercial page states in text which units are actually duplexes.
  const duplexProse = summary.duplexCount
    ? `${countWord(summary.duplexCount)} of them ${
        summary.duplexCount === 1 ? 'is a duplex apartment' : 'are duplex apartments'
      }${
        summary.duplexTypes.length ? ` (${summary.duplexTypes.join(', ')})` : ''
      }${
        project.location ? ` - duplex apartments in ${project.location}, Karachi` : ''
      }.`
    : null

  const th =
    'px-4 py-3 text-left text-[0.7rem] uppercase tracking-[0.15em] text-brand-deep/55 font-medium'
  const td = 'px-4 py-3.5 text-sm text-brand-deep'

  return (
    <section id="available-units" className="bg-white py-20 md:py-28">
      <div className="container">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
            {sectionNumber}
          </span>
          <span className="h-px w-10 bg-gold" />
        </div>
        <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight text-brand-deep md:text-4xl">
          Available units &amp; prices
        </h2>
        <SectionRule className="mt-6" />

        <p className="mt-6 max-w-3xl text-base leading-relaxed text-brand-deep/75">
          {prose}
          {duplexProse ? ` ${duplexProse}` : ''}
        </p>

        <div className="mt-10 overflow-x-auto rounded-xl border border-brand-deep/10">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Available units and prices at {project.title}
            </caption>
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-brand-deep/10 bg-ivory">
                <th className={th} scope="col">
                  Unit
                </th>
                <th className={th} scope="col">
                  Configuration
                </th>
                <th className={th} scope="col">
                  Rooms
                </th>
                <th className={th} scope="col">
                  Area
                </th>
                <th className={th} scope="col">
                  Price
                </th>
                <th className={th} scope="col">
                  <span className="sr-only">Flat layout</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => (
                <tr
                  key={u.id ?? `${unitKey(u)}-${i}`}
                  className="block border-b border-brand-deep/5 last:border-0 md:table-row"
                >
                  <td
                    className={`${td} block font-medium before:mr-2 before:text-[0.65rem] before:uppercase before:tracking-[0.15em] before:text-brand-deep/45 before:content-[attr(data-label)] md:table-cell md:before:content-none`}
                    data-label="Unit"
                  >
                    {u.name || u.type}
                  </td>
                  <td
                    className={`${td} block before:mr-2 before:text-[0.65rem] before:uppercase before:tracking-[0.15em] before:text-brand-deep/45 before:content-[attr(data-label)] md:table-cell md:before:content-none`}
                    data-label="Configuration"
                  >
                    {u.type}
                    {u.isDuplex && (
                      <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-brand-deep">
                        Duplex
                      </span>
                    )}
                  </td>
                  <td
                    className={`${td} block before:mr-2 before:text-[0.65rem] before:uppercase before:tracking-[0.15em] before:text-brand-deep/45 before:content-[attr(data-label)] md:table-cell md:before:content-none`}
                    data-label="Rooms"
                  >
                    {u.rooms}
                  </td>
                  <td
                    className={`${td} block before:mr-2 before:text-[0.65rem] before:uppercase before:tracking-[0.15em] before:text-brand-deep/45 before:content-[attr(data-label)] md:table-cell md:before:content-none`}
                    data-label="Area"
                  >
                    {u.areaSqFt ? `${u.areaSqFt.toLocaleString()} sq ft` : '—'}
                  </td>
                  <td
                    className={`${td} block font-medium before:mr-2 before:text-[0.65rem] before:uppercase before:tracking-[0.15em] before:text-brand-deep/45 before:content-[attr(data-label)] md:table-cell md:before:content-none`}
                    data-label="Price"
                  >
                    {formatPkr(u.price)}
                  </td>
                  <td className={`${td} block pb-5 md:table-cell md:pb-3.5`}>
                    {/* The flat layout is the more useful action where one exists:
                        a buyer comparing units wants the plan, and the payment
                        calculator is a full section further down the page anyway.
                        Rows without a layout keep the payment-plan link, so the
                        column is never dead. */}
                    {layoutUrl(u) ? (
                      <a
                        className="text-sm text-gold underline underline-offset-2 hover:text-brand-deep"
                        href={layoutUrl(u) as string}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Flat Layout
                      </a>
                    ) : (
                      <a
                        className="text-sm text-gold underline underline-offset-2 hover:text-brand-deep"
                        href={`?unit=${encodeURIComponent(unitKey(u))}#payment-plan`}
                      >
                        Payment plan
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
