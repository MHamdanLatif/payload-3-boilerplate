'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'

/**
 * Renders a PDF onto canvases, in the page.
 *
 * Every previous approach handed the file to something outside our control and
 * lost the lead in the process. Google's `gview` was deprecated and started
 * offering to save a file named "gview". A bare `<iframe>` works on desktop but
 * Android Chrome downloads the PDF instead of showing it, and even where the
 * iframe does work the browser's own PDF toolbar carries a download button.
 *
 * That mattered more than it looked: a brochure saved to the device is read
 * offline, as many times as the buyer likes, and none of it is visible to us.
 * The re-open alerts and the time-on-page figures — the whole reason these pages
 * are personalised and tracked — quietly stop reflecting reality.
 *
 * Drawing the pages ourselves keeps the brochure on the page, so reading it is
 * a visit. It also renders identically everywhere, which the previous split
 * between desktop and Android never did.
 *
 * This is NOT DRM and does not pretend to be: the bytes reach the browser, so
 * anyone determined can still retrieve them. It removes the one-tap path that
 * every ordinary reader would otherwise take.
 */

/** Cap the backing-store resolution. Retina looks sharp; 3x only costs memory. */
const MAX_DPR = 2

type Status = 'idle' | 'loading' | 'ready' | 'error'

export function PdfCanvas({
  url,
  label,
  onFirstPageRendered,
}: {
  url: string
  label: string
  onFirstPageRendered?: () => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return

    // Captured as a non-null local so the async closure below does not have to
    // re-read a ref that TypeScript cannot prove is still set.
    const target = host

    async function render() {
      setStatus('loading')
      try {
        // Loaded on demand: pdf.js is large, and a lead who never scrolls to the
        // brochure should not pay for it.
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()

        const doc = await pdfjs.getDocument({ url }).promise
        if (cancelled) return
        setPageCount(doc.numPages)

        // Measured once, off the host element, so the pages match the column
        // they sit in rather than the viewport.
        const cssWidth = target.clientWidth || 600
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)

        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr })

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          canvas.className = 'border-b border-brand-deep/10 last:border-b-0'
          // Decorative in the accessibility sense — the brochure's content is
          // also delivered by an advisor, and a canvas cannot expose its text.
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `${label}, page ${n} of ${doc.numPages}`)

          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('canvas unavailable')
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          if (cancelled) return

          target.appendChild(canvas)
          if (n === 1) {
            setStatus('ready')
            onFirstPageRendered?.()
          }
        }
      } catch (e) {
        if (cancelled) return
        console.warn('[brochure] pdf render failed:', (e as Error)?.message)
        setStatus('error')
      }
    }

    void render()
    return () => {
      cancelled = true
    }
    // Re-rendering on prop change would duplicate canvases; the URL is stable
    // for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return (
    <div>
      <div ref={hostRef} className="overflow-hidden rounded-2xl bg-white" />

      {status !== 'ready' && status !== 'error' && (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <p className="text-sm text-brand-deep/60">Loading the brochure…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <FileText className="h-7 w-7 text-gold" />
          <p className="text-sm text-brand-deep/70">
            The brochure could not be displayed here.
          </p>
          <p className="text-xs text-brand-deep/50">
            Message us on WhatsApp and an advisor will send it across.
          </p>
        </div>
      )}

      {status === 'ready' && pageCount > 1 && (
        <p className="mt-2 text-center text-xs text-brand-deep/45">
          {pageCount} pages &middot; scroll to read
        </p>
      )}
    </div>
  )
}
