/**
 * Collections that can back the payment-plan calculator and its generated PDF.
 *
 * The PDF endpoint deliberately re-reads the project server-side rather than
 * trusting the numbers posted by the browser, which means it needs to know
 * WHICH collection to read. Kept as an allowlist in one place so the value can
 * cross the network from a client component and still be validated on arrival —
 * an arbitrary string here would otherwise become an arbitrary collection read.
 */
export const PAYMENT_PLAN_COLLECTIONS = ['featured-projects', 'marketed-projects'] as const

export type PaymentPlanCollection = (typeof PAYMENT_PLAN_COLLECTIONS)[number]

export function isPaymentPlanCollection(value: unknown): value is PaymentPlanCollection {
  return (
    typeof value === 'string' && (PAYMENT_PLAN_COLLECTIONS as readonly string[]).includes(value)
  )
}
