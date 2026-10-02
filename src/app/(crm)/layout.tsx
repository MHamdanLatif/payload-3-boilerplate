import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { CrmShell } from '@/components/crm/CrmShell'
import '../(frontend)/globals.css'
import './crm.css'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { hasFinanceAccess } from '@/access/finance'

export const metadata: Metadata = {
  title: { default: 'Lateef CRM', template: '%s | Lateef CRM' },
  robots: { index: false, follow: false },
  manifest: '/leads-dashboard/manifest.webmanifest',
  applicationName: 'Lateef CRM',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: 'hsl(231 30% 27%)' }
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return (
    <html lang="en" className={GeistSans.variable} data-theme="light">
      <body className="crm">
        <CrmShell canFinance={hasFinanceAccess(user)}>{children}</CrmShell>
      </body>
    </html>
  )
}
