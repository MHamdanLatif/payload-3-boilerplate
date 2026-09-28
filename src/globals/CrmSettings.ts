import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

/**
 * Editable CRM settings — currently the WhatsApp "Send File" message template.
 * Stored in the DB (not an env var) so the copy can be tweaked in the admin
 * without a redeploy. The SendFileButton reads this at click time.
 *
 * Placeholders — replaced when a lead is sent their brochure:
 *   {name}    → the lead's first name
 *   {project} → what they enquired about (sourceName / brochure headline)
 *   {link}    → their unique trackable brochure link (/brochure/<id>)
 */
export const CrmSettings: GlobalConfig = {
  slug: 'crm-settings',
  label: 'CRM Settings',
  access: {
    read: authenticated,
    update: authenticated,
  },
  admin: {
    group: 'CRM',
    description: 'Settings for the native CRM — the WhatsApp brochure message template.',
  },
  fields: [
    {
      name: 'automaticUncontactedReminders',
      type: 'checkbox',
      defaultValue: true,
      label: 'Automatic Uncontacted lead reminders',
      admin: {
        description:
          'Notify at 30 minutes and 2 hours after creation if still Uncontacted. Separate from manually scheduled follow-ups.',
      },
    },
    {
      name: 'notificationStartAt',
      type: 'date',
      admin: { hidden: true },
      access: { update: () => false },
    },
    {
      name: 'whatsappMessageTemplate',
      type: 'textarea',
      label: 'WhatsApp brochure message',
      defaultValue: "Hi {name}, here's the {project} brochure: {link}",
      admin: {
        description:
          'Sent via the “Send File” button. Placeholders: {name}, {project}, {link}. The lead reviews and taps send in WhatsApp themselves.',
      },
    },
  ],
}
