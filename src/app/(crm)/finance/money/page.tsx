import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { accountBalances, cashPurpose, fundingRows } from '@/lib/finance-ledger'
import { paisaRupees } from '@/lib/finance-query'
import { MONEY_TABS } from '@/lib/finance-nav'
import { FinanceTabs } from '@/components/finance/FinanceNav'

/** Where the money is, and who it belongs to, at a glance. */
export default async function Money() {
  const exec = await financeExec()
  const [accounts, purpose, people, funding] = await Promise.all([
    accountBalances(exec),
    cashPurpose(exec),
    exec(sql`SELECT id, name, is_owner FROM finance_participants WHERE NOT archived ORDER BY is_owner DESC, name`),
    fundingRows(exec),
  ])
  const owed = new Map<number, number>()
  for (const r of funding) {
    const b = Number(r.received) - Number(r.costs) - Number(r.refunds) + Number(r.adjustments)
    if (b < 0) owed.set(r.participant_id, (owed.get(r.participant_id) || 0) - b)
  }
  return (
    <>
      <h1>Money</h1>
      <FinanceTabs tabs={MONEY_TABS} />
      <div className="finance-cards">
        <div className="finance-card">
          <span>Recorded cash</span>
          <strong>{paisaRupees(purpose.recordedPaisa)}</strong>
          <small>All accounts, as entered here</small>
        </div>
        <div className="finance-card">
          <span>Ad money still unspent</span>
          <strong>{paisaRupees(purpose.pools.reduce((a, p) => a + p.poolPaisa, 0))}</strong>
          <small>Belongs to project funders</small>
        </div>
        <div className="finance-card">
          <span>Commission held</span>
          <strong>{paisaRupees(purpose.commissionRetainedPaisa)}</strong>
          <small>Received, not yet paid out</small>
        </div>
      </div>
      <div className="finance-heading">
        <h2>Accounts</h2>
        <Link className="finance-button small secondary" href="/finance/new/account">
          + Add account
        </Link>
      </div>
      <div className="finance-list">
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <Link key={a.id} className="finance-item" href="/finance/accounts">
              <div className="finance-row">
                <h3>{a.name}</h3>
                <span className="finance-amount">{paisaRupees(a.balance)}</span>
              </div>
              <p>{a.kind === 'card' ? 'Card (settles later)' : a.kind === 'cash' ? 'Cash' : 'Bank account'}</p>
            </Link>
          ))}
        {!accounts.length && <p>No accounts yet. Add the account your commission and ad money go through.</p>}
      </div>
      <div className="finance-heading">
        <h2>People</h2>
        <Link className="finance-button small secondary" href="/finance/new/participant">
          + Add person
        </Link>
      </div>
      <div className="finance-list">
        {people.map((x) => (
          <Link key={x.id} className="finance-item" href={`/finance/participants/${x.id}`}>
            <div className="finance-row">
              <h3>
                {x.name} {x.is_owner && <span className="finance-badge">Me</span>}
              </h3>
              {owed.get(x.id) ? (
                <span className="finance-badge overdue">Owes {paisaRupees(owed.get(x.id))} top-up</span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
      <p>
        <Link href="/finance/accounts">Cash by purpose, statements and transfers</Link> ·{' '}
        <Link href="/admin/collections/finance-audit-log">Change history</Link>
      </p>
    </>
  )
}
