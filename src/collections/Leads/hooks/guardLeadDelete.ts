import { APIError, type CollectionBeforeDeleteHook } from 'payload'

/** Set by the CRM delete route after the user has confirmed what happens to linked records. */
export const CRM_LEAD_DELETE = 'crmLeadDelete'

/**
 * Deleting from /admin gives no chance to explain that saved schedules go with
 * the lead and finance deals stay behind, so those leads must be deleted from
 * the CRM record, which asks first.
 */
export const guardLeadDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (req.context?.[CRM_LEAD_DELETE] === true) return
  const where = { lead: { equals: id } }
  const [schedules, deals] = await Promise.all([
    req.payload.count({ collection: 'lead-schedules', where, req, overrideAccess: true }),
    req.payload.count({ collection: 'finance-deals', where, req, overrideAccess: true }),
  ])
  const linked = [
    schedules.totalDocs ? 'a payment schedule' : '',
    deals.totalDocs ? 'a finance deal' : '',
  ].filter(Boolean)
  if (!linked.length) return
  throw new APIError(
    `This lead has ${linked.join(' and ')} – delete it from the CRM, where you'll be asked what to do with ${linked.length > 1 ? 'them' : 'it'}.`,
    400,
    null,
    true,
  )
}
