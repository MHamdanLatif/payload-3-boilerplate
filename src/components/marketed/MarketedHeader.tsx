import Image from 'next/image'

/**
 * Wordmark only, laid OVER the hero rather than above it.
 *
 * Transparent and absolutely positioned so the elevation runs to the top of the
 * viewport. A solid bar costs the first ~68px of a page whose single job is to
 * make the building look worth enquiring about, and on an ad page that strip is
 * the most expensive real estate there is.
 *
 * It also fixes the logo: the asset is white with transparency, so it was almost
 * invisible on the ivory bar and reads correctly against the dark hero.
 *
 * No navigation, and — unlike the pack header — no Call/WhatsApp buttons: the
 * sticky bar carries those on mobile and the hero form carries the ask on
 * desktop. Not a link either; on every other page the logo goes home, which here
 * is just an exit from a page bought with ad spend.
 */
export function MarketedHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="container flex items-center py-5">
        <span className="flex items-center gap-2.5" aria-label="Lateef Properties">
          <Image
            src="/brand/lateef-logo.png"
            alt=""
            width={120}
            height={120}
            className="h-8 w-auto"
            priority
          />
          <span className="font-serif text-lg tracking-tight text-white">Lateef Properties</span>
        </span>
      </div>
    </header>
  )
}
