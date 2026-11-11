import type { CollectionConfig } from 'payload'
import { financeAccess } from '@/access/finance'

/** Private accounting identity, independent of whether a project has an organic page. */
export const FinanceProjects: CollectionConfig = {
  slug: 'finance-projects',
  access: {
    read: financeAccess,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: { group: 'Finance', useAsTitle: 'title', description: 'Created automatically from Featured Projects and standalone Marketed Projects.' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'sourceKey', type: 'text', required: true, unique: true, admin: { hidden: true } },
    { name: 'featuredProject', type: 'relationship', relationTo: 'featured-projects', unique: true },
    { name: 'marketedProject', type: 'relationship', relationTo: 'marketed-projects', unique: true },
  ],
}
