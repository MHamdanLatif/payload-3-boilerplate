import type { Metadata } from 'next'
import '../(frontend)/globals.css'

export const metadata: Metadata = {
  title: 'Payment Plan Studio | Lateef Properties',
  robots: { index: false, follow: false },
}

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ivory text-brand-deep" style={{ fontFamily: 'Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
