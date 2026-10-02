import {
  APIError,
  type CollectionConfig,
  type Field,
  type RelationshipField,
  type CollectionBeforeChangeHook,
} from 'payload'
import { financeAccess } from '@/access/finance'

const money = (name: string, required = true): Field => ({
  name,
  type: 'number',
  min: 0,
  max: 999999999999,
  required,
  validate: (v) =>
    (v == null
      ? !required
      : Number.isFinite(v) &&
        v >= 0 &&
        v <= 999999999999 &&
        Math.abs(v * 100 - Math.round(v * 100)) < 0.001) ||
    'Use a non-negative amount with at most two decimal places.',
})
const text = (name: string, required = false): Field => ({ name, type: 'text', required })
const date = (name: string): Field => ({
  name,
  type: 'date',
  required: true,
  index: true,
  admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd MMM yyyy' } },
})
const choice = (name: string, options: string[], defaultValue = options[0]): Field => ({
  name,
  type: 'select',
  required: true,
  options,
  defaultValue,
})
const relationship = (
  name: string,
  relationTo: 'users' | 'leads' | 'featured-projects' | 'finance-deals' | 'finance-receivables',
  required = false,
): RelationshipField => ({ name, type: 'relationship', relationTo, required, index: true })
const idOf = (v: unknown) => (typeof v === 'object' && v ? (v as { id: number }).id : v)
const audit: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
  collection,
}) => {
  data.createdBy = operation === 'create' ? req.user?.id : idOf(originalDoc.createdBy)
  data.updatedBy = req.user?.id
  data.createdAt = operation === 'create' ? new Date().toISOString() : originalDoc.createdAt
  if (operation === 'create') data.entryKey ||= crypto.randomUUID()
  else data.entryKey = originalDoc.entryKey
  if (data.voided && !data.voidReason?.trim() && !originalDoc?.voidReason?.trim())
    throw new APIError('A reason is required to void a record.', 400)
  const merged = { ...originalDoc, ...data }
  if (collection.slug === 'finance-deals' && merged.lead) {
    const lead = await req.payload.findByID({
      collection: 'leads',
      id: idOf(merged.lead) as number,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (operation === 'create') {
      data.clientName ||= lead.name
      data.contact ||= lead.phone
      data.project ||= idOf(
        lead.closedProject || lead.currentInterestedProject || lead.acquiredProject,
      )
    }
  }
  if (collection.slug === 'finance-deals') {
    if (merged.calculationType === 'percentage' && merged.commissionRate == null)
      throw new APIError('Enter a commission rate.', 400)
    if (merged.calculationType === 'fixed' && merged.fixedCommission == null)
      throw new APIError('Enter a fixed commission.', 400)
    if (merged.trigger === 'threshold' && merged.requiredBookingPercentage == null)
      throw new APIError('Enter the required booking percentage.', 400)
  }
  if (merged.deal) {
    const deal = await req.payload.findByID({
      collection: 'finance-deals',
      id: idOf(merged.deal) as number,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (deal.cancelled && !merged.voided)
      throw new APIError('This deal is cancelled. Reopen it before adding transactions.', 400)
  }
  if (collection.slug === 'finance-receipts' && merged.receivable) {
    const schedule = await req.payload.findByID({
      collection: 'finance-receivables',
      id: idOf(merged.receivable) as number,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (idOf(schedule.deal) !== idOf(merged.deal) || schedule.voided)
      throw new APIError('Expected payment must be active and belong to the same deal.', 400)
  }
  // Once posted, transactions keep their monetary identity. Correct errors by voiding
  // and recording a replacement; notes and void reasons remain editable.
  if (
    operation === 'update' &&
    ['finance-receipts', 'finance-expenses', 'finance-receivables'].includes(collection.slug)
  ) {
    const immutable =
      collection.slug === 'finance-expenses'
        ? ['amount', 'date', 'project', 'category']
        : ['amount', 'date', 'deal', 'receivable']
    for (const field of immutable)
      if (
        data[field] !== undefined &&
        String(idOf(data[field]) ?? '') !== String(idOf(originalDoc[field]) ?? '')
      )
        throw new APIError(
          `Posted ${field} cannot change. Void this entry and create a replacement.`,
          400,
        )
    if (originalDoc.voided && data.voided === false)
      throw new APIError('Voided entries cannot be restored. Create a replacement.', 400)
  }
  return data
}
const base = (slug: string, fields: Field[], title: string): CollectionConfig => ({
  slug,
  access: {
    create: financeAccess,
    read: financeAccess,
    update: financeAccess,
    delete: () => false,
  },
  admin: {
    group: 'Finance',
    useAsTitle: title,
    description:
      'Private finance ledger. Posted amounts are immutable; void mistakes with a reason and enter a replacement. Dashboard: /finance',
  },
  hooks: {
    beforeChange: [audit],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (slug === 'finance-deals' && operation === 'create' && data?.lead) {
          const lead = await req.payload.findByID({
            collection: 'leads',
            id: idOf(data.lead) as number,
            depth: 0,
            req,
            overrideAccess: false,
          })
          data.clientName ||= lead.name
          data.contact ||= lead.phone
          data.project ||= idOf(
            lead.closedProject || lead.currentInterestedProject || lead.acquiredProject,
          )
        }
        return data
      },
    ],
  },
  fields: [
    ...fields,
    { name: 'notes', type: 'textarea' },
    { name: 'entryKey', type: 'text', unique: true, index: true, admin: { hidden: true } },
    ...(['finance-deals'].includes(slug)
      ? []
      : [
          {
            name: 'voided',
            type: 'checkbox',
            defaultValue: false,
            admin: {
              description:
                'Exclude this entry from totals. A reason is required. This cannot be undone.',
            },
          } as Field,
          text('voidReason'),
        ]),
    {
      ...relationship('createdBy', 'users'),
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      ...relationship('updatedBy', 'users'),
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
  ],
  timestamps: true,
})

export const FinanceDeals = base(
  'finance-deals',
  [
    relationship('lead', 'leads'),
    text('clientName', true),
    text('contact'),
    relationship('project', 'featured-projects', true),
    text('unitNumber', true),
    text('unitType'),
    text('configuration'),
    { name: 'sizeSqft', type: 'number', min: 0 },
    date('dateClosed'),
    money('saleValue'),
    money('bookingAmount', false),
    {
      name: 'bookingPercentage',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      required: true,
    },
    { name: 'requiredBookingPercentage', type: 'number', min: 0, max: 100, defaultValue: 20 },
    { name: 'expectedEligibilityDate', type: 'date' },
    relationship('salesperson', 'users'),
    choice('calculationType', ['percentage', 'fixed']),
    { name: 'commissionRate', type: 'number', min: 0, max: 100 },
    money('fixedCommission', false),
    choice('trigger', ['threshold', 'booking', 'milestone', 'manual']),
    text('milestoneDescription'),
    { name: 'milestoneReached', type: 'checkbox', defaultValue: false },
    { name: 'claimed', type: 'checkbox', defaultValue: false },
    { name: 'cancelled', type: 'checkbox', defaultValue: false },
  ],
  'clientName',
)
export const FinanceReceivables = base(
  'finance-receivables',
  [relationship('deal', 'finance-deals', true), date('date'), money('amount')],
  'date',
)
export const FinanceReceipts = base(
  'finance-receipts',
  [
    relationship('deal', 'finance-deals', true),
    relationship('receivable', 'finance-receivables'),
    date('date'),
    money('amount'),
    text('paymentMethod'),
    text('reference'),
    text('receivedFrom'),
  ],
  'date',
)
export const FinanceExpenses = base(
  'finance-expenses',
  [
    date('date'),
    money('amount'),
    {
      name: 'category',
      type: 'text',
      required: true,
      defaultValue: 'Miscellaneous',
      admin: {
        description:
          'Meta Ads, Digital Advertising, Marketing, Website / Hosting, CRM / Software, Office, Salaries, Sales / Referral Commission, Travel / Fuel, Printing, Photography / Video, Client Entertainment, Professional Fees, Utilities, Miscellaneous. New categories may be entered directly.',
      },
    },
    relationship('project', 'featured-projects'),
    text('description', true),
    text('paymentMethod'),
    text('vendor'),
    { name: 'recurring', type: 'checkbox', defaultValue: false },
  ],
  'description',
)
