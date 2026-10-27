import { financeSession } from '@/lib/finance-server'
import { FinanceNav } from '@/components/finance/FinanceNav'
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
      <p className="finance-eyebrow">Lateef Properties · Private finance</p>
      {children}
      <FinanceNav />
    </main>
  )
}
