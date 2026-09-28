import type { Lead } from '@/payload-types'
import type { CrmPushMessage } from './crm-push'
import { getServerSideURL } from '@/utilities/getURL'
import { signLeadAction } from './lead-action-link'

export function leadNotificationMessage(lead: Lead, kind: string): CrmPushMessage {
  const base = getServerSideURL().replace(/\/$/, '')
  const actions: NonNullable<CrmPushMessage['actions']> = []
  if (lead.phone && lead.brochureId)
    actions.push({
      action: 'send-brochure',
      title: 'Send brochure',
      url: `${base}/api/leads/${lead.id}/send-brochure?sig=${signLeadAction(lead.id, 'send-brochure')}`,
    })
  if (lead.phone)
    actions.push({
      action: 'whatsapp',
      title: 'WhatsApp',
      url: `${base}/api/leads/${lead.id}/whatsapp?sig=${signLeadAction(lead.id, 'whatsapp')}`,
    })
  const reminder = kind !== 'new'
  return {
    title: reminder
      ? kind === '30m'
        ? 'Uncontacted lead: 30-minute reminder'
        : 'Uncontacted lead: 2-hour reminder'
      : 'New Lead',
    message: `${lead.name} - ${lead.sourceName || lead.brochureHeadline || 'General enquiry'}\n${lead.phone}\n${reminder ? 'Still Uncontacted. Please follow up.' : lead.metaAdName || lead.source || 'website'}`,
    priority: 'high',
    clickUrl: `${base}/leads-dashboard/${lead.id}`,
    actions,
  }
}
