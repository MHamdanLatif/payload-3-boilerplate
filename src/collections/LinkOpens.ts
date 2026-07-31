import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

/**
 * One row per brochure-link engagement event: a page open, or a specific asset
 * being viewed/played. Written by /api/brochure/[id]/open (server, Local API).
 * Powers the reporting dashboard's open-tracking and funnel.
 */
export const LinkOpens: CollectionConfig = {
  slug: 'link-opens',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'brochureId',
    group: 'CRM',
    defaultColumns: ['brochureId', 'asset', 'lead', 'createdAt'],
    description: 'Brochure link opens & asset engagement, logged automatically.',
  },
  fields: [
    { name: 'lead', type: 'relationship', relationTo: 'leads' },
    {
      name: 'brochureId',
      type: 'text',
      index: true,
      admin: { description: 'The brochure link id that was opened.' },
    },
    {
      name: 'asset',
      type: 'select',
      defaultValue: 'page',
      options: [
        { label: 'Page open', value: 'page' },
        { label: 'PDF 1', value: 'pdf1' },
        { label: 'PDF 2', value: 'pdf2' },
        { label: 'Map', value: 'map' },
        { label: 'Video', value: 'video' },
      ],
      admin: { description: 'What was engaged: the page itself, or a specific asset.' },
    },
    { name: 'ip', type: 'text', admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true } },
    { name: 'referrer', type: 'text', admin: { readOnly: true } },
  ],
}
