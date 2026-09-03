import type { MarketedProject } from '@/payload-types'
import { LeadForm } from '@/components/forms/LeadForm'

/**
 * The landing page's form, in both places it appears.
 *
 * Exists so the hero and the closing CTA cannot drift apart — the same eight
 * props, including the copy, set once. The only difference between the two is
 * `placement`, which decides the conversion surface recorded against the lead
 * and therefore answers "does the hero or the closing form actually convert?"
 */
export function MarketedLeadForm({
  project,
  placement,
  unitOptions,
  tone = 'light',
}: {
  project: MarketedProject
  placement: 'hero' | 'final'
  unitOptions: string[]
  tone?: 'light' | 'dark'
}) {
  return (
    <LeadForm
      sourceName={project.title}
      sourceSlug={project.slug}
      sourceKind="marketed-project"
      placement={placement}
      tone={tone}
      submitLabel="Register Interest"
      footnote="We typically send details on your WhatsApp directly within a couple of minutes. Your details stay private."
      conversionSurface={placement === 'hero' ? 'marketed-hero-form' : 'marketed-cta-form'}
      unitOptions={unitOptions}
      // No navigation on success: /thank-you lives in the main site shell and
      // would hand a converted visitor the full navigation this page removes.
      inlineSuccess
    />
  )
}
