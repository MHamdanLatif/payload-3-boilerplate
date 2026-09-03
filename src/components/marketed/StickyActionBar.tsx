import { MessageCircle } from 'lucide-react'
import { whatsappUrl } from '@/lib/contact'
import { WhatsAppLink } from '@/components/shared/WhatsAppLink'

/**
 * Fixed bottom bar, mobile only.
 *
 * The hero form scrolls out of view within one swipe, and cold ad traffic
 * largely does not scroll back up to find it. This keeps both actions reachable
 * from anywhere on the page.
 *
 * Both this and the units-table button target the hero form, so the same label
 * always means the same destination. The closing CTA carries an identical form
 * for anyone who simply reaches the end of the page.
 *
 * Hidden from `md` up, where the hero form stays beside the content and a fixed
 * bar would only cover it.
 */
export function StickyActionBar({
  projectTitle,
  projectSlug,
  targetId,
}: {
  projectTitle: string
  projectSlug: string
  targetId: string
}) {
  const message = `Hi, I'm interested in ${projectTitle}. Please share details on availability, pricing and payment plans.`

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-deep/10 bg-ivory/95 p-3 backdrop-blur-sm md:hidden">
      <div className="flex items-center gap-2.5">
        <a
          href={`#${targetId}`}
          className="flex-1 rounded-full bg-gold px-5 py-3 text-center text-sm font-medium uppercase tracking-[0.15em] text-brand-deep shadow-gold"
        >
          Register Interest
        </a>
        <WhatsAppLink
          href={whatsappUrl(message)}
          project={projectSlug}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message us on WhatsApp"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-deep text-white"
        >
          <MessageCircle className="h-5 w-5" />
        </WhatsAppLink>
      </div>
    </div>
  )
}
