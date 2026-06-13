import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { META_PIXEL_ID } from '@/components/MetaPixel'

type SearchParams = {
  project?: string
  source?: string // "project:<slug>" or "listing:<slug>"
}

function parseSource(source: string | undefined, legacyProject: string | undefined) {
  if (source) {
    const [kind, ...rest] = source.split(':')
    const slug = rest.join(':')
    if ((kind === 'project' || kind === 'listing') && slug) {
      return { kind, slug }
    }
  }
  if (legacyProject) return { kind: 'project' as const, slug: legacyProject }
  return null
}

export const metadata: Metadata = {
  title: 'Thank you | Lateef Properties',
  description: 'Your enquiry has been received. A senior advisor will reach out within 24 hours.',
  robots: { index: false, follow: false },
}

// The base pixel + initial PageView are mounted in the root layout via
// `<MetaPixel />`. This page only fires the conversion Lead event on top
// of that. `META_PIXEL_ID` is imported above and falls back to the hardcoded
// value when the env var isn't set — so the conversion fires in dev too.
const GOOGLE_ADS_CONVERSION_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID
const GOOGLE_ADS_CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { project, source } = await searchParams
  const parsed = parseSource(source, project)
  const displayName = parsed ? parsed.slug.replace(/-/g, ' ') : null
  const sourceLabel = parsed?.kind === 'listing' ? 'listing' : 'enquiry'
  const whatsappText = displayName
    ? `Hi, I just enquired about ${displayName}. Following up.`
    : 'Hi, I just enquired through your website. Following up.'

  return (
    <>
      {META_PIXEL_ID && (
        <>
          {/* Lead-event-only — base pixel (init + PageView) comes from the root layout's <MetaPixel />. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function waitFb(){if(typeof window.fbq==='function'){fbq('track','Lead'${displayName ? `,{content_name:'${displayName.replace(/'/g, "\\'")}'}` : ''});}else{setTimeout(waitFb,150);}})();`,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=Lead&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
      {GOOGLE_ADS_CONVERSION_ID && GOOGLE_ADS_CONVERSION_LABEL && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_CONVERSION_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ADS_CONVERSION_ID}');
                gtag('event', 'conversion', { 'send_to': '${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}' });
              `,
            }}
          />
        </>
      )}

      <main className="flex min-h-[80vh] items-center bg-ivory py-32">
        <div className="container max-w-2xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold bg-gold/10 text-gold">
            <Check className="h-7 w-7" strokeWidth={1.5} />
          </div>

          <span className="mt-8 inline-block font-mono text-[0.7rem] tracking-[0.3em] text-gold">
            REQUEST RECEIVED
          </span>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-brand-deep md:text-5xl lg:text-6xl">
            Thank you — we&rsquo;ll be in touch within 24 hours.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-brand-deep/70 md:text-lg">
            A senior advisor will call you on the number you shared{' '}
            {displayName ? (
              <>
                {sourceLabel === 'listing'
                  ? 'to schedule a viewing of '
                  : 'with available units and pricing for '}
                <span className="font-medium text-brand-deep">{displayName}</span>.
              </>
            ) : (
              <>with options matching your enquiry.</>
            )}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`https://wa.me/923363528333?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-hover"
            >
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp us now
            </a>
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 rounded-full border border-brand-deep/25 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-brand-deep transition-all duration-300 hover:border-brand-deep hover:bg-brand-deep hover:text-white"
            >
              Browse more properties
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <p className="mt-10 text-xs uppercase tracking-[0.25em] text-brand-deep/45">
            Ground Floor, Four Seasons Apartment · Block 16, Gulshan-e-Iqbal · Karachi
          </p>
        </div>
      </main>
    </>
  )
}
