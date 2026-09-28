import type { CollectionConfig } from 'payload'

export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'endpointHash', type: 'text', required: true, unique: true },
    { name: 'endpoint', type: 'text', required: true },
    { name: 'p256dh', type: 'text', required: true },
    { name: 'auth', type: 'text', required: true },
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true },
  ],
}
