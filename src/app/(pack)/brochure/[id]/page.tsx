import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead, Media } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { BrochureView } from '@/components/brochure/BrochureView'
import { logBrochureOpen, isCrawler } from '@/lib/brochure-open'
import { buildPackMeta } from '@/lib/pack-metadata'

/**
 * Project-specific link previews.
 *
 * A pack link shared on WhatsApp previously showed the generic company logo, so
 * a Tulip Comfort lead and a Saima Elite lead received visually identical
 * messages. The preview now carries the project's own elevation and name.
 *
 * noindex/nofollow is retained deliberately: Open Graph tags are read by
 * messaging crawlers, which ignore robots directives, so richer previews cost
 * nothing in search exposure. The page stays out of the index and the sitemap.
 *
 * No lead data appears here - see src/lib/pack-metadata.ts for why.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  let lead: Lead | null = null
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'leads',
      where: { brochureId: { equals: id } },
      depth: 2,
      limit: 1,
    })
    lead = (res.docs[0] as Lead) ?? null
  } catch {
    // Fall through to the generic preview rather than failing the page.
  }

  const payload = await getPayload({ config })
  const meta = await buildPackMeta(payload, lead, id)

  return {
    title: meta.title,
    description: meta.description,
    robots: { index: false, follow: false },
    alternates: { canonical: meta.canonical },
    openGraph: {
      type: 'website',
      siteName: 'Lateef Properties',
      title: meta.title,
      description: meta.description,
      url: meta.canonical,
      ...(meta.imageUrl
        ? { images: [{ url: meta.imageUrl, width: 1200, height: 630, alt: meta.title }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      ...(meta.imageUrl ? { images: [meta.imageUrl] } : {}),
    },
  }
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

  // Log the page open server-side (reliable on iOS, where the client beacon is
  // not), after the response is sent so it never delays render. Skip link-preview
  // crawlers so WhatsApp generating the chat card doesn't fire a false "opened".
  // A per-render id ties this page view to the row logged below, so the client's
  // time-on-page beacon updates that exact open rather than guessing at the
  // latest one. Minted here (not in `after`) so it can be handed to the client.
  const h = await headers()
  const ua = h.get('user-agent')
  const crawler = isCrawler(ua)
  const visitId = crypto.randomUUID()
  if (!crawler) {
    const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null
    const referrer = h.get('referer')
    after(() =>
      logBrochureOpen({ brochureId: id, asset: 'page', ip, userAgent: ua, referrer, visitId }),
    )
  }

  const base = getServerSideURL().replace(/\/$/, '')

  return (
    <BrochureView
      brochureId={id}
      visitId={crawler ? null : visitId}
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
