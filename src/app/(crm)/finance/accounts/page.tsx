import { FinanceTabs } from '@/components/finance/FinanceNav'
import { MONEY_TABS } from '@/lib/finance-nav'
import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { accountBalances, cashPurpose } from '@/lib/finance-ledger'
import { displayDate, paisaRupees, param, pktDate, rupees, todayPKT, type FinanceParams } from '@/lib/finance-query'
import { Badge } from '@/components/finance/FinanceUI'
import { LedgerForm } from '@/components/finance/LedgerForm'
import { VoidEntry } from '@/components/finance/VoidEntry'

export default async function Accounts({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const p = await searchParams
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(param(p, 'asOf')) ? param(p, 'asOf') : todayPKT()
  const exec = await financeExec()
  const [balances, purpose, statements, transfers] = await Promise.all([
    accountBalances(exec, asOf),
    cashPurpose(exec, asOf),
    exec(sql`SELECT s.*, a.name AS account_name FROM finance_statements s JOIN finance_accounts a ON a.id=s.account_id ORDER BY s.date DESC, s.id DESC LIMIT 50`),
    exec(sql`SELECT t.*, f.name AS from_name, a.name AS to_name FROM finance_transfers t JOIN finance_accounts f ON f.id=t.from_account_id JOIN finance_accounts a ON a.id=t.to_account_id ORDER BY t.date DESC, t.id DESC LIMIT 50`),
  ])
  // Each statement is compared with the recorded balance of its account on its own date.
  const checks = await Promise.all(
    statements.map(async (s): Promise<Record<string, any>> => {
      const rows = await accountBalances(exec, pktDate(s.date))
      const recorded = Number(rows.find((r) => r.id === s.account_id)?.balance || 0)
      return { ...s, recorded, difference: Math.round(Number(s.statement_balance) * 100) - recorded }
    }),
  )
  return (
    <>
      <FinanceTabs tabs={MONEY_TABS} />
      <div className="finance-heading">
        <h2>Accounts and reconciliation</h2>
        <div className="finance-actions">
          <Link className="finance-button" href="/finance/new/account">
            + Add account
          </Link>
          <Link className="finance-button secondary" href="/finance/new/transfer">
            + Transfer / card settlement
          </Link>
          <Link className="finance-button secondary" href="/finance/new/statement">
            + Statement balance
          </Link>
        </div>
      </div>
      <form className="finance-filters">
        <label>
          Balances as of (PKT)
          <input type="date" name="asOf" defaultValue={asOf} />
        </label>
        <button className="finance-button">Show</button>
        <a download href={`/finance/export?kind=account-report&from=${asOf.slice(0, 8)}01&to=${asOf}`}>
          Download reconciliation report (CSV)
        </a>
      </form>
      <p>
        These are <strong>recorded balances</strong>: what this app has been told, not a live bank feed. Compare them with your
        statements below.
      </p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Account', 'Type', 'Recorded balance', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.name} {a.archived && <Badge>Archived</Badge>}
                </td>
                <td>
                  {a.kind === 'card' ? 'Card (settles later)' : a.kind === 'cash' ? 'Cash' : 'Bank'} {a.card_label}
                </td>
                <td>{paisaRupees(a.balance)}</td>
                <td className="finance-actions">
                  <Link href={`/finance/new/account?id=${a.id}`}>Edit</Link>
                  <Link href={`/finance/new/statement?account=${a.id}`}>Enter statement</Link>
                  <LedgerForm
                    kind="archive"
                    entryKey={crypto.randomUUID()}
                    hidden={{ collection: 'accounts', id: String(a.id), archived: String(!a.archived) }}
                    fields={[]}
                    submit={a.archived ? 'Restore' : 'Archive'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!balances.length && <p>No accounts yet. Add your business bank account, with its opening balance.</p>}
      </div>
      <h2>What the recorded cash is for</h2>
      <p>Business performance, physical cash and what is owed to people are different things; this splits the recorded cash by purpose.</p>
      <div className="finance-table">
        <table>
          <tbody>
            {purpose.pools.map((x) => (
              <tr key={x.project}>
                <td>
                  Advertising funding remaining · <Link href={`/finance/projects/${x.project}`}>{x.title}</Link>
                </td>
                <td>
                  {paisaRupees(x.poolPaisa)} {x.poolPaisa < 0 && <Badge tone="alert">Project deficit</Badge>}
                </td>
              </tr>
            ))}
            <tr>
              <td>Commission received and retained, pending distribution</td>
              <td>{paisaRupees(purpose.commissionRetainedPaisa)}</td>
            </tr>
            <tr>
              <td>General business spending paid from these accounts</td>
              <td>{paisaRupees(purpose.generalSpendingPaisa)}</td>
            </tr>
            <tr>
              <td>Opening amount classified as mine</td>
              <td>{paisaRupees(purpose.openingOwnerPaisa)}</td>
            </tr>
            <tr>
              <td>Opening amount classified as other</td>
              <td>{paisaRupees(purpose.openingOtherPaisa)}</td>
            </tr>
            <tr>
              <td>Unclassified opening amount (needs classification)</td>
              <td>
                {paisaRupees(purpose.unclassifiedOpeningPaisa)}{' '}
                {purpose.unclassifiedOpeningPaisa !== 0 && <Badge tone="alert">Classify</Badge>}
              </td>
            </tr>
            <tr>
              <td>
                <strong>Total recorded cash</strong>
              </td>
              <td>
                <strong>{paisaRupees(purpose.recordedPaisa)}</strong>
                {purpose.differencePaisa !== 0 && <Badge tone="alert">Unexplained {paisaRupees(purpose.differencePaisa)}</Badge>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {(purpose.unassignedReceiptsPaisa > 0 || purpose.unassignedExpensesPaisa > 0) && (
        <p className="finance-warning">
          Older entries without an account are not in these balances: {paisaRupees(purpose.unassignedReceiptsPaisa)} of commission
          receipts and {paisaRupees(purpose.unassignedExpensesPaisa)} of expenses. Classify them when you set opening balances.
        </p>
      )}
      <h2>Statement checks</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Date', 'Account', 'Statement balance', 'Recorded balance', 'Difference'].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map((s) => (
              <tr key={s.id}>
                <td>{displayDate(s.date)}</td>
                <td>{s.account_name}</td>
                <td>{rupees(s.statement_balance)}</td>
                <td>{paisaRupees(s.recorded)}</td>
                <td>{s.difference === 0 ? <Badge>Reconciled</Badge> : <Badge tone="alert">{paisaRupees(s.difference)}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!checks.length && <p>No statement balances entered.</p>}
      </div>
      <h2>Transfers</h2>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Date', 'From', 'To', 'Amount', 'Type', 'Reference', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id}>
                <td>{displayDate(t.date)}</td>
                <td>{t.from_name}</td>
                <td>{t.to_name}</td>
                <td>{rupees(t.amount)}</td>
                <td>{t.kind === 'card-settlement' ? 'Card settlement' : 'Transfer'}</td>
                <td>{t.reference || '—'}</td>
                <td>{t.voided ? 'Voided' : <VoidEntry collection="transfers" id={t.id} next="/finance/accounts" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!transfers.length && <p>No transfers.</p>}
      </div>
    </>
  )
}
