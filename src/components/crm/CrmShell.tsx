'use client'
import { CrmNotifications, disableCrmNotifications } from './CrmNotifications'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Users, Plus, BarChart3, Clock, Eye } from 'lucide-react'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}
export function CrmShell({ children, canFinance = false }: { children: React.ReactNode; canFinance?: boolean }) {
  const path = usePathname()
  const router = useRouter()
  const login = path.endsWith('/login')
  const finance = path.startsWith('/finance')
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [offline, setOffline] = useState(false)
  const [hint, setHint] = useState('')
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine)
    online()
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    window.addEventListener('online', online)
    window.addEventListener('offline', online)
    const prompt = (event: Event) => {
      event.preventDefault()
      setInstall(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', prompt)
    const installed = () => {
      setInstall(null)
      setStandalone(true)
    }
    window.addEventListener('appinstalled', installed)
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .register('/leads-dashboard/sw.js', { scope: '/leads-dashboard' })
        .catch(() => {})
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', online)
      window.removeEventListener('beforeinstallprompt', prompt)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  useEffect(() => {
    if (login) return
    let last = 0
    const refresh = async () => {
      if (
        document.visibilityState !== 'visible' ||
        !navigator.onLine ||
        Date.now() - last < 15 * 60_000
      )
        return
      last = Date.now()
      try {
        const result = await fetch('/api/users/refresh-token', {
          method: 'POST',
          credentials: 'include',
        })
        if (result.status === 401 || result.status === 403)
          router.replace(
            '/leads-dashboard/login?next=' +
              encodeURIComponent(window.location.pathname + window.location.search),
          )
      } catch {
        /* Keep unsaved forms intact when connectivity drops. */
      }
    }
    void refresh()
    const timer = setInterval(refresh, 15 * 60_000)
    const visible = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [login, router])
  return (
    <>
      <header className="crm-top">
        <Link href="/leads-dashboard" className="crm-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lateef-logo.png" alt="Lateef Properties" width={100} height={52} />
          <span>CRM</span>
        </Link>
        <div className="flex items-center">
          {canFinance && <Link href="/finance" className="px-3">Finance</Link>}
          {!standalone && (
            <button
              onClick={async () => {
                if (!install) {
                  setHint(
                    'In Chrome, open the three-dot menu, then Add to Home screen and Install app.',
                  )
                  return
                }
                await install.prompt()
                await install.userChoice
                setInstall(null)
              }}
            >
              Install app
            </button>
          )}
          {!login && (
            <button
              onClick={async () => {
                try {
                  await disableCrmNotifications()
                  const result = await fetch('/api/users/logout', { method: 'POST' })
                  if (!result.ok) throw Error()
                  window.location.assign('/leads-dashboard/login')
                } catch {
                  setHint('Could not sign out. Check your connection and try again.')
                }
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      {offline && (
        <div className="crm-notice">You are offline. Reconnect before saving changes.</div>
      )}
      {hint && (
        <div className="crm-notice flex justify-between gap-3">
          {hint}
          <button aria-label="Dismiss message" onClick={() => setHint('')}>
            Close
          </button>
        </div>
      )}
      {!login && !finance && <CrmNotifications />}
      {children}
      {!login && !finance && (
        <nav className="crm-nav" aria-label="CRM navigation">
          <Link className={path === '/leads-dashboard' ? 'active' : ''} href="/leads-dashboard">
            <Users size={20} />
            Leads
          </Link>
          <Link href="/leads-dashboard?view=followups">
            <Clock size={20} />
            Follow-ups
          </Link>
          <Link
            className={path === '/leads-dashboard/brochures' ? 'active' : ''}
            aria-current={path === '/leads-dashboard/brochures' ? 'page' : undefined}
            href="/leads-dashboard/brochures"
          >
            <Eye size={20} />
            Brochures
          </Link>
          <Link className="add" href="/leads-dashboard/new">
            <Plus size={20} />
            Add lead
          </Link>
          <Link
            className={path.includes('/reports') ? 'active' : ''}
            href="/leads-dashboard/reports"
          >
            <BarChart3 size={20} />
            Reports
          </Link>
        </nav>
      )}
    </>
  )
}
