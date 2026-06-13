import type { CollectionBeforeChangeHook } from 'payload'
import type { FeaturedProject } from '@/payload-types'
import { DEFAULT_PAYMENT_HEADS } from '@/lib/payment-heads'

/**
 * Seed the 19 default payment heads on every project that doesn't yet have any.
 * Runs on every save; only writes when `paymentPlan.paymentHeads` is empty/missing,
 * so admin edits are preserved on subsequent saves.
 */
export const seedPaymentHeads: CollectionBeforeChangeHook<FeaturedProject> = ({ data }) => {
  if (!data) return data
  const plan = (data as { paymentPlan?: { paymentHeads?: unknown[] } }).paymentPlan
  if (!plan) return data
  if (Array.isArray(plan.paymentHeads) && plan.paymentHeads.length > 0) return data

  plan.paymentHeads = DEFAULT_PAYMENT_HEADS.map((h) => ({ ...h }))
  return data
}
