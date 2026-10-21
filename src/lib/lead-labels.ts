import type { Lead } from '@/payload-types'

type Attribution = Partial<Lead>

const channels: Record<string, string> = {
  'meta-ads': 'Paid — Meta ads',
  'google-ads': 'Paid — Google ads',
  'google-organic': 'Organic — Google search',
  'instagram-organic': 'Organic — Instagram',
  direct: 'Direct website visit',
  whatsapp: 'WhatsApp enquiry',
  call: 'Phone enquiry',
  referral: 'Referral',
  manual: 'Manually added',
}
const surfaces: Record<string, string> = {
  'project-hero-form': 'Project page: top (hero) form',
  'project-enquiry-cta': 'Project page: bottom (CTA) form',
  'project-details-whatsapp': 'Project page: brochure request form',
  'project-pack': 'Project brochure request',
  'marketed-hero-form': 'Marketing page: top (hero) form',
  'marketed-cta-form': 'Marketing page: bottom (CTA) form',
  'payment-plan-pdf': 'Payment plan PDF download',
  'listing-form': 'Property listing: enquiry form',
  'consultation-form': 'Home page: consultation form',
  'zero-results-form': 'Property search: no-results enquiry form',
  'whatsapp-cta': 'WhatsApp button',
  'crm-manual': 'CRM: manually added',
}
const legacySurfaces: Record<string, string> = {
  'project-landing:hero': surfaces['project-hero-form'],
  'project-landing:final': surfaces['project-enquiry-cta'],
  'project-landing:brochure': surfaces['project-details-whatsapp'],
  'marketed-project-landing:hero': surfaces['marketed-hero-form'],
  'marketed-project-landing:final': surfaces['marketed-cta-form'],
  'payment-plan:pdf': surfaces['payment-plan-pdf'],
  'listing-landing:hero': 'Property listing: top (hero) form',
  'listing-landing:final': 'Property listing: bottom (CTA) form',
  'listing-landing:modal': 'Property listing: popup enquiry form',
  'project-landing:modal': 'Project page: popup enquiry form',
  'home:consultation': surfaces['consultation-form'],
  'properties:zero-results': surfaces['zero-results-form'],
}

/** A page/form is not evidence of paid traffic. Preserve unknown attribution. */
export function leadChannelLabel(lead: Attribution): string {
  if (lead.source === 'call' && lead.acquisitionSource === 'manual') return channels.call
  if (lead.acquisitionSource && channels[lead.acquisitionSource])
    return channels[lead.acquisitionSource]
  if (lead.sourceKind === 'meta-ad' || lead.metaAdName) return channels['meta-ads']
  return channels[lead.source || ''] || 'Source not recorded'
}
export function leadFormLabel(lead: Attribution): string {
  // Legacy placement can be more specific than the generic listing-form value.
  return (
    legacySurfaces[lead.source || ''] ||
    surfaces[lead.conversionSurface || ''] ||
    (lead.sourceKind === 'meta-ad' ? 'Meta instant form' : 'Form not recorded')
  )
}
export function leadProjectLabel(lead: Attribution): string {
  return lead.sourceName || lead.brochureHeadline || 'General enquiry (no project recorded)'
}
export function leadSourceLabel(lead: Attribution): string {
  return `${leadChannelLabel(lead)} · ${leadFormLabel(lead)}`
}
/** Same grouping used by report filters and CSV exports. */
export function leadReportLabel(lead: Attribution): string {
  return `${leadProjectLabel(lead)} · ${leadSourceLabel(lead)}${lead.metaAdName ? ` · Ad: ${lead.metaAdName}` : ''}`
}
