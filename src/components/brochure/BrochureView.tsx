'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, MapPin, Loader2 } from 'lucide-react'
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

/** POST a tracking payload in a way that survives the page going away. */
function beacon(url: string, payload: unknown) {
  try {
    const body = JSON.stringify(payload)
    // sendBeacon survives navigation; fall back to keepalive fetch.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    } else {
      void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
    }
  } catch {
    /* tracking must never break the page */
  }
}

function track(brochureId: string, asset: Asset) {
  beacon(`/api/brochure/${brochureId}/open`, { asset })
}

/**
 * Measures how long the brochure is actually in front of the lead.
 *
 * Counts foreground time only — visibilitychange pauses the clock, so a tab
 * left open in the background never reads as engagement. Reports the running
 * total on a heartbeat as well as on hide/unload, because mobile browsers
 * routinely discard a page without firing a final unload; the server keeps the
 * largest value it receives, so the repeat sends are harmless.
 */
function useDwellTracking(brochureId: string, visitId: string | null) {
  useEffect(() => {
    if (!visitId) return

    let visibleMs = 0
    let since = Date.now()
    let reported = 0

    const settle = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') visibleMs += now - since
      since = now
    }

    const report = () => {
      settle()
      const ms = Math.round(visibleMs)
      // Only send real growth — keeps the heartbeat silent on a hidden tab.
      if (ms < 1000 || ms <= reported) return
      reported = ms
      beacon(`/api/brochure/${brochureId}/dwell`, { visitId, ms })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report()
      else since = Date.now()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', report)
    const heartbeat = window.setInterval(report, 15_000)

    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', report)
      report()
    }
  }, [brochureId, visitId])
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
 * Inline PDF preview.
 *
 * Previously rendered through Google's `docs.google.com/gview` viewer, chosen
 * because Android Chrome downloads a PDF rather than displaying it in a bare
 * iframe. That endpoint is deprecated and now fails often: when it does the
 * browser receives something it cannot display inline and offers to save a file
 * literally named "gview", while the iframe's load event never fires, so the
 * loader spun forever. Meanwhile "open full screen" worked instantly, because
 * it hit the PDF directly and skipped Google altogether.
 *
 * Now the PDF is served straight from our own R2 URL and rendered by the
 * browser's own viewer. `navigator.pdfViewerEnabled` is the standard way to ask
 * whether that will actually work — true in desktop Chrome, Firefox, Edge and
 * Safari; false on Android Chrome, which is exactly the case gview existed for.
 *
 * Where inline rendering is unavailable we do not pretend: the lead gets a
 * clear card that opens the brochure in their device's own PDF reader, which
 * handles it far better than any embed would.
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
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [show, setShow] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  // null = not yet determined (server render / before hydration)
  const [canInline, setCanInline] = useState<boolean | null>(null)

  useEffect(() => {
    // Feature detection rather than user-agent sniffing. Older browsers do not
    // expose the property; a wide viewport is a reasonable stand-in there.
    const nav = navigator as Navigator & { pdfViewerEnabled?: boolean }
    setCanInline(
      typeof nav.pdfViewerEnabled === 'boolean'
        ? nav.pdfViewerEnabled
        : window.matchMedia('(min-width: 1024px)').matches,
    )
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShow(true) // mount the viewer a little before it is on screen
            track(brochureId, asset) // engagement
            io.disconnect()
            break
          }
        }
      },
      { rootMargin: '500px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [brochureId, asset])

  // A spinner with no exit is worse than no spinner. If the viewer has not
  // reported itself ready, surface the direct link rather than leaving a lead
  // watching it turn.
  useEffect(() => {
    if (!show || loaded || canInline === false) return
    const t = window.setTimeout(() => setSlow(true), 6000)
    return () => window.clearTimeout(t)
  }, [show, loaded, canInline])

  const inline = canInline !== false

  return (
    <div>
      <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight text-brand-deep">
        <FileText className="h-5 w-5 text-gold" /> {label}
      </h2>
      <div
        ref={wrapRef}
        className={`relative mt-4 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white shadow-luxe ${
          inline ? 'h-[72vh]' : ''
        }`}
      >
        {inline ? (
          <>
            {show && (
              <iframe
                src={url}
                title={label}
                onLoad={() => setLoaded(true)}
                className={`h-full w-full transition-opacity duration-500 ${
                  loaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}
            {(!show || !loaded) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                {slow ? (
                  <>
                    <FileText className="h-7 w-7 text-gold" />
                    <p className="text-sm text-brand-deep/70">
                      The preview is taking a while to load.
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 rounded-full bg-brand-deep px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-gold hover:text-brand-deep"
                    >
                      Open the brochure
                    </a>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-gold" />
                    <p className="text-sm text-brand-deep/65">Loading brochure…</p>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          // Device cannot display a PDF inline. Offer the real thing instead of
          // an embed that would silently download.
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(brochureId, asset)}
            className="flex flex-col items-center gap-3 px-6 py-12 text-center transition-colors hover:bg-cream/40"
          >
            <FileText className="h-9 w-9 text-gold" />
            <span className="font-serif text-lg text-brand-deep">{label}</span>
            <span className="text-sm text-brand-deep/60">
              Tap to open the full brochure
            </span>
            <span className="mt-2 rounded-full bg-brand-deep px-5 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white">
              Open brochure
            </span>
          </a>
        )}
      </div>
      {inline && (
        <p className="mt-2 text-center text-xs text-brand-deep/45">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gold"
          >
            Open full screen ↗
          </a>
        </p>
      )}
    </div>
  )
}

export function BrochureView({
  brochureId,
  visitId = null,
  assets,
}: {
  brochureId: string
  visitId?: string | null
  assets: BrochureAssets
}) {
  // The page-open event is logged server-side on render (reliable on iOS, where
  // client beacons are not). Only asset engagement and time-on-page are tracked
  // from the client — visitId ties the latter back to that server-logged open.
  useDwellTracking(brochureId, visitId)
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
