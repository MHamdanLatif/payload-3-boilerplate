'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Handshake, Home, Plus, Wallet } from 'lucide-react'

const section = (path: string) =>
  path === '/finance'
    ? 'home'
    : /^\/finance\/(deals|receivables|receipts)/.test(path)
      ? 'deals'
      : /^\/finance\/(record|new|entry)/.test(path)
        ? 'record'
        : /^\/finance\/projects/.test(path)
          ? 'projects'
          : 'money'

/** Bottom navigation, the same pattern as the CRM. */
export function FinanceNav() {
  const active = section(usePathname())
  const item = (key: string, href: string, label: string, icon: React.ReactNode, extra = '') => (
    <Link
      href={href}
      className={[active === key ? 'active' : '', extra].join(' ').trim()}
      aria-current={active === key ? 'page' : undefined}
    >
      {icon}
      {label}
    </Link>
  )
  return (
    <nav className="crm-nav finance-nav" aria-label="Finance navigation">
      {item('home', '/finance', 'Home', <Home size={20} />)}
      {item('deals', '/finance/deals', 'Deals', <Handshake size={20} />)}
      {item('record', '/finance/record', 'Record', <Plus size={20} />, 'add')}
      {item('projects', '/finance/projects', 'Projects', <Building2 size={20} />)}
      {item('money', '/finance/money', 'Money', <Wallet size={20} />)}
    </nav>
  )
}

/** Pill tabs inside a section. */
export function FinanceTabs({ tabs }: { tabs: [label: string, href: string][] }) {
  const path = usePathname()
  return (
    <nav className="finance-tabs" aria-label="Section">
      {tabs.map(([label, href]) => (
        <Link key={href} href={href} className={path === href.split('?')[0] ? 'active' : ''}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

