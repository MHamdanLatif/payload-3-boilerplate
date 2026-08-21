import { EMAIL, PHONE_DISPLAY, PHONE_E164, WHATSAPP_URL } from '@/lib/contact'

/**
 * Minimal footer for personalised project packs.
 *
 * Company identity, contact routes and the legal links — and nothing that
 * invites the lead back out into the site. The full footer's blog links,
 * neighbourhood lists, project directories and SEO internal-link blocks exist
 * to distribute crawl equity on indexable pages; these pages are noindex, so
 * that content has no purpose here and only competes with the CTA.
 */
export function PackFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-brand-deep/10 bg-ivory">
      <div className="container py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-serif text-lg tracking-tight text-brand-deep">Lateef Properties</p>
            <p className="mt-1 text-xs text-brand-deep/55">
              Authorised marketing agency for Karachi&rsquo;s leading developers.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <a className="text-brand-deep/75 hover:text-gold" href={`tel:${PHONE_E164}`}>
              {PHONE_DISPLAY}
            </a>
            <a
              className="text-brand-deep/75 hover:text-gold"
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp an advisor
            </a>
            <a className="break-all text-brand-deep/75 hover:text-gold" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-brand-deep/10 pt-6 text-xs text-brand-deep/45 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {year} Lateef Properties. All rights reserved.</span>
          <span className="flex gap-4">
            <a className="hover:text-gold" href="/privacy">Privacy</a>
            <a className="hover:text-gold" href="/terms">Terms</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
