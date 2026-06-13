'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import type { Media } from '@/payload-types'
import { SectionRule } from '@/components/landing/SectionRule'
import { imageUrl, imageAlt } from '@/lib/featured-projects'

export type GalleryRow = {
  image: number | Media | null | undefined
  caption?: string | null
}

type Props = {
  photos: GalleryRow[] | null | undefined
  itemTitle: string
  sectionNumber?: string
  heading?: string
}

export function PhotoGallerySection({
  photos,
  itemTitle,
  sectionNumber = '03 / GALLERY',
  heading = 'See it for yourself',
}: Props) {
  const rows = (photos ?? []).filter((r) => !!r?.image)
  const [open, setOpen] = useState<number | null>(null)

  if (!rows.length) return null

  const current = open != null ? rows[open] : null
  const next = () => setOpen((i) => (i == null ? null : (i + 1) % rows.length))
  const prev = () => setOpen((i) => (i == null ? null : (i - 1 + rows.length) % rows.length))

  return (
    <section className="bg-ivory py-20 md:py-28">
      <div className="container">
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              {sectionNumber}
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl">
            {heading}
          </h2>
          <SectionRule className="mt-6" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, i) => {
            const src = imageUrl(row.image)
            const alt = row.caption || imageAlt(row.image, `${itemTitle} ${i + 1}`)
            if (!src) return null
            return (
              <button
                key={`gallery-${i}`}
                onClick={() => setOpen(i)}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl shadow-luxe-sm transition-shadow duration-500 hover:shadow-luxe"
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-deep/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {row.caption && (
                  <span className="absolute bottom-3 left-3 right-3 rounded-md bg-brand-deep/70 px-3 py-1.5 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                    {row.caption}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <AnimatePresence>
          {current && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[80] flex items-center justify-center bg-brand-deep/95 p-4 backdrop-blur-sm"
              onClick={() => setOpen(null)}
              role="dialog"
              aria-modal="true"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(null)
                }}
                aria-label="Close gallery"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-gold hover:text-gold"
              >
                <X className="h-4 w-4" />
              </button>
              {rows.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      prev()
                    }}
                    aria-label="Previous photo"
                    className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-gold hover:text-gold sm:left-8"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      next()
                    }}
                    aria-label="Next photo"
                    className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-gold hover:text-gold sm:right-8"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <motion.div
                key={open}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative max-h-[85vh] w-full max-w-5xl"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={imageUrl(current.image) ?? ''}
                  alt={current.caption || itemTitle}
                  width={1920}
                  height={1280}
                  className="h-auto max-h-[85vh] w-full rounded-2xl object-contain"
                />
                {current.caption && (
                  <p className="mt-3 text-center text-sm text-white/80">{current.caption}</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
