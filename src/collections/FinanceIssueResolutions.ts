import type { CollectionConfig } from 'payload'
import { financeAccess } from '@/access/finance'

// Written only by the authenticated Finance actions, which validate the live issue.
export const FinanceIssueResolutions: CollectionConfig = {
  slug: 'finance-issue-resolutions',
  admin: { group: 'Finance', useAsTitle: 'title' },
  access: { read: financeAccess, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'fingerprint', type: 'text', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'detail', type: 'textarea', required: true },
    { name: 'href', type: 'text', required: true },
    { name: 'note', type: 'textarea', required: true },
    { name: 'resolvedBy', type: 'text', required: true },
    { name: 'reopenedAt', type: 'date' },
  ],
}
