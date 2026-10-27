import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeExec, financeQuery } from '@/lib/finance-server'
import { param, rupees, type FinanceParams } from '@/lib/finance-query'

const PICK: Record<string, { title: string; help: string; href: (id: number) => string }> = {
  commission: {
    title: 'Commission received — which deal?',
    help: 'Choose the deal the builder paid. You can also say if you have already withdrawn or paid it out.',
    href: (id) => `/finance/new/commission?deal=${id}`,
  },
  payout: {
    title: 'Pay out or withdraw — which deal?',
    help: 'Choose the deal whose commission you are paying out (to yourself or someone else).',
    href: (id) => `/finance/new/payout?deal=${id}`,
  },
  'deal-expense': {
    title: 'Deal expense — which deal?',
    help: 'Only for costs of one specific deal, such as a broker fee.',
    href: (id) => `/finance/new/deal-expense?deal=${id}`,
  },
}

/** One place to record anything. Everything is a tap or two away. */
export default async function Record({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams
  const what = param(p, 'for')
  if (PICK[what]) {
    const q = param(p, 'q').slice(0, 80)
    const deals = await financeQuery(sql`SELECT d.id, d.client_name, d.project_name, d.commission, d.received, d.outstanding, d.cancelled
      FROM deals d WHERE (${q}='' OR d.client_name ILIKE ${`%${q}%`} OR d.project_name ILIKE ${`%${q}%`})
      ORDER BY d.cancelled, d.outstanding DESC, d.date_closed DESC LIMIT 60`)
    const pick = PICK[what]
    return (
      <>
        <h1>{pick.title}</h1>
        <p>{pick.help}</p>
        <form className="finance-filters">
          <input type="hidden" name="for" value={what} />
          <label style={{ flex: 1 }}>
            Search client or project
            <input name="q" defaultValue={q} />
          </label>
          <button className="finance-button secondary">Search</button>
        </form>
        <div className="finance-list">
          {deals.map((d) => (
            <Link key={d.id} className="finance-item" href={pick.href(d.id)}>
              <h3>{d.client_name}</h3>
              <p>{d.project_name}</p>
              <div className="finance-row">
                <span>
                  Received {rupees(d.received)} of {rupees(d.commission)}
                </span>
                {d.cancelled ? (
                  <span className="finance-badge">Cancelled</span>
                ) : Number(d.outstanding) > 0 ? (
                  <span className="finance-badge">{rupees(d.outstanding)} to come</span>
                ) : (
                  <span className="finance-badge good">Fully received</span>
                )}
              </div>
            </Link>
          ))}
        </div>
        {!deals.length && (
          <p>
            No deals yet. <Link href="/finance/entry/deals">Add a deal</Link> first.
          </p>
        )}
      </>
    )
  }
  if (what === 'funding' || what === 'campaign') {
    const projects = await (
      await financeExec()
    )(sql`SELECT id, title FROM featured_projects ORDER BY title`)
    return (
      <>
        <h1>{what === 'funding' ? 'Money from an investor — which project?' : 'New campaign — which project?'}</h1>
        <div className="finance-list">
          {projects.map((x) => (
            <Link key={x.id} className="finance-item" href={`/finance/new/${what}?project=${x.id}`}>
              <h3>{x.title}</h3>
            </Link>
          ))}
        </div>
      </>
    )
  }
  const tile = (href: string, label: string, hint: string, primary = false) => (
    <Link className={`finance-tile${primary ? ' primary' : ''}`} href={href}>
      {label}
      <small>{hint}</small>
    </Link>
  )
  return (
    <>
      <h1>Record</h1>
      <p>What happened? Pick one.</p>
      <div className="finance-tiles">
        {tile('/finance/record?for=commission', 'Commission received', 'The builder paid you', true)}
        {tile('/finance/record?for=payout', 'Pay out / withdraw', 'Commission to you or a partner', true)}
        {tile('/finance/entry/deals', 'New deal', 'A closed sale')}
        {tile('/finance/new/ad-charge', 'Ad spend', 'A Meta charge on your bank or card')}
        {tile('/finance/record?for=funding', 'Money from investor', 'Funding for a project’s ads')}
        {tile('/finance/entry/expenses', 'Business expense', 'Office, software, travel…')}
        {tile('/finance/record?for=deal-expense', 'Deal expense', 'E.g. a broker fee on one deal')}
        {tile('/finance/new/transfer', 'Transfer', 'Between accounts, or paying a card')}
        {tile('/finance/new/statement', 'Bank statement', 'Check the balance matches')}
      </div>
      <h2>Set up</h2>
      <div className="finance-tiles">
        {tile('/finance/new/participant', 'Add person', 'Investor, partner or referrer')}
        {tile('/finance/new/account', 'Add account', 'Bank, cash or card')}
        {tile('/finance/record?for=campaign', 'Add campaign', 'Under a project')}
      </div>
    </>
  )
}
