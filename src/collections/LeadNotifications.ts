import type { CollectionConfig } from 'payload'

export const LeadNotifications: CollectionConfig = {
  slug: 'lead-notifications',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'eventKey', type: 'text', required: true, unique: true },
    { name: 'lead', type: 'relationship', relationTo: 'leads', index: true },
    { name: 'kind', type: 'text', required: true },
    { name: 'dueAt', type: 'date', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'retryAt', type: 'date' },
    { name: 'claim', type: 'text' },
    { name: 'finishedAt', type: 'date' },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'receipts', type: 'json', defaultValue: [] },
    { name: 'deliveryStatus', type: 'text' },
  ],
}
