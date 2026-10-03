import {
  APIError,
  type CollectionConfig,
  type Field,
  type NumberField,
  type RelationshipField,
  type CollectionBeforeChangeHook,
} from 'payload'
import { financeAccess } from '@/access/finance'

const money = (name: string, required = true): NumberField => ({
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
    }
  }
  if (collection.slug === 'finance-deals') {
    data.calculationType = 'fixed'
    data.trigger = 'booking'
    if (merged.fixedCommission == null) throw new APIError('Enter the commission amount.', 400)
    if (!merged.project && !merged.otherProperty?.trim())
      throw new APIError('Enter the property name or address.', 400)
    if (operation === 'create' && !merged.expectedPaymentDate)
      throw new APIError('Choose the expected commission date.', 400)
    if (
      merged.project &&
      merged.unitTypeKey &&
      (operation === 'create' ||
        merged.unitTypeKey !== originalDoc?.unitTypeKey ||
        String(idOf(merged.project)) !== String(idOf(originalDoc?.project)))
    ) {
      const project = await req.payload.findByID({
        collection: 'featured-projects',
        id: idOf(merged.project) as number,
        req,
        overrideAccess: false,
        depth: 0,
      })
      const unit = project.unitTypes?.find((u) => u.id === merged.unitTypeKey)
      if (!unit) throw new APIError('Select a unit type belonging to this project.', 400)
      data.unitType = unit.name || unit.type
      data.configuration = unit.type
      data.sizeSqft = unit.areaSqFt ?? null
    }
    if (!merged.project) {
      data.unitTypeKey = null
      data.configuration = null
      data.sizeSqft = null
    } else data.otherProperty = null
  }
  if (merged.deal) {
    const deal = await req.payload.findByID({
      collection: 'finance-deals',
      id: idOf(merged.deal) as number,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (collection.slug === 'finance-expenses' && operation === 'create')
      data.project = idOf(deal.project) || null
    if (collection.slug === 'finance-receipts' && operation === 'create') {
      if (!(merged.amount > 0)) throw new APIError('Enter a payment amount greater than zero.', 400)
      const receipts = await req.payload.find({
        collection: 'finance-receipts',
        where: { and: [{ deal: { equals: deal.id } }, { voided: { not_equals: true } }] },
        pagination: false,
        depth: 0,
        req,
        overrideAccess: false,
      })
      const paid = receipts.docs.reduce((total, r) => total + r.amount, 0)
      if (
        Math.round((Number(deal.fixedCommission || 0) - paid - merged.amount) * 100) > 0 &&
        !merged.nextExpectedDate
      )
        throw new APIError('Choose when the remaining commission is expected.', 400)
    }
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
        ? ['amount', 'date', 'project', 'deal', 'category']
        : ['amount', 'date', 'deal', 'receivable', 'nextExpectedDate']
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
    delete: slug === 'finance-receivables' ? () => false : financeAccess,
  },
  admin: {
    group: 'Finance',
    useAsTitle: title,
    description:
      'Private finance ledger. Posted amounts are immutable; void mistakes with a reason and enter a replacement. Dashboard: /finance',
  },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        if (slug !== 'finance-deals') return
        // Keep deletion atomic, including the deal's dependent ledger entries.
        for (const collection of [
          'finance-receipts',
          'finance-expenses',
          'finance-receivables',
        ] as const) {
          await req.payload.delete({
            collection,
            where: { deal: { equals: id } },
            req,
            overrideAccess: collection === 'finance-receivables',
          })
        }
      },
    ],
    beforeChange: [audit],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (
          slug === 'finance-receipts' &&
          operation === 'create' &&
          !doc.voided &&
          doc.nextExpectedDate
        ) {
          await req.payload.update({
            collection: 'finance-deals',
            id: idOf(doc.deal) as number,
            data: { expectedPaymentDate: doc.nextExpectedDate },
            req,
            overrideAccess: false,
          })
        }
        return doc
      },
    ],
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
    relationship('project', 'featured-projects'),
    text('otherProperty'),
    text('unitTypeKey'),
    { name: 'expectedPaymentDate', type: 'date', index: true },
    text('unitNumber'),
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
    choice('calculationType', ['percentage', 'fixed'], 'fixed'),
    { name: 'commissionRate', type: 'number', min: 0, max: 100 },
    { ...money('fixedCommission', false), label: 'Commission (PKR)' },
    choice('trigger', ['threshold', 'booking', 'milestone', 'manual'], 'booking'),
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
    { ...relationship('receivable', 'finance-receivables'), admin: { hidden: true } },
    { name: 'nextExpectedDate', type: 'date' },
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
    relationship('deal', 'finance-deals'),
    { ...relationship('project', 'featured-projects'), admin: { hidden: true } },
    text('description', true),
    text('paymentMethod'),
    text('vendor'),
    { name: 'recurring', type: 'checkbox', defaultValue: false },
  ],
  'description',
)

// Preserve legacy data while keeping the editor focused on the current workflow.
const legacyFields = new Set([
  'bookingPercentage',
  'requiredBookingPercentage',
  'expectedEligibilityDate',
  'calculationType',
  'commissionRate',
  'trigger',
  'milestoneDescription',
  'milestoneReached',
  'claimed',
  'configuration',
  'sizeSqft',
  'unitTypeKey',
])
for (const field of FinanceDeals.fields)
  if ('name' in field && legacyFields.has(field.name))
    field.admin = { ...field.admin, hidden: true }
FinanceReceivables.admin = { ...FinanceReceivables.admin, hidden: true }
FinanceReceivables.access!.create = () => false
