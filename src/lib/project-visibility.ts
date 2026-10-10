import type { Where } from 'payload'

/** Legacy projects remain available until an editor explicitly withdraws them. */
export const availableProjectsWhere: Where = {
  or: [{ salesAvailability: { equals: 'available' } }, { salesAvailability: { exists: false } }],
}

export function isProjectAvailable(project: { salesAvailability?: string | null }) {
  return !project.salesAvailability || project.salesAvailability === 'available'
}

export function hasPublicPaymentPlan(project: {
  status?: string | null
  readyPaymentPlanConfirmed?: boolean | null
  paymentPlan?: { enabled?: boolean | null } | null
}) {
  return (
    project.paymentPlan?.enabled !== false &&
    (project.status !== 'Ready to Move' || project.readyPaymentPlanConfirmed === true)
  )
}
