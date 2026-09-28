import type { GlobalConfig } from 'payload'

// VAPID private key never leaves the server or appears in the admin/API.
export const CrmPushSettings: GlobalConfig = {
  slug: 'crm-push-settings',
  admin: { hidden: true },
  access: { read: () => false, update: () => false },
  fields: [
    { name: 'publicKey', type: 'text', required: true },
    { name: 'privateKey', type: 'text', required: true },
  ],
}
