import Image from 'next/image'

/**
 * Wordmark only. No navigation, and — unlike the pack header — no Call/WhatsApp
 * buttons either, because the sticky bar carries those on mobile and the hero
 * form carries the ask on desktop. Two competing CTAs in the same eyeline split
 * attention instead of doubling it.
 *
 * Not a link. The logo on every other page goes home; here that is just an exit
 * from a page bought with ad spend.
 */
export function MarketedHeader() {
  return (
    <header className="border-b border-brand-deep/10 bg-ivory">
      <div className="container flex items-center py-4">
        <span className="flex items-center gap-3" aria-label="Lateef Properties">
          <Image
            src="/brand/lateef-logo.png"
            alt="Lateef Properties"
            width={120}
            height={120}
            className="h-9 w-auto"
            priority
          />
        </span>
      </div>
    </header>
  )
}
