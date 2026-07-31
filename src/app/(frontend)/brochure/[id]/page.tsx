import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead, Media } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { BrochureView } from '@/components/brochure/BrochureView'

export const metadata: Metadata = {
  title: 'Your brochure | Lateef Properties',
  description: 'Your personalised property brochure.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function mediaUrl(m: number | Media | null | undefined, base: string): string | null {
  if (!m || typeof m !== 'object' || !m.url) return null
  try {
    return new URL(m.url, base).href
  } catch {
    return null
  }
}

export default async function BrochurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'leads',
    where: { brochureId: { equals: id } },
    depth: 1,
    limit: 1,
  })
  const lead = res.docs[0] as Lead | undefined
  if (!lead) notFound()

  const base = getServerSideURL().replace(/\/$/, '')

  return (
    <BrochureView
      brochureId={id}
      assets={{
        headline: lead.brochureHeadline,
        name: lead.name,
        pdf1: mediaUrl(lead.brochurePdfPrimary, base),
        pdf2: mediaUrl(lead.brochurePdfSecondary, base),
        mapEmbed: lead.brochureMapEmbed,
        videoUrl: lead.brochureVideoUrl,
      }}
    />
  )
}
