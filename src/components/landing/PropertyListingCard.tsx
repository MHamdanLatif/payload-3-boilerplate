'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, BedDouble, MapPin } from 'lucide-react'
import type { PropertyListing } from '@/payload-types'
import { listingHeroImage, imageAlt, getSocietyOrProject } from '@/lib/property-listings'
import { formatPkr } from '@/lib/featured-projects'
import { InquiryModal } from '@/components/shared/InquiryModal'
import { fadeUp } from './_motion'

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80&auto=format&fit=crop'

const STATUS_TONE: Record<string, string> = {
  'Ready for Possession': 'bg-gold text-brand-deep',
  Resale: 'bg-white/15 text-white border border-white/30 backdrop-blur-sm',
  'Urgent Sale': 'bg-[#c25b3a] text-white',
}

export function PropertyListingCard({ listing }: { listing: PropertyListing }) {
  const [open, setOpen] = useState(false)
  const src = listingHeroImage(listing) ?? PLACEHOLDER
  const alt = imageAlt(listing.mainImage, listing.title)
  const society = getSocietyOrProject(listing)
  const href = `/listings/${listing.slug}`
  const statusTone = STATUS_TONE[listing.status ?? ''] ?? 'bg-gold text-brand-deep'

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

          {listing.status && (
            <span
              className={
                'absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] shadow-sm ' +
                statusTone
              }
            >
              <span className="h-1 w-1 rounded-full bg-current" />
              {listing.status}
            </span>
          )}

          {listing.propertyType && (
            <span className="absolute right-5 top-5 rounded-full bg-white/15 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.25em] text-white backdrop-blur-sm">
              {listing.propertyType}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <h3 className="font-serif text-2xl leading-tight tracking-tight">
              {listing.title}
            </h3>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="h-3.5 w-3.5" />
              {listing.location}
            </p>
          </div>
        </Link>

        <div className="flex flex-1 flex-col gap-4 p-5">
          {society && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em] text-brand-deep">
              {society}
            </span>
          )}

          <div className="grid grid-cols-2 gap-3 border-b border-dashed border-border pb-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/55">
                Price
              </p>
              <p className="mt-1 font-serif text-lg text-brand-deep">
                {formatPkr(listing.price)}
              </p>
            </div>
            {listing.rooms != null && (
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-brand-deep/55">
                  Rooms
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 font-serif text-lg text-brand-deep">
                  <BedDouble className="h-4 w-4 text-gold" />
                  {listing.rooms}
                </p>
              </div>
            )}
          </div>

          {listing.summary && (
            <p className="text-sm leading-relaxed text-brand-deep/70 line-clamp-3">
              {listing.summary}
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
              View Details
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.article>

      <InquiryModal
        open={open}
        onClose={() => setOpen(false)}
        sourceName={listing.title}
        sourceSlug={listing.slug ?? ''}
        sourceKind="listing"
      />
    </>
  )
}
