import { PHONE_E164, WHATSAPP_URL } from '@/lib/contact'

/**
 * Minimal header for personalised project packs.
 *
 * Identity and a way to make contact — nothing else. The main site nav is
 * deliberately absent: a lead reading their own project pack should be moving
 * toward a conversation, not browsing neighbourhoods and blog posts.
 */
export function PackHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-deep/10 bg-ivory/95 backdrop-blur-sm">
      <div className="container flex items-center justify-between gap-4 py-4">
        {/* The logo asset is a WHITE knockout, so on this ivory bar it was
            invisible — a blank space where the company name should be. There is
            no dark variant of the file, so it is used as a MASK and filled with
            the brand colour instead, which gives the exact brand blue rather
            than a filter chain approximating it.
            -webkit- prefix first: these packs are opened on whatever phone the
            buyer owns, and that spelling is the one every older engine knows. */}
        <a href="/" className="flex items-center gap-3" aria-label="Lateef Properties">
          <span
            role="img"
            aria-label="Lateef Properties"
            className="block h-9 w-9 bg-brand-deep"
            style={{
              WebkitMaskImage: 'url(/brand/lateef-logo.png)',
              maskImage: 'url(/brand/lateef-logo.png)',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
        </a>
        <div className="flex items-center gap-2">
          <a
            href={`tel:${PHONE_E164}`}
            className="rounded-full border border-brand-deep/15 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-brand-deep transition-colors hover:border-gold hover:text-gold"
          >
            Call
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-brand-deep px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-white transition-colors hover:bg-gold hover:text-brand-deep"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </header>
  )
}
