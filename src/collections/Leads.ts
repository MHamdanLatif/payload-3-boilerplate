import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

/**
 * Backup copy of every website lead. The /api/leads route writes a row here on
 * every submission, independent of Privyr — so if the CRM webhook is down (or
 * rejects a lead), nothing is lost and the team can recover it from the admin.
 *
 * Read/update/delete are admin-only (leads are private). Creates come from the
 * server route via the Local API (which overrides access), so no public create
 * access is needed.
 *
 * Storage note: rows are a few hundred bytes each — negligible in the existing
 * Postgres DB, so this adds no meaningful Railway cost.
 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    group: 'CRM',
    defaultColumns: ['name', 'phone', 'sourceKind', 'privyrForwarded', 'createdAt'],
    description:
      'Automatic backup of every website lead, captured on submission independent of Privyr. If “Privyr forwarded” is unchecked, the CRM did not accept it — follow up manually.',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'email', type: 'text' },
    {
      name: 'sourceKind',
      type: 'text',
      admin: {
        description:
          'project | listing | location | payment-plan | consultation | zero-results | unknown',
      },
    },
    { name: 'sourceName', type: 'text', label: 'Enquiring about (name)' },
    { name: 'sourceSlug', type: 'text', label: 'Enquiring about (slug)' },
    { name: 'placement', type: 'text' },
    { name: 'source', type: 'text', label: 'Source tag' },
    { name: 'notes', type: 'textarea' },
    { name: 'propertyType', type: 'text' },
    { name: 'budget', type: 'text' },
    {
      name: 'searchedParams',
      type: 'json',
      admin: { description: 'Filters from the /properties no-results form, when applicable.' },
    },
    {
      name: 'privyrForwarded',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Did Privyr accept this lead? If unchecked, forward it manually.' },
    },
    {
      name: 'privyrStatus',
      type: 'text',
      admin: { readOnly: true, description: 'Privyr response status or error, for diagnostics.' },
    },
  ],
}
