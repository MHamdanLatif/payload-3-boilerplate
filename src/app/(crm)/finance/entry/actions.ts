'use server'
import { redirect } from 'next/navigation'
import { financeSession } from '@/lib/finance-server'
const collections = {
  deals: 'finance-deals',
  receipts: 'finance-receipts',
  receivables: 'finance-receivables',
  expenses: 'finance-expenses',
} as const
const allowed = {
  deals: [
    'lead',
    'clientName',
    'contact',
    'project',
    'unitNumber',
    'unitType',
    'configuration',
    'sizeSqft',
    'dateClosed',
    'saleValue',
    'bookingAmount',
    'bookingPercentage',
    'requiredBookingPercentage',
    'expectedEligibilityDate',
    'salesperson',
    'calculationType',
    'commissionRate',
    'fixedCommission',
    'trigger',
    'milestoneDescription',
    'notes',
  ],
  receipts: [
    'deal',
    'receivable',
    'date',
    'amount',
    'paymentMethod',
    'reference',
    'receivedFrom',
    'notes',
  ],
  receivables: ['deal', 'date', 'amount', 'notes'],
  expenses: [
    'date',
    'amount',
    'category',
    'project',
    'description',
    'paymentMethod',
    'vendor',
    'notes',
  ],
}
const numeric = new Set([
  'lead',
  'project',
  'deal',
  'receivable',
  'salesperson',
  'sizeSqft',
  'saleValue',
  'bookingAmount',
  'bookingPercentage',
  'requiredBookingPercentage',
  'commissionRate',
  'fixedCommission',
  'amount',
])
export async function saveFinanceEntry(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const { payload, user } = await financeSession()
  const kind = String(form.get('kind')) as keyof typeof collections
  if (!Object.hasOwn(collections, kind)) return { error: 'Invalid entry type.' }
  const entryKey = String(form.get('entryKey') || '')
  if (!/^[a-f\d-]{36}$/i.test(entryKey)) return { error: 'Invalid submission. Reload the form.' }
  const data: Record<string, any> = { entryKey }
  for (const key of allowed[kind]) {
    const value = String(form.get(key) || '').trim()
    if (value)
      data[key] = numeric.has(key)
        ? Number(value)
        : ['date', 'dateClosed', 'expectedEligibilityDate'].includes(key)
          ? `${value}T00:00:00+05:00`
          : value
  }
  let id: number
  try {
    const existing = await payload.find({
      collection: collections[kind],
      where: { entryKey: { equals: entryKey } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
      user,
    })
    if (existing.docs[0]) id = existing.docs[0].id
    else {
      const doc = await payload.create({
        collection: collections[kind],
        data: data as any,
        overrideAccess: false,
        user,
      })
      id = doc.id
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save this entry. Please retry.',
    }
  }
  redirect(
    kind === 'deals'
      ? `/finance/deals/${id}`
      : data.deal
        ? `/finance/deals/${data.deal}`
        : `/finance/${kind}`,
  )
}
