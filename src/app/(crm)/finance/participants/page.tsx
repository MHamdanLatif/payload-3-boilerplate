import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres'
import { financeExec } from '@/lib/finance-server'
import { fundingRows } from '@/lib/finance-ledger'
import { paisaRupees } from '@/lib/finance-query'
import { Badge } from '@/components/finance/FinanceUI'
import { LedgerForm } from '@/components/finance/LedgerForm'

export default async function Participants() {
  const exec = await financeExec()
  const [people, rows] = await Promise.all([
    exec(sql`SELECT * FROM finance_participants ORDER BY archived, name`),
    fundingRows(exec),
  ])
  const totals = new Map<number, { balance: number; shortfall: number }>()
  for (const r of rows) {
    const balance = Number(r.received) - Number(r.costs) - Number(r.refunds) + Number(r.adjustments)
    const t = totals.get(r.participant_id) || { balance: 0, shortfall: 0 }
    // Balances are per project; a shortfall in one project is never netted against another.
    if (balance >= 0) t.balance += balance
    else t.shortfall -= balance
    totals.set(r.participant_id, t)
  }
  return (
    <>
      <div className="finance-heading">
        <h2>Participants</h2>
        <Link className="finance-button" href="/finance/new/participant">
          + Add participant
        </Link>
      </div>
      <p>People who fund projects or receive commission. They do not log in. Archive anyone with history instead of deleting them.</p>
      <div className="finance-table">
        <table>
          <thead>
            <tr>
              {['Name', 'Phone', 'Unspent funding (all projects)', 'Shortfalls owed', 'Status', ''].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const t = totals.get(p.id)
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/finance/participants/${p.id}`}>{p.name}</Link> {p.is_owner && <Badge>Me</Badge>}
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td>{paisaRupees(t?.balance)}</td>
                  <td>{t?.shortfall ? <Badge tone="alert">{paisaRupees(t.shortfall)}</Badge> : '—'}</td>
                  <td>{p.archived ? 'Archived' : 'Active'}</td>
                  <td className="finance-actions">
                    <Link href={`/finance/new/participant?id=${p.id}`}>Edit</Link>
                    <LedgerForm
                      kind="archive"
                      entryKey={crypto.randomUUID()}
                      hidden={{ collection: 'participants', id: String(p.id), archived: String(!p.archived) }}
                      fields={[]}
                      submit={p.archived ? 'Restore' : 'Archive'}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!people.length && <p>No participants yet. Add yourself first, then each investor or referrer.</p>}
      </div>
    </>
  )
}
