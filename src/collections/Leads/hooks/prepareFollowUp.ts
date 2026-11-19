import { ValidationError, type CollectionBeforeChangeHook } from 'payload'

export const prepareFollowUp: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.status === 'site-visit-pending' && originalDoc?.status !== 'site-visit-pending') {
    const reminder = data.followUpAt === undefined ? originalDoc?.followUpAt : data.followUpAt
    const time = reminder ? new Date(reminder).getTime() : NaN
    if (!Number.isFinite(time) || time <= Date.now()) {
      throw new ValidationError({
        errors: [{ path: 'followUpAt', message: 'Choose a future reminder for the pending site visit.' }],
      })
    }
  }
  if (data.followUpAt === undefined) return data
  const next = data.followUpAt ? new Date(data.followUpAt).getTime() : null
  const previous = originalDoc?.followUpAt ? new Date(originalDoc.followUpAt).getTime() : null
  if (next === previous) return data
  if (next !== null && (!Number.isFinite(next) || next <= Date.now())) {
    throw new ValidationError({
      errors: [{ path: 'followUpAt', message: 'Choose a future date and time for the reminder.' }],
    })
  }
  data.followUpAt = next === null ? null : new Date(next).toISOString()
  data.followUpSentAt = null
  data.followUpRepeatSentAt = null
  data.followUpRetryAt = null
  data.followUpClaim = null
  data.followUpStatus = next === null ? null : 'Pending'
  return data
}
