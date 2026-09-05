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

type WithResolvers = {
  withResolvers?: <T>() => {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: unknown) => void
  }
}

/**
 * Define structuredClone where the engine is too old to provide it.
 *
 * Chrome 98 / Safari 15.4, so roughly 2022 — newer than a fair number of phones
 * still in use. Without it pdf.js renders a couple of pages and then stops, or
 * fails outright, depending on what else is missing.
 *
 * Deliberately covers only what pdf.js passes through it: plain objects, arrays,
 * typed arrays and buffers, Map, Set, Date, RegExp, and cycles. It is not a
 * complete implementation — Blob, File and transferables are not handled,
 * because nothing in this path uses them.
 */
function ensureStructuredClone(): void {
  // Typed loosely on purpose: the real signature is generic, and assigning a
  // runtime shim to it is not something the DOM lib types allow directly.
  const w = window as unknown as { structuredClone?: (v: unknown) => unknown }
  if (typeof w.structuredClone === 'function') return

  const clone = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
    if (value === null || typeof value !== 'object') return value
    const obj = value as object
    const hit = seen.get(obj)
    if (hit !== undefined) return hit

    if (ArrayBuffer.isView(obj)) {
      const view = obj as unknown as Uint8Array
      const copy = new (obj.constructor as typeof Uint8Array)(
        view.buffer.slice(0) as ArrayBuffer,
        view.byteOffset,
        view.length,
      )
      seen.set(obj, copy)
      return copy
    }
    if (obj instanceof ArrayBuffer) {
      const copy = obj.slice(0)
      seen.set(obj, copy)
      return copy
    }
    if (obj instanceof Date) return new Date(obj.getTime())
    if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags)
    if (obj instanceof Map) {
      const copy = new Map()
      seen.set(obj, copy)
      obj.forEach((v, k) => copy.set(clone(k, seen), clone(v, seen)))
      return copy
    }
    if (obj instanceof Set) {
      const copy = new Set()
      seen.set(obj, copy)
      obj.forEach((v) => copy.add(clone(v, seen)))
      return copy
    }
    if (Array.isArray(obj)) {
      const copy: unknown[] = []
      seen.set(obj, copy)
      for (const v of obj) copy.push(clone(v, seen))
      return copy
    }
    // Anything that is not a PLAIN object is passed through by reference.
    // pdf.js hands ImageBitmaps through structuredClone, and deep-copying one
    // into a bag of properties produces an object canvas.drawImage rejects —
    // which showed up as the render dying two pages in. Real structuredClone
    // would transfer these; within one thread, sharing them is equivalent.
    const proto = Object.getPrototypeOf(obj)
    if (proto !== Object.prototype && proto !== null) return obj

    const copy: Record<string, unknown> = {}
    seen.set(obj, copy)
    for (const [k, v] of Object.entries(obj)) copy[k] = clone(v, seen)
    return copy
  }

  w.structuredClone = (value: unknown) => clone(value, new WeakMap())
}

/** Define Promise.withResolvers where the engine is too old to provide it. */
function ensurePromiseWithResolvers(): void {
  const P = Promise as unknown as WithResolvers
  if (typeof P.withResolvers === 'function') return
  P.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

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
        // MUST run before pdf.js is evaluated.
        //
        // pdf.js 6 calls Promise.withResolvers, which only arrived in Chrome 119
        // (late 2023) and Safari 17.4. Plenty of Android phones — Samsung
        // Internet especially, which trails Chrome by a long way — do not have
        // it, and the whole viewer dies with "Promise.withResolvers is not a
        // function". Desktop never saw it, which is exactly how this shipped.
        //
        // The legacy build does not help: it calls it too.
        ensurePromiseWithResolvers()
        ensureStructuredClone()

        // Loaded on demand: pdf.js is large, and a lead who never scrolls to the
        // brochure should not pay for it. The legacy build is used for the same
        // reason as the polyfill — these pages are opened on whatever phone the
        // buyer happens to own, not on a current browser.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
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

      {/* Last resort. Drawing the brochure in the page is what keeps reading it
          visible to us, but that is OUR benefit — it must never cost the buyer
          the brochure itself. Any engine too old for the viewer still gets the
          real file, opened by the device, exactly as it worked before.
          We lose the in-page dwell signal for these few; the open is still
          recorded, because the link goes through our own proxy route. */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <FileText className="h-8 w-8 text-gold" />
          <p className="font-serif text-lg text-brand-deep">{label}</p>
          <p className="text-sm text-brand-deep/60">
            Your browser can&rsquo;t show this here.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 rounded-full bg-brand-deep px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-gold hover:text-brand-deep"
          >
            Open brochure
          </a>
        </div>
      )}

      {/* One template string rather than an expression sitting next to text:
          the JSX form rendered as "8pages", losing the space between them. */}
      {status === 'ready' && pageCount > 1 && (
        <p className="mt-2 text-center text-xs text-brand-deep/45">
          {`${pageCount} pages · scroll to read`}
        </p>
      )}
    </div>
  )
}
