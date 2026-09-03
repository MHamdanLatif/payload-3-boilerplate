import type { CollectionBeforeChangeHook } from 'payload'
import { DEFAULT_PAYMENT_HEADS } from '@/lib/payment-heads'

/**
 * Seed the 19 default payment heads on every project that doesn't yet have any.
 * Runs on every save; only writes when `paymentPlan.paymentHeads` is empty/missing,
 * so admin edits are preserved on subsequent saves.
 *
 * Deliberately untyped against a specific collection: `marketed-projects` carries
 * its own copy of the same `paymentPlan` group and needs identical seeding, and
 * the body only ever touches that group.
 */
export const seedPaymentHeads: CollectionBeforeChangeHook = ({ data }) => {
  if (!data) return data
  const plan = (data as { paymentPlan?: { paymentHeads?: unknown[] } }).paymentPlan
  if (!plan) return data
  if (Array.isArray(plan.paymentHeads) && plan.paymentHeads.length > 0) return data

  plan.paymentHeads = DEFAULT_PAYMENT_HEADS.map((h) => ({ ...h }))
  return data
}
