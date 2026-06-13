'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Play } from 'lucide-react'
import { SectionRule } from '@/components/landing/SectionRule'
import { parseVideoUrl } from '@/lib/property-listings'

type Props = {
  url: string | null | undefined
  itemTitle: string
}

export function ListingWalkthroughVideo({ url, itemTitle }: Props) {
  const [open, setOpen] = useState(false)
  const parsed = parseVideoUrl(url)
  if (!parsed) return null

  const thumb =
    parsed.provider === 'youtube'
      ? `https://img.youtube.com/vi/${parsed.id}/hqdefault.jpg`
      : `https://vumbnail.com/${parsed.id}.jpg`

  const embed =
    parsed.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${parsed.id}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${parsed.id}?autoplay=1`

  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="container">
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] tracking-[0.3em] text-gold">
              02 / WALK-THROUGH
            </span>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-brand-deep text-balance md:text-5xl">
            Step inside.
          </h2>
          <SectionRule className="mt-6" />
        </div>

        <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-brand-deep/10 shadow-luxe">
          {open ? (
            <iframe
              src={embed}
              title={`Walk-through of ${itemTitle}`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              width={1920}
              height={1080}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Play walk-through of ${itemTitle}`}
              className="group absolute inset-0 h-full w-full"
            >
              <Image
                src={thumb}
                alt={`${itemTitle} walk-through preview`}
                fill
                sizes="(min-width: 1024px) 1000px, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/55 via-brand-deep/15 to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gold text-brand-deep shadow-gold transition-transform duration-300 group-hover:scale-110">
                  <Play className="h-7 w-7 translate-x-0.5" strokeWidth={2} fill="currentColor" />
                </span>
              </span>
              <span className="absolute bottom-5 left-5 rounded-md bg-brand-deep/70 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.25em] text-white backdrop-blur-sm">
                Tap to play
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
