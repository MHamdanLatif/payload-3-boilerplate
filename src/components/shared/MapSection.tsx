import { MapPin } from 'lucide-react'
import { SectionRule } from '@/components/landing/SectionRule'

type Props = {
  embedUrl: string | null | undefined
  itemTitle: string
  location?: string | null
  sectionNumber?: string
  heading?: string
}

export function MapSection({
  embedUrl,
  itemTitle,
  location,
  sectionNumber = '04 / LOCATION',
  heading = "Where you'll be",
}: Props) {
  if (!embedUrl) return null

  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="container">
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              {sectionNumber}
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl">
            {heading}
          </h2>
          <SectionRule className="mt-6" />
          {location && (
            <p className="mt-6 inline-flex items-center gap-2 text-base text-brand-deep/70 md:text-lg">
              <MapPin className="h-4 w-4 text-gold" />
              {location}
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-brand-deep/10 shadow-luxe">
          {/* Explicit width/height eliminates Cumulative Layout Shift while
              the iframe loads. The CSS `aspect-[16/10]` then takes over for
              responsive sizing once the layout is committed. */}
          <iframe
            src={embedUrl}
            title={`Map of ${itemTitle}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            width={1600}
            height={1000}
            className="aspect-[16/10] w-full"
          />
        </div>
      </div>
    </section>
  )
}
