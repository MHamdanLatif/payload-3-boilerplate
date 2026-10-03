import { notFound } from 'next/navigation'
import { sql } from '@payloadcms/db-postgres'
import { financeSession, financeQuery } from '@/lib/finance-server'
import { param, positiveID, todayPKT, rupees, type FinanceParams } from '@/lib/finance-query'
import { EntryForm, type EntryField } from '@/components/finance/EntryForm'
import type { FinanceProject } from '@/components/finance/DealFields'

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
  const fields: EntryField[] = []
  const field = (name: string, label: string, extra: Partial<EntryField> = {}) =>
    fields.push({ name, label, ...extra })
  const money = (name: string, label: string, required = true) =>
    field(name, label, { type: 'number', min: 0, step: '0.01', required })
  let projects: FinanceProject[] | undefined,
    initialProject = '',
    context = '',
    outstanding: number | undefined
  if (kind === 'deals') {
    const leadID = positiveID(param(p, 'lead'))
    const lead = leadID
      ? await payload.findByID({
          collection: 'leads',
          id: leadID,
          depth: 0,
          overrideAccess: false,
          user,
        })
      : null
    if (lead) {
      field('lead', '', { type: 'hidden', value: String(lead.id) })
      context = `From CRM: ${lead.name}`
      initialProject = String(
        lead.closedProject || lead.currentInterestedProject || lead.acquiredProject || '',
      )
    }
    projects = (
      await payload.find({
        collection: 'featured-projects',
        depth: 0,
        limit: 1000,
        select: { title: true, unitTypes: true },
        overrideAccess: false,
        user,
        sort: 'title',
      })
    ).docs
    field('clientName', 'Client name', { required: true, value: lead?.name })
    field('contact', 'Contact number', { value: lead?.phone })
    field('dateClosed', 'Date closed (PKT)', { type: 'date', required: true, value: todayPKT() })
    money('bookingAmount', 'Booking amount (PKR)', false)
    money('fixedCommission', 'Commission (PKR)')
    field('expectedPaymentDate', 'Expected commission date', { type: 'date', required: true })
  } else if (kind === 'expenses') {
    const deals = await financeQuery(
      sql`SELECT id,client_name,project_name FROM deals WHERE NOT COALESCE(cancelled,false) ORDER BY date_closed DESC,id DESC LIMIT 1000`,
    )
    field('deal', 'Expense for', {
      value: param(p, 'deal'),
      options: [
        { value: '', label: 'General expense (Meta Ads, office, etc.)' },
        ...deals.map((d) => ({
          value: String(d.id),
          label: `${d.client_name} · ${d.project_name} (#${d.id})`,
        })),
      ],
    })
    field('date', 'Payment date (PKT)', { type: 'date', required: true, value: todayPKT() })
    money('amount', 'Amount (PKR)')
    field('category', 'Category', { required: true, value: 'Miscellaneous' })
    field('description', 'Description', { required: true })
  } else {
    const id = positiveID(param(p, 'deal'))
    const [deal] = await financeQuery(sql`SELECT * FROM deals WHERE id=${id}`)
    if (!deal || deal.cancelled) notFound()
    context = `${deal.client_name} · ${deal.project_name} · ${rupees(deal.outstanding)} remaining`
    field('deal', '', { type: 'hidden', value: String(id) })
    if (kind === 'receipts') {
      outstanding = Number(deal.outstanding)
      field('date', 'Payment date (PKT)', { type: 'date', required: true, value: todayPKT() })
      money('amount', 'Amount (PKR)')
      field('nextExpectedDate', 'Next expected payment date', { type: 'date', required: true })
      field('reference', 'Payment reference (optional)')
    } else {
      field('expectedPaymentDate', 'Expected commission date', {
        type: 'date',
        required: true,
        value: deal.expected_payment_date
          ? new Date(new Date(deal.expected_payment_date).getTime() + 5 * 3600000)
              .toISOString()
              .slice(0, 10)
          : '',
      })
    }
  }
  if (kind !== 'receivables') field('notes', 'Notes (optional)', { type: 'textarea' })
  return (
    <>
      <h2>
        {kind === 'deals'
          ? 'Add deal'
          : kind === 'receipts'
            ? 'Record commission payment'
            : kind === 'receivables'
              ? 'Change expected payment date'
              : 'Add expense'}
      </h2>
      {context && (
        <p>
          <strong>{context}</strong>
        </p>
      )}
      <p>
        {kind === 'receipts'
          ? 'Enter the amount received. For a partial payment, choose when you expect the remaining balance.'
          : kind === 'deals'
            ? 'Choose the property, enter your commission and when you expect to receive it.'
            : 'All amounts are in PKR.'}
      </p>
      <EntryForm
        kind={kind}
        entryKey={crypto.randomUUID()}
        fields={fields}
        projects={projects}
        initialProject={initialProject}
        outstanding={outstanding}
      />
    </>
  )
}
