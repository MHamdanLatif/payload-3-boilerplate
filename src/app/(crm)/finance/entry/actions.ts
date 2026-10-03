'use server'
import { redirect } from 'next/navigation'
import { financeSession } from '@/lib/finance-server'
import { revalidatePath } from 'next/cache'
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
    'otherProperty',
    'unitNumber',
    'unitType',
    'unitTypeKey',
    'dateClosed',
    'saleValue',
    'bookingAmount',
    'fixedCommission',
    'expectedPaymentDate',
    'notes',
  ],
  receipts: ['deal', 'date', 'amount', 'nextExpectedDate', 'reference', 'notes'],
  receivables: ['deal', 'expectedPaymentDate'],
  expenses: ['deal', 'date', 'amount', 'category', 'description', 'notes'],
}
const numeric = new Set([
  'lead',
  'project',
  'deal',
  'saleValue',
  'bookingAmount',
  'fixedCommission',
  'amount',
])
export async function removeFinanceEntry(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const { payload, user } = await financeSession()
  const kind = String(form.get('kind'))
  const id = Number(form.get('id'))
  if (!['deals', 'receipts', 'expenses'].includes(kind) || !Number.isSafeInteger(id) || id < 1)
    return { error: 'Invalid entry.' }
  const collection = collections[kind as 'deals' | 'receipts' | 'expenses']
  let destination = '/finance/deals?period=all'
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: false, user })
    if (kind === 'deals' && form.get('cancel') === 'true') {
      await payload.update({
        collection: 'finance-deals',
        id,
        data: { cancelled: true },
        overrideAccess: false,
        user,
      })
      destination = `/finance/deals/${id}`
    } else {
      await payload.delete({ collection, id, overrideAccess: false, user })
      const deal = 'deal' in doc ? doc.deal : null
      if (kind !== 'deals')
        destination = deal
          ? `/finance/deals/${typeof deal === 'object' ? deal.id : deal}`
          : '/finance/expenses'
    }
    revalidatePath('/finance', 'layout')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not remove this entry.' }
  }
  redirect(destination)
}
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
    if (key === 'project' && value === 'other') {
      data.project = null
      continue
    }
    if (value)
      data[key] = numeric.has(key)
        ? Number(value)
        : ['date', 'dateClosed', 'expectedPaymentDate', 'nextExpectedDate'].includes(key)
          ? `${value}T00:00:00+05:00`
          : value
  }
  let id: number
  try {
    if (kind === 'receivables') {
      if (!data.deal || !data.expectedPaymentDate) return { error: 'Choose an expected date.' }
      await payload.update({
        collection: 'finance-deals',
        id: data.deal,
        data: { expectedPaymentDate: data.expectedPaymentDate },
        overrideAccess: false,
        user,
      })
      id = data.deal
    } else {
      if (kind === 'deals') data.salesperson = user.id
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
