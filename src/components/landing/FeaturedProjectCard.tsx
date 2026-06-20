'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, BedDouble, MapPin } from 'lucide-react'
import type { FeaturedProject } from '@/payload-types'
import { heroImage, imageAlt, formatPkr, smallestUnit } from '@/lib/featured-projects'
import { InquiryModal } from '@/components/shared/InquiryModal'
import { HighlightBadge, type HighlightTag } from './HighlightBadge'
import { fadeUp } from './_motion'

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1400&q=80&auto=format&fit=crop'

export function FeaturedProjectCard({ project }: { project: FeaturedProject }) {
  const [open, setOpen] = useState(false)
  const src = heroImage(project) ?? PLACEHOLDER
  const alt = imageAlt(project.elevationImages?.[0]?.image, project.title)
  const small = smallestUnit(project)
  const href = `/projects/${project.slug}`

  return (
    <>
      <motion.article
        variants={fadeUp}
        className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-luxe-sm ring-1 ring-border/60 transition-shadow duration-500 hover:shadow-luxe"
      >
        <Link href={href} className="relative aspect-[4/5] overflow-hidden">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/80 via-brand-deep/15 to-transparent" />

          <div className="absolute left-5 top-5 z-10 flex flex-col items-start gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-brand-deep shadow-sm">
              <span className="h-1 w-1 rounded-full bg-brand-deep" />
              {project.status}
            </span>
            {project.highlightTag && (
              <HighlightBadge tag={project.highlightTag as HighlightTag} />
            )}
          </div>

          {project.builderName && (
            <span className="absolute right-5 top-5 rounded-full bg-white/15 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.25em] text-white backdrop-blur-sm">
              {project.builderName}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <h3 className="font-serif text-2xl leading-tight tracking-tight">
              {project.title}
            </h3>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="h-3.5 w-3.5" />
              {project.location}
            </p>
          </div>
        </Link>

        <div className="flex flex-1 flex-col gap-4 p-5">
          {(project.startingPrice || small) && (
            <div className="grid grid-cols-2 gap-3 border-b border-dashed border-border pb-4">
              {project.startingPrice && (
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/55">
                    Starting from
                  </p>
                  <p className="mt-1 font-serif text-lg text-brand-deep">
                    {formatPkr(project.startingPrice)}
                  </p>
                </div>
              )}
              {small && (
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/55">
                    Starting From
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 font-serif text-lg text-brand-deep">
                    <BedDouble className="h-4 w-4 text-gold" />
                    {small.type}
                  </p>
                </div>
              )}
            </div>
          )}

          {project.summary && (
            <p className="text-sm leading-relaxed text-brand-deep/70 line-clamp-3">
              {project.summary}
            </p>
          )}

          <div className="mt-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-gold hover:text-brand-deep"
            >
              Send Inquiry
            </button>
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-deep/20 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-deep transition-all duration-300 hover:border-brand-deep hover:bg-brand-deep hover:text-white"
            >
              View Project
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.article>

      <InquiryModal
        open={open}
        onClose={() => setOpen(false)}
        sourceName={project.title}
        sourceSlug={project.slug ?? ''}
        sourceKind="project"
      />
    </>
  )
}
