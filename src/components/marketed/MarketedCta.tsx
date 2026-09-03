import type { MarketedProject } from '@/payload-types'
import { MarketedLeadForm } from './MarketedLeadForm'
import { unitInterestOptions } from '@/lib/marketed-projects'
import { SectionRule } from '@/components/landing/SectionRule'

/** Anchor for the closing form. */
export const ENQUIRE_ANCHOR = 'enquire'

/**
 * Closing CTA — the same form as the hero, for the visitor who read everything.
 *
 * Dark panel rather than the hero's white card so the page ends on the brand's
 * deep tone, and so the two forms are not mistaken for the same element
 * repeated by a rendering bug.
 */
export function MarketedCta({
  project,
  sectionNumber = '06 / REGISTER INTEREST',
}: {
  project: MarketedProject
  sectionNumber?: string
}) {
  const unitOptions = unitInterestOptions(project)

  return (
    <section id={ENQUIRE_ANCHOR} className="scroll-mt-24 bg-brand-deep py-20 text-white md:py-28">
      <div className="container grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              {sectionNumber}
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Ready to see <i className="text-gold">{project.title}?</i>
          </h2>
          <SectionRule className="mt-6" />
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/75">
            Share your details and we&rsquo;ll send the full pricing, payment plan and
            availability straight to your WhatsApp.
          </p>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
            <MarketedLeadForm
              project={project}
              placement="final"
              unitOptions={unitOptions}
              tone="dark"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
