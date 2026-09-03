import { PHONE_DISPLAY, PHONE_E164 } from '@/lib/contact'

/**
 * The barest footer the page can legally carry.
 *
 * Identity, one phone number, and the two legal links — Privacy and Terms stay
 * because Meta's ad review looks for them on a landing page, and because they
 * are the right thing to publish next to a form that collects a phone number.
 *
 * Everything else the site footer carries (socials, neighbourhood lists, project
 * directories, blog links) exists to spread crawl equity across indexable pages.
 * This page is noindex, so none of it has a job here except to offer an exit.
 *
 * Extra bottom padding on mobile so the sticky action bar never covers the
 * legal links.
 */
export function MarketedFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-brand-deep/10 bg-ivory pb-24 md:pb-0">
      <div className="container py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-lg tracking-tight text-brand-deep">Lateef Properties</p>
            <p className="mt-1 text-xs text-brand-deep/55">
              Authorised marketing agency for Karachi&rsquo;s leading developers.
            </p>
          </div>
          <a className="text-sm text-brand-deep/75 hover:text-gold" href={`tel:${PHONE_E164}`}>
            {PHONE_DISPLAY}
          </a>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-brand-deep/10 pt-6 text-xs text-brand-deep/45 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {year} Lateef Properties. All rights reserved.</span>
          <span className="flex gap-4">
            <a className="hover:text-gold" href="/privacy">
              Privacy
            </a>
            <a className="hover:text-gold" href="/terms">
              Terms
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
