import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Header } from '@/Header/Component'
import { Footer } from '@/Footer/Component'

/**
 * The site's 404.
 *
 * It lives in the landing-page group because that group's `[adSlug]` route now
 * owns every unmatched root path — a mistyped `/propertes` resolves here, not to
 * the (frontend) not-found. Without the header and footer, the most common 404
 * on the site would be a dead end inside a stripped ad shell.
 *
 * So this deliberately does NOT inherit the group's minimal chrome: it imports
 * the real Header and Footer directly. Both take no props, so this is the whole
 * cost of keeping a wrong turn recoverable.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <div className="container py-28">
        <div className="prose max-w-none">
          <h1 style={{ marginBottom: 0 }}>404</h1>
          <p className="mb-4">This page could not be found.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="default">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/properties">Browse properties</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </>
  )
}
