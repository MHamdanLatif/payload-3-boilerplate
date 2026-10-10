import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Listing unavailable | Lateef Properties', robots: { index: false, follow: true } }

// Standalone listings are retired. Do not redirect unrelated properties to a project.
export default function RetiredListingPage() { notFound() }
