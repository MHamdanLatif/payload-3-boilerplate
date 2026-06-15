/**
 * Master payment-head catalogue. Each project starts with these 19 heads
 * pre-seeded (via the FeaturedProjects beforeChange hook); admins toggle them
 * on/off per project and can add Custom Heads under one of the four backend
 * categories.
 */

export type PaymentHeadCategory =
  | 'Initial Payment'
  | 'Time-Based'
  | 'Grey Structure'
  | 'Finishing'
  | 'Possession'

export type PaymentHead = {
  name: string
  category: PaymentHeadCategory
  enabled: boolean
  isCustom: boolean
  /**
   * Slab Casting only. The slab payment fires once per slab cast; with N slabs
   * the schedule shows N milestone rows under this head, each carrying the
   * head's allocated amount / N. Falsy / unset → 1 event (the head fires once).
   */
  numberOfSlabs?: number | null
}

const SLAB_HEAD_PATTERN = /\bslab\b/i

/** Does this head's name look like the slab-casting milestone? */
export function isSlabCastingHead(h: PaymentHead): boolean {
  return h.category === 'Grey Structure' && SLAB_HEAD_PATTERN.test(h.name)
}

/** How many separate events this head fires. Slab Casting honours numberOfSlabs; all others = 1. */
export function headEventCount(h: PaymentHead): number {
  if (!isSlabCastingHead(h)) return 1
  const n = Number(h.numberOfSlabs ?? 0)
  return n > 0 ? Math.floor(n) : 1
}

export const DEFAULT_PAYMENT_HEADS: PaymentHead[] = [
  // Initial Payment (consolidated into the buyer-facing Down Payment slider).
  { name: 'Booking', category: 'Initial Payment', enabled: true, isCustom: false },
  { name: 'Allocation', category: 'Initial Payment', enabled: true, isCustom: false },
  { name: 'Confirmation', category: 'Initial Payment', enabled: true, isCustom: false },
  { name: 'Start of Work', category: 'Initial Payment', enabled: true, isCustom: false },

  // Time-Based (per-frequency cadences).
  { name: 'Monthly Installments', category: 'Time-Based', enabled: true, isCustom: false },
  { name: 'Quarterly Installments', category: 'Time-Based', enabled: false, isCustom: false },
  { name: 'Half Yearly Installments', category: 'Time-Based', enabled: false, isCustom: false },

  // Grey Structure milestones.
  { name: 'Excavation', category: 'Grey Structure', enabled: true, isCustom: false },
  { name: 'Foundation', category: 'Grey Structure', enabled: true, isCustom: false },
  { name: 'Plinth', category: 'Grey Structure', enabled: true, isCustom: false },
  { name: 'Slab casting', category: 'Grey Structure', enabled: true, isCustom: false },
  { name: 'Block masonry', category: 'Grey Structure', enabled: true, isCustom: false },
  { name: 'Plaster', category: 'Grey Structure', enabled: true, isCustom: false },

  // Finishing milestones.
  { name: 'Electric work', category: 'Finishing', enabled: true, isCustom: false },
  { name: 'Plumbing work', category: 'Finishing', enabled: true, isCustom: false },
  { name: 'Coloring', category: 'Finishing', enabled: true, isCustom: false },
  { name: 'Flooring', category: 'Finishing', enabled: true, isCustom: false },
  { name: 'Finishing', category: 'Finishing', enabled: true, isCustom: false },

  // Final Phase.
  { name: 'Possession', category: 'Possession', enabled: true, isCustom: false },
]

export const TIME_BASED_NAMES = {
  Monthly: 'Monthly Installments',
  Quarterly: 'Quarterly Installments',
  HalfYearly: 'Half Yearly Installments',
} as const

export type InstallmentFrequencyKind = keyof typeof TIME_BASED_NAMES

export const FREQUENCY_MONTHS: Record<InstallmentFrequencyKind, number> = {
  Monthly: 1,
  Quarterly: 3,
  HalfYearly: 6,
}

export function frequencyFromHeadName(name: string): InstallmentFrequencyKind | null {
  if (name === TIME_BASED_NAMES.Monthly) return 'Monthly'
  if (name === TIME_BASED_NAMES.Quarterly) return 'Quarterly'
  if (name === TIME_BASED_NAMES.HalfYearly) return 'HalfYearly'
  return null
}

export function isInitialHead(h: PaymentHead): boolean {
  return h.category === 'Initial Payment'
}

export function isGreyHead(h: PaymentHead): boolean {
  return h.category === 'Grey Structure'
}

export function isFinishingHead(h: PaymentHead): boolean {
  return h.category === 'Finishing'
}
