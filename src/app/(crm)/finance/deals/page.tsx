import Link from 'next/link'
import { dealRows, financeSession } from '@/lib/finance-server'
import { displayDate, rupees, param, type FinanceParams } from '@/lib/finance-query'
import { Badge, Pager, PeriodFilter } from '@/components/finance/FinanceUI'

export default async function Deals({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams
  const { rows, page, total } = await dealRows(p)
  const { payload, user } = await financeSession()
  const [projects, users] = await Promise.all([
    payload.find({
      collection: 'featured-projects',
      depth: 0,
      limit: 1000,
      select: { title: true },
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'users',
      depth: 0,
      limit: 1000,
      select: { name: true },
      overrideAccess: false,
      user,
    }),
  ])
  return (
    <>
      <h2>Deals</h2>
      <PeriodFilter params={p} />
      <form className="finance-filters">
        {['period', 'month', 'from', 'to'].map((k) => (
          <input key={k} type="hidden" name={k} value={param(p, k)} />
        ))}
        <label>
          Search client, phone or unit
          <input name="q" defaultValue={param(p, 'q')} />
        </label>
        <label>
          Project
          <select name="project" defaultValue={param(p, 'project')}>
            <option value="">All properties</option>
            <option value="other">Other properties / brokerage</option>
            {projects.docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={param(p, 'status')}>
            <option value="">All statuses</option>
            {['Awaiting Payment', 'Partially Received', 'Fully Received', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Salesperson
          <select name="salesperson" defaultValue={param(p, 'salesperson')}>
            <option value="">Everyone</option>
            {users.docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expected receipt month
          <input type="month" name="expectedMonth" defaultValue={param(p, 'expectedMonth')} />
        </label>
        <label>
          Balance
          <select name="balance" defaultValue={param(p, 'balance')}>
            <option value="">All</option>
            <option value="paid">Fully paid</option>
            <option value="outstanding">Outstanding</option>
          </select>
        </label>
        <label>
          Overdue
          <select name="overdue" defaultValue={param(p, 'overdue')}>
            <option value="">All</option>
            <option value="yes">Overdue only</option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={param(p, 'sort')}>
            <option value="date">Date closed</option>
            <option value="sale">Sale value</option>
            <option value="commission">Commission</option>
            <option value="outstanding">Outstanding</option>
            <option value="expected">Expected receipt date</option>
          </select>
        </label>
        <button className="finance-button">Filter deals</button>
      </form>
      <p>Outstanding is your commission minus payments received.</p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {[
                'Client',
                'Contact',
                'Project',
                'Unit',
                'Unit type',
                'Date closed',
                'Sale value',
                'Commission',
                'Received',
                'Outstanding',
                'Next payment',
                'Status',
                'Notes',
              ].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/finance/deals/${d.id}`}>{d.client_name}</Link>
                </td>
                <td>{d.contact}</td>
                <td>{d.project_name}</td>
                <td>{d.unit_number}</td>
                <td>{d.unit_type}</td>
                <td>{displayDate(d.date_closed)}</td>
                <td>{rupees(d.sale_value)}</td>
                <td>{rupees(d.commission)}</td>
                <td>{rupees(d.received)}</td>
                <td>{rupees(d.outstanding)}</td>
                <td>{displayDate(d.next_payment)}</td>
                <td>
                  <Badge>{d.status}</Badge>
                </td>
                <td>{d.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No deals match these filters.</p>}
      </div>
      <Pager params={p} page={page} total={total} />
      <a download href="/finance/export?kind=deals">
        Export all deals (CSV)
      </a>
    </>
  )
}
