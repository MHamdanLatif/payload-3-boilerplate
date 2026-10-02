import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { financeAdminField, isFinanceAdmin } from '../../access/finance'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: ({ req }) => isFinanceAdmin(req.user),
    delete: ({ req }) => isFinanceAdmin(req.user),
    read: authenticated,
    update: ({ req }) =>
      isFinanceAdmin(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 30 * 24 * 60 * 60,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // Payload's first-user onboarding bypasses create access. Bootstrap only an
        // empty installation; existing installations are handled by the migration.
        if (
          operation === 'create' &&
          (await req.payload.count({ collection: 'users', req, overrideAccess: true }))
            .totalDocs === 0
        ) {
          data.financeAdmin = true
          data.financeAccess = true
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'financeAccess',
      type: 'checkbox',
      defaultValue: false,
      access: { create: financeAdminField, update: financeAdminField },
    },
    {
      name: 'financeAdmin',
      type: 'checkbox',
      defaultValue: false,
      access: { create: financeAdminField, update: financeAdminField },
      admin: { description: 'May grant finance access and manage other users.' },
    },
    {
      name: 'name',
      type: 'text',
    },
  ],
  timestamps: true,
}
