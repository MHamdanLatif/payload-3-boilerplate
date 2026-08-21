import Image from 'next/image'
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
        <a href="/" className="flex items-center gap-3" aria-label="Lateef Properties">
          <Image
            src="/brand/lateef-logo.png"
            alt="Lateef Properties"
            width={120}
            height={120}
            className="h-9 w-auto"
            priority
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
