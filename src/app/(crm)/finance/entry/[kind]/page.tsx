import { notFound } from 'next/navigation'
import { financeSession } from '@/lib/finance-server'
import { param, todayPKT, type FinanceParams } from '@/lib/finance-query'
import { EntryForm, type EntryField } from '@/components/finance/EntryForm'

export default async function Entry({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<FinanceParams>
}) {
  const { kind } = await params,
    p = await searchParams,
    { payload, user } = await financeSession()
  if (!['deals', 'receipts', 'receivables', 'expenses'].includes(kind)) notFound()
  const today = todayPKT()
  const fields: EntryField[] = []
  const field = (name: string, label: string, extra: Partial<EntryField> = {}) =>
    fields.push({ name, label, ...extra })
  const number = (name: string, label: string, value?: string) =>
    field(name, label, {
      type: 'number',
      step: '0.01',
      min: 0,
      value,
      required: ['saleValue', 'amount'].includes(name),
    })
  const option = (name: string, label: string, values: string[]) =>
    field(name, label, { options: values.map((value) => ({ value, label: value })) })
  let lead: any = null
  let contextLabel = ''
  if (kind === 'deals' && Number(param(p, 'lead')))
    lead = await payload.findByID({
      collection: 'leads',
      id: Number(param(p, 'lead')),
      depth: 0,
      overrideAccess: false,
      user,
    })
  if (kind === 'deals' || kind === 'expenses') {
    const projects = await payload.find({
      collection: 'featured-projects',
      depth: 0,
      limit: 1000,
      select: { title: true },
      overrideAccess: false,
      user,
      sort: 'title',
    })
    if (kind === 'deals') {
      if (lead) {
        field('lead', 'Linked CRM lead', { type: 'hidden', value: String(lead.id) })
        contextLabel = `From CRM: ${lead.name}`
      }
      field('clientName', 'Client name', { required: true, value: lead?.name })
      field('contact', 'Contact number', { value: lead?.phone })
    }
    field('project', 'Project', {
      required: kind === 'deals',
      value: String(
        lead?.closedProject || lead?.currentInterestedProject || lead?.acquiredProject || '',
      ),
      options: [
        { value: '', label: kind === 'expenses' ? 'Business overhead' : 'Select project' },
        ...projects.docs.map((d) => ({ value: String(d.id), label: d.title })),
      ],
    })
  }
  if (kind === 'deals') {
    field('unitNumber', 'Unit number', { required: true })
    field('unitType', 'Unit type')
    field('configuration', 'Bedrooms / configuration')
    number('sizeSqft', 'Size (sqft)')
    field('dateClosed', 'Date closed (PKT)', { type: 'date', required: true, value: today })
    number('saleValue', 'Sale value (PKR)')
    number('bookingAmount', 'Booking amount (PKR)')
    number('bookingPercentage', 'Client paid (%)', '0')
    number('requiredBookingPercentage', 'Required booking (%)', '20')
    field('expectedEligibilityDate', 'Expected eligibility date', { type: 'date' })
    const users = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1000,
      select: { name: true },
      overrideAccess: false,
      user,
    })
    field('salesperson', 'Salesperson / closed by', {
      value: String(user.id),
      options: users.docs.map((u) => ({ value: String(u.id), label: u.name || String(u.id) })),
    })
    option('calculationType', 'Commission calculation', ['percentage', 'fixed'])
    number('commissionRate', 'Commission rate (%)')
    number('fixedCommission', 'Fixed commission (PKR)')
    option('trigger', 'Commission trigger', ['threshold', 'booking', 'milestone', 'manual'])
    field('milestoneDescription', 'Custom milestone')
  } else {
    if (kind !== 'expenses') {
      const dealID = Number(param(p, 'deal'))
      if (!dealID) notFound()
      const deal = await payload.findByID({
        collection: 'finance-deals',
        id: dealID,
        depth: 0,
        overrideAccess: false,
        user,
      })
      contextLabel = `${deal.clientName} · Unit ${deal.unitNumber}`
      field('deal', `Deal: ${deal.clientName} · ${deal.unitNumber}`, {
        type: 'hidden',
        value: String(deal.id),
        required: true,
      })
      if (kind === 'receipts') {
        const schedules = await payload.find({
          collection: 'finance-receivables',
          where: { and: [{ deal: { equals: dealID } }, { voided: { not_equals: true } }] },
          depth: 0,
          limit: 1000,
          overrideAccess: false,
          user,
          sort: 'date',
        })
        field('receivable', 'Match expected payment (optional)', {
          options: [
            { value: '', label: 'Allocate to existing unpaid schedules' },
            ...schedules.docs.map((s) => ({
              value: String(s.id),
              label: `${s.date.slice(0, 10)} · Rs. ${s.amount}`,
            })),
          ],
        })
      }
    }
    field('date', kind === 'receivables' ? 'Expected date (PKT)' : 'Payment date (PKT)', {
      type: 'date',
      value: today,
      required: true,
    })
    number('amount', 'Amount (PKR)')
    if (kind === 'receipts') {
      field('paymentMethod', 'Payment method')
      field('reference', 'Transaction reference')
      field('receivedFrom', 'Received from / builder')
    }
    if (kind === 'expenses') {
      field('category', 'Category', { required: true, value: 'Miscellaneous' })
      field('description', 'Description', { required: true })
      field('paymentMethod', 'Payment method')
      field('vendor', 'Vendor / paid to')
    }
  }
  field('notes', 'Notes', { type: 'textarea' })
  return (
    <>
      <h2>
        {kind === 'deals'
          ? 'Add deal'
          : kind === 'receipts'
            ? 'Record commission payment'
            : kind === 'receivables'
              ? 'Schedule expected payment'
              : 'Add expense'}
      </h2>
      {contextLabel && (
        <p>
          <strong>{contextLabel}</strong>
        </p>
      )}
      <p>
        Amounts are PKR. Transaction corrections use void and replacement. Additional fields and
        audit details are available in the CMS editor.
      </p>
      <EntryForm kind={kind} entryKey={crypto.randomUUID()} fields={fields} />
    </>
  )
}
