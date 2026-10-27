import Link from 'next/link'
import { financeSession } from '@/lib/finance-server'
import './finance.css'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Finance | Lateef Properties',
  robots: { index: false, follow: false },
}
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await financeSession()
  return (
    <main className="finance">
      <header className="finance-heading">
        <div>
          <p>Lateef Properties · Private</p>
          <h1>Finance</h1>
        </div>
        <div className="finance-actions">
          <Link className="finance-button" href="/finance/entry/deals">
            + Add Deal
          </Link>
          <Link className="finance-button secondary" href="/finance/entry/expenses">
            + Add Expense
          </Link>
        </div>
      </header>
      <nav className="finance-tabs" aria-label="Finance navigation">
        {[
          ['Overview', '/finance'],
          ['Deals', '/finance/deals'],
          ['Receivables', '/finance/receivables'],
          ['Commission Payments', '/finance/receipts'],
          ['Expenses', '/finance/expenses'],
          ['Projects & funding', '/finance/projects'],
          ['Ad charges', '/finance/ad-charges'],
          ['Participants', '/finance/participants'],
          ['Accounts', '/finance/accounts'],
          ['Reports', '/finance/reports'],
        ].map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  )
}
