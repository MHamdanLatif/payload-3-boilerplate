/**
 * The wordmark, laid OVER the hero rather than above it.
 *
 * Transparent and absolutely positioned so the elevation runs to the top of the
 * viewport. A solid bar costs the first ~80px of a page whose single job is to
 * make the building look worth enquiring about, and on an ad page that strip is
 * the most expensive real estate there is.
 *
 * Type, not the logo mark: same serif, size and gold separator as the site
 * header, so the page reads as the same company at a glance.
 *
 * Deliberately NOT a link, which is the one way it differs from the site header
 * — everywhere else the wordmark goes home; here that is just an exit from a
 * page bought with ad spend. The hover animation on the dot goes with it, since
 * nothing here responds to a click.
 */
export function MarketedHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="container flex h-20 items-center">
        <span className="flex items-baseline gap-2" aria-label="Lateef Properties">
          <span className="font-serif text-2xl tracking-tight text-white">Lateef</span>
          <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-gold" />
          <span className="font-serif text-2xl tracking-tight text-white">Properties</span>
        </span>
      </div>
    </header>
  )
}
