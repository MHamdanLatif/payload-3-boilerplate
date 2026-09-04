import Image from 'next/image'
import { MapPin, Tag } from 'lucide-react'
import type { MarketedProject } from '@/payload-types'
import { MarketedLeadForm } from './MarketedLeadForm'
import { heroImage, imageAlt, formatPkr } from '@/lib/featured-projects'
import { availabilityLine, unitInterestOptions } from '@/lib/marketed-projects'

/** The hero form's anchor, targeted by the units CTA and the sticky bar. */
export const REGISTER_ANCHOR = 'register'

/**
 * Hero for a paid landing page.
 *
 * A copy of `ProjectHero` rather than a parameterised version of it: the two
 * differ in the availability format, five separate strings of form copy, the
 * presence of a unit-interest select, the anchor id, and the offer strip. Wiring
 * all of that through as optional props would leave both callers reading a soup
 * of flags, and would couple an ad page's copy to the organic page's.
 *
 * Mobile-first: the form sits BELOW the pitch on small screens and beside it
 * from `lg`. Ad traffic is ~81% mobile here, and a form that opens above the
 * project name asks for a phone number before saying what is being sold.
 */
export function MarketedHero({ project }: { project: MarketedProject }) {
  const bg = heroImage(project)
  const alt = imageAlt(project.elevationImages?.[0]?.image, project.title)
  const availability = availabilityLine(project)
  const unitOptions = unitInterestOptions(project)

  return (
    <section className="relative isolate overflow-hidden bg-brand-deep text-white">
      {bg && (
        <Image
          src={bg}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover"
        />
      )}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-brand-deep/95 via-brand-deep/80 to-brand-deep/40" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep/95 via-transparent to-transparent" />

      {/* Extra top padding, not margin: the header overlays this section, so
          the content has to clear it while the image still runs to the top. */}
      <div className="container relative grid grid-cols-1 items-center gap-10 pb-14 pt-24 md:pb-20 md:pt-28 lg:grid-cols-12 lg:gap-16 lg:pb-28 lg:pt-32">
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-brand-deep">
              <span className="h-1 w-1 rounded-full bg-brand-deep" />
              {project.status}
            </span>
            {project.builderName && (
              <span className="text-[0.7rem] uppercase tracking-[0.25em] text-white/55">
                by {project.builderName}
              </span>
            )}
          </div>

          <h1 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {project.title}
          </h1>

          {project.location && (
            <p className="mt-4 flex items-center gap-2 text-base text-white/85">
              <MapPin className="h-4 w-4 text-gold" />
              {project.location}
            </p>
          )}

          {project.summary && (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80">
              {project.summary}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {project.startingPrice && (
              <div className="inline-flex items-baseline gap-3 rounded-lg border border-white/15 bg-white/[0.06] px-5 py-3 backdrop-blur-sm">
                <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/55">
                  Starting from
                </span>
                <span className="font-serif text-2xl text-gold">
                  {formatPkr(project.startingPrice)}
                </span>
              </div>
            )}
            {project.offerNote && (
              <p className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
                <Tag className="h-4 w-4 shrink-0" />
                {project.offerNote}
              </p>
            )}
          </div>

          {availability && (
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/70">{availability}</p>
          )}
        </div>

        <div className="lg:col-span-5">
          <div id={REGISTER_ANCHOR} className="relative scroll-mt-24">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-gold/40 via-transparent to-transparent" />
            <div className="relative rounded-2xl border border-white/10 bg-white/95 p-6 text-brand-deep shadow-luxe sm:p-7">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 bg-gold" />
                <span className="eyebrow text-gold">Register Your Interest</span>
              </div>
              <h2 className="font-serif text-2xl leading-tight tracking-tight text-brand-deep">
                Tell us a little about you.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-deep/65">
                Get project details and pricing sent directly to your WhatsApp.
              </p>
              <div className="mt-5">
                <MarketedLeadForm project={project} placement="hero" unitOptions={unitOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
