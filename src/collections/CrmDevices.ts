import type { CollectionConfig } from 'payload'

// One row per signed-in phone/tablet session. Laptops are never recorded, so they
// never count towards the per-account device limit (see src/lib/crm-devices.ts).
export const CrmDevices: CollectionConfig = {
  slug: 'crm-devices',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'sessionId', type: 'text', required: true, unique: true },
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'description', type: 'text' },
  ],
}
