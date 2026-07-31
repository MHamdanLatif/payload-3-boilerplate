'use client'

import { useEffect, useRef } from 'react'
import { FileText, MapPin } from 'lucide-react'
import { WhatsAppLink } from '@/components/shared/WhatsAppLink'

export type BrochureAssets = {
  headline?: string | null
  name?: string | null
  pdf1?: string | null
  pdf2?: string | null
  mapEmbed?: string | null
  videoUrl?: string | null
  whatsapp?: string | null
}

type Asset = 'page' | 'pdf1' | 'pdf2' | 'map' | 'video'

function track(brochureId: string, asset: Asset) {
  try {
    const body = JSON.stringify({ asset })
    // sendBeacon survives navigation; fall back to keepalive fetch.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`/api/brochure/${brochureId}/open`, new Blob([body], { type: 'application/json' }))
    } else {
      void fetch(`/api/brochure/${brochureId}/open`, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
    }
  } catch {
    /* tracking must never break the page */
  }
}

/** Convert a YouTube/Vimeo watch URL to an embeddable src. */
function toEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (/youtube\.com$/.test(u.hostname) || u.hostname === 'www.youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`
    }
    if (u.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean).pop()}`
    return url
  } catch {
    return null
  }
}

function useTrackInView(brochureId: string, asset: Asset) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let done = false
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !done) {
          done = true
          track(brochureId, asset)
          io.disconnect()
        }
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [brochureId, asset])
  return ref
}

/**
 * Inline PDF preview — renders the brochure right on the page via Google's PDF
 * viewer, which displays reliably on mobile (incl. Android, where a raw <iframe>
 * to a PDF forces a download). No download button; the lead reads it in place.
 * The media is already public (served from R2), so no new exposure. Engagement
 * is tracked when the preview scrolls into view.
 */
function PdfPreview({
  brochureId,
  url,
  label,
  asset,
}: {
  brochureId: string
  url: string
  label: string
  asset: Asset
}) {
  const ref = useTrackInView(brochureId, asset)
  const src = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
  return (
    <div ref={ref}>
      <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight text-brand-deep">
        <FileText className="h-5 w-5 text-gold" /> {label}
      </h2>
      <div className="mt-4 h-[72vh] overflow-hidden rounded-2xl border border-brand-deep/10 bg-white shadow-luxe">
        <iframe src={src} title={label} loading="lazy" className="h-full w-full" />
      </div>
      <p className="mt-2 text-center text-xs text-brand-deep/45">
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
          Open full screen ↗
        </a>
      </p>
    </div>
  )
}

export function BrochureView({ brochureId, assets }: { brochureId: string; assets: BrochureAssets }) {
  // Log the page open once on mount.
  useEffect(() => {
    track(brochureId, 'page')
  }, [brochureId])

  const mapRef = useTrackInView(brochureId, 'map')
  const videoRef = useTrackInView(brochureId, 'video')
  const embed = assets.videoUrl ? toEmbed(assets.videoUrl) : null
  const firstName = (assets.name || '').split(' ')[0]

  return (
    <main className="min-h-screen bg-ivory pb-20 pt-28 md:pt-32">
      <div className="container max-w-3xl">
        <p className="eyebrow text-gold">Lateef Properties</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-brand-deep md:text-5xl">
          {assets.headline || 'Your personalised brochure'}
        </h1>
        {firstName && (
          <p className="mt-4 text-base leading-relaxed text-brand-deep/70 md:text-lg">
            Hi {firstName}, everything you asked about — in one place. Brochures, location and a walkthrough below.
          </p>
        )}

        {/* PDFs — previewed inline (no download needed) */}
        {(assets.pdf1 || assets.pdf2) && (
          <section className="mt-10 space-y-10">
            {[
              { url: assets.pdf1, label: 'Project Brochure', asset: 'pdf1' as const },
              { url: assets.pdf2, label: 'Payment Plan & Details', asset: 'pdf2' as const },
            ]
              .filter((p) => p.url)
              .map((p) => (
                <PdfPreview
                  key={p.asset}
                  brochureId={brochureId}
                  url={p.url as string}
                  label={p.label}
                  asset={p.asset}
                />
              ))}
          </section>
        )}

        {/* Video */}
        {embed && (
          <section ref={videoRef} className="mt-10">
            <h2 className="font-serif text-2xl tracking-tight text-brand-deep">Walkthrough</h2>
            <div className="mt-4 aspect-video overflow-hidden rounded-2xl shadow-luxe">
              <iframe
                src={embed}
                title="Walkthrough video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </section>
        )}

        {/* Map */}
        {assets.mapEmbed && (
          <section ref={mapRef} className="mt-10">
            <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight text-brand-deep">
              <MapPin className="h-5 w-5 text-gold" /> Location
            </h2>
            <div className="mt-4 aspect-[16/10] overflow-hidden rounded-2xl border border-brand-deep/10 shadow-luxe-sm">
              <iframe
                src={assets.mapEmbed}
                title="Location map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full"
              />
            </div>
          </section>
        )}

        {/* WhatsApp CTA */}
        <section className="mt-12 rounded-2xl border border-brand-deep/10 bg-white p-8 text-center shadow-luxe-sm">
          <p className="eyebrow text-gold">Questions?</p>
          <h2 className="mt-3 font-serif text-2xl tracking-tight text-brand-deep">
            Talk to a senior advisor.
          </h2>
          <div className="mt-6">
            <WhatsAppLink
              href={`https://wa.me/${(assets.whatsapp || '923363528333').replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in ${assets.headline || 'the properties'}.`)}`}
              project={assets.headline || 'brochure'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-deep px-7 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-white transition-all hover:-translate-y-0.5 hover:bg-gold hover:text-brand-deep"
            >
              Chat on WhatsApp
            </WhatsAppLink>
          </div>
        </section>
      </div>
    </main>
  )
}
