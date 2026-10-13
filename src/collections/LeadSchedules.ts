import type { CollectionConfig } from 'payload'

const staff: NonNullable<CollectionConfig['access']>['read'] = ({ req }) =>
  req.user?.collection === 'users'
// Writes go through the CRM endpoint so revision checks cannot be bypassed via REST.
const access = { read: staff, create: () => false, update: () => false, delete: () => false }
export const LeadSchedules: CollectionConfig = {
  slug: 'lead-schedules',
  access,
  admin: {
    group: 'CRM',
    useAsTitle: 'title',
    description: 'Saved payment schedules. Edit from the client record in CRM.',
  },
  fields: [
    { name: 'lead', type: 'relationship', relationTo: 'leads', required: true, index: true },
    { name: 'title', type: 'text', required: true, maxLength: 120 },
    { name: 'entryKey', type: 'text', required: true, unique: true },
  ],
}
export const ScheduleRevisions: CollectionConfig = {
  slug: 'schedule-revisions',
  access,
  admin: {
    group: 'CRM',
    useAsTitle: 'revisionKey',
    description: 'Immutable snapshots saved explicitly from CRM.',
  },
  fields: [
    {
      name: 'schedule',
      type: 'relationship',
      relationTo: 'lead-schedules',
      required: true,
      index: true,
    },
    { name: 'revision', type: 'number', required: true, min: 1 },
    { name: 'revisionKey', type: 'text', required: true, unique: true },
    { name: 'settings', type: 'json', required: true },
    { name: 'buyerName', type: 'text', required: true, maxLength: 120 },
    { name: 'buyerPhone', type: 'text', required: true, maxLength: 60 },
    { name: 'note', type: 'textarea', maxLength: 1000 },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', required: true },
  ],
}
